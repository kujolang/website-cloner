(()=>{for(const form of document.querySelectorAll('form[data-cloner-product-ordering]')){
 let cfg;try{cfg=JSON.parse(form.dataset.clonerProductOrdering);}catch{continue;}
 const select=form.querySelector('select.orderby'),grid=document.querySelector('ul.products');if(!select||!grid||(!cfg.manifest&&(!cfg.pages?.length||!cfg.items)))continue;
 const local=p=>{const u=new URL(p,location.href);if(u.origin!==location.origin||!/^https?:$/.test(u.protocol))throw Error('Nonlocal catalog');return u;};
 try{if(cfg.manifest)local(cfg.manifest);else cfg.pages.forEach(local);local(cfg.root);}catch{continue;}
 const allowed=new Set(cfg.supported);for(const option of select.options)option.disabled=!allowed.has(option.value);
 select.disabled=false;select.removeAttribute('aria-disabled');form.removeAttribute('data-migration-form-disabled');form.removeAttribute('aria-description');form.removeAttribute('title');
 const initialPath=location.pathname;let cached,loading,revision=0;
 const status=document.createElement('span');status.setAttribute('role','status');status.className='screen-reader-text';form.append(status);
 async function catalog(){if(cached)return cached;if(loading)return loading;
  loading=(async()=>{if(cfg.manifest){
    const response=await fetch(local(cfg.manifest),{credentials:'omit'});if(!response.ok||new URL(response.url).origin!==location.origin)throw Error('Catalog unavailable');
    const data=await response.json();if(data.schema!=='website-cloner-catalog/v1'||!data.items||!Array.isArray(data.cards))throw Error('Invalid catalog');
    const found=new Map();for(const {key,html}of data.cards){if(typeof html!=='string'||!Object.hasOwn(data.items,key)||found.has(key))throw Error('Invalid card');found.set(key,{key,html});}
    if(found.size!==Object.keys(data.items).length)throw Error('Incomplete catalog');cfg.items=data.items;return cached=[...found.values()];
   }const docs=new Array(cfg.pages.length);let cursor=0;await Promise.all(Array.from({length:Math.min(4,docs.length)},async()=>{while(cursor<docs.length){const i=cursor++,response=await fetch(local(cfg.pages[i]),{credentials:'omit'});if(!response.ok)throw Error('Catalog page unavailable');if(new URL(response.url).origin!==location.origin)throw Error('Nonlocal response');docs[i]=new DOMParser().parseFromString(await response.text(),'text/html');}}));
   const found=new Map();for(const doc of docs)for(const card of doc.querySelectorAll('ul.products > [data-migration-record]')){const key=card.dataset.migrationRecord;if(cfg.items[key]&&!found.has(key))found.set(key,{key,card});}
   if(found.size!==Object.keys(cfg.items).length)throw Error('Incomplete local catalog');return cached=[...found.values()];})();try{return await loading;}finally{loading=null;}}
 function state(){const u=new URL(location.href),order=u.searchParams.get('orderby')||'menu_order',page=Math.max(1,parseInt(u.searchParams.get('product-page')||String(cfg.manifest?(u.pathname===initialPath?cfg.page:1):(Math.max(0,cfg.pages.findIndex(p=>local(p).pathname===u.pathname))+1)),10)||1);return{order:allowed.has(order)?order:'menu_order',page};}
 function url(order,page){const u=local(cfg.root);if(order!=='menu_order')u.searchParams.set('orderby',order);if(page>1)u.searchParams.set('product-page',page);return u;}
 async function render(order,page,push){const token=++revision;status.textContent='Loading catalog';form.setAttribute('aria-busy','true');try{
  let list=[...await catalog()];if(token!==revision)return;
  const sign=order==='price-desc'?-1:1;
  list.sort((a,b)=>{const x=cfg.items[a.key],y=cfg.items[b.key];if(order==='price'||order==='price-desc'){const A=BigInt((order==='price-desc'?x.max:x.min)??x.price),B=BigInt((order==='price-desc'?y.max:y.min)??y.price);return sign*(A<B?-1:A>B?1:0)||sign*((x.id??0)-(y.id??0));}if(order==='rating')return Number(y.rating)-Number(x.rating)||(y.ratingCount??0)-(x.ratingCount??0)||(y.id??0)-(x.id??0);if(order==='popularity')return y.sales-x.sales||(y.id??0)-(x.id??0);if(order==='date')return Date.parse(y.date)-Date.parse(x.date)||(y.id??0)-(x.id??0);return 0;});
  const size=Math.max(1,Number(cfg.size)||20),pages=Math.max(1,Math.ceil(list.length/size));page=Math.min(page,pages);const selected=list.slice((page-1)*size,page*size);const doc=new DOMParser().parseFromString('<ul class="products">'+selected.map(item=>item.html??item.card.outerHTML).join('')+'</ul>','text/html'),nodes=[...doc.querySelectorAll('ul.products > [data-migration-record]')];if(nodes.length!==selected.length||nodes.some((node,i)=>node.dataset.migrationRecord!==selected[i].key))throw Error('Invalid visible cards');grid.replaceChildren(...nodes);
  const columns=Number([...grid.classList].find(x=>/^columns-\d+$/.test(x))?.split('-')[1])||4;[...grid.children].forEach((card,i)=>{card.classList.toggle('first',i%columns===0);card.classList.toggle('last',(i+1)%columns===0);});
  const count=document.querySelector('.woocommerce-result-count');if(count&&/^Showing /.test(count.textContent.trim()))count.textContent=list.length===1?'Showing the single result':list.length<=size?`Showing all ${list.length} results`:`Showing ${(page-1)*size+1}–${Math.min(page*size,list.length)} of ${list.length} results`;
  let nav=document.querySelector('.migration-pagination,.woocommerce-pagination');if(!nav&&pages>1){nav=document.createElement('nav');nav.className='migration-pagination';grid.after(nav);}if(nav){nav.replaceChildren();nav.setAttribute('aria-label','Product pages');for(let n=1;n<=pages;n++){const a=document.createElement('a');a.href=url(order,n);a.textContent=String(n);if(n===page)a.setAttribute('aria-current','page');a.addEventListener('click',e=>{if(e.button||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();render(order,n,true);});nav.append(a,document.createTextNode(' '));}}
  select.value=order;if(push)history.pushState(null,'',url(order,page));status.textContent=`${list.length} products, page ${page} of ${pages}`;
 }catch{if(token===revision){cached=undefined;status.className='';status.textContent='Local catalog could not be loaded. Please retry.';}}finally{if(token===revision)form.removeAttribute('aria-busy');}}
 form.addEventListener('submit',e=>{e.preventDefault();render(select.value,1,true);});select.addEventListener('change',()=>render(select.value,1,true));addEventListener('popstate',()=>{const s=state();render(s.order,s.page,false);});
 if(new URL(location.href).searchParams.has('orderby')||new URL(location.href).searchParams.has('product-page')){const s=state();render(s.order,s.page,false);}
}})();
