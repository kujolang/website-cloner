import {load} from 'cheerio/slim';
// Read structured metadata without constructing a second DOM for large cached
// pages (which frequently include hundreds of kilobytes of inline CSS).
export function documentTypes(html,url){
 const types=new Set();
 const visit=node=>{
  if(Array.isArray(node)){for(const item of node)visit(item);return;}
  if(!node||typeof node!=='object')return;
  const address=node.url||node.mainEntityOfPage?.['@id']||(typeof node.mainEntityOfPage==='string'?node.mainEntityOfPage:'');
  let matches=!address;try{matches=!url||new URL(address,url).pathname===new URL(url).pathname;}catch{}
  if(matches)for(const type of [node['@type']].flat().filter(Boolean))if(['Product','BlogPosting','NewsArticle','Article'].includes(type))types.add(type);
  visit(node['@graph']);visit(node.mainEntity);
 };
 for(const match of String(html||'').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)){
  if(!/\btype\s*=\s*["']application\/ld\+json["']/i.test(match[1]))continue;
  try{visit(JSON.parse(match[2]));}catch{}
 }
 return [...types];
}
// Only explicit document metadata/single-post bylines; never guess dates from URL paths.
export function htmlMetadata(html,url) {
 const $=load(html||'',null,false),single=$('body').is('.single,.single-post')||$('.wp-block-post-content,.entry-content,[itemprop="articleBody"]').length===1;
 const value=selectors=>$(selectors).first().attr('content')||'';
 const date=value('meta[property="article:published_time"],meta[itemprop="datePublished"]')||(single?$('time[datetime]').first().attr('datetime')||'':'');
 const author=value('meta[name="author"]')||(single?$('.wp-block-post-author-name,.author.vcard .fn,[rel="author"]').first().text().trim():'');
 const categories=single?$('.wp-block-post-terms.taxonomy-category a,a[rel="category tag"]').map((_,e)=>$(e).text().trim()).get().filter(Boolean):[];
 const tags=single?$('.wp-block-post-terms.taxonomy-post_tag a,a[rel="tag"]').map((_,e)=>$(e).text().trim()).get().filter(Boolean):[];
 return {documentTypes:documentTypes(html,url),date,author,categories:[...new Set(categories)],tags:[...new Set(tags)]};
}
