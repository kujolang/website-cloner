import test from 'node:test';import assert from 'node:assert/strict';import {load} from 'cheerio';import {captureSmartSliders} from '../engine/slider-data.mjs';import {extract} from '../engine/extract.mjs';
const config={responsive:{base:{slideWidth:1200,slideHeight:600},type:'auto',mediaQueries:{mobileportrait:['(max-width: 700px)']}},controls:{touch:'horizontal',keyboard:1},autoplay:{enabled:0},mainanimation:{type:'horizontal',duration:800,ease:'easeOutQuad'}};
function html(data=config,type='Simple'){return `<html><head><title>Slides</title><script>new _N2.SmartSlider${type}('n2-ss-7',${JSON.stringify(data).slice(0,-1)},"initCallbacks":function(){throw Error('must never execute')}})</script></head><body><main><h1>Slides</h1><div class="n2-ss-slider" id="n2-ss-7"><p>Slide content</p></div></main></body></html>`;}
test('Smart Slider settings survive extraction without callbacks or executable scripts',()=>{
 const $=load(html());assert.deepEqual(captureSmartSliders($),[]);const d=JSON.parse($('.n2-ss-slider').attr('data-cloner-smart-slider'));assert.equal(d.animation.duration,800);assert.deepEqual(d.responsive.mediaQueries,config.responsive.mediaQueries);assert.doesNotMatch(JSON.stringify(d),/initCallbacks|must never execute/);
 const page=extract(html(),'https://fixture.test/');assert.match(page.content,/data-cloner-smart-slider/);assert.doesNotMatch(page.content,/initCallbacks|must never execute|<script/);
});
test('unavailable, malformed and unsupported slider settings remain explicit',()=>{
 for(const input of [html(config,'Carousel'),html({...config,responsive:{}}),html().replace('"controls":{','"controls":function(){'),'<div class="n2-ss-slider" data-cloner-smart-slider="untrusted"></div>']){
  const $=load(input);assert.equal(captureSmartSliders($).length,1);assert.equal($('.n2-ss-slider').attr('data-cloner-smart-slider'),undefined);
 }
});
test('braces in JSON strings do not terminate settings or leak adjacent initializers',()=>{
 const first=html({...config,controls:{...config.controls,label:'quoted } { \\" value'}});const $=load(first.replace('</head>',`<script>new _N2.SmartSliderSimple('n2-ss-8',${JSON.stringify({...config,autoplay:{enabled:1}})})</script></head>`).replace('</main>','<div class="n2-ss-slider" id="n2-ss-8"></div></main>'));const warnings=captureSmartSliders($);assert.equal(warnings.length,1);assert.equal(warnings[0].sourceId,'n2-ss-8');assert.match(warnings[0].reason,/autoplay/);assert.equal(JSON.parse($('#n2-ss-7').attr('data-cloner-smart-slider')).autoplay.enabled,0);assert.equal(JSON.parse($('#n2-ss-8').attr('data-cloner-smart-slider')).autoplay.enabled,1);
});
