import {spawn} from 'node:child_process';
import {mkdir,cp,readFile,writeFile,stat,statfs} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
const execute=(file,args,options)=>new Promise((resolve,reject)=>{
 const child=spawn(file,args,{stdio:'inherit',...options});
 child.once('error',reject);child.once('exit',(code,signal)=>code===0?resolve():reject(Error(`${path.basename(file)} failed (${signal||code})`)));
});
export const quote=value=>`'${String(value).replaceAll("'", "'\\''")}'`;
const exists=async p=>{try{await stat(p);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}};
export async function install(source,{base=process.env.CLONER_HOME||path.join(os.homedir(),'.local/share/website-cloner'),platform=process.platform,env=process.env,run=execute,log=console.log,checkSpace=true}={}){
 if(!['darwin','linux'].includes(platform))throw Error('Installer supports macOS and Linux only.');
 source=path.resolve(source);base=path.resolve(base);const app=path.join(base,'app');
 if(source===base||base.startsWith(source+path.sep))throw Error('Choose CLONER_HOME outside the source directory.');
 await mkdir(base,{recursive:true});
 // A reinstall must not replace files underneath a running worker.
 const state=path.join(app,'.data/server-process.json');
 if(await exists(state)){const record=JSON.parse(await readFile(state,'utf8'));try{process.kill(record.pid,0);throw Error('Stop the installed cloner before reinstalling. Saved builds will be kept.');}catch(e){if(e.code!=='ESRCH')throw e;}}
 if(checkSpace){const disk=await statfs(base);if(disk.bavail*disk.bsize<900*1024*1024)throw Error('Installation needs about 900 MB of free working space for dependencies and browser files. Free space and rerun; saved builds are untouched.');}
 const command=async(file,args,options={})=>run(file,args,{env,cwd:app,timeout:600000,maxBuffer:4e6,...options});
 const available=async(file,args)=>{try{await command(file,args,{cwd:base,timeout:15000,stdio:'ignore'});return true;}catch{return false;}};
 const missing=[];for(const name of ['zip','unzip'])if(!await available(name,['-v']))missing.push(name);
 if(missing.length){
  if(platform!=='linux'||!await available('apt-get',['--version']))throw Error(`Install ${missing.join(' and ')}, then rerun the installer.`);
  log(`Installing ${missing.join(', ')}; your system may ask for an administrator password.`);
  await command('sudo',['apt-get','update'],{cwd:base});await command('sudo',['apt-get','install','-y',...missing],{cwd:base});
 }
 log('Installing Website Cloner dependencies…');
 await mkdir(app,{recursive:true});
 // Never import developer settings, credentials, builds or installed dependencies.
 const excluded=new Set(['.git','.data','.env','.npmrc','node_modules','artifacts','work','seo-audit']);
 if(source!==app)await cp(source,app,{recursive:true,filter:p=>!path.relative(source,p).split(path.sep).some(part=>excluded.has(part)||part.startsWith('.env.'))});
 await command('npm',['ci','--ignore-scripts','--no-audit','--no-fund']);
 const tools=path.join(base,'runtime/tools');
 log('Installing the Kujo runtime (no ecosystem services)…');
 await command('npm',['install','--prefix',tools,'--no-audit','--no-fund','--ignore-scripts','--save-exact','@kujolang/kujo-runtime@1.9.0']);
 const kujo=path.join(tools,'node_modules/.bin/kujo');
 await command(kujo,['--version']);
 const browsers=path.join(base,'runtime/browsers');
 const runtimeEnv={...env,KUJO_BIN:kujo,PLAYWRIGHT_BROWSERS_PATH:browsers};
 log('Setting up the browser…');
 let channel=env.BROWSER_CHANNEL||'chrome';
 const probe=`import('playwright').then(async({chromium})=>{const b=await chromium.launch({channel:${JSON.stringify(channel)},headless:true});await b.close()})`;
 try{await command(process.execPath,['-e',probe],{env:runtimeEnv,stdio:'ignore'});}catch{
  if(!['chrome','chromium'].includes(channel))throw Error(`Browser channel ${channel} is unavailable. Install it or use BROWSER_CHANNEL=chromium.`);
  channel='chromium';
  await command(process.execPath,['node_modules/playwright/cli.js','install','chromium'],{env:runtimeEnv});
  if(platform==='linux'){
   log('Installing Chromium system libraries; your system may ask for an administrator password.');
   await command(process.execPath,['node_modules/playwright/cli.js','install-deps','chromium'],{env:runtimeEnv});
  }
 }
 const bin=path.join(base,'bin');await mkdir(bin,{recursive:true});
 const launcher=path.join(bin,'website-cloner');
 const nodeDir=path.dirname(process.execPath);
 await writeFile(launcher,`#!/usr/bin/env bash\nset -euo pipefail\nexport PATH=${quote(nodeDir)}:"$PATH"\nexport KUJO_BIN=${quote(kujo)}\nexport PLAYWRIGHT_BROWSERS_PATH=${quote(browsers)}\nexport BROWSER_CHANNEL="\${BROWSER_CHANNEL:-${channel}}"\ncd ${quote(app)}\nexec ${quote(process.execPath)} scripts/launch.mjs "\${1:-start}"\n`,{mode:0o755});
 const launchEnv={...runtimeEnv,BROWSER_CHANNEL:channel};
 await command(process.execPath,['--env-file-if-exists=.env','scripts/doctor.mjs'],{env:launchEnv});
 const desktopLauncher=path.join(base,platform==='darwin'?'Website Cloner.command':'website-cloner.sh');
 await writeFile(desktopLauncher,`#!/usr/bin/env bash\nexec ${quote(launcher)} start\n`,{mode:0o755});
 await command(launcher,['start'],{env:launchEnv});
 log(`Ready. Open again: ${desktopLauncher}\nStop: ${quote(launcher)} stop\nRestart: ${quote(launcher)} restart`);
 return {app,launcher,channel};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{await install(process.argv[2]||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'));}catch(e){console.error(`Installation stopped: ${e.message}`);process.exitCode=1;}
}
