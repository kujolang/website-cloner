// Convert a known public booking widget into a portable link. Never retain or
// execute source onclick handlers, and never invent a provider/account URL.
export function captureHostedActions($){
 const targets=$('iframe[src]').map((_,el)=>$(el).attr('src')).get().filter(src=>{try{const u=new URL(src);return u.protocol==='https:'&&u.hostname==='book.housecallpro.com'&&u.pathname.startsWith('/book/')&&!u.username&&!u.password;}catch{return false;}});
 const unique=[...new Set(targets)];if(unique.length!==1)return;
 $('a[onclick]').each((_,el)=>{const a=$(el);if(/^\s*HCPWidget\.openModal\(\)\s*;?\s*$/.test(a.attr('onclick')||''))a.attr('href',unique[0]).attr('target','_blank').attr('rel','noopener noreferrer').removeAttr('onclick');});
}
