import {verifyNamedNavigation} from './verify-named-navigation.mjs';
export async function verifyNavigation(page){
 const results=[];
 for(const nav of await page.locator('nav').all()){
  const opener=nav.locator('.wp-block-navigation__responsive-container-open,.e-n-menu-toggle').first();let modal=false;
  try{
   if(await opener.count()&&await opener.isVisible()){await opener.click();modal=true;if(await opener.getAttribute('aria-expanded')!=='true')throw Error('Responsive menu did not open');}
   for(const button of await nav.locator('button.wp-block-navigation-submenu__toggle,button.wp-block-navigation__submenu-icon,button.e-n-menu-dropdown-icon').all()){
    if(!await button.isVisible())continue;
    await button.focus();await button.press('Enter');const id=await button.getAttribute('aria-controls');
    if(await button.getAttribute('aria-expanded')!=='true'||!id||!await page.locator('[id='+JSON.stringify(id)+']').isVisible())throw Error('Submenu did not expand');
    await page.keyboard.press('Escape');if(await button.getAttribute('aria-expanded')!=='false')throw Error('Escape did not close submenu');results.push({kind:'disclosure',status:'passed'});
   }
   if(modal){await page.keyboard.press('Escape');if(await opener.getAttribute('aria-expanded')!=='false'||!await opener.evaluate(el=>document.activeElement===el))throw Error('Responsive menu failed focus return');results.push({kind:'responsive-dialog',status:'passed'});}
  }catch(error){results.push({status:'failed',error:error.message});}
 }
 for(const nav of await page.locator('nav.hfe-nav-menu__layout-horizontal,nav.hfe-nav-menu__layout-vertical,nav.hfe-nav-menu__layout-expandible,nav.hfe-nav-menu__layout-flyout,.hfe-flyout-wrapper nav').all()){
  try{
   await page.mouse.move(-1,-1);
   if(await nav.getAttribute('data-cloner-addon-menu-ready')!=='true')throw Error('Addon menu adapter did not initialize');
   const widget=nav.locator('xpath=ancestor::*[contains(concat(" ",normalize-space(@class)," ")," elementor-widget ")][1]'),toggle=widget.locator('.hfe-nav-menu__toggle').first();
   const collapsed=await toggle.count()&&await toggle.isVisible();
   if(collapsed){if(await toggle.getAttribute('aria-expanded')==='true')await nav.press('Escape');await toggle.focus();await toggle.press('Enter');if(await toggle.getAttribute('aria-expanded')!=='true'||!await nav.isVisible())throw Error('Addon responsive menu did not open');}
   let disclosures=0;
   const addonButtons=await nav.locator('.hfe-has-submenu-container > a[aria-controls],.hfe-has-submenu-container[role=button]').all();
   for(const button of [...addonButtons].reverse())if(await button.getAttribute('aria-expanded')==='true')await button.press('Escape');
   for(const button of addonButtons){
    const ancestors=await button.evaluate(el=>{const nav=el.closest('nav'),all=[...nav.querySelectorAll('.hfe-has-submenu-container > a[aria-controls],.hfe-has-submenu-container[role=button]')],indices=[];for(let li=el.closest('.hfe-has-submenu-container').parentElement.parentElement.closest('li');li&&nav.contains(li);li=li.parentElement.closest('li')){const opener=[...li.children].find(n=>n.classList.contains('hfe-has-submenu-container'));if(opener)indices.unshift(all.indexOf(opener.querySelector('a[aria-controls]')||opener));}return indices;});
    for(const index of ancestors)if(await addonButtons[index].getAttribute('aria-expanded')!=='true')await addonButtons[index].press(' ');
    if(!await button.isVisible())throw Error('Nested addon submenu control is not visible after opening ancestors');
    await button.focus();await button.press(' ');const id=await button.getAttribute('aria-controls');
    if(!id)throw Error('Addon submenu has no controlled panel');const panel=page.locator('[id='+JSON.stringify(id)+']');
    if(await button.getAttribute('aria-expanded')!=='true'||!await panel.isVisible())throw Error('Addon submenu did not expand');
    await button.press('Escape');
    if(await button.getAttribute('aria-expanded')!=='false'||await panel.isVisible()||!await panel.evaluate(el=>el.inert)||!await button.evaluate(el=>el===document.activeElement))throw Error('Addon submenu failed closure or focus return');
    disclosures++;
   }
   for(const button of [...addonButtons].reverse())if(await button.getAttribute('aria-expanded')==='true')await button.press('Escape');
   if(collapsed){await nav.press('Escape');if(await toggle.getAttribute('aria-expanded')!=='false'||await nav.isVisible()||!await nav.evaluate(el=>el.inert)||!await toggle.evaluate(el=>el===document.activeElement))throw Error('Addon responsive menu failed closure or focus return');}
   results.push({kind:'addon-navigation',status:'passed',disclosures,responsive:collapsed});
  }catch(error){results.push({kind:'addon-navigation',status:'failed',error:error.message});}
 }
 for(const widget of await page.locator('.elementor-widget-nav-menu').all()){
  const toggle=widget.locator('.elementor-menu-toggle').first();
  if(!await toggle.count()||!await toggle.isVisible())continue;
  try{
   await toggle.click();if(await toggle.getAttribute('aria-expanded')!=='true')throw Error('Legacy responsive menu did not open');
   for(const button of await widget.locator('.migration-submenu-toggle').all()){
    if(!await button.isVisible())continue;await button.click();const id=await button.getAttribute('aria-controls');
    if(!id||!await page.locator('[id='+JSON.stringify(id)+']').isVisible())throw Error('Legacy submenu did not expand');
    await page.keyboard.press('Escape');if(await button.getAttribute('aria-expanded')!=='false')throw Error('Legacy submenu did not close');
   }
   await page.keyboard.press('Escape');if(await toggle.getAttribute('aria-expanded')!=='false')throw Error('Legacy responsive menu did not close');results.push({kind:'legacy-responsive',status:'passed'});
  }catch(error){results.push({status:'failed',error:error.message});}
 }
 for(const button of await page.locator('button.layout-drawer-hamburger[aria-controls]').all()){
  if(!await button.isVisible())continue;
  try{await button.click();const id=await button.getAttribute('aria-controls');const panel=page.locator('[id='+JSON.stringify(id)+']');if(!await panel.isVisible())throw Error('Drawer did not open');await page.keyboard.press('Escape');if(await panel.isVisible())throw Error('Drawer did not close');results.push({kind:'drawer-responsive',status:'passed'});}catch(error){results.push({kind:'drawer-responsive',status:'failed',error:error.message});}
 }
 for(const nav of await page.locator('nav.main-navigation').all()){
  if(!await nav.locator('.main-nav,.unifiednav__container').count())continue;
  try{
   const id=await nav.getAttribute('id');let opener=page.locator('button.menu-toggle[data-nav='+JSON.stringify(id)+']').first();
   if(!await opener.count()||!await opener.isVisible())opener=nav.locator('button.menu-toggle').first();
   const mobile=await opener.count()&&await opener.isVisible();
   if(mobile){await opener.click();if(await opener.getAttribute('aria-expanded')!=='true')throw Error('Classic menu did not open');}
   for(const button of await nav.locator('.migration-classic-toggle').all()){
    if(!await button.isVisible())continue;await button.focus();await button.press('Enter');
    const target=await button.getAttribute('aria-controls');
    if(await button.getAttribute('aria-expanded')!=='true'||!await page.locator('[id='+JSON.stringify(target)+']').isVisible())throw Error('Classic submenu did not open');
    await page.keyboard.press('Escape');if(await button.getAttribute('aria-expanded')!=='false'||await page.locator('[id='+JSON.stringify(target)+']').isVisible()||!await page.locator('[id='+JSON.stringify(target)+']').evaluate(el=>el.inert))throw Error('Classic submenu did not close or remove hidden links from keyboard navigation');
    results.push({kind:'classic-disclosure',status:'passed'});
   }
   if(mobile){await page.keyboard.press('Escape');if(await opener.getAttribute('aria-expanded')!=='false'||!await opener.evaluate(el=>el===document.activeElement))throw Error('Classic menu did not close or restore focus');results.push({kind:'classic-responsive',status:'passed'});}
  }catch(error){results.push({kind:'classic-navigation',status:'failed',error:error.message});}
 }
 for(const viewport of await page.locator('.e-n-carousel.swiper,.elementor-main-swiper').all()){
  if(!await viewport.isVisible()||await viewport.locator('.swiper-slide:not(.swiper-slide-duplicate)').count()<2)continue;
  const widget=viewport.locator('xpath=ancestor::*[@data-settings][1]'),next=widget.locator('.elementor-swiper-button-next').first(),previous=widget.locator('.elementor-swiper-button-prev').first();
  if(!await next.count()||!await next.isVisible())continue;
  try{const active=()=>viewport.evaluate(e=>[...e.querySelectorAll('.swiper-slide:not(.swiper-slide-duplicate)')].findIndex(s=>s.classList.contains('swiper-slide-active')));const before=await active();await next.click();if(await active()===before)throw Error('Carousel next control did not change the active slide');if(await previous.count()){await previous.focus();await previous.press('Enter');if(await active()!==before)throw Error('Carousel keyboard previous did not restore the slide');}results.push({kind:'carousel',status:'passed'});}catch(error){results.push({kind:'carousel',status:'failed',error:error.message});}
 }
 results.push(...await verifyNamedNavigation(page));
 return results;
}
