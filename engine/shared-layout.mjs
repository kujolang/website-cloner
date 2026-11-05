import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
// Intern repeated structured data, never rendered HTML. References remain local
// and are resolved before author fields are merged into the rendering context.
export async function shareLayoutData(project,files){
 const counts=new Map();
 const key=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0,20);
 const visit=v=>{if(!v||typeof v!=='object')return;const text=JSON.stringify(v);if(text.length>=250){const id=key(v);counts.set(id,(counts.get(id)||0)+1);}for(const child of Object.values(v))visit(child);};
 let beforeBytes=0;
 for(const file of files){const text=await readFile(path.join(project,file),'utf8');beforeBytes+=Buffer.byteLength(text);visit(JSON.parse(text));}
 const shared={};
 function compact(v,root=false){
  if(!v||typeof v!=='object')return v;
  const id=key(v);
  if(!root&&counts.get(id)>1){if(!shared[id])shared[id]=compact(v,true);return {$shared:id};}
  return Array.isArray(v)?v.map(x=>compact(x)):Object.fromEntries(Object.entries(v).map(([k,x])=>[k,compact(x)]));
 }
 let afterBytes=0;
 for(const file of files){const data=JSON.parse(await readFile(path.join(project,file),'utf8'));const text=JSON.stringify(compact(data,true),null,2);afterBytes+=Buffer.byteLength(text);await writeFile(path.join(project,file),text);}
 const text=JSON.stringify(shared,null,2);afterBytes+=Buffer.byteLength(text);await writeFile(path.join(project,'templates/data/shared.json'),text);
 return {definitions:Object.keys(shared).length,beforeBytes,afterBytes};
}
