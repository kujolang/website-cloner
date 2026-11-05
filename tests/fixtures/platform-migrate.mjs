import assert from 'node:assert/strict';import path from 'node:path';import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {migrate} from '../../engine/pipeline.mjs';
const root=path.resolve(process.argv[2]||'work/platform-fixtures'),output=path.resolve(process.argv[3]||'artifacts/platform/events');
const kind=process.argv.find(arg=>arg.startsWith('--kind='))?.slice(7);
const source=kind?{fixture:JSON.parse(await readFile(path.join(root,kind+'-ready.json')))}:JSON.parse(await readFile(path.join(root,'runtime-evidence.json')));
const entry=process.argv.find(arg=>arg.startsWith('--entry='))?.slice(8)||'/';
const url=kind?new URL(entry,source.fixture.url).href:source.events[0].url,origin=new URL(url).origin;
assert.equal(new URL(url).hostname,'127.0.0.1');assert.equal(source.fixture.authorized,true);
const wholeSite=process.argv.includes('--whole-site');
const requestedLimit=process.argv.find(arg=>arg.startsWith('--page-limit='))?.slice(13),pageLimit=requestedLimit===undefined?12:Number(requestedLimit);
assert.ok(Number.isSafeInteger(pageLimit)&&pageLimit>0,'Fixture page limit must be a positive integer');assert.ok(!(wholeSite&&requestedLimit!==undefined),'Choose whole-site or a fixture page limit, not both');
await mkdir(output,{recursive:true});const started=Date.now();
try{
 const result=await migrate(url,output,{fixtureOrigins:[origin],maxPages:wholeSite?null:pageLimit,aiEnabled:false,resume:process.argv.includes("--rebuild")||process.argv.includes("--resume"),rebuild:process.argv.includes("--rebuild"),event:(stage,counts)=>console.log(stage,JSON.stringify(counts||{}))});
 const report={fixture:source.fixture,status:result.report.status,elapsedMs:Date.now()-started,metrics:result.report.metrics,scope:wholeSite?'Whole installed-plugin fixture crawl; not whole-plugin acceptance.':`Explicit ${pageLimit}-page installed-plugin fixture sample; not whole-plugin acceptance.`};
 await writeFile(path.join(output,'platform-run.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(error){await writeFile(path.join(output,'platform-run.json'),JSON.stringify({status:'failed',elapsedMs:Date.now()-started,error:error.message},null,2));throw error;}
