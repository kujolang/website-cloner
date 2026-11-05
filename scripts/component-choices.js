(()=>{
 let sequence=0;
 for(const root of document.querySelectorAll('[data-cloner-choices]')){
  const select=root.querySelector('select'),inner=root.querySelector('.choices__inner'),dropdown=root.querySelector('.choices__list--dropdown'),selectedList=inner?.querySelector('.choices__list--single,.choices__list--multiple');
  if(!select||select.matches(':disabled')||!inner||!dropdown||!selectedList)continue;
  const list=dropdown.querySelector('[role=listbox]')||dropdown,search=root.querySelector('input.choices__input--cloned'),control=search||root,prototype=selectedList.querySelector('[data-item]')?.cloneNode(true),choicePrototype=list.querySelector('[data-choice]')?.cloneNode(true);
  const labels=[...document.querySelectorAll('label[for]')].filter(l=>l.htmlFor===select.id),label=labels.map(l=>l.textContent.trim()).join(' ')||select.getAttribute('aria-label')||'Choose options';
  let prefix;do{prefix='cloner-choices-'+(++sequence);}while(document.getElementById(prefix));list.id=prefix;list.setAttribute('role','listbox');list.setAttribute('aria-multiselectable',String(select.multiple));
  root.setAttribute('aria-label',label);root.removeAttribute('aria-labelledby');root.setAttribute('role',search?'group':'combobox');root.tabIndex=search?-1:0;
  if(search){root.removeAttribute('aria-autocomplete');search.setAttribute('aria-autocomplete','list');search.disabled=false;search.removeAttribute('name');search.tabIndex=0;search.setAttribute('aria-label','Search '+label);search.setAttribute('role','combobox');search.setAttribute('autocomplete','off');}
  control.setAttribute('aria-controls',prefix);control.setAttribute('aria-haspopup','listbox');control.setAttribute('aria-required',String(select.required));if(search)root.removeAttribute('aria-expanded');dropdown.removeAttribute('aria-expanded');select.tabIndex=-1;
  const error=document.createElement('div');error.id=prefix+'-error';error.className='choices__validation-message';error.setAttribute('role','alert');error.hidden=true;root.append(error);
  const originalDescription=control.getAttribute('aria-describedby')||'';
  function syncFeedback(){
   const ids=[...new Set((originalDescription+' '+(select.getAttribute('aria-describedby')||'')+(!error.hidden?' '+error.id:'')).split(/\s+/).filter(Boolean))];
   if(ids.length)control.setAttribute('aria-describedby',ids.join(' '));else control.removeAttribute('aria-describedby');
   control.setAttribute('aria-invalid',String(select.getAttribute('aria-invalid')==='true'||!error.hidden));
  }
  new MutationObserver(syncFeedback).observe(select,{attributes:true,attributeFilter:['aria-invalid','aria-describedby']});
  let opened=false,active=-1,typeahead='',typeTimer;let selectionOrder=[...selectedList.querySelectorAll('[data-item][data-value]')].map(e=>e.dataset.value);
  const options=()=>[...select.options],enabled=o=>!o.matches(':disabled'),visible=()=>[...list.querySelectorAll('[data-cloner-option]')].filter(e=>!e.hidden&&e.getAttribute('aria-disabled')!=='true');
  function highlight(index){const items=visible();active=items.length?Math.max(0,Math.min(index,items.length-1)):-1;for(const e of list.querySelectorAll('[data-cloner-option]'))e.classList.remove('is-highlighted');const item=items[active];if(item){item.classList.add('is-highlighted');control.setAttribute('aria-activedescendant',item.id);}else control.removeAttribute('aria-activedescendant');}
  function open(){opened=true;root.classList.add('is-open','is-focused');dropdown.classList.add('is-active');dropdown.hidden=false;if(!search)root.setAttribute('aria-expanded','true');control.setAttribute('aria-expanded','true');highlight(0);}
  function close(){opened=false;root.classList.remove('is-open');root.classList.toggle('is-focused',root.contains(document.activeElement));dropdown.classList.remove('is-active');dropdown.hidden=true;if(!search)root.setAttribute('aria-expanded','false');control.setAttribute('aria-expanded','false');control.removeAttribute('aria-activedescendant');}
  function changed(){select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));}
  function choose(index){const option=options()[index];if(!option||!enabled(option))return;if(select.multiple){option.selected=true;selectionOrder=selectionOrder.filter(v=>v!==option.value);selectionOrder.push(option.value);}else select.selectedIndex=index;if(search)search.value='';changed();if(select.multiple){open();control.focus();}else{close();control.focus();}}
  function remove(index){const option=options()[index];if(!option||!enabled(option))return;if(select.multiple)option.selected=false;else select.value='';changed();control.focus();}
  function render(){
   selectionOrder=selectionOrder.filter(v=>options().some(o=>o.selected&&o.value===v));for(const o of options())if(o.selected&&!selectionOrder.includes(o.value))selectionOrder.push(o.value);
   selectedList.replaceChildren();list.replaceChildren();const query=(search?.value||'').trim().toLocaleLowerCase();
   options().forEach((option,index)=>{
    if(option.selected){const item=prototype?prototype.cloneNode(true):document.createElement('div');item.className='choices__item choices__item--selectable'+(option.value===''?' choices__placeholder':'');item.removeAttribute('id');item.setAttribute('data-item','');item.dataset.value=option.value;item.dataset.id=String(index+1);item.removeAttribute('aria-selected');item.textContent=option.label;
     if(select.multiple||prototype?.querySelector('[data-button]')){const button=document.createElement('button');button.type='button';button.className='choices__button';button.dataset.button='';button.setAttribute('aria-label','Remove '+option.label);button.textContent='Remove item';item.setAttribute('data-deletable','');button.disabled=!enabled(option)&&option.value!=='';button.addEventListener('click',event=>{event.stopPropagation();remove(index);});item.append(button);}selectedList.append(item);
    }
    const item=choicePrototype?choicePrototype.cloneNode(true):document.createElement('div');item.className='choices__item choices__item--choice '+(enabled(option)?'choices__item--selectable':'choices__item--disabled')+(option.selected?' is-selected':'')+(option.value===''?' choices__placeholder':'');item.textContent=option.label;item.id=prefix+'-'+index;item.dataset.clonerOption=String(index);item.dataset.value=option.value;item.setAttribute('role','option');item.setAttribute('aria-selected',String(option.selected));item.setAttribute('aria-disabled',String(!enabled(option)));item.hidden=Boolean(query&&!option.label.toLocaleLowerCase().includes(query)||select.multiple&&option.selected);item.removeAttribute('data-choice-disabled');item.removeAttribute('data-choice-selectable');item.setAttribute(enabled(option)?'data-choice-selectable':'data-choice-disabled','');list.append(item);
   });
   for(const value of selectionOrder){const item=[...selectedList.children].find(e=>e.dataset.value===value);if(item)selectedList.append(item);}
   if(!visible().length){const notice=document.createElement('div');notice.className='choices__item choices__item--choice has-no-results';notice.textContent='No results found';notice.setAttribute('aria-live','polite');list.append(notice);}
   if(search&&select.multiple)search.style.width=Math.max(1,search.value.length+1)+'ch';
   const invalid=!select.validity.valid;if(!invalid){error.hidden=true;error.textContent='';}syncFeedback();highlight(0);
  }
  list.addEventListener('click',event=>{const item=event.target.closest('[data-cloner-option]');if(item&&list.contains(item))choose(Number(item.dataset.clonerOption));});
  root.addEventListener('click',event=>{if(event.target.closest('[data-button],.choices__list--dropdown'))return;if(opened&&!search)close();else open();if(search)search.focus();});
  search?.addEventListener('input',()=>{render();open();});
  control.addEventListener('keydown',event=>{
   if(event.key==='Tab'){close();return;}
   if(event.key==='Escape'){close();event.preventDefault();return;}
   if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();if(!opened){open();if(event.key==='ArrowUp'||event.key==='End')highlight(visible().length-1);}else highlight(event.key==='Home'?0:event.key==='End'?visible().length-1:active+(event.key==='ArrowDown'?1:-1));return;}
   if(event.key==='Enter'||event.key===' '&&!search){event.preventDefault();if(!opened)open();else{const item=visible()[active];if(item)choose(Number(item.dataset.clonerOption));}return;}
   if(event.key==='Backspace'&&select.multiple&&!(search?.value)){const selected=options().map((o,i)=>({o,i})).filter(({o})=>o.selected&&enabled(o)).sort((a,b)=>selectionOrder.indexOf(a.o.value)-selectionOrder.indexOf(b.o.value));if(selected.length){event.preventDefault();remove(selected.at(-1).i);}return;}
   if(!search&&event.key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey){clearTimeout(typeTimer);typeahead+=event.key.toLocaleLowerCase();typeTimer=setTimeout(()=>typeahead='',700);if(!opened)open();highlight(visible().findIndex(e=>e.textContent.toLocaleLowerCase().startsWith(typeahead)));}
  });
  control.addEventListener('focus',()=>root.classList.add('is-focused'));root.addEventListener('focusout',event=>{if(!root.contains(event.relatedTarget)){close();root.classList.remove('is-focused');}});
  select.addEventListener('change',render);select.addEventListener('invalid',event=>{event.preventDefault();error.textContent=select.validationMessage;error.hidden=false;syncFeedback();open();control.focus();});
  select.form?.addEventListener('reset',()=>setTimeout(()=>{if(search)search.value='';error.hidden=true;render();close();},0));
  for(const labelElement of labels)labelElement.addEventListener('click',event=>{event.preventDefault();open();control.focus();});
  document.addEventListener('pointerdown',event=>{if(!root.contains(event.target))close();});render();close();
 }
})();
