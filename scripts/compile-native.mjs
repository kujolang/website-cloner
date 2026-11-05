import {within} from './source.mjs';
import {mkdir,rm,cp,readFile,writeFile,readdir} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile);
// Batch size bounds compiler working memory, never the number of exported pages.
export async function compileNative(routes, config = {}) {
  const size=Math.max(1,Math.min(20,Number(process.env.SSG_BATCH_SIZE)||20));
  const concurrency=Math.max(1,Math.min(4,Number(process.env.SSG_WORKERS)||2));
  await rm('.ssg-output',{recursive:true,force:true});
  await rm('.ssg-batches',{recursive:true,force:true});
  await mkdir('.ssg-output/.well-known',{recursive:true});
  const lookups=(await readdir('.ssg-content')).filter(f=>f.endsWith('.yml'));
  const groups=Array.from({length:Math.ceil(routes.length/size)},(_,i)=>routes.slice(i*size,(i+1)*size));
  const results=new Array(groups.length);let next=0;let imageMerge=Promise.resolve();
  const controller=new AbortController();
  const workers=Array.from({length:Math.min(concurrency,groups.length)},async()=>{
    while(next<groups.length){const index=next++,batch=groups[index],root='.ssg-batches/'+index;
      await mkdir(root+'/content',{recursive:true});await mkdir(root+'/assets',{recursive:true});
      for(const f of lookups)await cp('.ssg-content/'+f,root+'/content/'+f);
      for(const p of batch){await mkdir(root+'/content/'+p.collection,{recursive:true});let markdown=await readFile(`.ssg-content/${p.collection}/${p.slug}.md`,'utf8');
        const feature=/^featured_image: ("[^"]*")$/m.exec(markdown);
        if(feature){const source=JSON.parse(feature[1]);if(source){if(/^https?:\/\//.test(source)){if(!config.download_remote_images)throw Error('Enable download_remote_images to mirror remote featured images');}else{if(!/^assets\/[a-zA-Z0-9_./-]+\.(?:webp|png|jpe?g|gif|avif|svg)$/.test(source)||source.split('/').includes('..'))throw Error('Unsafe featured image');await within(source);const bytes=await readFile(source);
          const animatedOrUnsupported=/\.(?:gif|svg|avif)$/.test(source) || (source.endsWith('.png') && bytes.includes(Buffer.from('acTL')));
          if(animatedOrUnsupported)markdown=markdown.replace(feature[0],'featured_image: ""');
          else{await mkdir(root+'/assets/media',{recursive:true});await cp(source,root+'/'+source);markdown=markdown.replace(feature[0],'featured_image: '+JSON.stringify(root+'/'+source));}}}}
        await writeFile(`${root}/content/${p.collection}/${p.slug}.md`,markdown);}

      const started=Date.now();
      try {await run(process.env.KUJO_BIN||'kujo',['run',...(process.env.SSG_RUNTIME === 'vm' ? [] : ['--interpreter']),'build.kujo','--','--site-url',config.site_url,'--no-index','--no-aliases','--content',root+'/content','--templates','.ssg-templates','--assets',root+'/assets','--output',root+'/output'],{timeout:600000,maxBuffer:2e6,signal:controller.signal});}
      catch(e){throw Error(`Native compilation batch ${index+1}/${groups.length} failed: ${e.message}`);}
      if(index===0){try{await cp(root+'/output/assets','.ssg-output/assets',{recursive:true});}catch(e){if(e.code!=='ENOENT')throw e;}}
      // Compilation stays parallel; recursive copies into a shared directory
      // must be serialized because fs.cp can race its destination mkdir calls.
      imageMerge=imageMerge.then(async()=>{try{await cp(root+'/output/images','.ssg-output/images',{recursive:true});}catch(e){if(e.code!=='ENOENT')throw e;}});
      await imageMerge;
      const native=JSON.parse(await readFile(root+'/output/.well-known/kujo-site-index.json','utf8'));
      let feed='';try{feed=await readFile(root+'/output/feed/index.xml','utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
      results[index]={items:native.items,feed};
      for(const p of batch){const rel=(!['pages','posts'].includes(p.collection)?p.collection+'/':'')+p.slug;await mkdir('.ssg-output/'+rel,{recursive:true});await cp(root+'/output/'+rel+'/index.html','.ssg-output/'+rel+'/index.html');}
      await rm(root,{recursive:true,force:true});
      console.log(`Compiled batch ${index+1}/${groups.length}: ${batch.length} pages (${((Date.now()-started)/1000).toFixed(1)}s)`);
    }
  });
  const settled=await Promise.allSettled(workers.map(p=>p.catch(error=>{controller.abort();throw error;})));
  const failure=settled.find(r=>r.status==='rejected');if(failure)throw failure.reason;
  await writeFile('.ssg-output/.well-known/kujo-site-index.json',JSON.stringify({items:results.flatMap(r=>r.items)}));
  await rm('.ssg-batches',{recursive:true,force:true});
  return results.flatMap(r=>r.feed.match(/<item>[\s\S]*?<\/item>/g)||[]);
}
