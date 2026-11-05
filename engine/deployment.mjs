import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
export function target(provider, options = {}) {
  if (!["github", "cloudflare", "zip"].includes(provider))
    throw Error("Unknown provider");
  if (
    provider === "github" &&
    !/^[\w.-]+\/[\w.-]+$/.test(options.repository || "")
  )
    throw Error("Expected owner/repository");
  if (provider === "cloudflare" && !/^[a-z0-9-]+$/.test(options.project || ""))
    throw Error("Expected Cloudflare project");
  return { provider, ...options };
}
export async function prepare(project, spec) {
  target(spec.provider, spec);
  const instructions =
    spec.provider === "github"
      ? `Build with SITE_URL=https://${spec.repository.split("/")[0]}.github.io/${spec.repository.split("/")[1]} BASE_PATH=/${spec.repository.split("/")[1]} npm run build. Enable GitHub Pages with GitHub Actions, then upload output/ using actions/upload-pages-artifact and actions/deploy-pages.`
      : spec.provider === "cloudflare"
        ? "Run npm run build, then npx wrangler pages deploy output --project-name " +
          spec.project
        : "Upload output/ to a static host; keep source project privately.";
  return {
    provider: spec.provider,
    status: "prepared",
    instructions,
    requiresAuthorization: spec.provider !== "zip",
    liveVerified: false,
  };
}
export async function publishGithub(
  project,
  {
    repository,
    token,
    confirmed = false,
    fetcher = fetch,
    api = "https://api.github.com",
  },
) {
  target("github", { repository });
  if (!confirmed || !token)
    throw Error(
      "Explicit publish confirmation and a GitHub token are required",
    );
  const request = async (route, method = "GET", body) => {
    const r = await fetcher(api + route, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "content-type": "application/json",
        "x-github-api-version": "2022-11-28",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) throw Error(`GitHub ${method} ${r.status}`);
    return r.status === 204 ? {} : r.json();
  };
  const repo = "/repos/" + repository;
  const meta = await request(repo);
  const ref = await request(repo + "/git/ref/heads/" + meta.default_branch);
  const commit = await request(repo + "/git/commits/" + ref.object.sha);
  const tree = [];
  async function files(dir, prefix = "") {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      if (e.isSymbolicLink()) throw Error("Symlink in export");
      if (e.isDirectory())
        await files(path.join(dir, e.name), prefix + e.name + "/");
      else {
        const blob = await request(repo + "/git/blobs", "POST", {
          encoding: "base64",
          content: (await readFile(path.join(dir, e.name))).toString("base64"),
        });
        tree.push({
          path: "migrated-site/" + prefix + e.name,
          mode: "100644",
          type: "blob",
          sha: blob.sha,
        });
      }
    }
  }
  await files(path.join(project, "output"));
  const workflow = `name: Publish migrated site\non: workflow_dispatch\npermissions:\n  contents: read\n  pages: write\n  id-token: write\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    environment:\n      name: github-pages\n      url: \${{ steps.deployment.outputs.page_url }}\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/configure-pages@v5\n      - uses: actions/upload-pages-artifact@v3\n        with:\n          path: migrated-site\n      - uses: actions/deploy-pages@v4\n        id: deployment\n`;
  const blob = await request(repo + "/git/blobs", "POST", {
    encoding: "utf-8",
    content: workflow,
  });
  tree.push({
    path: ".github/workflows/migrated-pages.yml",
    mode: "100644",
    type: "blob",
    sha: blob.sha,
  });
  const t = await request(repo + "/git/trees", "POST", {
    base_tree: commit.tree.sha,
    tree,
  });
  const c = await request(repo + "/git/commits", "POST", {
    message: "Add migrated static website",
    tree: t.sha,
    parents: [ref.object.sha],
  });
  await request(repo + "/git/refs/heads/" + meta.default_branch, "PATCH", {
    sha: c.sha,
    force: false,
  });
  await request(
    repo + "/actions/workflows/migrated-pages.yml/dispatches",
    "POST",
    { ref: meta.default_branch },
  );
  return {
    provider: "github",
    status: "queued",
    commit: c.sha,
    repository,
    liveVerified: false,
  };
}
export async function checkGithub({
  repository,
  token,
  fetcher = fetch,
  api = "https://api.github.com",
}) {
  target("github", { repository });
  const r = await fetcher(`${api}/repos/${repository}/pages`, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw Error(`GitHub Pages status ${r.status}`);
  const data = await r.json();
  return {
    provider: "github",
    status: data.status,
    url: data.html_url,
    providerReportedReady: data.status === "built",
    liveVerified: false,
  };
}
export async function publishCloudflare(
  project,
  { project: projectName, token, accountId, confirmed = false, runner },
) {
  target("cloudflare", { project: projectName });
  if (!confirmed || !token || !accountId)
    throw Error("Explicit confirmation and Cloudflare configuration required");
  if (!runner)
    throw Error(
      "Provide a pinned installed Wrangler runner; shell installation is never automatic",
    );
  const r = await runner(
    [
      "pages",
      "deploy",
      path.join(project, "output"),
      "--project-name",
      projectName,
    ],
    { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: accountId },
  );
  return {
    provider: "cloudflare",
    status: "submitted",
    diagnostics: r,
    liveVerified: false,
  };
}
export async function checkCloudflare({
  project,
  accountId,
  token,
  fetcher = fetch,
}) {
  target("cloudflare", { project });
  if (!/^[a-f0-9]{32}$/i.test(accountId)) throw Error("Invalid account ID");
  const r = await fetcher(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${project}/deployments`,
    {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!r.ok) throw Error(`Cloudflare ${r.status}`);
  const data = await r.json();
  if (!data.success) throw Error("Cloudflare rejected status request");
  const d = data.result?.[0];
  return {
    provider: "cloudflare",
    status: d?.latest_stage?.status || "unknown",
    url: d?.url,
    providerReportedReady: d?.latest_stage?.status === "success",
    liveVerified: false,
  };
}
export const deploymentReport = (result) => ({
  ...result,
  reportedAt: new Date().toISOString(),
  note: result.liveVerified
    ? "Provider reported deployment ready; review the published URL."
    : "Live deployment has not been verified.",
});
