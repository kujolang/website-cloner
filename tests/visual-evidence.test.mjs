import test from 'node:test';
import assert from 'node:assert/strict';
import {compareCapturePositions,visualEvidenceFailures} from '../engine/visual-evidence.mjs';
import {chromium} from 'playwright';
import {measure} from '../engine/capture.mjs';
import {layoutScore} from '../engine/verify.mjs';

test('capture alignment distinguishes missing evidence, rounding and actual scrolling',()=>{
 assert.equal(compareCapturePositions(null,{x:0,y:0}).status,'unknown');
 assert.equal(compareCapturePositions({x:0,y:NaN},{x:0,y:0}).status,'unknown');
 assert.equal(compareCapturePositions({x:0,y:0},{x:0.25,y:0.5}).status,'aligned');
 assert.deepEqual(compareCapturePositions({x:0,y:500},{x:0,y:0}),{status:'mismatched',delta:{x:0,y:-500}});
});

test('incompatible evidence cannot pass even with perfect scores, and raw scores are retained',()=>{
 const row={capturePosition:{source:{x:0,y:500},rebuilt:{x:0,y:0}},pixelSimilarity:1,layoutSimilarity:1};
 const before=structuredClone(row);assert.match(visualEvidenceFailures([row])[0],/scroll positions differ/);assert.deepEqual(row,before);
 const low={...row,pixelSimilarity:0.5,layoutSimilarity:0.2};
 assert.equal(visualEvidenceFailures([low]).length,1);
 assert.match(visualEvidenceFailures([{...low,capturePosition:{source:null,rebuilt:{x:0,y:0}}}])[0],/unverified/);
 assert.match(visualEvidenceFailures([{...low,capturePosition:{source:{x:0,y:0},rebuilt:{x:0,y:0}}}])[0],/layout differs/);
 assert.deepEqual(visualEvidenceFailures([{...row,capturePosition:{source:{x:0,y:0},rebuilt:{x:0,y:0}}}]),[]);
});

test('same DOM measured at different scroll positions reports capture mismatch rather than inferred design regression',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});try{
  const page=await browser.newPage({viewport:{width:800,height:600}});
  await page.setContent('<style>body{margin:0}main{height:4000px}h1{margin:0;padding-top:100px}</style><main><h1>Same source heading</h1><p>Same source content</p></main>');
  const first=await measure(page);await page.evaluate(()=>scrollTo({top:1500,behavior:'instant'}));const second=await measure(page);
  const score=layoutScore(first,second);assert.ok(score<0.7);
  const failures=visualEvidenceFailures([{layoutSimilarity:score,capturePosition:{source:first.scrollPosition,rebuilt:second.scrollPosition}}]);assert.equal(failures.length,1);assert.match(failures[0],/scroll positions differ/);
 }finally{await browser.close();}
});
