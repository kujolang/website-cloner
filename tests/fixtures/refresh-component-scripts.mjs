import {cp,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
// Candidate-runtime checks must copy the registry together with every dependency.
// Keep generated-source checks separate: they deliberately test shipped scripts.
export async function refreshComponentScripts(project){
 const source=fileURLToPath(new URL('../../scripts/',import.meta.url));
 for(const name of await readdir(source)){
  if(name==='form-export.mjs'||/^component-.*\.(?:js|mjs)$/.test(name)||/^vendor-.*\.js$/.test(name))await cp(path.join(source,name),path.join(project,'scripts',name));
 }
}
