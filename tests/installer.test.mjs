import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,stat} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {install,quote} from '../scripts/install.mjs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
async function fixture(fn){
 const root=await mkdtemp(path.join(os.tmpdir(),"cloner setup ' "));
 const source=path.join(root,'source'),base=path.join(root,'installed');
 await mkdir(source);await writeFile(path.join(source,'package.json'),'{}');
 for(const dir of ['.data','.git','node_modules']){await mkdir(path.join(source,dir));await writeFile(path.join(source,dir,'private'),'private');}
 await writeFile(path.join(source,'.env'),'SECRET=private');
 const calls=[];
 const run=async(file,args,options)=>{calls.push({file,args,options});return {stdout:''};};
 try{await fn({root,source,base,calls,run});}finally{await rm(root,{recursive:true,force:true});}
}
test('fresh install isolates dependencies, excludes private state, validates then launches',()=>fixture(async({source,base,calls,run})=>{
 const result=await install(source,{base,platform:'darwin',run,checkSpace:false,log:()=>{}});
 for(const name of ['.env','.data','.git','node_modules'])await assert.rejects(stat(path.join(result.app,name)),{code:'ENOENT'});
 assert.ok(calls.some(c=>c.args.includes('@kujolang/kujo-runtime@1.9.0')));
 assert.equal(result.channel,'chrome');
 const doctor=calls.findIndex(c=>c.args.includes('scripts/doctor.mjs'));
 assert.ok(doctor>0);assert.equal(calls.at(-1).file,result.launcher);assert.ok(doctor<calls.length-1);
 const script=await readFile(result.launcher,'utf8');await exec('bash',['-n',result.launcher]);
 assert.ok(script.includes('KUJO_BIN='));assert.ok(script.includes('PLAYWRIGHT_BROWSERS_PATH='));
 assert.ok((await stat(result.launcher)).mode&0o100);
}));
test('reinstall preserves user settings and saved builds',()=>fixture(async({source,base,run})=>{
 const app=path.join(base,'app');await mkdir(path.join(app,'.data'),{recursive:true});
 await writeFile(path.join(app,'.env'),'PORT=4999');await writeFile(path.join(app,'.data','job'),'keep');
 await install(source,{base,run,checkSpace:false,log:()=>{}});
 assert.equal(await readFile(path.join(app,'.env'),'utf8'),'PORT=4999');assert.equal(await readFile(path.join(app,'.data/job'),'utf8'),'keep');
}));
test('running installation cannot be overwritten',()=>fixture(async({source,base,run,calls})=>{
 await mkdir(path.join(base,'app/.data'),{recursive:true});await writeFile(path.join(base,'app/.data/server-process.json'),JSON.stringify({pid:process.pid}));
 await assert.rejects(install(source,{base,run,checkSpace:false}),/Stop the installed/);assert.equal(calls.length,0);
}));
test('missing Chrome installs private Chromium and Linux dependencies before validation',()=>fixture(async({source,base,run,calls})=>{
 const result=await install(source,{base,platform:'linux',checkSpace:false,log:()=>{},run:async(...args)=>{await run(...args);if(args[1][0]==='-e')throw Error('No Chrome');}});
 assert.equal(result.channel,'chromium');
 assert.ok(calls.some(c=>c.args.includes('install-deps')));
 assert.equal(calls.find(c=>c.args.includes('scripts/doctor.mjs')).options.env.BROWSER_CHANNEL,'chromium');
}));
test('failed dependency install stops before browser launch or server startup',()=>fixture(async({source,base,run,calls})=>{
 await assert.rejects(install(source,{base,checkSpace:false,log:()=>{},run:async(...args)=>{await run(...args);if(args[1][0]==='ci')throw Error('Download failed');}}),/Download failed/);
 assert.ok(!calls.some(c=>c.args.includes('start')));
}));
test('missing zip tools use apt only on supported package-manager systems',()=>fixture(async({source,base,run,calls})=>{
 await install(source,{base,platform:'linux',checkSpace:false,log:()=>{},run:async(...args)=>{await run(...args);if(['zip','unzip'].includes(args[0]))throw Error('missing');}});
 assert.ok(calls.some(c=>c.file==='sudo'&&c.args.join(' ')==='apt-get install -y zip unzip'));
}));
test('shell paths are literal even with spaces, quotes and metacharacters',async()=>{
 const value="a ' $(touch /tmp/should-not-run) `echo bad`";
 assert.equal((await exec('bash',['-c',`printf %s ${quote(value)}`])).stdout,value);
});
test('source cannot contain installation destination',()=>fixture(async({source,run})=>{
 await assert.rejects(install(source,{base:path.join(source,'nested'),run,checkSpace:false}),/outside/);
}));
test('explicit private Chromium is installed and retained in the launcher environment',()=>fixture(async({source,base,run,calls})=>{
 const result=await install(source,{base,platform:'darwin',env:{...process.env,BROWSER_CHANNEL:'chromium'},checkSpace:false,log:()=>{},run:async(...args)=>{await run(...args);if(args[1][0]==='-e')throw Error('No private browser yet');}});
 assert.equal(result.channel,'chromium');
 assert.ok(calls.find(c=>c.args[0]==='-e').args[1].includes('"chromium"'));
 assert.ok(calls.some(c=>c.args.join(' ')==='node_modules/playwright/cli.js install chromium'));
 assert.equal(calls.at(-1).options.env.BROWSER_CHANNEL,'chromium');
}));
test('unavailable explicitly selected browser channel fails without silently replacing it',()=>fixture(async({source,base,run,calls})=>{
 await assert.rejects(install(source,{base,env:{...process.env,BROWSER_CHANNEL:'chrome-beta'},checkSpace:false,log:()=>{},run:async(...args)=>{await run(...args);if(args[1][0]==='-e')throw Error('No beta');}}),/chrome-beta is unavailable/);
 assert.ok(!calls.some(c=>c.args.includes('scripts/doctor.mjs')));
}));
