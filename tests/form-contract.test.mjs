import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from 'cheerio';
import {publicFormContracts} from '../engine/form-contract.mjs';
import {clean} from '../engine/extract.mjs';
test('CF7 fields become structured definitions without tokens or captured submissions',()=>{
 const forms=publicFormContracts(load(`<div class="wpcf7"><form id="contact" action="https://old.example/send"><input type="hidden" name="_nonce" value="secret"><label for="name:1">Name</label><input id="name:1" name="name" value="Private Person" required><textarea name="message">Private message</textarea><input type="email" name="email" aria-label="Email"><input type="submit"></form></div>`),'/contact/');
 assert.equal(forms.length,1);assert.equal(forms[0].provider,'contact-form-7');assert.equal(forms[0].fields.length,3);
 assert.equal(forms[0].fields[0].label,'Name');assert.equal(forms[0].fields[0].required,true);
 for(const secret of ['secret','Private','old.example','_nonce'])assert.ok(!JSON.stringify(forms).includes(secret));
 assert.equal(forms[0].delivery.endpoint,null);assert.equal(forms[0].status,'requires-connection');
});
test('WPForms choice definitions and constraints survive without guessing hidden logic',()=>{
 const forms=publicFormContracts(load(`<div class="wpforms-container"><form><label>Plan <select name="plan" required><option value="basic">Basic</option></select></label><label><input type="checkbox" name="consent" value="yes">I agree</label><input type="number" name="amount" min="1" max="10" step="0.5"></form></div>`),'/');
 assert.equal(forms[0].provider,'wpforms');assert.equal(forms[0].fields[0].label,'Plan');
 assert.equal(forms[0].fields[0].options[0].value,'basic');assert.equal(forms[0].fields[1].label,'I agree');
 assert.equal(forms[0].fields[2].step,'0.5');assert.match(forms[0].limitations[1],/not inferred/);
});
test('search forms use local search instead of delivery contracts and IDs stay stable',()=>{
 const html='<form role="search"><input name="s"></form><form id="message"><input name="message"></form>';
 const a=publicFormContracts(load(html),'/');assert.equal(a.length,1);
 assert.equal(a[0].id,publicFormContracts(load(html),'/')[0].id);
 assert.notEqual(a[0].id,publicFormContracts(load(html),'/other/')[0].id);
});
test('sanitizer retains native form validation and choice attributes without accepting form actions',()=>{
 const $=load(clean('<form action="https://old.example"><input type="number" min="2" max="12" step="2"><input type="checkbox" checked><input type="file" accept="image/*" multiple><input minlength="2" pattern="[a-z]+" autocomplete="name"></form>',{forms:true}));
 assert.equal($('form').attr('action'),undefined);assert.equal($('input').first().attr('min'),'2');
 assert.ok($('input[type=checkbox]').is('[checked]'));assert.ok($('input[type=file]').is('[multiple]'));
 assert.equal($('input').last().attr('pattern'),'[a-z]+');
});

test('cached presentation refresh retains SEO and stable form bindings after raw HTML is discarded',async()=>{
 const {extract}=await import('../engine/extract.mjs'),{refreshPresentation}=await import('../engine/presentation.mjs');
 const html='<html><head><script type="application/ld+json">{"@type":"WebPage","name":"Preserved schema"}</script></head><body><main><form><input name="name"><button>Send</button></form></main></body></html>';
 const p=extract(html,'https://example.test/');p.content='<p>Old</p>';delete p.sourceSEO;refreshPresentation(p,html);delete p.sourceHTML;
 assert.equal(p.sourceSEO.structured_data[0].name,'Preserved schema');
 assert.equal(p.sourceForms[0].fields[0].disabled,false);
 const {platformSupportReport}=await import('../engine/platform-support.mjs');assert.equal(platformSupportReport([p]).pages[0].forms[0].fields[0].disabled,false);
 assert.equal(load(p.content)('form').attr('data-migration-form-key'),publicFormContracts(load(html),'/')[0].id);
 assert.equal(load(p.content)('input').attr('data-migration-field-index'),'0');
});

test('CF7 acceptance and checkbox groups translate to explicit shared validation rules',()=>{
 const $=load('<div class="wpcf7"><form><span class="wpcf7-checkbox wpcf7-validates-as-required"><input type="checkbox" name="topics[]"><input type="checkbox" name="topics[]"></span><span class="wpcf7-acceptance"><input type="checkbox" name="terms"></span><span class="wpcf7-acceptance optional"><input type="checkbox" name="optional"></span><span class="wpcf7-acceptance invert"><input type="checkbox" name="inverse"></span></form></div>');
 const fields=publicFormContracts($,'/')[0].fields;
 assert.deepEqual(fields.slice(0,2).map(f=>[f.required,f.requiredGroup]),[[false,'topics[]'],[false,'topics[]']]);
 assert.equal(fields[2].required,true);assert.equal(fields[3].required,false);assert.equal(fields[4].mustBeUnchecked,true);
});

test('WPForms required groups and confirmation links become provider-independent constraints',()=>{
 const $=load('<div class="wpforms-container"><form><input id="primary" type="email" name="email"><input type="email" name="confirm" data-rule-confirm="#primary"><div class="wpforms-field-checkbox"><input type="checkbox" name="topics[]" required><input type="checkbox" name="topics[]" required></div></form></div>');const fields=publicFormContracts($,'/')[0].fields;assert.equal(fields[1].matchesFieldIndex,0);assert.deepEqual(fields.slice(2).map(f=>[f.required,f.requiredGroup]),[[false,'topics[]'],[false,'topics[]']]);
});

test('empty option values remain empty instead of becoming placeholder text',()=>{
 const $=load(clean('<select required><option value="">Choose an option</option><option value="blue">Blue</option></select>',{forms:true}));assert.equal($('option').first().attr('value'),'');assert.equal($('option').last().attr('value'),'blue');
});


test('enhanced select search boxes are excluded without dropping the actual select',async()=>{
 const html='<form method="post"><div class="choices"><select name="topics"><option>A</option></select><input class="choices__input choices__input--cloned" type="search" name="search_terms"></div><input type="search" name="real_query"></form>';
 const result=publicFormContracts(load(html),'/')[0];assert.deepEqual(result.fields.map(f=>f.name),['topics','real_query']);
 const {extract}=await import('../engine/extract.mjs'),{applyForms}=await import('../scripts/form-export.mjs'),model=extract('<main>'+html+'</main>','https://example.test/'),$=load(model.content);model.sourceForms[0].delivery={endpoint:'/deliver'};applyForms($,model,model.sourceForms);assert.equal($('.choices__input--cloned').attr('name'),undefined);assert.equal($('select').attr('name'),'topics');assert.equal($('[name=real_query]').length,1);
});


test('initialized Choices widgets recover unselected options removed from their native select',()=>{
 const html='<form method="post"><div class="choices"><select name="region"><option value="a">Alpha</option></select><div class="choices__list--single"><div data-item data-value="a">Alpha</div></div><div class="choices__list--dropdown"><div data-choice data-value="a" aria-selected="true">Alpha</div><div data-choice data-value="b" aria-selected="true">Beta</div><div data-choice data-value="c" data-choice-disabled>Closed</div></div></div></form>';
 const field=publicFormContracts(load(html),'/')[0].fields[0];assert.equal(field.widget,'choices');assert.deepEqual(field.options,[{value:'a',label:'Alpha',disabled:false,selected:true},{value:'b',label:'Beta',disabled:false,selected:false},{value:'c',label:'Closed',disabled:true,selected:false}]);
 const multiple=html.replace('<select name="region"><option value="a">Alpha</option></select>','<select name="region" multiple></select>').replace('<div data-item data-value="a">Alpha</div>','');assert.equal(publicFormContracts(load(multiple),'/')[0].fields[0].options.length,3);assert.equal(publicFormContracts(load(multiple),'/')[0].fields[0].options.some(o=>o.selected),false);
});
