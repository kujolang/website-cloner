import {spawnSync,spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const action=process.argv[2]||'start';
if(!['start','restart','stop'].includes(action)){console.error('Usage: website-cloner start|restart|stop');process.exit(1);}
const result=spawnSync(process.execPath,['scripts/server-control.mjs',action],{cwd:root,env:process.env,stdio:'inherit'});
if(result.error||result.status!==0){console.error(result.error?.message||'Could not start Website Cloner.');process.exit(result.status||1);}
if(action!=='stop'){
 try{process.loadEnvFile(path.join(root,'.env'));}catch(e){if(e.code!=='ENOENT')throw e;}
 const url=`http://127.0.0.1:${Number(process.env.PORT||4310)}/`;
 const opener=process.platform==='darwin'?'open':'xdg-open';
 const child=spawn(opener,[url],{stdio:'ignore',detached:true});
 child.on('error',()=>console.log(`Open ${url} in your browser.`));child.unref();
}
