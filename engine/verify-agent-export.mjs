import { checkAgentExport } from '../scripts/check-agent-export.mjs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
export async function verifyAgentExport(browser, project, origin) {
  try {
    let routes;
    try { routes=JSON.parse(await readFile(path.join(project,'output/export-routes.json'),'utf8')); }
    catch(error){if(error.code!=='ENOENT')throw error;routes=JSON.parse(await readFile(path.join(project,'routes.json'),'utf8'));}
    const result = await checkAgentExport(path.join(project,'output'), routes);
    const page = await browser.newPage();
    try {
      // API contract harness works even when Chrome's experimental API is absent.
      await page.addInitScript(() => {
        window.__agentTools = {};
        Object.defineProperty(document, 'modelContext', { configurable:true, value:{registerTool(tool){window.__agentTools[tool.name]=tool;}} });
      });
      await page.goto(origin + routes[0].route);
      const evidence = await page.evaluate(async () => {
        const t=window.__agentTools;
        if(Object.keys(t).sort().join(',')!=='get_content,get_site_info,list_content,search_site') throw Error('Expected four WebMCP tools');
        const info=await t.get_site_info.execute({});
        const list=await t.list_content.execute({type:info.content_types[0]?.name || 'pages',limit:1});
        let content=null,search=null;
        if(list.items.length){content=await t.get_content.execute({id:list.items[0].id});search=await t.search_site.execute({query:content.title.slice(0,200)||'page',limit:1});}
        return {tools:Object.keys(t),schema:info.schema,url:content?.url,searchExecuted:Boolean(search)};
      });
      if(evidence.url && !(await fetch(origin+evidence.url)).ok) throw Error('WebMCP result route is unavailable');
      return {...result, runtime:'passed-api-contract-harness', ...evidence};
    } finally {await page.close();}
  } catch(error){return {status:'failed',error:error.message};}
}
