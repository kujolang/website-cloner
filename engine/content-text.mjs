import {load} from 'cheerio/slim';
const blockTags=new Set('address article aside blockquote br dd div dl dt fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hr li main nav ol p pre section table tbody td th thead tr ul'.split(' '));
// DOM textContent joins adjacent blocks (e.g. "Founder" + "About") and treats
// indentation as content. Compare prose using the same block boundaries on both
// sides; keep inline boundaries and repeated words significant.
export function contentText(html){
 const $=load(String(html||''),null,false);$('style,script,noscript,template').remove();
 function walk(node){if(node.type==='text')return node.data;const text=(node.children||[]).map(walk).join('');return blockTags.has(node.name)?' '+text+' ':text;}
 return walk($.root()[0]).replace(/\s+/g,' ').trim();
}
export function contentCoverage(source,actual){
 const words=source.split(/\s+/).filter(Boolean),got=new Map();
 for(const word of actual.split(/\s+/))got.set(word,(got.get(word)||0)+1);
 return words.length?words.filter(word=>{const count=got.get(word)||0;if(!count)return false;got.set(word,count-1);return true;}).length/words.length:1;
}
