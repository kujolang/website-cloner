import {createReadStream,createWriteStream} from 'node:fs';
import {rename,rm} from 'node:fs/promises';
import {pipeline} from 'node:stream/promises';
import {randomUUID} from 'node:crypto';
import {parseChunked,stringifyChunked} from '@discoveryjs/json-ext';
// Whole-site snapshots can exceed V8's single-string limit. Keep ordinary JSON
// on disk, but never assemble the entire document into a JavaScript string.
export const readJSON=file=>parseChunked(createReadStream(file));
export async function writeJSON(file,value){
 const temporary=file+'.'+randomUUID()+'.tmp';
 try{
  await pipeline(stringifyChunked(value,{space:2,highWaterMark:65536}),createWriteStream(temporary,{flags:'wx',mode:0o600}));
  await rename(temporary,file);
 }catch(error){await rm(temporary,{force:true});throw error;}
}
