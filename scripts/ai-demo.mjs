import {readJSON} from '../engine/json.mjs';
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { reconstruct } from "../engine/reconstruct.mjs";
import { generate } from "../engine/generate.mjs";
import { json, run } from "../engine/pipeline.mjs";
if (!process.env.AI_ENDPOINT || !process.env.AI_MODEL)
  throw Error("Set AI_ENDPOINT and AI_MODEL");
const dir = path.resolve(process.argv[2] || "artifacts/evaluation/gutenberg");
const model = await readJSON(path.join(dir, "project/site-model.json"));
const before = { ...model.metrics };
const started = Date.now();
await reconstruct(model, { screenshotDir: path.join(dir, "evidence/source") });
await generate(model, path.join(dir, "project"));
await run(process.execPath, ["scripts/build.mjs"], {
  cwd: path.join(dir, "project"),
  timeout: 150000,
});
await json(path.join(dir, "ai-demo.json"), {
  method: model.design.method,
  design: model.design,
  elapsedMs: Date.now() - started,
  metrics: model.metrics,
  previousMetrics: before,
});
console.log(JSON.stringify(model.design));
