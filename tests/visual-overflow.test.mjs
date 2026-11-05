import test from 'node:test';import assert from 'node:assert/strict';import {PNG} from 'pngjs';import {chromium} from 'playwright';import {visualComparison,overflowComparison} from '../engine/verify.mjs';import {measure} from '../engine/capture.mjs';
function png(width,height=2){const p=new PNG({width,height});for(let i=0;i<p.data.length;i+=4){p.data[i]=209;p.data[i+1]=228;p.data[i+2]=221;p.data[i+3]=255;}return p;}
const evidence={viewportWidth:2,sourceMeasurements:{horizontalOverflow:{viewportWidth:2,hiddenOnly:true},body:{background:'rgb(209, 228, 221)'}},rebuiltMeasurements:{overflow:false}};
test('blank hidden source overflow has explicit normalization while visible or unknown overflow fails',()=>{
 const a=png(3),b=png(2),source=PNG.sync.write(a),rebuilt=PNG.sync.write(b);assert.equal(visualComparison(source,rebuilt,evidence).score,1);assert.equal(visualComparison(source,rebuilt,evidence).normalization.reason,'source-hidden-blank-horizontal-overflow');
 assert.throws(()=>visualComparison(source,rebuilt),/dimensions differ/);assert.throws(()=>visualComparison(source,rebuilt,{...evidence,sourceMeasurements:{...evidence.sourceMeasurements,horizontalOverflow:{viewportWidth:2,hiddenOnly:false}}}),/dimensions differ/);
 assert.throws(()=>visualComparison(source,rebuilt,{...evidence,rebuiltMeasurements:{overflow:true}}),/dimensions differ/);assert.throws(()=>visualComparison(source,PNG.sync.write(png(2,3)),evidence),/dimensions differ/);
 a.data[8]=0;assert.throws(()=>visualComparison(PNG.sync.write(a),rebuilt,evidence),/painted pixels/);
 assert.equal(visualComparison(rebuilt,rebuilt).normalization,null);
});
test('overflow measurement distinguishes invisible descendants from visible out-of-viewport content',async()=>{
 const browser=await chromium.launch({channel:'chrome'});try{const page=await browser.newPage({viewport:{width:390,height:600}});await page.setContent('<!doctype html><style>body{margin:0}.overflow{position:absolute;left:250px;width:220px;height:20px;visibility:hidden}</style><main>Visible content</main><div class="overflow"><span>Hidden menu</span></div>');let m=await measure(page);assert.equal(m.overflow,true);assert.equal(m.horizontalOverflow.hiddenOnly,true);assert.equal(m.horizontalOverflow.scrollWidth,470);await page.locator('.overflow').evaluate(e=>e.style.visibility='visible');m=await measure(page);assert.equal(m.horizontalOverflow.hiddenOnly,false);await page.locator('.overflow').evaluate(e=>e.style.display='none');m=await measure(page);assert.equal(m.overflow,false);}finally{await browser.close();}
});

test('overflow extent comparison distinguishes source issues without excusing export overflow',()=>{
 const m=(scrollWidth,viewportWidth=390)=>({overflow:scrollWidth>viewportWidth+1,horizontalOverflow:{scrollWidth,viewportWidth,hiddenOnly:false}});
 assert.deepEqual(overflowComparison(m(1230),m(1230)),{status:'matching-extent',sourcePixels:840,rebuiltPixels:840,sourceHiddenOnly:false,rebuiltHiddenOnly:false});
 for(const [a,b,status] of [[390,390,'none'],[390,500,'introduced'],[500,390,'resolved'],[500,600,'increased'],[600,500,'reduced']])assert.equal(overflowComparison(m(a),m(b)).status,status);
 assert.equal(overflowComparison(null,m(500)).status,'unknown');assert.equal(overflowComparison(m(500),m(500,400)).status,'unknown');assert.equal(overflowComparison(m(NaN),m(500)).status,'unknown');
});
