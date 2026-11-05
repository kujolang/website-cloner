import test from 'node:test';import assert from 'node:assert/strict';import {load} from 'cheerio/slim';import {captureSliderSequences,renderSliderSequences} from '../scripts/slider-authoring.mjs';
const fixture=()=>`<main><div id="slider" data-cloner-smart-slider="{}"><div class="backgrounds">${[1,2,3].map(id=>`<div class="n2-ss-slide-background" data-public-id="${id}"><img src="/${id}.jpg"></div>`).join('')}</div><div class="track">${[1,2,3].map(id=>`<div class="n2-ss-slide ${id===1?'n2-ss-slide-active':''}" data-slide-public-id="${id}"><p>Slide ${id}</p></div>`).join('')}</div><nav>${[1,2,3].map(id=>`<button data-slide-public-id="${id}">${id}</button>`).join('')}</nav></div></main>`;
test('slide sequence preserves default HTML and binds reordered/removed content and media',()=>{
 const html=fixture(),sequences=captureSliderSequences(load(html));assert.deepEqual(sequences.slider,['1','2','3']);assert.equal(renderSliderSequences(html,sequences),html);
 const $=load(renderSliderSequences(html,{slider:['3','1']}));assert.deepEqual($('.n2-ss-slide').map((_,el)=>$(el).attr('data-slide-public-id')).get(),['3','1']);assert.deepEqual($('.n2-ss-slide-background img').map((_,el)=>$(el).attr('src')).get(),['/3.jpg','/1.jpg']);assert.equal($('.n2-ss-slide-active').text(),'Slide 3');assert.ok($('.n2-ss-slide').eq(1).is('[hidden]'));assert.deepEqual($('nav button').map((_,el)=>$(el).text()).get(),['3','1']);assert.equal($('button[aria-selected=true]').text(),'3');assert.equal(load(renderSliderSequences(html,{slider:[]}))('[data-cloner-smart-slider]').length,0);
});
test('invalid sequence data fails explicitly rather than dropping authored slides',()=>{
 for(const data of [{slider:['unknown']},{slider:['1','1']},{slider:[1]},{missing:['1']},[],null])assert.throws(()=>renderSliderSequences(fixture(),data),/Invalid|Unknown|unique/);
 assert.equal(renderSliderSequences(fixture(),undefined),fixture());const $=load(fixture());$('.n2-ss-slide-background').last().remove();assert.deepEqual(Object.keys(captureSliderSequences($)),[]);assert.throws(()=>renderSliderSequences($.html(),{slider:['1']}),/Unsupported/);
});

test('fixed track siblings retain their place around reordered slides',()=>{
 const $=load(fixture(),null,false);$('.track').prepend('<b>Before</b>').append('<i>After</i>');const result=load(renderSliderSequences($.html(),{slider:['2','1']}));assert.deepEqual(result('.track').children().map((_,el)=>el.name).get(),['b','div','div','i']);
});

test('new image slides reuse captured structure with new data and matching controls',()=>{
 const $=load(fixture());$('.n2-ss-slide-background img').wrap('<picture></picture>');$('.n2-ss-slide').each((_,el)=>$(el).html('<div class="n2-ss-slide--focus">Original title</div><div class="n2-ss-layer" data-sstype="slide"></div>'));
 const added={id:'new-scene',template:'1',title:'New scene',image:{src:'/new.webp',alt:'New artwork'}};
 const out=load(renderSliderSequences($.html(),{slider:['3',added,'1']}));assert.deepEqual(out('.n2-ss-slide').map((_,el)=>out(el).attr('data-slide-public-id')).get(),['3','new-scene','1']);assert.equal(out('[data-public-id="new-scene"] img').attr('src'),'/new.webp');assert.equal(out('[data-public-id="new-scene"] img').attr('alt'),'New artwork');assert.equal(out('.n2-ss-slide[data-slide-public-id="new-scene"]').text(),'New scene');assert.equal(out('nav [data-slide-public-id="new-scene"]').attr('aria-label'),'New scene');assert.equal(out('nav button').length,3);
 assert.throws(()=>renderSliderSequences($.html(),{slider:[{...added,id:'1'}]}),/Invalid new/);assert.throws(()=>renderSliderSequences($.html(),{slider:[{...added,image:{src:'javascript:alert(1)'}}]}),/Unsafe/);
 $('.n2-ss-slide').first().attr('id','source-id');assert.throws(()=>renderSliderSequences($.html(),{slider:[added]}),/ID authoring/);
});

test('new slides require explicit responsive candidates and do not pretend to support layered templates',()=>{
 const $=load(fixture());$('.n2-ss-slide-background img').wrap('<picture></picture>');$('picture').prepend('<source srcset="/source.webp" type="image/webp">');const item={id:'new',template:'1',title:'New',image:{src:'/new.png',alt:'New'}};
 assert.throws(()=>renderSliderSequences($.html(),{slider:[item]}),/responsive candidates/);
 const out=load(renderSliderSequences($.html(),{slider:[{...item,sources:[{srcset:'/new.webp',type:'image/webp'}]}]}));assert.equal(out('source').attr('srcset'),'/new.webp');
 $('.n2-ss-slide').first().append('<div class="n2-ss-layer" data-sstype="slide"><h2>A layer</h2></div>');assert.throws(()=>renderSliderSequences($.html(),{slider:[item]}),/layer\/ID/);
});
