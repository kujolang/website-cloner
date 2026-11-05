import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
// Keep Kujo's four read-only tool implementations, adapting discovery and URLs
// to the migrator's final route map instead of intermediate page-NNN slugs.
const source = await readFile(new URL('../vendor/ssg.kujo', import.meta.url), 'utf8');
const block = source.split('func webmcp_runtime_source() {')[1].split('\nfunc inject_webmcp_runtime')[0];
const native = block.split('\n').map(l => l.trim().replace(/,$/, '')).filter(l => l.startsWith('"')).map(l => JSON.parse(l)).join('\n');
export const webmcpRuntime = native
  .replace('i.taxonomies[n].slice(0,5)', 'i.taxonomies[n].slice()')
  .replace('a.content_types.slice(0,25)', 'a.content_types.slice()')
  .replace('a.navigation.slice(0,25)', 'a.navigation.slice()')
  .replace('s=document.currentScript', 's=document.querySelector(\'link[rel="kujo-site-index"]\')')
  .replace("s.dataset.kujoSiteIndex||''", 's.href')
  .replace('return a},F=q=>', `const root=new URL('../',u);const local=v=>{if(typeof v!=='string'||!v.startsWith('/')||v.startsWith('//'))E('invalid local route');const t=new URL(v.slice(1),root);if(t.origin!==location.origin||!t.pathname.startsWith(root.pathname))E('route outside site');return t.pathname};a.items=a.items.map(i=>({...i,url:local(i.url)}));a.navigation=a.navigation.map(i=>({...i,url:local(i.url)}));return a},F=q=>`);
if (webmcpRuntime === native || !webmcpRuntime.includes('const root=new URL')) throw Error('Unrecognized vendored WebMCP runtime');
export const webmcpHash = 'sha256-' + createHash('sha256').update(webmcpRuntime).digest('base64');
