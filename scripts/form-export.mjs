import {commerceFormSelector} from './commerce-export.mjs';
export function formEndpoint(value){
 if(typeof value!=='string'||!value)throw Error('Form delivery requires an endpoint');
 if(/^\/(?!\/)/.test(value)&&!/[#\\\x00-\x20]/.test(value))return value;
 let u;try{u=new URL(value);}catch{throw Error('Invalid form endpoint');}
 if(u.protocol!=='https:'||u.username||u.password||u.hash)throw Error('Form endpoint must be HTTPS without credentials or a fragment');
 return u.href;
}
const labelText=value=>String(value||'').replace(/\s+/g,' ').trim();
function applyFieldLabel($,form,el,definition){
 if(typeof definition.label!=='string'||!definition.label)return true;
 if(el.attr('aria-label')!==undefined){el.attr('aria-label',definition.label);return true;}
 let labels=el.closest('label');
 if(!labels.length&&el.attr('id'))labels=form.find('label').filter((_,node)=>$(node).attr('for')===el.attr('id'));
 if(labels.length!==1)return false;
 const nodes=[];
 const visit=node=>{if(node.type==='text'){if(labelText(node.data))nodes.push(node);return;}if(['input','select','textarea','button','svg','script','style'].includes(node.tagName))return;for(const child of node.children||[])visit(child);};
 visit(labels[0]);
 if(labelText(nodes.map(n=>n.data).join(' '))===labelText(definition.label))return true;
 if(nodes.length!==1)return false;
 const old=nodes[0].data;nodes[0].data=(/^\s*/.exec(old)?.[0]||'')+definition.label+(/\s*$/.exec(old)?.[0]||'');return true;
}
export function applyForms($,page,contracts,base=''){
 const results=[];
 if($('input[data-migration-pseudo-paint]').length&&!$('style[data-cloner-form-paint]').length){
  // Only inert forms use frozen pseudo-element paint; configured controls keep
  // the source theme's checked/unchecked states during interaction.
  const selector='form[data-migration-form-disabled] input'+ '[data-migration-pseudo-paint]'.repeat(4);
  $('head').append($('<style data-cloner-form-paint="true"></style>').text(selector+'::before{opacity:var(--cloner-before-opacity,1)!important}'+selector+'::after{opacity:var(--cloner-after-opacity,1)!important}'));
 }
 // Never activate based on an attribute copied from a source website.
 $('form[data-cloner-delivery]').removeAttr('data-cloner-delivery');
 $('[data-cloner-choices]').removeAttr('data-cloner-choices');
 $('[data-cloner-text-counter]').removeAttr('data-cloner-text-counter');
 $('[data-cloner-input-mask]').removeAttr('data-cloner-input-mask');
 for(const contract of contracts.filter(f=>f.route===(page.sourceRoute||page.route))){
  const keyed=$('form').filter((_,el)=>$(el).attr('data-migration-form-key')===contract.id);
  const form=keyed.length?keyed:contract.sourceId?$('form').filter((_,el)=>$(el).attr('id')===contract.sourceId):$();
  if(form.is(commerceFormSelector)){results.push({id:contract.id,status:'requires-commerce-connection'});continue;}
  if(form.length!==1){results.push({id:contract.id,status:'unmatched',reason:'A unique captured form is required.'});continue;}
  const fields=form.find('input:not([type=hidden]):not([type=submit]),select,textarea');
  const definitions=contract.fields||[],authoringIssues=[];
  fields.removeAttr('data-cloner-validation-kind data-cloner-validation-messages data-cloner-required-group data-cloner-must-uncheck data-cloner-max-file-bytes data-cloner-match-index data-cloner-min-items data-cloner-max-items data-cloner-max-words data-cloner-word-input');
  fields.each((_,node)=>{const el=$(node),definition=definitions.find(f=>el.attr('data-migration-field-index')!==undefined&&f.sourceIndex!==undefined?String(f.sourceIndex)===el.attr('data-migration-field-index'):f.sourceId?f.sourceId===el.attr('id'):f.name===el.attr('name')&&f.type===(node.tagName==='input'?(el.attr('type')||'text'):node.tagName));if(!definition)return;if(['tel','http-url'].includes(definition.validationKind))el.attr('data-cloner-validation-kind',definition.validationKind);if(['contact-form-7','wpforms'].includes(contract.provider)&&definition.validationMessages&&typeof definition.validationMessages==='object')el.attr('data-cloner-validation-messages',JSON.stringify(Object.fromEntries(Object.entries(definition.validationMessages).filter(([key,value])=>['confirm','required','requiredfile','tel','url','email','number','date','minlength','maxlength','minnumber','maxnumber','mindate','maxdate','file','maxfilesize','minitems','maxitems'].includes(key)&&typeof value==='string'))));if(!applyFieldLabel($,form,el,definition))authoringIssues.push({field:definition.name,issue:'Label could not be uniquely bound without changing markup.'});el.attr('name',definition.name||null);if(['checkbox','radio'].includes(definition.type)){el.attr('value',definition.value??'on');el.attr('checked',definition.checked?'checked':null);}if(node.tagName==='select'&&Array.isArray(definition.options)){const existing=el.find('option').toArray();definition.options.forEach((option,index)=>{const item=existing[index]?$(existing[index]):$('<option></option>');if(item.attr('label')!==undefined)item.attr('label',String(option.label??''));item.attr('value',String(option.value??'')).text(String(option.label??'')).attr('disabled',option.disabled?'disabled':null).attr('selected',option.selected?'selected':null);if(!existing[index])el.append(item);});for(const old of existing.slice(definition.options.length))$(old).remove();}el.attr('disabled',definition.disabled?'disabled':null);el.attr('required',definition.required?'required':null);if(Number.isInteger(definition.matchesFieldIndex)&&definition.matchesFieldIndex>=0)el.attr('data-cloner-match-index',String(definition.matchesFieldIndex));for(const [key,attr] of [['minItems','data-cloner-min-items'],['maxItems','data-cloner-max-items']])if((definition.type==='checkbox'||definition.type==='select'&&definition.multiple)&&Number.isSafeInteger(definition[key])&&definition[key]>=0)el.attr(attr,String(definition[key]));if(['text','textarea'].includes(definition.type)&&Number.isSafeInteger(definition.maxWords)&&definition.maxWords>=0)el.attr('data-cloner-max-words',String(definition.maxWords));if(definition.wordLimitBehavior==='restrict'&&Number.isSafeInteger(definition.maxWords)&&definition.maxWords>=0)el.attr('data-cloner-word-input','restrict');if(definition.requiredGroup)el.attr('data-cloner-required-group',String(definition.requiredGroup));if(Number.isSafeInteger(definition.maxFileBytes)&&definition.maxFileBytes>0)el.attr('data-cloner-max-file-bytes',String(definition.maxFileBytes));if(definition.mustBeUnchecked===true)el.attr('data-cloner-must-uncheck','true');for(const key of ['min','max','step','minlength','maxlength','pattern','accept','autocomplete','placeholder'])if(definition[key]!==undefined)el.attr(key,String(definition[key]));});
  if(!contract.delivery?.endpoint){fields.attr('disabled','disabled');results.push({id:contract.id,status:'requires-connection',...(authoringIssues.length?{authoringIssues}: {})});continue;}
  form.find('.choices input.choices__input--cloned').each((_,node)=>{const el=$(node);if(el.closest('.choices').find('select').length)el.removeAttr('name');});
  form.find('.choices').each((_,node)=>{const widget=$(node);if(widget.find('select').length===1&&widget.find('.choices__list--dropdown').length===1&&!widget.find('select').is(':disabled'))widget.attr('data-cloner-choices','true');});
  fields.each((_,node)=>{
   const el=$(node),definition=definitions.find(f=>String(f.sourceIndex)===el.attr('data-migration-field-index'));
   const counter=definition?.textCounter;if(!counter||!['words','characters'].includes(counter.unit)||typeof counter.template!=='string'||counter.template.length>500)return;
   const limit=counter.unit==='words'?definition.maxWords:Number(definition.maxlength);
   const hints=el.parent().children('.wpforms-field-limit-text');if(hints.length!==1)return;
   if(!Number.isSafeInteger(limit)||limit<0){hints.remove();return;}
   hints.attr('data-cloner-text-counter',JSON.stringify({sourceIndex:definition.sourceIndex,unit:counter.unit,limit,template:counter.template})).text(counter.template.replaceAll('{count}','0').replaceAll('{limit}',String(limit)));
  });
  fields.each((_,node)=>{
   const el=$(node),definition=definitions.find(f=>String(f.sourceIndex)===el.attr('data-migration-field-index')),mask=definition?.inputMask;
   if(!mask||definition.type!=='text'||definition.disabled)return;
   if(typeof mask.mask==='string'&&mask.mask.length<=256&&!/[{}]/.test(mask.mask))el.attr('data-cloner-input-mask',JSON.stringify({mask:mask.mask}));
   else if(['email','integer','decimal'].includes(mask.alias))el.attr('data-cloner-input-mask',JSON.stringify({alias:mask.alias}));
   else if(mask.alias==='datetime'&&typeof mask.inputFormat==='string'&&['dd/mm/yyyy','mm/dd/yyyy','yyyy-mm-dd','HH:MM','HH:MM:ss'].includes(mask.inputFormat))el.attr('data-cloner-input-mask',JSON.stringify({alias:'datetime',inputFormat:mask.inputFormat}));
   else authoringIssues.push({field:definition.name,issue:'Input mask configuration is captured but not supported by the verified runtime.'});
  });
  const endpoint=formEndpoint(contract.delivery.endpoint),format=contract.delivery.format||'multipart';
  if(!['multipart','json'].includes(format))throw Error('Unsupported form delivery format');
  const configured=endpoint.startsWith('/')?base+endpoint:endpoint;
  form.find('button,input[type=submit]').each((_,node)=>{const el=$(node);if(el.attr('data-migration-source-disabled')==='false'||contract.provider==='contact-form-7'&&el.hasClass('wpcf7-submit'))el.removeAttr('disabled');});
  if(form.attr('data-migration-source-description')!==undefined){form.attr('aria-description',form.attr('data-migration-source-description')||null);form.removeAttr('data-migration-source-description');}
  if(form.attr('data-migration-source-describedby')!==undefined){form.attr('aria-describedby',form.attr('data-migration-source-describedby')||null);form.removeAttr('data-migration-source-describedby');}
  form.find('.migration-form-notice').remove();form.removeAttr('data-migration-form-disabled').removeAttr('title');
  const described=(form.attr('aria-describedby')||'').split(/\s+/).filter(id=>$('[id]').toArray().some(e=>e.attribs.id===id));form.attr('aria-describedby',described.join(' ')||null);
  form.attr('data-cloner-delivery',JSON.stringify({endpoint:configured,format,...(contract.provider==='contact-form-7'&&form.find('.wpcf7-response-output').length===1?{feedback:'contact-form-7'}:contract.provider==='wpforms'?{feedback:'wpforms'}:{})}));
  form.removeAttr('action').attr('method','post');
  const policy=$('meta[http-equiv]').filter((_,el)=>$(el).attr('http-equiv')?.toLowerCase()==='content-security-policy');
  const origin=endpoint.startsWith('/')?"'self'":new URL(endpoint).origin;
  policy.each((_,node)=>{const el=$(node);let value=el.attr('content')||'';const re=/(^|;)(\s*connect-src\s+)([^;]*)/i;if(re.test(value))value=value.replace(re,(_,start,prefix,rules)=>start+prefix+rules.replace(/'none'\s*/g,'').trim()+' '+origin);else value+='; connect-src '+origin;el.attr('content',value);});
  results.push({id:contract.id,status:'configured',format,...(authoringIssues.length?{authoringIssues}: {})});
 }
 return results;
}
