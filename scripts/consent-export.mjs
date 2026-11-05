import {createHash} from 'node:crypto';
const categories=new Set(['preferences','analytics','marketing']);
const bannerSelector='.cmplz-cookiebanner,.cky-consent-container';
const oldPanels='.cky-modal,.cky-preference-center,.cky-overlay,.cmplz-categories,.cmplz-soft-cookiewall';
const reopenSelector='.cmplz-manage-consent,.cky-btn-revisit';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function sourcePreferences($,source,config){
 if(!source.is('.cmplz-cookiebanner')||!source.find('.cmplz-categories .cmplz-category').length)return null;
 const dialog=$('<dialog></dialog>').attr('data-cloner-consent-dialog','').attr('data-cloner-consent-presentation','complianz').attr('aria-label','Privacy preferences');
 // Keep vendor styling and placement; native dialog owns focus management.
 dialog.attr('class',[...new Set([...(source.attr('class')||'').split(/\s+/).filter(c=>c!=='cmplz-hidden'),'cmplz-show','cmplz-categories-visible'])].join(' '));
 dialog.attr('style','position:fixed;box-sizing:border-box;max-width:100vw;max-height:100vh;height:fit-content;overflow:auto;overflow-wrap:anywhere');
 const header=source.find('.cmplz-header').first().clone();header.find('.cmplz-title').text('Privacy preferences');header.find('.cmplz-close').attr('data-cloner-consent-action','close');dialog.append(header);
 const body=$('<div class="cmplz-body"></div>');body.append($('<div class="cmplz-message"></div>').text('Choose which optional export services to enable. Local content remains available when they are rejected.'));
 const list=$('<div class="cmplz-categories"></div>').css('display','block');
 for(const category of [...new Set(config.services.map(s=>s.category))]){
  const candidate=source.find('.cmplz-category.cmplz-'+category).first();if(!candidate.length)return null;
  const row=candidate.clone().css('display','block'),id='cloner-consent-'+category;
  row.find('.cmplz-category-title').attr('id',id+'-title').text(category[0].toUpperCase()+category.slice(1));
  row.find('input').removeClass('cmplz-'+category).removeAttr('checked disabled data-category aria-describedby').attr({type:'checkbox',name:category,id});
  row.find('label').attr('for',id);row.find('.screen-reader-text').text(category[0].toUpperCase()+category.slice(1));
  row.find('.cmplz-description').attr({id:id+'-description',hidden:'hidden'}).text(config.services.filter(s=>s.category===category).map(s=>s.label).join(', '));
  row.find('.cmplz-category-toggle').attr({'data-cloner-consent-action':'details','aria-expanded':'false','aria-controls':id+'-description','aria-labelledby':id+'-title'});
  list.append(row);
 }
 body.append(list);dialog.append(body);
 const buttons=$('<div class="cmplz-buttons"></div>');
 for(const [selector,action,label] of [['.cmplz-accept','accept','Accept optional services'],['.cmplz-deny','reject','Reject optional services'],['.cmplz-save-preferences','save','Save preferences']]){
  const button=source.find(selector).first().clone();if(!button.length)return null;button.attr('type','button').attr('data-cloner-consent-action',action).removeAttr('hidden').css('display','block').text(label);buttons.append(button);
 }
 dialog.append(buttons,$('<p data-cloner-consent-status role="status"></p>'));
 // Captured IDs/ARIA references cannot collide with the still-present banner.
 const ids=new Map();dialog.find('[id]').each((_,el)=>{const value=$(el).attr('id');if(!value.startsWith('cloner-consent-')){ids.set(value,'cloner-preferences-'+value);$(el).attr('id',ids.get(value));}});
 dialog.find('[for],[aria-labelledby],[aria-describedby],[aria-controls]').each((_,el)=>{for(const attr of ['for','aria-labelledby','aria-describedby','aria-controls']){const value=$(el).attr(attr);if(value)$(el).attr(attr,value.split(/\s+/).map(id=>ids.get(id)||id).join(' '));}});
 return dialog;
}
function cookieYesPreferences($,config){
 const source=$('.cky-preference-center').first();if(!source.length)return null;
 const panel=source.clone().removeAttr('hidden aria-hidden').css({'display':'flex','max-width':'100%','box-sizing':'border-box'});
 const header=panel.find('.cky-preference-header').first();header.find('.cky-preference-title').text('Privacy preferences');header.find('.cky-btn-close').attr({'type':'button','data-cloner-consent-action':'close','aria-label':'Close preferences'});
 const body=panel.find('.cky-preference-body-wrapper').first(),description=source.find('.cky-preference-content-wrapper').first().clone(),rows=$('<div class="cky-accordion-wrapper"></div>');description.empty().append($('<p></p>').text('Choose which optional export services to enable. Local content remains available when they are rejected.'));body.empty().append(description,rows);
 for(const category of [...new Set(config.services.map(s=>s.category))]){
  const slug={preferences:'functional',analytics:'analytics',marketing:'advertisement'}[category];
  const row=source.find('#ckyDetailCategory'+slug).first().clone();if(!row.length)return null;
  const id='cloner-consent-'+category,title=category[0].toUpperCase()+category.slice(1);
  row.attr('id',id+'-row').removeClass('cky-accordion-active');row.find('.cky-always-active,.cky-switch,.cky-accordion-header-des').remove();
  row.find('.cky-accordion-btn').attr({'type':'button','id':id+'-title','aria-label':title,'aria-expanded':'false','aria-controls':id+'-description','data-cloner-consent-action':'details'}).text(title);
  row.find('.cky-accordion-header').append($('<div class="cky-switch"></div>').append($('<input type="checkbox">').attr({id,name:category,'aria-labelledby':id+'-title'})));
  row.find('.cky-accordion-body').attr({id:id+'-description',hidden:'hidden'}).empty().append($('<p></p>').text(config.services.filter(s=>s.category===category).map(s=>s.label).join(', ')));
  rows.append(row);
 }
 const footer=panel.find('.cky-footer-wrapper').first();
 for(const [selector,action,label] of [['.cky-btn-accept','accept','Accept optional services'],['.cky-btn-reject','reject','Reject optional services'],['.cky-btn-preferences','save','Save preferences']]){
  const button=footer.find(selector);if(button.length!==1)return null;button.attr({'type':'button','data-cloner-consent-action':action,'aria-label':label}).text(label);
 }
 // Retain configured controls, not stale source-cookie claims or service branding.
 footer.find('.cky-prefrence-btn-wrapper').siblings().remove();panel.find('[data-cky-tag]').removeAttr('data-cky-tag');
 const dialog=$('<dialog data-cloner-consent-dialog data-cloner-consent-presentation="cookieyes" aria-label="Privacy preferences"></dialog>').attr('style','box-sizing:border-box;max-width:calc(100vw - 2rem);max-height:calc(100vh - 2rem);padding:0;border:0;overflow:auto;background:transparent').append(panel,$('<p data-cloner-consent-status role="status"></p>'));
 return dialog;
}
export function prepareConsent(input={},forms=[],base=''){
 if(!input||!Array.isArray(input.services||[]))throw Error('consent.json services must be an array');
 const services=[],issues=[],ids=new Set();
 for(const service of input.services||[]){
  try{
   if(!/^[a-z][a-z0-9-]*$/.test(service.id)||ids.has(service.id))throw Error('Invalid or duplicate service ID');ids.add(service.id);
   if(!categories.has(service.category))throw Error('Unsupported optional-service category');
   if(service.type==='form'){
    const form=forms.find(f=>f.id===service.formId);if(!form?.delivery?.endpoint)throw Error('Form is not configured for delivery');
    services.push({id:service.id,type:'form',formId:service.formId,sourceId:form.sourceId,route:form.route,category:service.category,label:String(service.label||service.id),endpoint:form.delivery.endpoint});
   }else if(service.type==='iframe'){
    const url=new URL(service.url);if(url.protocol!=='https:'||url.username||url.password||!service.targetId||typeof service.route!=='string'||!service.route.startsWith('/'))throw Error('Embed requires an HTTPS URL, target ID and local route');
    services.push({id:service.id,type:'iframe',url:url.href,targetId:String(service.targetId),route:service.route,category:service.category,label:String(service.label||service.id)});
   }else throw Error('Unsupported service type');
  }catch(error){issues.push({id:service?.id,reason:error.message});}
 }
 const revision=createHash('sha256').update(JSON.stringify(services)).digest('hex').slice(0,24);
 return {services,issues,revision,storageKey:'website-cloner-consent:'+base};
}
export function applyConsent($,page,config){
 const report={sourceBanners:$(bannerSelector).length,services:[],issues:[]};
 for(const name of ['config','service','category','embed','action','banner','reopen','dialog'])$('[data-cloner-consent-'+name+']').removeAttr('data-cloner-consent-'+name);
 // Only explicitly declared export services participate. Old tracking/vendor lists are not revived.
 $(oldPanels).attr('hidden','hidden').attr('aria-hidden','true').css('display','none!important');
 if(!config.services.length){$(bannerSelector+','+reopenSelector).attr('hidden','hidden').attr('aria-hidden','true').css('display','none!important');report.status='no-configured-optional-services';return report;}
 for(const service of config.services.filter(s=>s.route===(page.sourceRoute||page.route))){
  let elements;
  if(service.type==='form'){
   elements=$('form[data-cloner-delivery]').filter((_,el)=>$(el).attr('data-migration-form-key')===service.formId);
   if(!elements.length&&service.sourceId)elements=$('form[data-cloner-delivery]').filter((_,el)=>$(el).attr('id')===service.sourceId);
   if(elements.length===1)elements.attr('data-cloner-consent-service',service.id).attr('data-cloner-consent-category',service.category);
  }else{
   elements=$('migration-frame[id],[data-cloner-embed][id]').filter((_,el)=>$(el).attr('id')===service.targetId);
   if(elements.length===1){elements.empty().attr('data-cloner-consent-embed',service.id).attr('aria-label',service.label);
    const policies=$('meta[http-equiv]').filter((_,el)=>$(el).attr('http-equiv')?.toLowerCase()==='content-security-policy');
    policies.each((_,node)=>{const el=$(node),value=el.attr('content')||'',pattern=/(^|;)(\s*frame-src\s+)([^;]*)/i,origin=new URL(service.url).origin;el.attr('content',pattern.test(value)?value.replace(pattern,(_,a,b,c)=>a+b+c.replace(/'none'\s*/g,'').trim()+' '+origin):value+'; frame-src '+origin);});
   }
  }
  if(elements.length!==1){report.issues.push({id:service.id,reason:'Missing or ambiguous service target'});continue;}
  report.services.push({id:service.id,type:service.type,category:service.category,status:'consent-required'});
 }
 const originalBanner=$(bannerSelector).first().clone();
 const banner=$(bannerSelector).first();$(bannerSelector).slice(1).attr('hidden','hidden').css('display','none!important');
 if(banner.length){
  banner.attr('data-cloner-consent-banner','');banner.find('.cmplz-message,.cky-notice-des').text('Choose which optional services to enable. Your preferences stay in this browser.');
  for(const [selector,action]of [['.cmplz-accept,.cky-btn-accept','accept'],['.cmplz-deny,.cky-btn-reject','reject'],['.cmplz-view-preferences,.cmplz-save-preferences,.cky-btn-customize','preferences'],['.cmplz-close,.cky-btn-close','dismiss']])banner.find(selector).attr('data-cloner-consent-action',action);
  if(!banner.find('[data-cloner-consent-action=preferences]').length)banner.append('<button type="button" data-cloner-consent-action="preferences">Privacy preferences</button>');
 }else $('body').append('<aside data-cloner-consent-banner><p>Choose which optional services to enable.</p><button type="button" data-cloner-consent-action="accept">Accept optional services</button> <button type="button" data-cloner-consent-action="reject">Reject optional services</button> <button type="button" data-cloner-consent-action="preferences">Preferences</button></aside>');
 $(reopenSelector).attr('data-cloner-consent-action','preferences');
 $('body').append('<button type="button" data-cloner-consent-action="preferences" data-cloner-consent-reopen>Privacy preferences</button>');
 const options=[...new Set(config.services.map(s=>s.category))].map(category=>`<label><input type="checkbox" name="${category}"> ${esc(category)}: ${esc(config.services.filter(s=>s.category===category).map(s=>s.label).join(', '))}</label>`).join('<br>');
 const styledPreferences=sourcePreferences($,originalBanner,config)||cookieYesPreferences($,config);
 if(styledPreferences)$('body').append('<style>:where([data-cloner-consent-presentation=complianz]){inset:auto;margin:0;padding:0}:where([data-cloner-consent-presentation=complianz])::backdrop{background:transparent}[data-cloner-consent-dialog]:not([open]){display:none!important}[data-cloner-consent-dialog] [data-cloner-consent-status]:empty{display:none}</style>',styledPreferences);else $('body').append(`<dialog data-cloner-consent-dialog style="box-sizing:border-box;max-width:calc(100vw - 2rem);max-height:calc(100vh - 2rem);overflow:auto;overflow-wrap:anywhere;font:inherit" aria-label="Privacy preferences"><h2>Privacy preferences</h2><p>Only the optional services listed here are controlled by these settings. Rejecting them keeps local content available.</p>${options}<p><button type="button" data-cloner-consent-action="save">Save preferences</button> <button type="button" data-cloner-consent-action="reject">Reject optional services</button> <button type="button" data-cloner-consent-action="close">Close</button></p><p data-cloner-consent-status role="status"></p></dialog>`);
 // Attribute encoding keeps configuration data out of executable script syntax.
 $('[data-cloner-consent-dialog]').attr('data-cloner-consent-config',JSON.stringify(config));
 report.presentation=styledPreferences?'captured-'+styledPreferences.attr('data-cloner-consent-presentation')+'-components':'generic-accessible-dialog';
 report.status='configured';return report;
}
