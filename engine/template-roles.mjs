import {load} from 'cheerio/slim';
const slug=s=>String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export function templateRole(page,source,html=''){
 const classes=page.bodyClass||'',type=page.wordpress?.type||page.contentType?.replace(/^wp-/,'');
 const result=(role,evidence)=>({role,evidence});
 let route=page.route||'/',contentQuery=false;try{const url=new URL(page.documentURL||page.url);route=url.pathname;contentQuery=[...url.searchParams.keys()].some(k=>!/^(utm_.+|fbclid|gclid|msclkid)$/.test(k));}catch{}
 if(/(?:^|\s)category(?:\s|$)/.test(classes)||/^\/(?:.+\/)?category\/[^/]+\//.test(route))return result('category','category archive');
 if(/(?:^|\s)tag(?:\s|$)/.test(classes)||/^\/(?:.+\/)?tag\/[^/]+\//.test(route))return result('tag','tag archive');
 const taxonomy=/(?:^|\s)tax-([\w-]+)/.exec(classes)?.[1];
 if(taxonomy)return result('taxonomy-'+slug(taxonomy),'WordPress taxonomy class');
 const archiveType=/(?:^|\s)post-type-archive-([\w-]+)/.exec(classes)?.[1];
 if(archiveType)return result(archiveType==='product'?'shop':'archive-'+slug(archiveType),'WordPress content-type archive');
 if(!contentQuery&&/(?:^|\s)home(?:\s|$)/.test(classes))return result('home','explicit front-page class');
 if(/(?:^|\s)(?:archive|blog)(?:\s|$)/.test(classes)||page.family==='archive')return result('archive','archive layout');
 if(type==='post'||type==='posts')return result('single-post','native post or article layout');
 if(type&&!['page','pages'].includes(type))return result('single-'+slug(type),'native custom collection');
 if(!type&&page.family==='article')return result('single-post','article layout fallback');
 if(!contentQuery&&route.replace(/\/$/,'')==='')return result('home','site root without a more specific content role');
 // Conventional listing URLs alone are insufficient: require repeated visible
 // editorial/card links too, so an ordinary page named Blog keeps its design.
 if(/\/(?:blog|news|newsroom|journal|articles)(?:\/page\/\d+)?\/?$/.test(route)){
  const $=load(html||page.content||'',null,false);
  if($('article,h2 a[href],h3 a[href],a:has(h2),a:has(h3)').length>1)return result('archive','listing URL and repeated editorial entries');
 }
 return result('default-page','page fallback; layout sections remain distinct');
}
