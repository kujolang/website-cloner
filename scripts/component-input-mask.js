(()=>{
 for(const field of document.querySelectorAll('[data-cloner-input-mask]')){
  let config;try{config=JSON.parse(field.dataset.clonerInputMask);}catch{continue;}
  if(field.matches(':disabled')||!field.form?.hasAttribute('data-cloner-delivery'))continue;
  // Authored contract only; do not import arbitrary source data options/callbacks.
  const options=typeof config.mask==='string'?{mask:config.mask}:{alias:config.alias,...(config.inputFormat?{inputFormat:config.inputFormat}: {})};
  new window.Inputmask({...options,rightAlign:false,importDataAttributes:false}).mask(field);
  const validate=()=>field.setCustomValidity(!field.matches(':disabled')&&field.inputmask.unmaskedvalue()!==''&&!field.inputmask.isComplete()?'Please fill out the field in the required format.':'');
  field.addEventListener('input',validate);field.addEventListener('change',validate);field.addEventListener('blur',validate);
  field.form.addEventListener('reset',()=>setTimeout(validate,0));validate();
 }
})();
