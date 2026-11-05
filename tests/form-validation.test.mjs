import test from 'node:test';import assert from 'node:assert/strict';
import {applyValidationSchema,enrichForms,restoreFormValidation,restoreCachedFormSchemas} from '../engine/form-validation.mjs';
const form=()=>({id:'form',provider:'contact-form-7',sourceFormId:17,fields:[{name:'upload',type:'file'},{name:'topics[]',type:'checkbox'},{name:'topics[]',type:'checkbox'}]});
const schema={rules:[{rule:'maxfilesize',field:'upload',threshold:'2097152'},{rule:'file',field:'upload',accept:['.pdf','.txt']},{rule:'required',field:'topics'},{rule:'custom',field:'upload'}]};
test('public validation imports file limits and grouped requirements and reports unknown rules',()=>{
 const f=applyValidationSchema(form(),schema);assert.equal(f.fields[0].maxFileBytes,2097152);assert.equal(f.fields[0].accept,'.pdf,.txt');assert.equal(f.fields[1].requiredGroup,'topics[]');assert.deepEqual(f.validationIssues,[{field:'upload',rule:'custom'}]);
 const next=[form()];restoreFormValidation([f],next);assert.equal(next[0].fields[0].maxFileBytes,2097152);
});
test('schema discovery shares one cached request across pages and resumptions',async()=>{
 const model={source:'https://example.test/',pages:[{sourceForms:[form()]},{sourceForms:[form()]}]};let requests=0,saves=0;
 const network={get:async url=>{requests++;assert.equal(url,'https://example.test/wp-json/contact-form-7/v1/contact-forms/17/feedback/schema');return {status:200,body:JSON.stringify(schema)};}};
 await enrichForms(model,network,async()=>saves++);await enrichForms(model,network);assert.equal(requests,1);assert.equal(saves,1);assert.equal(model.pages[1].sourceForms[0].fields[0].maxFileBytes,2097152);
});
test('schema fetch propagates checkpoint interruption and records unavailable public schemas',async()=>{
 const model={source:'https://example.test',pages:[{sourceForms:[form()]}]};await assert.rejects(enrichForms(model,{get:async()=>{throw Object.assign(Error('budget'),{code:'CRAWL_BUDGET'});}}),/budget/);assert.deepEqual(model.formValidation.schemas,{});
 await enrichForms(model,{get:async()=>({status:403})});assert.equal(model.formValidation.schemas[17],null);assert.match(model.formValidation.issues[0].error,/403/);
});

test('presentation refresh keeps cached public validation without another request',async()=>{
 const {extract}=await import('../engine/extract.mjs'),{refreshPresentation}=await import('../engine/presentation.mjs');
 const html='<html><body><main><div class="wpcf7"><form><input type="hidden" name="_wpcf7" value="17"><input type="file" name="upload"></form></div></main></body></html>';
 const page=extract(html,'https://example.test/contact/');applyValidationSchema(page.sourceForms[0],schema);refreshPresentation(page,html);assert.equal(page.sourceForms[0].fields[0].maxFileBytes,2097152);assert.equal(page.sourceForms[0].sourceFormId,17);
});
test('unknown or malformed rules remain advisory rather than silently claiming support',()=>{
 const f=applyValidationSchema(form(),{rules:[{rule:'maxfilesize',field:'upload',threshold:'not a number'},{rule:'file',field:'upload',accept:['javascript:bad','.PDF']},{rule:'minitems',field:'topics',threshold:'invalid'}]});
 assert.equal(f.fields[0].maxFileBytes,undefined);assert.equal(f.fields[0].accept,'.PDF');assert.equal(f.validationIssues.length,2);
});

test('choice cardinality maps into editable limits and survives saved schema restore',()=>{
 const f=applyValidationSchema(form(),{rules:[{rule:'minitems',field:'topics',threshold:'2'},{rule:'maxitems',field:'topics',threshold:'3'}]});assert.deepEqual(f.validationIssues,[]);assert.equal(f.fields[1].minItems,2);assert.equal(f.fields[2].maxItems,3);const next=[form()];restoreFormValidation([f],next);assert.equal(next[0].fields[1].minItems,2);
});

test('public validation messages survive cache restore without importing unknown rule messages',()=>{const f={id:'x',sourceFormId:1,fields:[{name:'email',type:'email'}]};applyValidationSchema(f,{rules:[{rule:'email',field:'email',error:'Adresse invalide.'},{rule:'custom-private',field:'email',error:'Not imported'}]});assert.deepEqual(f.fields[0].validationMessages,{email:'Adresse invalide.'});const next={id:'x',sourceFormId:1,fields:[{name:'email',type:'email'}]};restoreFormValidation([f],[next]);assert.equal(next.fields[0].validationMessages.email,'Adresse invalide.');});

test('cached rebuild restores messages from retained full schema without discovery',()=>{const contract={provider:'contact-form-7',sourceFormId:17,fields:[{name:'email',type:'email'}],publicValidation:{rules:[{rule:'email',field:'email'}]}},model={pages:[{sourceForms:[contract]}],formValidation:{schemas:{17:{rules:[{rule:'email',field:'email',error:'Captured email message.'}]}}}};assert.equal(restoreCachedFormSchemas(model),1);assert.equal(contract.fields[0].validationMessages.email,'Captured email message.');assert.equal(contract.publicValidation.rules[0].error,'Captured email message.');assert.equal(restoreCachedFormSchemas({pages:[]}),0);});

test('CF7 telephone, HTTP URL and required file rules remain explicit native contracts',()=>{const f={fields:[{name:'phone',type:'tel'},{name:'web',type:'url'},{name:'file',type:'file'}]};applyValidationSchema(f,{rules:[{field:'phone',rule:'tel',error:'Telephone incorrect.'},{field:'web',rule:'url',error:'Website incorrect.'},{field:'file',rule:'requiredfile',error:'Upload required.'}]});assert.deepEqual(f.validationIssues,[]);assert.equal(f.fields[0].validationKind,'tel');assert.equal(f.fields[1].validationKind,'http-url');assert.equal(f.fields[2].required,true);});
