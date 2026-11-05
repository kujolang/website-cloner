import { packageProject } from '../engine/recovery.mjs';
import {readJSON} from '../engine/json.mjs';
// Targeted metadata repair: preserve immutable visual measurements since body/CSS do not change.
import { readFile, writeFile, copyFile, rm } from "node:fs/promises";
import path from "node:path";
import { load } from "cheerio";
import { verify } from "../engine/verify.mjs";
import { json } from "../engine/pipeline.mjs";
const base = path.resolve("artifacts/evaluation");
const rows = JSON.parse(await readFile(path.join(base, "evaluation.json")));
for (const row of rows) {
  if (!row.metrics) throw Error(row.name + " has no completed report");
  const dir = path.join(base, row.name),
    project = path.join(dir, "project");
  const file = path.join(project, "templates/layout.html");
  let layout = await readFile(file, "utf8");
  layout = layout.replace(
    "<title>{{page_title}}</title>",
    "<title>{{seo_title}}</title>",
  );
  await writeFile(file, layout);
  await copyFile(
    "scripts/build-export.mjs",
    path.join(project, "scripts/build.mjs"),
  );
  await run(process.execPath, ["scripts/build.mjs"], {
    cwd: project,
    timeout: 150000,
  });
  const routes = JSON.parse(await readFile(path.join(project, "routes.json")));
  for (const p of row.pages) {
    const route = routes.find((x) => x.route === p.route);
    const html = await readFile(
      path.join(
        project,
        "output",
        p.route.endsWith("/") ? p.route + "index.html" : p.route,
      ),
      "utf8",
    );
    p.title = load(html)("title").text() === route.title;
    if (!p.title) throw Error("Title repair failed " + p.route);
  }
  const model = await readJSON(path.join(project, "site-model.json"));
  const checked = await verify(model, project, path.join(dir, "evidence"));
  row.pages = checked.pages;
  row.visual = checked.visual;
  row.checks = checked.checks;
  row.status = checked.status;
  row.finalValidationMs = checked.metrics.verificationMs;
  row.metadataRepair = {
    change: "Use native seo_title token to avoid duplicate site-title suffix",
    verified: true,
    bodyUnchanged: true,
  };
  await json(path.join(dir, "report.json"), row);
  await json(path.join(project, "migration-report.json"), row);
  await rm(path.join(project, ".ssg-output"), { recursive: true, force: true });
  for (const d of [".ssg-content", ".ssg-templates"])
    await rm(path.join(project, d), { recursive: true, force: true });
  for (const route of routes)
    await rm(path.join(project, "content/pages", route.slug + ".md"), {
      force: true,
    });
  await packageProject(dir);
  console.log(row.name, row.status);
}
await json(path.join(base, "evaluation.json"), rows);
console.log("Rebuilt and verified title metadata for all five exports.");
