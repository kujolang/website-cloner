import assert from 'node:assert/strict';
import {mkdtemp,cp,readFile,writeFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';import path from 'node:path';import {load} from 'cheerio/slim';
import {run} from '../../engine/pipeline.mjs';import {serveStatic} from '../../engine/static.mjs';
import {verifyNavigation} from '../../engine/verify-navigation.mjs';import {chromium} from 'playwright';
const artifact=path.resolve(process.argv[2]||'artifacts/platform/ultimate-variants-installed'),temp=await mkdtemp(path.join(tmpdir(),'ultimate-deep-menus-'));
const pages=await readdir(path.join(artifact,'project/content/pages'));
const variants=['nested','contained','fullwidth','flyout-left','flyout-right','flyout-left-push','flyout-right-push'].filter(name=>pages.includes('menu-'+name+'.md'));
assert.ok(variants.includes('nested'),'Installed nested menu fixture is required');
let browser,server;
try{
 await cp(path.join(artifact,'project'),temp,{recursive:true});
 for(const name of ['finish-export.mjs','menu-authoring.mjs','semantic-export.mjs','component-addon-navigation.js','component-export.mjs','component-markup.mjs'])await cp(new URL('../../scripts/'+name,import.meta.url),path.join(temp,'scripts',name));
 await cp(new URL('../../scripts/build-export.mjs',import.meta.url),path.join(temp,'scripts/build.mjs'));
 const build=()=>run(process.execPath,['scripts/build.mjs'],{cwd:temp,timeout:120000});
 const readRoute=async route=>load(await readFile(path.join(temp,'output',route,'index.html'),'utf8'));
 await build();
 const file=path.join(temp,'menus.json'),data=JSON.parse(await readFile(file));
 const [id,menu]=Object.entries(data.menus).find(([,menu])=>menu.items.some(item=>item.children?.some(child=>child.children?.length)));
 const parent=menu.items.find(item=>item.children),branch=parent.children[0],leaf=branch.children[0];
 parent.label='Our services';branch.label='Planning options';
 branch.children=[{id:'new-consultation',template:leaf.id,label:'New consultation',url:'/menu-nested/'},{...leaf,label:'Contact our team'}];
 menu.items=[menu.items.find(item=>item!==parent),parent];
 await writeFile(file,JSON.stringify(data,null,2));await build();
 for(const variant of variants){
  const $=await readRoute('menu-'+variant),nav=$('.elementor-widget-navigation-menu nav');
  assert.deepEqual(nav.find('a').map((_,el)=>$(el).text().trim()).get(),['Contact','Our services','Planning options','New consultation','Contact our team']);
  assert.equal(nav.find('.hfe-menu-toggle').length,2,'Both captured disclosure icons remain');
  assert.equal(nav.find('[aria-current=page]').length,variant==='nested'?1:0);
  assert.equal(nav.find('.current-menu-ancestor').length,variant==='nested'?2:0);
 }
 const contentFile=path.join(temp,'content/pages/menu-nested.md');
 await writeFile(contentFile,(await readFile(contentFile,'utf8')).replace('permalink: /menu-nested/','permalink: /menu-authored/'));await build();
 const renamed=await readRoute('menu-authored');
 assert.equal(renamed('.elementor-widget-navigation-menu [aria-current=page]').attr('href'),'/menu-authored/');
 assert.equal(renamed('.elementor-widget-navigation-menu .current-menu-ancestor').length,2);
 assert.equal(Object.keys(JSON.parse(await readFile(file)).menus).length,Object.keys(data.menus).length);
 server=await serveStatic(path.join(temp,'output'));browser=await chromium.launch({channel:'chrome'});const checks=[];
 for(const variant of variants)for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900}});page.setDefaultTimeout(12000);
  await page.goto(server.url+(variant==='nested'?'/menu-authored/':'/menu-'+variant+'/'),{waitUntil:'networkidle'});
  const result=(await verifyNavigation(page)).find(r=>r.kind==='addon-navigation');assert.equal(result?.status,'passed',JSON.stringify(result));assert.equal(result.disclosures,2);
  checks.push({variant,width,...result});await page.close();
 }
 await browser.close();browser=null;await server.close();server=null;
 // Remove every third-level child: the former parent must become an ordinary link.
 const latest=JSON.parse(await readFile(file));const authoredBranch=latest.menus[id].items.find(item=>item.children).children[0];authoredBranch.children=[];
 await writeFile(file,JSON.stringify(latest,null,2));await build();
 for(const variant of variants){const $=await readRoute(variant==='nested'?'menu-authored':'menu-'+variant),nav=$('.elementor-widget-navigation-menu nav');assert.equal(nav.find('.hfe-menu-toggle').length,1);assert.equal(nav.find('a').length,3);assert.doesNotMatch(nav.text(),/New consultation|Contact our team/);}
 const result={authoredMenu:id,sharedDefinitions:Object.keys(data.menus).length,threeLevelAddReorderRelabel:true,renamedRoute:true,currentAncestors:2,iconsPreserved:true,emptyBranchDemoted:true,checks};
 await writeFile(path.join(artifact,'ultimate-deep-menu-authoring-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser?.close();await server?.close();await rm(temp,{recursive:true,force:true});}
