import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
const run=promisify(execFile);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Native SSG supplies both resolved relationships and the card renderer. The adapter
// combines all batches and preserves source archives instead of overwriting their design.
export async function buildArchives(routes,nativeIndex,{base,origin,title,postsPerPage=20}){
 const records=routes.filter(p=>p.collection!=='pages'&&!/\b(noindex|none)\b/i.test(p.robots||''));
 if(!records.length)return [];
 let root='/_migration/archives/';
 while(routes.some(p=>p.route.startsWith(root)||p.route===root.slice(0,-1)))root='/_migration/'+root.split('/')[2]+'-native/';
 const inputs=[],groups=new Map();
 const add=(key,label,p)=>{if(!groups.has(key))groups.set(key,{key,title:label,records:[]});groups.get(key).records.push(p);};
 for(const p of records){
  const native=nativeIndex.items.find(i=>i.slug===p.slug&&i.type===p.collection);
  if(!native)throw Error('Archive native record missing: '+p.route);
  const meta=p.meta||JSON.parse(await readFile(`content/${p.collection}/${p.slug}.json`,'utf8'));
  p.cardKey=p.collection+'-'+p.slug;
  const image=/^assets\/[a-zA-Z0-9_./-]+\.(webp|png|jpe?g|gif|avif|svg)$/.test(meta.featured_image||'')?base+'/'+meta.featured_image:'';
  inputs.push({slug:p.cardKey,route:base+p.route,title:p.title,excerpt:p.excerpt||p.description||'',image,width:meta.featured_image_width,height:meta.featured_image_height,tags:native.taxonomies?.tags||[]});
  add('type/'+p.collection,p.collection,p);
  for(const [taxonomy,terms]of Object.entries(native.taxonomies||{}))for(const term of new Set(terms)){
   const key='taxonomy/'+encodeURIComponent(taxonomy)+'/'+createHash('sha256').update(term).digest('hex').slice(0,16);
   add(key,taxonomy+': '+term,p);
  }
 }
 await writeFile('.archive-input.json',JSON.stringify(inputs));
 let cards;
 try{await run(process.env.KUJO_BIN||'kujo',['run','--interpreter','scripts/render-archive-cards.kujo'],{timeout:120000,maxBuffer:1e6});cards=JSON.parse(await readFile('.archive-cards.json','utf8'));}
 finally{await rm('.archive-input.json',{force:true});await rm('.archive-cards.json',{force:true});}
 // Native cards normalize permalinks to directory routes. Restore the exact export
 // permalink (including extensionless and .html URLs) on their article links.
 for(const input of inputs){if(typeof cards[input.slug]!=='string')throw Error('Native archive card missing');if(input.width>0&&input.height>0)cards[input.slug]=cards[input.slug].replace('<img ',`<img width="${Number(input.width)}" height="${Number(input.height)}" `);cards[input.slug]=cards[input.slug].replace(/(<a\b[^>]*\bhref=)"[^"]*"/g,(_,prefix)=>prefix+'"'+esc(input.route)+'"');}
 const layout=await readFile('templates/layout.html','utf8');
 const runtime=/<script data-kujo-webmcp>[\s\S]*?<\/script>/.exec(layout)?.[0];
 if(!runtime)throw Error('Archive WebMCP runtime missing');
 const generated=[],manifest=[];
 const style='body{font:1rem/1.6 system-ui;margin:0 auto;padding:2rem;max-width:72rem}a{color:inherit}.card-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,18rem),1fr));gap:2rem;list-style:none;padding:0}.listing-card-image{width:100%;aspect-ratio:16/9;object-fit:cover}.listing-card{border:1px solid #ddd;padding:1rem}nav{display:flex;gap:1rem;flex-wrap:wrap}';
 const emit=async(route,label,body)=>{
  await mkdir('output'+route,{recursive:true});
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(label)} — ${esc(title)}</title><meta name="description" content="${esc(label)} from ${esc(title)}"><link rel="canonical" href="${esc(origin+base+route)}"><link rel="kujo-site-index" href="${base}/.well-known/kujo-site-index.json"><link rel="alternate" type="text/plain" href="${base}/llms.txt"><link rel="alternate" type="application/rss+xml" href="${base}/feed/index.xml"><style>${style}</style></head><body><nav><a href="${base}/">Home</a><a href="${base+root}">Content archives</a></nav><main><h1>${esc(label)}</h1>${body}</main>${runtime}</body></html>`;
  await writeFile('output'+route+'index.html',html);
  generated.push({route,title:label,collection:'pages',generatedArchive:true,description:'Content archive',summary:label});
 };
 for(const g of groups.values()){
  g.records.sort((a,b)=>(Date.parse(b.date)||0)-(Date.parse(a.date)||0)||a.route.localeCompare(b.route));
  const count=Math.ceil(g.records.length/postsPerPage),first=root+g.key+'/';
  manifest.push({title:g.title,route:first,members:g.records.map(p=>p.route),pages:count});
  for(let i=0;i<count;i++){
   const route=i?first+'page/'+(i+1)+'/':first;
   const pageRoute=n=>n===0?first:first+'page/'+(n+1)+'/';
   const navigation=`<nav aria-label="Pagination">${i?`<a rel="prev" href="${base+pageRoute(i-1)}">Previous</a>`:''}<span>Page ${i+1} of ${count}</span>${i+1<count?`<a rel="next" href="${base+pageRoute(i+1)}">Next</a>`:''}</nav>`;
   const chunk=g.records.slice(i*postsPerPage,(i+1)*postsPerPage);
   if(chunk.some(p=>!cards[p.cardKey]))throw Error('Native archive card missing');
   await emit(route,g.title+(i?` — Page ${i+1}`:''),`<ul class="card-grid">${chunk.map(p=>cards[p.cardKey]).join('')}</ul>${navigation}`);
  }
 }
 await emit(root,'Content archives','<ul>'+manifest.map(g=>`<li><a href="${base+g.route}">${esc(g.title)}</a> (${g.members.length})</li>`).join('')+'</ul>');
 await writeFile('output/archive-manifest.json',JSON.stringify({schema:'migration-archives/v1',root,archives:manifest},null,2));
 return generated;
}
