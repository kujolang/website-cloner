import {load} from 'cheerio/slim';
function validate(attr,value){
  if(!['string','number'].includes(typeof value)||typeof value==='number'&&!Number.isFinite(value))throw Error('Invalid component media field '+attr);
  if(['src','srcset'].includes(attr)&&/(?:^|[\s,])(?:javascript|vbscript|file):/i.test(String(value)))throw Error('Unsafe component media URL');
}
const imageAttributes=['src','alt','srcset','sizes','width','height'],sourceAttributes=['srcset','sizes','media','type','width','height'];
export function captureComponentMedia(html){
 const $=load(html,null,false);if($.root().children().length!==1||!$.root().children().is('picture')||$('img').length!==1)return null;
 const data={image:{},sources:[]};
 const bind=(el,attrs,record,prefix)=>{for(const attr of attrs){const value=el.attr(attr);if(value===undefined)continue;record[attr]=value;el.attr(attr,'MIGRATION_MEDIA_'+prefix+'_'+attr+'_END');}};
 bind($('img'),imageAttributes,data.image,'image');$('source').each((i,node)=>{const record={};data.sources.push(record);bind($(node),sourceAttributes,record,'source'+i);});
 return {html:$.html(),data};
}
export function renderComponentMedia(html,data){
 if(!html.includes('MIGRATION_MEDIA_'))return html;
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Missing component media frontmatter');
 const $=load(html,null,false);
 $('*').each((_,node)=>{for(const [attr,text] of Object.entries(node.attribs||{})){
  const match=/^MIGRATION_MEDIA_(image|source\d+)_([a-z]+)_END$/.exec(text);if(!match)continue;
  const record=match[1]==='image'?data.image:data.sources?.[Number(match[1].slice(6))],value=record?.[match[2]];
  if(value===undefined)throw Error('Missing component media field '+match[1]+'.'+match[2]);
  validate(attr,value);
  $(node).attr(attr,String(value));
 }});
 const apply=(el,record,attrs)=>{for(const attr of attrs){if(record?.[attr]===undefined)continue;validate(attr,record[attr]);el.attr(attr,String(record[attr]));}};
 apply($('img'),data.image,imageAttributes);$('source').each((i,node)=>apply($(node),data.sources?.[i],sourceAttributes));
 return $.html();
}
