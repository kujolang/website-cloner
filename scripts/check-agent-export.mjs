import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
export async function checkAgentExport(output, routes, base = '') {
  const index = JSON.parse(await readFile(path.join(output, '.well-known/kujo-site-index.json'), 'utf8'));
  const llms = await readFile(path.join(output, 'llms.txt'), 'utf8');
  const expected = routes.filter(p => !/\b(noindex|none)\b/i.test(p.robots || ''));
  if (index.schema !== 'kujo-ssg-site-index/v1' || index.items.length !== expected.length) throw Error('Agent index coverage mismatch');
  if (!llms.startsWith('# ')) throw Error('Invalid llms.txt');
  for (const p of routes) {
    const dest = p.route.endsWith('/') || !path.posix.extname(p.route) ? path.posix.join(decodeURIComponent(p.route), 'index.html') : decodeURIComponent(p.route);
    await access(path.join(output, dest));
    const html = await readFile(path.join(output, dest), 'utf8');
    if (!html.includes('data-kujo-webmcp') || !html.includes(`href="${base}/.well-known/kujo-site-index.json"`)) throw Error('Missing WebMCP discovery: ' + p.route);
  }
  for (const p of expected) {
    if (!index.items.some(i => i.id === p.route && i.url === p.route && i.type === (p.collection || 'pages'))) throw Error('Missing agent route: ' + p.route);
    const url = index.site.url.replace(/\/$/, '') + encodeURI(p.route).replace(/%25([a-f0-9]{2})/gi,'%$1').replace(/[()]/g,c=>'%' + c.charCodeAt(0).toString(16));
    if (!llms.includes('](' + url + ')')) throw Error('Missing llms route: ' + p.route);
  }
  return { status: 'passed', publicPages: expected.length, pagesWithWebMCP: routes.length };
}
