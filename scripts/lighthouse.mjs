import lighthouse from 'lighthouse';
import { chromium } from 'playwright';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';import net from 'node:net';
import { serveStatic } from '../engine/static.mjs';
const project=path.resolve(process.argv[2] || '');if(!process.argv[2])throw Error('Usage: npm run audit:lighthouse -- PROJECT REPORT_DIRECTORY');
const destination=path.resolve(process.argv[3] || path.join(project,'audit/lighthouse'));await mkdir(destination,{recursive:true});
const server=await serveStatic(path.join(project,'output'));const temp=await mkdtemp(path.join(os.tmpdir(),'migration-lighthouse-'));
const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'chrome',headless:true,args:[`--remote-debugging-port=${port}`]});
try {
 for(const formFactor of ['desktop','mobile']) {
  const options={port,output:['json','html'],onlyCategories:['performance','seo','accessibility','best-practices'],logLevel:'error'};
  if(formFactor==='desktop') options.preset='desktop';
  const result=await lighthouse(server.url+'/',options);
  await writeFile(path.join(destination,formFactor+'.json'),result.report[0]);await writeFile(path.join(destination,formFactor+'.html'),result.report[1]);
  console.log(JSON.stringify({formFactor,lighthouseVersion:result.lhr.lighthouseVersion,categories:Object.fromEntries(Object.entries(result.lhr.categories).map(([k,v])=>[k,v.score]))}));
 }
}finally {await browser.close();await server.close();await rm(temp,{recursive:true,force:true});}
