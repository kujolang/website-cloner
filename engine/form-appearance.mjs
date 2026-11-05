// Freeze only control paint when capturing a rendered document. Disabling an
// exported form must not introduce browser-default grey text/backgrounds.
// Work on a clone: the source DOM and its scripts never see these changes.
export async function renderedDocument(page) {
 return page.evaluate(()=>{
  const copy=document.documentElement.cloneNode(true);
  const originals=[...document.querySelectorAll('input,textarea,select,button')];
  const clones=[...copy.querySelectorAll('input,textarea,select,button')];
  originals.forEach((control,i)=>{
   const form=control.closest('form');
   if(!form||control.matches(':disabled')||control.type==='hidden')return;
   const method=(form.getAttribute('method')||'get').toLowerCase();
   if(method==='get'&&(form.getAttribute('role')==='search'||form.querySelector('input[type="search"],input[name="s"]')))return;
   const style=getComputedStyle(control),originalPaint={};
   const freeze=(property,value)=>{originalPaint[property]={value:control.style.getPropertyValue(property),priority:control.style.getPropertyPriority(property),frozen:value};clones[i].style.setProperty(property,value);};
   if(['checkbox','radio'].includes(control.type)){
    clones[i].setAttribute('data-migration-pseudo-paint','true');
    for(const pseudo of ['before','after'])clones[i].style.setProperty('--cloner-'+pseudo+'-opacity',getComputedStyle(control,'::'+pseudo).opacity);
   }
   // A colour alone can revive a theme border after downstream CSS normalization.
   // Preserve explicitly absent edges without freezing responsive field widths.
   for(const side of ['top','right','bottom','left'])if(style.getPropertyValue('border-'+side+'-width')==='0px'){freeze('border-'+side+'-width','0px');freeze('border-'+side+'-style','none');}
   for(const property of ['color','background-color','border-top-color','border-right-color','border-bottom-color','border-left-color','opacity'])freeze(property,style.getPropertyValue(property));
   clones[i].setAttribute('data-migration-control-paint',JSON.stringify(originalPaint));
  });
  return '<!doctype html>'+copy.outerHTML;
 });
}
