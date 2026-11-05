// Public CF7 SWV definitions only; never submissions, tokens or delivery endpoints.
export function applyValidationSchema(contract,schema){
 if(!Array.isArray(schema?.rules))throw Error('Invalid public form validation schema');
 const issues=[];
 for(const rule of schema.rules){
  const fields=contract.fields.filter(f=>f.name.replace(/\[\]$/,'')===rule.field);
  if(!fields.length)continue;
  const threshold=Number(rule.threshold);
  for(const field of fields){
   if(typeof rule.error==='string'&&rule.error.trim()&&['required','requiredfile','tel','url','email','number','date','minlength','maxlength','minnumber','maxnumber','mindate','maxdate','file','maxfilesize','minitems','maxitems'].includes(rule.rule))(field.validationMessages||={})[rule.rule]=rule.error;
   if(rule.rule==='required'||rule.rule==='requiredfile'&&field.type==='file'){if(field.type==='checkbox'){field.requiredGroup=field.name;field.required=false;}else field.required=true;}
   else if(rule.rule==='maxfilesize'&&field.type==='file'&&Number.isSafeInteger(threshold)&&threshold>0)field.maxFileBytes=threshold;
   else if(rule.rule==='file'&&field.type==='file'&&Array.isArray(rule.accept))field.accept=rule.accept.filter(x=>typeof x==='string'&&/^(?:\.[a-z0-9]+|[a-z0-9.+-]+\/(?:[a-z0-9.+-]+|\*))$/i.test(x)).join(',');
   else if(['minlength','maxlength'].includes(rule.rule)&&Number.isSafeInteger(threshold)&&threshold>=0)field[rule.rule]=String(threshold);
   else if(['minnumber','maxnumber'].includes(rule.rule)&&field.type==='number'&&Number.isFinite(threshold))field[rule.rule==='minnumber'?'min':'max']=String(threshold);
   else if(['mindate','maxdate'].includes(rule.rule)&&field.type==='date'&&/^\d{4}-\d{2}-\d{2}$/.test(rule.threshold))field[rule.rule==='mindate'?'min':'max']=rule.threshold;
   else if(rule.rule==='tel'&&field.type==='tel')field.validationKind='tel';
   else if(rule.rule==='url'&&field.type==='url')field.validationKind='http-url';
   else if(['email','number','date'].includes(rule.rule)&&field.type===rule.rule)continue;
   else if(rule.rule==='enum'&&['select','checkbox','radio'].includes(field.type))continue; // Captured options define these choices.
   else if(['minitems','maxitems'].includes(rule.rule)&&Number.isSafeInteger(threshold)&&threshold>=0&&(field.type==='checkbox'||field.type==='select'&&field.multiple))field[rule.rule==='minitems'?'minItems':'maxItems']=threshold;
   else if(rule.rule==='maxitems'&&field.type==='radio'&&threshold===1)continue;
   else issues.push({field:rule.field,rule:rule.rule});
  }
 }
 contract.validationIssues=[...new Map(issues.map(x=>[JSON.stringify(x),x])).values()];
 contract.publicValidation={rules:schema.rules.map(r=>Object.fromEntries(['rule','field','threshold','accept','error'].filter(k=>r[k]!==undefined).map(k=>[k,r[k]])))};
 return contract;
}
export function restoreFormValidation(previous,current){
 for(const form of current||[]){const saved=(previous||[]).find(p=>p.id===form.id&&p.sourceFormId===form.sourceFormId);if(saved?.publicValidation)applyValidationSchema(form,saved.publicValidation);else if(saved?.validationIssues)form.validationIssues=structuredClone(saved.validationIssues);}
}
export async function enrichForms(model,network,save=async()=>{}){
 const forms=model.pages.flatMap(p=>p.sourceForms||[]).filter(f=>f.provider==='contact-form-7'&&f.sourceFormId);
 if(!forms.length)return;
 const root=new URL(model.wordpress?.apiRoot||'/wp-json/',model.source);if(root.origin!==new URL(model.source).origin)return;
 const state=model.formValidation||={schemas:{},issues:[]};
 for(const id of new Set(forms.map(f=>f.sourceFormId))){
  if(!Object.hasOwn(state.schemas,id)){
   try{const r=await network.get(root.href.replace(/\/$/,'')+'/contact-form-7/v1/contact-forms/'+id+'/feedback/schema');if(r.status!==200)throw Error('HTTP '+r.status);const schema=JSON.parse(r.body);if(!Array.isArray(schema.rules))throw Error('Invalid schema');state.schemas[id]={rules:schema.rules};}
   catch(error){if(['CRAWL_BUDGET','SOURCE_UNAVAILABLE','DISK_SPACE','ENOSPC'].includes(error.code))throw error;state.schemas[id]=null;state.issues.push({id,error:error.message});}
  }
  if(state.schemas[id])for(const form of forms.filter(f=>f.sourceFormId===id))applyValidationSchema(form,state.schemas[id]);
  else for(const form of forms.filter(f=>f.sourceFormId===id))form.validationIssues=[{rule:'schema-unavailable',field:null}];
  await save();
 }
}

// Rebuilds may skip discovery, but retain full public schemas in the checkpoint.
export function restoreCachedFormSchemas(model){
 let restored=0;
 for(const page of model.pages||[])for(const form of page.sourceForms||[]){
  if(form.provider!=='contact-form-7')continue;
  const schema=model.formValidation?.schemas?.[form.sourceFormId];
  if(Array.isArray(schema?.rules)){applyValidationSchema(form,schema);restored++;}
 }
 return restored;
}
