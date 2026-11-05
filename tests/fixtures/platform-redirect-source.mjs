import assert from 'node:assert/strict';import {readFile,writeFile} from 'node:fs/promises';import path from 'node:path';
const root=path.resolve(process.argv[2]||'work/redir'),origin='http://127.0.0.1:9432',results=[];
for(const [route,status,target]of [['/old-about/',301,'/about/'],['/temporary/',302,'/services/'],['/chain/',307,'/old-about/'],['/method/',308,'/contact/'],['/disabled/',404,null],['/enabled-in-disabled-group/',301,'/about/']]){
 const response=await fetch(origin+route,{redirect:'manual'}),location=response.headers.get('location');assert.equal(response.status,status,route);if(target)assert.equal(new URL(location,origin).pathname,target);else assert.equal(location,null);results.push({route,status:response.status,location});
}
const data=JSON.parse(await readFile(path.join(root,'redirects-export.json'),'utf8'));assert.equal(data.redirects.length,8);assert.ok(data.groups.some(g=>g.status==='disabled'));await writeFile(path.join(root,'source-http-check.json'),JSON.stringify({plugin:data.plugin.version,results},null,2));console.log(JSON.stringify(results));
