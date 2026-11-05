import path from "node:path";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { migrate, json } from "../engine/pipeline.mjs";
const fixtures = [
  ["gutenberg", 9411],
  ["classic", 9412],
  ["elementor", 9413],
  ["blog", 9414],
  ["brochure", 9415],
];
const destination = path.resolve("artifacts/evaluation");
await mkdir(destination, { recursive: true });
const results = [];
for (const [name, port] of fixtures) {
  const source = `http://127.0.0.1:${port}`;
  console.log(name);
  try {
    const r = await migrate(source + "/", path.join(destination, name), {
      fixtureOrigins: [source],
      maxPages: 40,
      event: (s) => console.log(" ", s),
    });
    results.push({ name, ...r.report });
  } catch (e) {
    results.push({ name, status: "failed", error: e.message });
  }
  await json(path.join(destination, "evaluation.json"), results);
}
console.log(
  results.map((r) => ({
    name: r.name,
    status: r.status,
    pages: r.metrics?.pagesGenerated,
    ms: r.metrics?.elapsedMs,
    error: r.error,
  })),
);
