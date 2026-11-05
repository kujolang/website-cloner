import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
const run=promisify(execFile);
// Fidelity first: only replace source pixels with a smaller lossless WebP.
// Recompressing already-lossy JPEGs causes visible artifacts. Never flatten animation.
export async function optimizeImage(body,type,{encoder=process.env.CWEBP_BIN||'cwebp'}={}) {
  if(!['image/png','image/jpeg'].includes(type))return {body,type,status:'preserved-format'};
  if(type==='image/png'){
    for(let pos=8;pos+12<=body.length;){const size=body.readUInt32BE(pos),kind=body.toString('ascii',pos+4,pos+8);if(kind==='acTL')return {body,type,status:'preserved-animation'};pos+=size+12;}
  }
  const dir=await mkdtemp(path.join(tmpdir(),'migration-image-'));
  try{
    const src=path.join(dir,type==='image/png'?'source.png':'source.jpg'),dest=path.join(dir,'image.webp');
    await writeFile(src,body);
    await run(encoder,['-quiet','-mt','-lossless','-exact','-metadata','all',src,'-o',dest],{timeout:120000,maxBuffer:65536});
    const output=await readFile(dest);
    if(output.length>=body.length || output.toString('ascii',0,4)!=='RIFF' || output.toString('ascii',8,12)!=='WEBP')return {body,type,status:'preserved-size'};
    return {body:output,type:'image/webp',status:'optimized'};
  }catch{return {body,type,status:'encoder-unavailable-or-failed'};}
  finally{await rm(dir,{recursive:true,force:true});}
}

export async function optimizeSavedMedia(model,project) {
  const replacements=new Map();
  const queue=[...(model.media||[])];
  await Promise.all(Array.from({length:Math.min(3,queue.length)},async()=>{
  while(queue.length) {const media=queue.shift();
    if(media.optimization)continue;
    if(!/^assets\/media\/[a-f0-9]+\.[a-z0-9]+$/.test(media.path))continue;
    const bytes=await readFile(path.join(project,media.path));
    const result=await optimizeImage(bytes,media.type);
    media.originalBytes=bytes.length;media.optimization=result.status;
    if(result.status==='optimized'){
      const sha256=createHash('sha256').update(result.body).digest('hex'),dest='assets/media/'+sha256.slice(0,20)+'.webp';
      await writeFile(path.join(project,dest),result.body);replacements.set(media.path,dest);
      Object.assign(media,{path:dest,sha256,bytes:result.body.length,type:result.type});
    }
  }
  }));
  if(replacements.size)for(const page of model.pages){
    let serialized=JSON.stringify(page);
    serialized=serialized.replace(/assets\/media\/[a-f0-9]+\.[a-z0-9]+/g,file=>replacements.get(file)||file);
    Object.assign(page,JSON.parse(serialized));
  }
  model.metrics.imageOptimization={optimized:model.media.filter(m=>m.optimization==='optimized').length,bytesSaved:model.media.reduce((n,m)=>n+(m.originalBytes||m.bytes)-m.bytes,0),fallbacks:model.media.filter(m=>m.optimization==='encoder-unavailable-or-failed').length};
}
