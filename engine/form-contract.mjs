import {createHash} from 'node:crypto';

// Only a fully captured local gallery can replace its search form without a service.
export function isLocalGallerySearch($,form){
 if(!form.hasClass('fg-layout-3-search-box')||!form.find('input[name="fg-frontend-search"]').length)return false;
 const root=form.closest('.eael-filter-gallery-wrapper'),items=root.find('.eael-filter-gallery-container.eael-filter-gallery-grid,.eael-filter-gallery-container.masonry').filter((_,el)=>$(el).closest('.eael-filter-gallery-wrapper')[0]===root[0]).first();
 const controls=root.find('[data-filter]').filter((_,el)=>$(el).closest('.eael-filter-gallery-wrapper')[0]===root[0]);
 if(!controls.length||controls.toArray().some(el=>! /^(?:\*|\.[\p{L}_][\p{L}\p{N}_-]*)$/u.test($(el).attr('data-filter')||'')))return false;
 return root.length>0&&items.children('.eael-filterable-gallery-item-wrap').length>0&&Number(items.attr('data-total-gallery-items'))===items.children('.eael-filterable-gallery-item-wrap').length;
}

export const formKey=(route,index,id='')=>'form-'+createHash('sha256').update(route+'\0'+index+'\0'+id).digest('hex').slice(0,16);
const text = value => String(value||'').replace(/\s+/g,' ').trim();
// Extract definitions, not submissions, nonce tokens, or source delivery URLs.
// This contract stays inert until an export owner configures a delivery service.
export function publicFormContracts($,route){
 const forms=[];
 const wpMessages={};
 // Parse the plugin's single-line JSON settings, never execute source JavaScript or retain tokens.
 for(const script of $('script').toArray()){
  const match=($(script).html()||'').match(/\b(?:var|let|const)\s+wpforms_settings\s*=\s*(\{[^\r\n]*\})\s*;?/);
  if(!match)continue;
  try{const settings=JSON.parse(match[1]);for(const key of ['required','email','url','number','confirm'])if(typeof settings['val_'+key]==='string'&&settings['val_'+key].trim())wpMessages[key]=settings['val_'+key];}catch{}
 }

 $('form').each((index,element)=>{
  const form=$(element);
  if(form.closest('template').length||isLocalGallerySearch($,form))return;
  if((form.attr('method')||'get').toLowerCase()==='get'&&(form.attr('role')==='search'||form.find('input[type="search"],input[name="s"]').length))return;
  const provider=form.closest('.wpcf7').length?'contact-form-7':form.closest('.wpforms-container').length?'wpforms':form.hasClass('elementor-form')?'elementor':'html';
  const id=formKey(route,index,form.attr('id')||'');
  const fields=[];
  form.find('input,textarea,select,button').each((sourceIndex,element)=>{
   const el=$(element),tag=element.tagName;
   // Choices' cloned search box is widget UI, not a submitted content field.
   if(tag==='input'&&el.hasClass('choices__input--cloned')&&el.closest('.choices').find('select').length)return;
   const type=tag==='input'?(el.attr('type')||'text').toLowerCase():tag==='button'?(el.attr('type')||'submit').toLowerCase():tag;
   if(['hidden','submit','button','reset','image'].includes(type))return;
   const sourceId=el.attr('id');
   // Attribute comparisons avoid interpreting source IDs as CSS selectors.
   const labels=sourceId?form.find('label').filter((_,label)=>$(label).attr('for')===sourceId):null;
   const wrapping=el.closest('label').clone();wrapping.find('input,textarea,select,button').remove();
   const labelledBy=(el.attr('aria-labelledby')||'').split(/\s+/).filter(Boolean).map(id=>text($('[id]').filter((_,node)=>$(node).attr('id')===id).first().text())).filter(Boolean).join(' ');
   const label=text(el.attr('aria-label'))||labelledBy||text(labels?.text())||text(wrapping.text());
   const field={sourceIndex,name:el.attr('name')||'',type,label,required:el.is('[required],[aria-required="true"]'),disabled:el.is(':disabled')};
   if(provider==='contact-form-7'&&type==='checkbox'){
    const acceptance=el.closest('.wpcf7-acceptance');
    if(acceptance.length&&!acceptance.hasClass('optional')){
     if(acceptance.hasClass('invert'))field.mustBeUnchecked=true;
     else field.required=true;
    }
    if(el.closest('.wpcf7-checkbox.wpcf7-validates-as-required').length){field.required=false;field.requiredGroup=field.name;}
   }
   if(provider==='wpforms'){
    if(Object.keys(wpMessages).length)field.validationMessages={...wpMessages};
    if(type==='checkbox'&&el.closest('.wpforms-field-checkbox').length&&field.required){field.required=false;field.requiredGroup=field.name;}
    const confirm=el.attr('data-rule-confirm');
    if(confirm?.startsWith('#')){const targets=form.find('input,textarea,select,button').toArray(),matches=targets.filter(node=>$(node).attr('id')===confirm.slice(1));if(matches.length===1)field.matchesFieldIndex=targets.indexOf(matches[0]);}
   }
   if(provider==='wpforms'&&['text','textarea'].includes(type)&&el.hasClass('wpforms-limit-words-enabled')){
    const limit=el.attr('data-text-limit');if(/^\d+$/.test(limit||'')&&Number.isSafeInteger(Number(limit))){field.maxWords=Number(limit);field.wordLimitBehavior='restrict';}
   }
   if(provider==='wpforms'&&['text','textarea'].includes(type)){
    const unit=el.hasClass('wpforms-limit-words-enabled')?'words':el.hasClass('wpforms-limit-characters-enabled')?'characters':null;
    const hint=el.parent().children('.wpforms-field-limit-text');
    const limit=el.attr('data-text-limit');
    // Capture only an unambiguous pristine counter; never infer translated prose.
    if(unit&&hint.length===1&&/^\d+$/.test(limit||'')){
     const parts=hint.text().split(/(\d+)/),numbers=parts.filter((_,i)=>i%2);
     if(numbers.length===2&&numbers[0]==='0'&&numbers[1]===limit){parts[1]='{count}';parts[3]='{limit}';field.textCounter={unit,template:parts.join('')};}
    }
   }
   if(provider==='wpforms'&&type==='text'&&el.hasClass('wpforms-masked-input')){
    const mask=el.attr('data-inputmask-mask');if(mask)field.inputMask={mask};
    else if(el.attr('data-inputmask-alias'))field.inputMask={alias:el.attr('data-inputmask-alias'),...(el.attr('data-inputmask-inputformat')?{inputFormat:el.attr('data-inputmask-inputformat')}: {})};
    else if(el.attr('data-inputmask-regex'))field.inputMask={regex:el.attr('data-inputmask-regex')};
   }
   if(sourceId)field.sourceId=sourceId;
   for(const key of ['placeholder','min','max','step','minlength','maxlength','pattern','accept','autocomplete'])if(el.attr(key)!==undefined)field[key]=el.attr(key);
   if(el.is('[multiple]'))field.multiple=true;
   // Choice values define an option; free-text values may contain captured PII.
   if(['checkbox','radio'].includes(type)){field.value=el.attr('value')??'on';field.checked=el.is('[checked]');}
   if(tag==='select')field.options=el.find('option').map((_,opt)=>({value:$(opt).attr('value')??text($(opt).text()),label:text($(opt).attr('label')??$(opt).text()),disabled:$(opt).is(':disabled'),selected:$(opt).is('[selected]')})).get();
   if(tag==='select'){
    const widget=el.closest('.choices');
    if(widget.length&&widget.find('select').length===1){
     const choices=widget.find('.choices__list--dropdown [data-choice][data-value]'),selected=new Set(widget.find('[data-item][data-value]').map((_,item)=>$(item).attr('data-value')).get());
     if(choices.length){field.widget='choices';field.options=choices.map((_,node)=>{const choice=$(node);return {value:choice.attr('data-value'),label:text(choice.text()),disabled:choice.is('[data-choice-disabled],[aria-disabled="true"]'),selected:selected.has(choice.attr('data-value'))};}).get();}
    }
   }
   fields.push(field);
  });
  const sourceFormId=Number(form.find('input[name="_wpcf7"]').attr('value'));
  forms.push({id,route,provider,...(provider==='contact-form-7'&&Number.isSafeInteger(sourceFormId)&&sourceFormId>0?{sourceFormId}:{}),sourceId:form.attr('id')||null,status:'requires-connection',fields,delivery:{endpoint:null},limitations:['Server validation, spam protection and delivery must be configured and verified.','Conditional and multistep rules are not inferred from field visibility.']});
 });
 return forms;
}
