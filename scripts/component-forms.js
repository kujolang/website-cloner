(()=>{
 for(const form of document.querySelectorAll('form[data-cloner-delivery]')){
  let config;try{config=JSON.parse(form.dataset.clonerDelivery);}catch{continue;}
  // Restore only provenance-tagged capture paint. Native CSSStyleDeclaration
  // handles border shorthands and preserves genuine/later inline edits.
  for(const control of form.querySelectorAll('[data-migration-control-paint]')){
   let paint;try{paint=JSON.parse(control.dataset.migrationControlPaint);}catch{continue;}
   if(!paint||typeof paint!=='object'||Array.isArray(paint))continue;
   for(const [property,saved]of Object.entries(paint)){
    if(!/^(?:color|background-color|opacity|border-(?:top|right|bottom|left)-(?:color|width|style))$/.test(property)||!saved||typeof saved.frozen!=='string'||control.style.getPropertyValue(property)!==saved.frozen||control.style.getPropertyPriority(property)!==''||typeof saved.value!=='string'||/[;{}<>]|url\s*\(|expression\s*\(/i.test(saved.value)||!['','important'].includes(saved.priority))continue;
    if(saved.value)control.style.setProperty(property,saved.value,saved.priority);else control.style.removeProperty(property);
   }
  }
  const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.hidden=true;form.append(status);
  const feedback=config.feedback==='contact-form-7'?form.querySelector('.wpcf7-response-output'):null;
  if(feedback)status.style.cssText='position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0';
  const showStatus=(message,state)=>{
   status.hidden=!message;status.textContent=message;
   if(config.feedback==='wpforms')status.style.cssText=state==='invalid'?'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0':'';
   if(feedback){for(const name of ['init','resetting','submitting','sent','failed','aborted','spam','invalid','unaccepted','payment-required'])form.classList.remove(name);form.classList.add(state);form.dataset.status=state;feedback.textContent=message;feedback.setAttribute('aria-hidden','true');}
  };

  const wpforms=config.feedback==='wpforms';
  const invalidClass=wpforms?'wpforms-error':'wpcf7-not-valid';
  const ownedWrappers=new Set();let validated=false;
  const serverErrors=new Map();let errorSequence=0;
  const clearServerError=name=>{const saved=serverErrors.get(name);if(!saved)return;for(const {field,invalid,described,hadClass}of saved.fields){if(invalid===null)field.removeAttribute('aria-invalid');else field.setAttribute('aria-invalid',invalid);if(described===null)field.removeAttribute('aria-describedby');else field.setAttribute('aria-describedby',described);if(!hadClass)field.classList.remove(invalidClass);}saved.note.remove();serverErrors.delete(name);for(const wrapper of [...ownedWrappers])if(!wrapper.querySelector('input.wpforms-error,select.wpforms-error,textarea.wpforms-error')){wrapper.classList.remove('wpforms-has-error');ownedWrappers.delete(wrapper);}};
  const clearServerErrors=()=>{for(const name of [...serverErrors.keys()])clearServerError(name);};
  const showServerErrors=(errors,focus=true)=>{
   if(!errors||typeof errors!=='object'||Array.isArray(errors))return false;
   let first;
   for(const [name,message]of Object.entries(errors)){
    if(typeof message!=='string'||!message.trim())continue;
    const fields=[...form.elements].filter(field=>field.name===name&&!field.matches(':disabled')&&!['hidden','submit','button','reset'].includes(field.type));if(!fields.length)continue;
    const note=document.createElement(wpforms?(form.closest('.wpforms-render-modern')?'em':'label'):'span');note.textContent=message;note.className=wpforms?'wpforms-error':feedback?'wpcf7-not-valid-tip':'cloner-field-error';
    if(wpforms){note.setAttribute('role','alert');if(note.tagName==='LABEL'&&fields.length===1&&fields[0].id)note.setAttribute('for',fields[0].id);}
    do{note.id='cloner-field-error-'+(++errorSequence);}while(document.getElementById(note.id));
    const saved=fields.map(field=>({field,invalid:field.getAttribute('aria-invalid'),described:field.getAttribute('aria-describedby'),hadClass:field.classList.contains(invalidClass)}));
    for(const field of fields){field.setAttribute('aria-invalid','true');field.setAttribute('aria-describedby',((field.getAttribute('aria-describedby')||'')+' '+note.id).trim());if(feedback||wpforms)field.classList.add(invalidClass);if(wpforms){const wrapper=field.closest('.wpforms-field');if(wrapper&&!wrapper.classList.contains('wpforms-has-error')){ownedWrappers.add(wrapper);wrapper.classList.add('wpforms-has-error');}}}
    const wrappers=fields.map(field=>field.closest('.wpcf7-form-control-wrap'));if(feedback&&wrappers[0]&&wrappers.every(wrapper=>wrapper===wrappers[0]))wrappers[0].append(note);else if(wpforms&&fields.length===1&&fields[0].closest('.wpforms-field-row-block'))fields[0].closest('.wpforms-field-row-block').append(note);else if(wpforms&&(fields.length>1||fields[0].closest('.choices'))&&fields[0].closest('.wpforms-field')&&fields.every(field=>field.closest('.wpforms-field')===fields[0].closest('.wpforms-field')))fields[0].closest('.wpforms-field').append(note);else fields.at(-1).after(note);serverErrors.set(name,{fields:saved,note});first||=fields[0];
   }
   if(focus)first?.focus();return Boolean(first);
  };
  form.addEventListener('input',event=>clearServerError(event.target.name));form.addEventListener('change',event=>clearServerError(event.target.name));form.addEventListener('reset',clearServerErrors);

  const countWords=value=>{value=value.trim().replace(/([a-z]+),([a-z]+)/gi,'$1, $2').replace(/([0-9]+),([a-z]+)/gi,'$1, $2').replace(/([a-z]+),([0-9]+)/gi,'$1, $2');return value?value.split(/\s+/).length:0;};
  for(const field of form.querySelectorAll('[data-cloner-word-input="restrict"][data-cloner-max-words]')){
   const limit=Number(field.dataset.clonerMaxWords);if(!Number.isSafeInteger(limit)||limit<0)continue;
   field.addEventListener('keydown',event=>{if(!event.isComposing&&[' ','Enter',','].includes(event.key)&&countWords(field.value)>=limit)event.preventDefault();});
   field.addEventListener('beforeinput',event=>{if(!event.isComposing&&['insertText','insertLineBreak','insertParagraph'].includes(event.inputType)&&(/^[\s,]$/.test(event.data||'')||event.inputType!=='insertText')&&countWords(field.value)>=limit)event.preventDefault();});
   field.addEventListener('paste',event=>{
    if(!event.clipboardData)return;event.preventDefault();
    const start=field.selectionStart??field.value.length,end=field.selectionEnd??start,text=event.clipboardData.getData('text/plain');
    const combined=field.value.slice(0,start)+text+field.value.slice(end);
    field.value=(combined.trim().match(/\S+(?:\s+|$)/g)||[]).slice(0,limit).join('').trim();
    const caret=Math.min(start+text.length,field.value.length);field.setSelectionRange(caret,caret);field.dispatchEvent(new Event('input',{bubbles:true}));
   });
  }
  const counters=[...form.querySelectorAll('[data-cloner-text-counter]')].flatMap(node=>{
   let config;try{config=JSON.parse(node.dataset.clonerTextCounter);}catch{return [];}
   const fields=[...form.querySelectorAll('[data-migration-field-index]')].filter(e=>e.dataset.migrationFieldIndex===String(config.sourceIndex));
   return fields.length===1&&typeof config.template==='string'?[{node,config,field:fields[0]}]:[];
  });
  const validateChoices=()=>{
   for(const field of form.querySelectorAll('[data-cloner-validation-kind]')){
    field.setCustomValidity('');if(field.matches(':disabled')||!field.value.trim())continue;
    let valid=true;const kind=field.dataset.clonerValidationKind;
    if(kind==='tel'){let number=field.value.replace(/[#*].*$/,'').replace(/[()\/.*#\s-]+/g,'');if(number.startsWith('+')||number.startsWith('00'))number='+'+number.replace(/^[+0]+/,'');valid=/^[+]?[0-9]+$/.test(number)&&number.length>5&&number.length<16;}
    if(kind==='http-url'){try{valid=['http:','https:'].includes(new URL(field.value).protocol);}catch{valid=false;}}
    if(!valid){let messages={};try{messages=JSON.parse(field.dataset.clonerValidationMessages||'{}');}catch{}field.setCustomValidity(messages[kind==='tel'?'tel':'url']||(kind==='tel'?'Enter a valid telephone number.':'Enter an HTTP or HTTPS URL.'));}
   }

   for(const {node,config,field} of counters){const count=config.unit==='words'?countWords(field.value):field.value.length;node.textContent=config.template.replaceAll('{count}',String(count)).replaceAll('{limit}',String(config.limit)).replaceAll('{remaining}',String(config.limit-count));}

   for(const field of form.querySelectorAll('[data-cloner-max-words]')){
    const limit=Number(field.dataset.clonerMaxWords);
    // Match WPForms' public word boundaries, including adjacent comma-separated words.
    const count=countWords(field.value);
    field.setCustomValidity(!field.matches(':disabled')&&Number.isSafeInteger(limit)&&limit>=0&&count>limit?'Use no more than '+limit+' words.':'');
   }

   for(const field of form.querySelectorAll('[data-cloner-min-items],[data-cloner-max-items]'))field.setCustomValidity('');
   const groups=new Map();
   for(const field of form.querySelectorAll('[data-cloner-required-group]')){field.setCustomValidity('');if(field.matches(':disabled'))continue;const key=field.dataset.clonerRequiredGroup;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(field);}
   for(const fields of groups.values())fields[0].setCustomValidity(fields.some(field=>field.checked)?'':'Choose at least one option.');
   const counted=new Set();
   for(const field of form.querySelectorAll('[data-cloner-min-items],[data-cloner-max-items]')){
    if(field.matches(':disabled')||counted.has(field))continue;
    const members=field.tagName==='SELECT'?[field]:[...form.elements].filter(e=>e.type===field.type&&e.name===field.name&&!e.matches(':disabled'));
    members.forEach(e=>counted.add(e));
    const count=field.tagName==='SELECT'?[...field.selectedOptions].filter(o=>!o.matches(':disabled')).length:members.filter(e=>e.checked).length;
    const bounds=(key)=>members.filter(e=>e.dataset[key]!==undefined).map(e=>Number(e.dataset[key])).filter(n=>Number.isSafeInteger(n)&&n>=0);
    const mins=bounds('clonerMinItems'),maxs=bounds('clonerMaxItems'),min=mins.length?Math.max(...mins):0,max=maxs.length?Math.min(...maxs):Infinity;
    // SWV item minimums constrain a supplied value; required is independent.
    if(count>0&&count<min)field.setCustomValidity('Choose at least '+min+' options.');
    else if(count>max)field.setCustomValidity('Choose no more than '+max+' options.');
   }
   for(const field of form.querySelectorAll('input[type=file]')){
    field.setCustomValidity('');if(field.matches(':disabled'))continue;
    const max=Number(field.dataset.clonerMaxFileBytes),accept=(field.accept||'').toLowerCase().split(',').map(x=>x.trim()).filter(Boolean);
    for(const file of field.files){
     if(max>0&&file.size>max){field.setCustomValidity('The selected file is too large.');break;}
     if(accept.length&&!accept.some(type=>type.startsWith('.')?file.name.toLowerCase().endsWith(type):type.endsWith('/*')?file.type.toLowerCase().startsWith(type.slice(0,-1)):file.type.toLowerCase()===type)){field.setCustomValidity('Choose a supported file type.');break;}
    }
   }
   for(const field of form.querySelectorAll('[data-cloner-match-index]')){const target=[...form.querySelectorAll('[data-migration-field-index]')].find(el=>el.dataset.migrationFieldIndex===field.dataset.clonerMatchIndex);field.setCustomValidity(field.matches(':disabled')?'':!target?'The matching field is unavailable.':field.value===target.value?'':'The values must match.');}
   for(const field of form.querySelectorAll('[data-cloner-must-uncheck]'))field.setCustomValidity(!field.matches(':disabled')&&field.checked?'Leave this option unchecked.':'');
  };
  const showClientErrors=(focus=false)=>{
   clearServerErrors();validateChoices();const errors={};
   for(const field of form.elements){if(!field.willValidate||field.validity.valid||!field.name)continue;
    let messages={};try{messages=JSON.parse(field.dataset.clonerValidationMessages||'{}');}catch{}
    const v=field.validity,key=v.valueMissing?(field.type==='file'?'requiredfile':'required'):v.typeMismatch?field.type:v.tooShort?'minlength':v.tooLong?'maxlength':v.rangeUnderflow?(field.type==='date'?'mindate':'minnumber'):v.rangeOverflow?(field.type==='date'?'maxdate':'maxnumber'):v.badInput?field.type:v.customError&&field.dataset.clonerRequiredGroup?'required':v.customError&&field.dataset.clonerMatchIndex!==undefined?'confirm':null;
    errors[field.name]=typeof messages[key]==='string'?messages[key]:field.validationMessage;
   }
   return showServerErrors(errors,focus);
  };
  if(feedback||wpforms){form.noValidate=true;form.addEventListener('change',()=>{if(feedback||validated)showClientErrors(false);});}
  form.addEventListener('input',validateChoices);form.addEventListener('change',validateChoices);
  form.addEventListener('reset',()=>setTimeout(validateChoices,0));validateChoices();
  let pending=false;
  form.addEventListener('reset',()=>{validated=false;if(!pending)showStatus('','init');});
  form.addEventListener('submit',async event=>{
   event.preventDefault();if(pending)return;
   const category=form.dataset.clonerConsentCategory;if(category&&!window.clonerConsent?.allows(category)){showStatus('Enable this optional service in privacy preferences before submitting.','failed');window.clonerConsent?.open();return;}
   clearServerErrors();validateChoices();if(feedback||wpforms){validated=true;if(showClientErrors(true)){showStatus('Please correct the highlighted fields.','invalid');return;}}else if(!form.reportValidity())return;
   const fields=new FormData(form);
   if(config.format==='json'&&[...fields.values()].some(v=>v instanceof File&&v.size)){status.hidden=false;status.textContent='File uploads require multipart delivery.';return;}
   let body=fields,headers={'Accept':'application/json'};
   if(config.format==='json'){const data={};for(const [key,value]of fields){if(value instanceof File)continue;if(Object.hasOwn(data,key))data[key]=[data[key]].flat().concat(value);else Object.defineProperty(data,key,{value,writable:true,enumerable:true,configurable:true});}body=JSON.stringify(data);headers['Content-Type']='application/json';}
   pending=true;form.setAttribute('aria-busy','true');showStatus('Sending...','submitting');
   const controls=[...form.querySelectorAll('button[type=submit],button:not([type]),input[type=submit]')].filter(el=>!el.matches(':disabled'));controls.forEach(el=>el.disabled=true);
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
   const consentChanged=()=>{if(category&&!window.clonerConsent?.allows(category))controller.abort();};document.addEventListener('cloner:consent-change',consentChanged);
   try{
    const response=await fetch(config.endpoint,{method:'POST',body,headers,credentials:'omit',redirect:'error',signal:controller.signal});
    const result=await response.json();
    if(response.status===422&&result?.ok===false&&showServerErrors(result.errors)){showStatus('Please correct the highlighted fields.','invalid');form.dispatchEvent(new CustomEvent('cloner:form-invalid',{bubbles:true}));return;}
    if(!response.ok||result?.ok!==true)throw Error('delivery');
    showStatus('Your submission was accepted.','sent');form.dispatchEvent(new CustomEvent('cloner:form-success',{bubbles:true}));
   }catch{showStatus('Your submission could not be confirmed. Please try again.','failed');form.dispatchEvent(new CustomEvent('cloner:form-error',{bubbles:true}));}
   finally{document.removeEventListener('cloner:consent-change',consentChanged);clearTimeout(timer);pending=false;form.removeAttribute('aria-busy');controls.forEach(el=>el.disabled=false);}
  });
 }
})();
