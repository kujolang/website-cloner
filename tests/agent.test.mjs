import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateRepair, improves, repairWithAgent } from "../engine/agent.mjs";

test("agent actions reject active resources and content invention; visual regressions are rejected", () => {
  for (const css of ['@import "https://evil.test/x";', 'p{background:url(https://evil.test)}', 'p:after{content:"invented"}', 'p{width:expression(x)}']) assert.throws(() => validateRepair({action:"patch_css",reason:"test",css}));
  assert.equal(validateRepair({action:"patch_css",reason:"Match source",css:"@media(max-width:600px){article{padding:20px}}"}).action,"patch_css");
  const report = { pages:[{contentCoverage:1,brokenLinks:[],articlesPreserved:true}], visual:[{layoutSimilarity:.9,pixelSimilarity:.9,failedResources:[],overflow:false}] };
  assert.equal(improves(report, {...report,visual:[{...report.visual[0],layoutSimilarity:.8}]}),false);
  assert.equal(improves(report, {...report,visual:[{...report.visual[0],layoutSimilarity:.95}]}),true);
});

test("agent rebuilds, inspects and rolls back a worsening proposal without modifying content", async () => {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const dir = await mkdtemp(path.join(os.tmpdir(), "agent-rollback-"));
  const visual = { route:"/", viewport:"desktop", layoutSimilarity:.9, pixelSimilarity:.9, failedResources:[], errors:[], a11y:[], overflow:false };
  const baseline = { pages:[{contentCoverage:1,brokenLinks:[],articlesPreserved:true}], visual:[visual] };
  const model = { pages:[],captures:[],warnings:[],metrics:{aiCalls:0,inputTokens:0,outputTokens:0,repairIterations:0} };
  let builds = 0, inspections = 0;
  try {
    await mkdir(path.join(dir,"assets/css"),{recursive:true});
    await writeFile(path.join(dir,"assets/css/agent.css"),"/* baseline */");
    const report = await repairWithAgent(model,dir,baseline,{
      selection:{profileId:"test",model:"test"},rounds:1,
      ask:async()=>({output_text:JSON.stringify({action:"patch_css",reason:"Try spacing",css:"article{padding:99px}"}),usage:{input_tokens:3,output_tokens:4}}),
      rebuild:async()=>{builds++;},
      inspect:async()=>{inspections++;return inspections===1?{...baseline,visual:[{...visual,layoutSimilarity:.3}]}:baseline;},
    });
    assert.equal(builds,2); assert.equal(inspections,2);
    assert.equal(await readFile(path.join(dir,"assets/css/agent.css"),"utf8"),"/* baseline */");
    assert.equal(report.agent.rounds[0].accepted,false);
    assert.equal(model.metrics.aiCalls,1); assert.equal(model.metrics.repairIterations,0);
  } finally {await rm(dir,{recursive:true,force:true});}
});

