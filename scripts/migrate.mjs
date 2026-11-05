import {createInterface} from 'node:readline/promises';
import path from "node:path";
import { migrate } from "../engine/pipeline.mjs";
const url = process.argv[2];
if (!url)
  throw Error(
    "Usage: npm run migrate -- https://example.com [output-directory] [--resume | --rebuild] [--ai | --no-ai] [--browser]",
  );
const dir = path.resolve(process.argv[3] || ".data/cli-" + Date.now());
const fixtureOrigins = (process.env.FIXTURE_ORIGINS || "")
  .split(",")
  .filter(Boolean);
const result = await migrate(url, dir, {
  fixtureOrigins,
  transport:process.argv.includes("--browser")?"browser":"http",
  browserConfirm:async()=>{if(!process.stdin.isTTY)throw Error("Browser capture requires an interactive terminal or the builder UI");const prompt=createInterface({input:process.stdin,output:process.stdout});try{await prompt.question("Review the source browser and handle its prompts, then press Enter to capture: ");}finally{prompt.close();}},
  aiEnabled: process.argv.includes("--ai") && !process.argv.includes("--no-ai"),
  resume: process.argv.includes("--resume") || process.argv.includes("--rebuild"),
  rebuild: process.argv.includes("--rebuild"),
  event: (stage, counts) => console.log(stage, counts || ""),
});
console.log(
  JSON.stringify(
    {
      directory: dir,
      status: result.report.status,
      metrics: result.report.metrics,
    },
    null,
    2,
  ),
);
