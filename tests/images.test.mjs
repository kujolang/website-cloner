import test from 'node:test';import assert from 'node:assert/strict';
import {PNG} from 'pngjs';import {optimizeImage} from '../engine/images.mjs';
test('raster conversion keeps fallback bytes, animation, and SVG',async()=>{
 const input=PNG.sync.write(new PNG({width:16,height:16}));
 const absent=await optimizeImage(input,'image/png',{encoder:'/missing/cwebp'});assert.deepEqual(absent.body,input);assert.equal(absent.status,'encoder-unavailable-or-failed');
 for(const type of ['image/gif','image/webp','image/avif','image/svg+xml']){const r=await optimizeImage(input,type);assert.deepEqual(r.body,input);assert.equal(r.type,type);}
 const anim=Buffer.concat([input.subarray(0,8),Buffer.from([0,0,0,0]),Buffer.from('acTL'),Buffer.alloc(4),input.subarray(8)]);
 assert.equal((await optimizeImage(anim,'image/png')).status,'preserved-animation');
});
test('available encoder only accepts smaller valid WebP',async()=>{
 const png=new PNG({width:256,height:256});for(let i=0;i<png.data.length;i+=4){png.data[i]=(i/4)%256;png.data[i+1]=128;png.data[i+2]=100;png.data[i+3]=i%8?255:80;}
 const input=PNG.sync.write(png),r=await optimizeImage(input,'image/png');
 if(r.status==='encoder-unavailable-or-failed')return;
 assert.ok(r.body.length<=input.length);if(r.type==='image/webp')assert.equal(r.body.toString('ascii',8,12),'WEBP');
});
test('resumed images rewrite content and stylesheet references once',async()=>{
 const {mkdtemp,mkdir,writeFile,readFile,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const path=await import('node:path');const {optimizeSavedMedia}=await import('../engine/images.mjs');
 const dir=await mkdtemp(path.join(tmpdir(),'resume-media-'));
 try{
  await mkdir(path.join(dir,'assets/media'),{recursive:true});const input=PNG.sync.write(new PNG({width:256,height:256}));const source='assets/media/aaaaaaaaaaaaaaaaaaaa.png';await writeFile(path.join(dir,source),input);
  const m={metrics:{},media:[{path:source,type:'image/png',bytes:input.length}],pages:[{content:`<img src="/${source}">`,styles:[`a{background:url(/${source})}`]}]};
  await optimizeSavedMedia(m,dir);const saved=JSON.stringify(m);await optimizeSavedMedia(m,dir);assert.equal(JSON.stringify(m),saved);
  assert.ok(m.pages[0].content.includes('/'+m.media[0].path));assert.ok(m.pages[0].styles[0].includes('/'+m.media[0].path));assert.equal((await readFile(path.join(dir,m.media[0].path))).length,m.media[0].bytes);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('image optimization preserves every decoded RGBA pixel including transparency',async(t)=>{
 const {mkdtemp,writeFile,readFile,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const path=await import('node:path');const {execFile}=await import('node:child_process');const {promisify}=await import('node:util');
 const png=new PNG({width:128,height:128});for(let i=0;i<png.data.length;i+=4){png.data[i]=i%251;png.data[i+1]=127;png.data[i+2]=49;png.data[i+3]=i%12?255:0;}
 const input=PNG.sync.write(png),result=await optimizeImage(input,'image/png');
 if(result.status==='encoder-unavailable-or-failed'){t.skip('Pixel fidelity test requires optional cwebp');return;}
 if(result.type==='image/png'){assert.deepEqual(result.body,input);return;}
 const dir=await mkdtemp(path.join(tmpdir(),'lossless-image-'));try{await writeFile(path.join(dir,'image.webp'),result.body);await promisify(execFile)('dwebp',[path.join(dir,'image.webp'),'-o',path.join(dir,'image.png')]);const decoded=PNG.sync.read(await readFile(path.join(dir,'image.png')));assert.deepEqual(decoded.data,png.data);}finally{await rm(dir,{recursive:true,force:true});}
});
