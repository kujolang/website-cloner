// Exercise named menus without following links or submitting source forms.
export async function verifyNamedNavigation(page){
 const results=[];
 const panelFor=async button=>{
  const id=await button.getAttribute('aria-controls')||await button.getAttribute('aria-owns');if(!id)throw Error('Named menu has no controlled panel');
  const panel=page.locator('[id='+JSON.stringify(id)+']');if(await panel.count()!==1)throw Error('Named menu panel is missing or ambiguous');return panel;
 };
 async function exposed(panel){
  await panel.waitFor({state:'visible',timeout:2000});
  const handle=await panel.elementHandle();try{await page.waitForFunction(el=>{
   if(el.getAttribute('aria-hidden')==='true'||el.inert||!el.getBoundingClientRect().height)return false;
   for(let node=el;node;node=node.parentElement){const css=getComputedStyle(node);if(node.hidden||node.inert||node.getAttribute('aria-hidden')==='true'||css.display==='none'||css.visibility==='hidden'||Number(css.opacity)<=0.01)return false;}return true;
  },handle,{timeout:2000});}catch{throw Error('Named menu or its ancestor remains hidden');}finally{await handle?.dispose();}
 }
 await page.mouse.move(-1,-1);
 for(const button of await page.locator('button[aria-haspopup="true"],button[aria-haspopup="menu"]').all()){
  if(!await button.isVisible()||await button.isDisabled()||await button.getAttribute('aria-disabled')==='true')continue;
  const candidate=await button.evaluate(el=>{
   const id=el.getAttribute('aria-controls')||el.getAttribute('aria-owns'),key=el.getAttribute('data-dropdown-trigger'),name=(el.getAttribute('aria-label')||el.textContent).replace(/\s+/g,' ').trim().toLowerCase();
   const panels=[...document.querySelectorAll('[role="menu"][aria-hidden]')];
   return panels.some(panel=>id?panel.id===id:key?panel.getAttribute('data-dropdown-name')===key:name.length>=3&&(' '+(panel.getAttribute('aria-label')||'').toLowerCase()+' ').includes(' '+name+' '));
  });if(!candidate)continue;
  const label=(await button.getAttribute('aria-label')||await button.innerText()).trim().slice(0,80);let drilldowns=0;
  try{
   const panel=await panelFor(button);
   if(await button.getAttribute('aria-expanded')==='true')await button.press('Escape');
   await button.focus();await button.press('Enter');
   if(await button.getAttribute('aria-expanded')!=='true')throw Error('Named menu did not expand');await exposed(panel);
   for(const trigger of await panel.locator('[data-mobile-dropdown],[data-dropdown-target]').all()){
    if(!await trigger.isVisible()||await trigger.getAttribute('aria-disabled')==='true'||await trigger.getAttribute('data-migration-unavailable')!==null)continue;
    const href=await trigger.getAttribute('href');if(href&&!['#',''].includes(href))continue;
    const child=await panelFor(trigger);await trigger.focus();await trigger.press('Enter');
    if(await trigger.getAttribute('aria-expanded')!=='true')throw Error('Named drilldown did not expand');await exposed(child);
    await page.keyboard.press('Escape');
    if(await trigger.getAttribute('aria-expanded')!=='false'||!await trigger.evaluate(el=>el===document.activeElement)||await button.getAttribute('aria-expanded')!=='true')throw Error('Drilldown Escape failed closure, focus return or parent preservation');
    await trigger.press('Enter');await exposed(child);const back=panel.getByRole('button',{name:/^(back|go back)$/i});if(await back.count()!==1)throw Error('Drilldown Back control is missing or ambiguous');await back.click();
    if(await trigger.getAttribute('aria-expanded')!=='false'||!await trigger.evaluate(el=>el===document.activeElement))throw Error('Drilldown Back failed closure or focus return');drilldowns++;
   }
   await page.keyboard.press('Escape');
   if(await button.getAttribute('aria-expanded')!=='false'||await panel.getAttribute('aria-hidden')!=='true'||!await button.evaluate(el=>el===document.activeElement))throw Error('Named menu Escape failed closure or focus return');
   results.push({kind:'named-navigation',label,status:'passed',drilldowns});
  }catch(error){results.push({kind:'named-navigation',label,status:'failed',error:error.message});}
  finally{for(let attempt=0;attempt<2&&await button.getAttribute('aria-expanded')==='true';attempt++)await page.keyboard.press('Escape').catch(()=>{});}
 }
 return results;
}
