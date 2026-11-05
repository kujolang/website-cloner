import {load} from 'cheerio/slim';
import {createHash} from 'node:crypto';
export function descriptionSummary(text,limit=200){
 const clean=String(text||'').replace(/\s+/g,' ').trim();
 if(clean.length<=limit)return clean;
 const sentences=[...new Intl.Segmenter('en',{granularity:'sentence'}).segment(clean)];
 const complete=sentences.filter(s=>s.index+s.segment.trimEnd().length<=limit).map(s=>s.segment).join('').trim();
 if(complete.length>=Math.min(60,limit/2))return complete;
 const cut=clean.slice(0,limit+1),boundary=cut.lastIndexOf(' ');
 return (boundary>0?cut.slice(0,boundary):clean.slice(0,limit)).replace(/[,:;—-]+$/,'').trim();
}
export function contentSlugs(pages){
 const candidates=pages.map(p=>{
  let route=p.route;try{route=decodeURIComponent(route);}catch{}
  return route.replace(/^\/+|\/+$/g,'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100)||'home';
 });
 const counts=new Map();for(const slug of candidates)counts.set(slug,(counts.get(slug)||0)+1);
 return candidates.map((slug,i)=>counts.get(slug)>1?slug+'-'+createHash('sha256').update(pages[i].route).digest('hex').slice(0,10):slug);
}

// Author-facing section names remain independent of internal template slots.
export function sectionName(label,used){
 const base=String(label||'section').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,64).replace(/-$/,'')||'section';
 let name=base,n=2;while(used.has(name)||/^body\d+$/.test(name))name=base+'-'+n++;
 used.add(name);return name;
}

// Source-derived fallback only: exclude site chrome, forms and repeated slides.
export function pageDescription(page){
 if(page.description&&page.descriptionSource!=='generated')return page.description.trim();
 const $=load(page.content||'',null,false);
 $('header,footer,nav,aside,form,script,style,template,[hidden],[aria-hidden="true"],.swiper-slide-duplicate,[data-migration-form-disabled]').remove();
 // Prefer the introduction following the primary heading, even when a theme
 // uses a heading tag merely to style that prose.
 const nodes=$('h1,h2,h3,h4,h5,h6,p').toArray();let start=nodes.findIndex(n=>n.name==='h1');
 const candidates=(start>=0?nodes.slice(start+1):nodes).filter(n=>!$(n).closest('details').length);
 const text=candidates.map(n=>$(n).text().replace(/\s+/g,' ').trim()).find(t=>t.length>=60&&/[.!?]/.test(t));
 const excerpt=page.wordpress?.excerpt?load(page.wordpress.excerpt,null,false).text():'';
 page.descriptionSource='generated';
 const introduction=candidates.filter(n=>n.name==='p').map(n=>$(n).text().replace(/\s+/g,' ').trim()).find(t=>/[.!?]$/.test(t));
 return descriptionSummary(excerpt||text||introduction||page.title);
}
