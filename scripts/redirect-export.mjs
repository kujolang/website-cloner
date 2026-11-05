import {createHash} from 'node:crypto';
export const redirectImportFingerprint = imported => createHash('sha256').update(JSON.stringify({redirects:imported.redirects||[],groups:imported.groups||[]})).digest('hex');
import {mkdir,writeFile,stat} from 'node:fs/promises';
import path from 'node:path';
const codes=new Set([301,302,303,307,308]);
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function localPath(value){
 if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||/[\\?#\s\x00-\x1f*:]/.test(value))throw Error('Source must be a literal local path without query or fragment');
 for(const part of value.split('/')){const decoded=decodeURIComponent(part);if(['.','..'].includes(decoded)||/[\\/\x00-\x20]/.test(decoded))throw Error('Unsafe path segment');}
 if(new URL(value,'https://local.invalid').pathname!==value)throw Error('Noncanonical path');
 return value;
}
const fileKey=route=>{const decoded=decodeURIComponent(route);return path.posix.extname(decoded)&&!decoded.endsWith('/')?decoded:decoded.replace(/\/?$/,'/')+'index.html';};
export function redirectPlan({observed=[],imported={redirects:[]},routes=[],source,base=''}){
 if(!Array.isArray(imported.redirects||[])||!Array.isArray(imported.groups||[])||!Array.isArray(observed))throw Error('Redirect configuration must contain arrays');
 const origin=new URL(source).origin,issues=[],rules=[],bySource=new Map();
 const known=new Set(routes.map(p=>p.route)),moved=new Map(routes.filter(p=>p.sourceRoute).map(p=>[p.sourceRoute,p.route]));
 const groups=new Map((imported.groups||[]).map(g=>[g.id,g]));
 const candidates=[...(imported.redirects||[]).map(r=>({raw:r,kind:'owner-import'})),...observed.map(r=>({raw:r,kind:'observed'}))];
 for(const {raw:r,kind}of candidates){
  const id=kind==='owner-import'?(r.id??r.url):r.from;const issue=reason=>issues.push({kind,id,reason});
  if(kind==='owner-import'&&r.group_id!==undefined&&!groups.has(r.group_id)&&typeof r.enabled!=='boolean'){issue('missing-group-state');continue;}
  if(r.enabled===false||r.status==='disabled'||groups.get(r.group_id)?.enabled===false||groups.get(r.group_id)?.status==='disabled'&&r.enabled!==true){issue('disabled-rule');continue;}
  if(groups.get(r.group_id)?.status==='disabled'&&r.enabled===true)issue('group-status-conflicts-with-enabled-rule');
  try{
   let from,to,status;
   if(kind==='owner-import'){
    const flags=r.match_data?.source||{};
    if(r.action_type!=='url'||r.match_type!=='url'){issue('conditional-or-non-redirect-action');continue;}
    if(r.regex||flags.flag_regex||flags.flag_case||flags.flag_trailing){issue('regex-case-or-trailing-match-not-supported');continue;}
    if(flags.flag_query!=='ignore'){issue('query-matching-requires-server-rule');continue;}
    from=r.url;to=typeof r.action_data==='string'?r.action_data:r.action_data?.url;status=r.action_code;
   }else{
    const fromURL=new URL(r.from,source);if(fromURL.origin!==origin){issue('source-origin-not-exported');continue;}
    if(fromURL.search||fromURL.hash){issue('query-matching-requires-server-rule');continue;}
    from=fromURL.pathname;to=r.to;status=r.status;
   }
   from=localPath(from);if(!codes.has(status))throw Error('Unsupported redirect status');
   if(typeof to!=='string'||/[\s\x00-\x1f\\]/.test(to))throw Error('Invalid target');
   const target=new URL(to,source);if(!['http:','https:'].includes(target.protocol)||target.username||target.password)throw Error('Unsafe target');
   const local=target.origin===origin;let targetPath;
   if(local){targetPath=localPath(target.pathname);targetPath=moved.get(targetPath)||targetPath;}
   const destination=local?targetPath+target.search+target.hash:target.href;
   if(local&&from===targetPath)throw Error('Self redirect');
   if(bySource.has(from)){issue(bySource.get(from).destination===destination&&bySource.get(from).status===status?'duplicate-rule':'conflicting-rule');continue;}
   const rule={from,destination,status,kind,local,targetPath};bySource.set(from,rule);rules.push(rule);
  }catch(error){issue(error.message);}
 }
 // Walk each graph edge once. Cycles and their upstream paths cannot produce a usable export.
 const states=new Map();
 function valid(start){
  const trail=[],seen=new Set();let current=start,ok;
  while(true){if(states.has(current)){ok=states.get(current);break;}if(seen.has(current)){ok=false;break;}seen.add(current);trail.push(current);
   const rule=bySource.get(current);if(!rule){ok=known.has(current);break;}if(!rule.local){ok=true;break;}current=rule.targetPath;
  }
  for(const item of trail)states.set(item,ok);return ok;
 }
 const accepted=rules.filter(r=>{if(valid(r.from))return true;issues.push({kind:r.kind,id:r.from,reason:'cycle-or-missing-local-destination'});return false;});
 return {schema:'website-cloner-redirects/v1',importFingerprint:redirectImportFingerprint(imported),rules:accepted.map(r=>({...r,publicSource:base+r.from,publicDestination:r.local?base+r.destination:r.destination})),issues,limitations:['Observed redirects establish behavior for the captured request only; query and visitor-specific behavior is unknown.','GitHub Pages/static fallback uses HTML navigation, not HTTP status codes or method-preserving redirects.']};
}
export async function exportRedirects(options){
 const {output='output',routes=[]}=options,report=redirectPlan(options),lines=[],occupied=new Set(routes.map(p=>fileKey(p.route)));
 for(const rule of report.rules){
  const key=fileKey(rule.from),line=`${rule.publicSource} ${rule.publicDestination} ${rule.status}`;
  const collision=occupied.has(key)&&!routes.some(p=>p.generatedAlias&&fileKey(p.route)===key&&p.canonicalRoute===rule.targetPath);
  const reserved=/^\/(?:assets|images|\.well-known|feed)(?:\/|$)/.test(rule.from)||/^\/(?:_|sitemap\.xml|robots\.txt|llms\.txt|export-routes\.json|archive-manifest\.json)/.test(rule.from);
  if(collision||reserved){rule.cloudflare='not-exported';rule.static='not-exported';report.issues.push({id:rule.from,reason:'existing-or-reserved-route'});continue;}
  if(lines.length>=2000||line.length>1000){rule.cloudflare='not-exported';report.issues.push({id:rule.from,reason:'cloudflare-rule-limit'});}else{lines.push(line);rule.cloudflare='http-rule';}
  const dest=path.join(output,key);
  if(key.split('/').some(segment=>Buffer.byteLength(segment)>255)||Buffer.byteLength(dest)>4096){rule.static='not-exported';report.issues.push({id:rule.from,reason:'static-path-exceeds-filesystem-limit'});continue;}
  if(!key.endsWith('.html')||[307,308].includes(rule.status)){rule.static='not-exported';report.issues.push({id:rule.from,reason:'static-host-cannot-preserve-status-or-resource-type'});continue;}
  if(await stat(dest).catch(()=>null)){rule.static='existing-alias';continue;}
  await mkdir(path.dirname(dest),{recursive:true});
  await writeFile(dest,`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,follow"><meta http-equiv="refresh" content="0;url=${escape(rule.publicDestination)}"><title>Page moved</title></head><body><main><h1>Page moved</h1><p><a href="${escape(rule.publicDestination)}">Continue to the new address</a></p></main></body></html>`);
  rule.static='html-fallback';
 }
 if(lines.length)await writeFile(path.join(output,'_redirects'),lines.join('\n')+'\n');
 return report;
}

// Static page links perform GET navigation. Resolve verified local chains to
// their authored destination without pretending an HTML file preserves 307/308.
export function applyRedirectNavigation($,plan,{routes,source,base=''}) {
 const known=new Set(routes.map(p=>p.route)),rules=new Map(plan.rules.map(r=>[r.from,r])),rewrites=[];
 const origin=new URL(source).origin;
 $('a[href],a[data-migration-unavailable]').each((_,node)=>{
  const a=$(node);if(a.is('[data-migration-dynamic]'))return;
  const raw=a.attr('data-migration-unavailable')||a.attr('href');let url;
  try{url=new URL(raw,source);}catch{return;}
  if(url.origin!==origin||url.search||url.hash)return;
  let from=url.pathname;if(base&&from.startsWith(base+'/'))from=from.slice(base.length);
  if(known.has(from)||!rules.has(from))return;
  const seen=new Set();let target=from;
  while(rules.has(target)&&!seen.has(target)){
   seen.add(target);const rule=rules.get(target);
   if(!rule.local||rule.destination!==rule.targetPath)return;
   target=rule.targetPath;
  }
  if(!known.has(target)||seen.has(target))return;
  a.attr('href',base+target).attr('data-migration-redirect',from).removeAttr('aria-disabled data-migration-unavailable');
  if(a.attr('title')==='This destination was not included in this static export.')a.removeAttr('title');
  rewrites.push({from,to:target});
 });
 return rewrites;
}
