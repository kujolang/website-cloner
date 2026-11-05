import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  publishGithub,
  checkGithub,
  publishCloudflare,
  prepare,
} from "../engine/deployment.mjs";
test("GitHub adapter realistic REST transaction preserves base tree and never force pushes", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "return-deploy-"));
  await mkdir(path.join(dir, "output"));
  await writeFile(path.join(dir, "output/index.html"), "<h1>Site</h1>");
  const calls = [];
  const fetcher = async (url, o) => {
    const b = o.body ? JSON.parse(o.body) : null;
    calls.push({ url, method: o.method, body: b });
    let data = { sha: "new" };
    if (url.endsWith("/repos/owner/site")) data = { default_branch: "main" };
    if (url.includes("/git/ref/heads/")) data = { object: { sha: "parent" } };
    if (url.includes("/git/commits/parent"))
      data = { tree: { sha: "oldtree" } };
    if (url.endsWith("/pages"))
      data = { status: "built", html_url: "https://owner.github.io/site/" };
    return new Response(JSON.stringify(data), { status: 200 });
  };
  try {
    await assert.rejects(
      publishGithub(dir, {
        repository: "owner/site",
        token: "fixture",
        fetcher,
      }),
    );
    const r = await publishGithub(dir, {
      repository: "owner/site",
      token: "fixture",
      confirmed: true,
      fetcher,
    });
    assert.equal(r.status, "queued");
    assert.equal(r.liveVerified, false);
    assert.equal(
      calls.find((c) => c.url.endsWith("/git/trees")).body.base_tree,
      "oldtree",
    );
    assert.equal(calls.find((c) => c.method === "PATCH").body.force, false);
    assert(calls.some((c) => c.url.endsWith("/dispatches")));
    assert.equal(
      (
        await checkGithub({
          repository: "owner/site",
          token: "fixture",
          fetcher,
        })
      ).status,
      "built",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("provider failures surface; Cloudflare requires explicit credentials", async () => {
  await assert.rejects(
    publishGithub(".", {
      repository: "owner/site",
      confirmed: true,
      token: "fixture",
      fetcher: async () => new Response("", { status: 403 }),
    }),
    /403/,
  );
  await assert.rejects(publishCloudflare(".", { project: "site" }));
  let args;
  const r = await publishCloudflare(".", {
    project: "site",
    accountId: "fixture",
    token: "fixture",
    confirmed: true,
    runner: async (a) => {
      args = a;
      return "fixture response";
    },
  });
  assert.equal(args[0], "pages");
  assert.equal(r.liveVerified, false);
  assert.equal(
    (await prepare(".", { provider: "github", repository: "owner/site" }))
      .status,
    "prepared",
  );
});
