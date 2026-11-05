import {bindRelationshipLists} from './relationship-lists.mjs';
import {bindRelationshipLinks} from './custom-relationships.mjs';
import {captureSliderSequences} from '../scripts/slider-authoring.mjs';
import {captureComponentMedia} from '../scripts/component-media.mjs';
import {bindCustomFieldText,bindCustomFieldLinks} from './custom-fields.mjs';
import {sectionName} from './authoring.mjs';
import {shareLayoutData} from './shared-layout.mjs';
import {templateInvariants} from './template-invariants.mjs';
import {renderBindings,nativeRelationshipIndex} from '../scripts/source-project.mjs';
import {compileTemplateFamilies,projectTemplateBindings} from './template-family.mjs';
import {templateRole} from './template-roles.mjs';
import {shareRepeats} from './template-repeats.mjs';
import {metadataFingerprint} from '../scripts/metadata-fingerprint.mjs';
import {load} from 'cheerio/slim';
import Turndown from 'turndown';
import YAML from 'yaml';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,rm,readdir} from 'node:fs/promises';
import path from 'node:path';
const hash=s=>createHash('sha256').update(s).digest('hex').slice(0,20);
const markdown=new Turndown({headingStyle:'atx',codeBlockStyle:'fenced',bulletListMarker:'-',emDelimiter:'*'});
markdown.addRule('contactLink',{filter:node=>node.nodeName==='A'&&/^tel:[+()0-9 .-]+$/i.test(node.getAttribute('href')||''),replacement:(content,node)=>'<a href="'+node.getAttribute('href').replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'">'+content+'</a>'});
markdown.addRule('preserveLineBreak',{filter:'br',replacement:()=>'<br>'});
markdown.addRule('inlinePresentation',{
 filter:['span','mark','small','sup','sub','abbr','kbd'],
 replacement:(content,node)=>{
  const escape=value=>value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  const tag=node.nodeName.toLowerCase();if(tag==='span'&&[...node.attributes].every(a=>!a.value.trim()))return content;const attrs=[...node.attributes].map(a=>' '+a.name+'="'+escape(a.value)+'"').join('');
  // Preserve presentation while converting child links/emphasis/literal stars
  // to Markdown, instead of emitting escaped nested HTML into the page.
  return '<'+tag+attrs+'>'+content+'</'+tag+'>';
 }
});
const semantic=new Set('br span mark small sup sub abbr kbd figure p h1 h2 h3 h4 h5 h6 blockquote ul ol li pre code strong b em i a img hr'.split(' '));
const rich=new Set('table picture svg video audio form iframe canvas hr'.split(' '));
const inlineTags=new Set('a span mark strong b em i small code label button sup sub br img'.split(' '));
const marker=name=>'MIGRATION_VALUE_'+name+'_END';
function structuralList(node){
 if(!['ol','ul'].includes(node?.name))return false;
 if(node.migrationStructuralList)return true;
 const nested=n=>(n.children||[]).some(c=>['ol','ul'].includes(c.name)||nested(c));
 const mixed=n=>(n.children||[]).some(c=>rich.has(c.name)||c.type==='tag'&&!semantic.has(c.name)||mixed(c));
 // Interactive lists are controls, not Markdown bullets. Keep exact sibling
 // boundaries (including absent whitespace), while their labels remain editable.
 const controls=(node.children||[]).some(c=>c.type==='tag'&&(c.attribs?.['data-filter']!==undefined||c.attribs?.['aria-controls']!==undefined||['button','tab','menuitem','menuitemcheckbox','menuitemradio'].includes(c.attribs?.role)));
 const result=controls||node.name==='ol'||node.parent?.name==='li'||nested(node)||mixed(node);
 if(result)node.migrationStructuralList=true;
 return result;
}
function compatible(node){
 if(node.migrationCustomField)return false;
 // A link around block content is a layout boundary. Turndown inserts blank
 // lines around figures, producing a multi-paragraph Markdown link that the
 // native renderer cannot parse. Keep the anchor while editing its children.
 if(node.name==='a'&&(node.children||[]).some(c=>c.type==='tag'&&!inlineTags.has(c.name)))return false;
 // Control label wrappers may be addressed by CSS or the local component runtime.
 if(node.name==='span'&&(['button','summary'].includes(node.parent?.name)||node.parent?.attribs?.role==='button'))return false;
 // A standalone inline wrapper is not a Markdown paragraph. Preserve its
 // boundary so block-child CSS cannot start matching newly invented P tags.
 if(node.name==='span'&&!inlineTags.has(node.parent?.name)&&node.parent?.name!=='p'&&!/^h[1-6]$/.test(node.parent?.name||''))return false;
 if(node.type==='text')return true;
 if(node.type!=='tag'||!semantic.has(node.name)||rich.has(node.name))return false;
 // Styled spans inside prose are already preserved by inlinePresentation.
 // Treating a sole span as a layout boundary unnecessarily splits adjacent
 // paragraphs. Standalone and control-label spans remain boundaries above.
 // Native Markdown currently flattens nested bullets and renders ordered lists
 // as paragraphs. Keep those list containers in shared layouts and their prose
 // in Markdown slots, preserving numbering, nesting and source CSS.
 if(node.name==='blockquote'||structuralList(node)||node.name==='li'&&structuralList(node.parent))return false;
 if(node.attribs?.['data-migration-archive']!==undefined)return false;
 // Blank blocks, nonbreaking-space spacers and CSS-only icons are layout,
 // not prose. Turndown otherwise silently drops them from mixed text runs.
 const meaningful=n=>n.type==='text'?Boolean(n.data.trim()):['img','br'].includes(n.name)||(n.children||[]).some(meaningful);
 if(!meaningful(node))return false;
 if(node.name==='figure'&&(node.children||[]).filter(n=>n.type==='tag').some(n=>n.name!=='img'&&!(n.name==='a'&&(n.children||[]).filter(c=>c.type==='tag').every(c=>c.name==='img'))))return false;
 // Markdown cannot represent these without dropping meaning or behavior.
 if(Object.keys(node.attribs||{}).some(k=>!['class','id','style','href','title','src','alt','width','height','loading','decoding','target','rel','sizes','srcset','start','reversed','type','value','role','tabindex','lang','dir'].includes(k)&&!k.startsWith('aria-')&&!k.startsWith('data-')))return false;

 const emphasis=['strong','b'].includes(node.name)?['strong','b']:['em','i'].includes(node.name)?['em','i']:null;
 const nested=n=>(n.children||[]).some(child=>emphasis?.includes(child.name)||nested(child));
 if(emphasis&&nested(node))return false;
 return (node.children||[]).every(compatible);
}
export async function writeEditableProject(model,project){
 const layout={schema:'migration-content/v2',records:{}},families=new Set(),components=new Set(),temporaryShells=new Set();
 await mkdir(path.join(project,'templates/content'),{recursive:true});
 await mkdir(path.join(project,'templates/components'),{recursive:true});
 await mkdir(path.join(project,'templates/data'),{recursive:true});
 await mkdir(path.join(project,'templates/repeats'),{recursive:true});
 const repeatTemplates=new Set(),variants=new Map(),recordVariants=new Map(),conversionCache=new Map();let reusedConversions=0;
 const sourcePages=new Map((model.pages||[]).map(p=>[p.route,p])),sourceAliases=[];
 for(const page of model.pages||[])try{
  const canonical=new URL(page.canonical),target=sourcePages.get(canonical.pathname);
  const text=page.sourceSemanticText||page.text;
  if(canonical.origin===new URL(model.source).origin&&target&&target!==page&&text&&text===(target.sourceSemanticText||target.text))sourceAliases.push({route:page.route,target:target.route,evidence:'Saved canonical and identical captured content; not an independent content item'});
 }catch{}
 for(const p of model.routes){
  const file=`content/${p.collection}/${p.slug}`,meta=JSON.parse(await readFile(path.join(project,file+'.json'),'utf8'));
  temporaryShells.add(meta.template);
  const html=await readFile(path.join(project,file+'.html'),'utf8'),shell=await readFile(path.join(project,'templates/page-'+meta.template+'.html'),'utf8');
  // Reuse conversion work only for identical localized DOM and the metadata
  // used for dynamic title/date/author bindings. This never caps source pages.
  const conversionKey=hash(html+'\0'+shell+'\0'+JSON.stringify([Object.keys(meta.custom_fields||{}).length?p.source:null,meta.title,meta.date,meta.author,meta.custom_fields,meta.custom_field_schema,meta.custom_field_relationships,meta.product?.sku,meta.event]));
  let conversion=conversionCache.get(conversionKey);
  if(!conversion){
   conversion=await (async()=>{
  const $=load(html,null,false);const sliderSequences=captureSliderSequences($);
  const candidates=$('.entry-content,.wp-block-post-content,[itemprop="articleBody"]');
  const body=candidates.length===1&&!$('[data-migration-archive]').length?candidates.first():$.root();
  const primaryHeading=$('h1').first(),contentTitle=primaryHeading.length&&!primaryHeading.children().length?primaryHeading.text().trim():'';
  const customLinks=bindCustomFieldLinks($,body,meta.custom_fields||{},p.source,model.routes);
  const relationshipLists=bindRelationshipLists($,body,meta.custom_field_relationships||{});
  meta.custom_field_lists=relationshipLists.lists;
  for(const [file,html]of relationshipLists.templates){await writeFile(path.join(project,file),html);repeatTemplates.add(file);}
  const relationships=bindRelationshipLinks($,body,meta.custom_field_relationships||{});
  meta.custom_field_links={...customLinks.contexts,...relationships.contexts};
  meta.custom_field_numbers={};
  const customBindings=bindCustomFieldText($,body,meta.custom_fields||{},'custom_fields',meta.custom_field_schema||{},meta.custom_field_numbers);
  customBindings.push(...customLinks.bindings,...relationships.bindings,...relationshipLists.bindings);
  if(meta.product?.sku)customBindings.push(...bindCustomFieldText($,body,{sku:meta.product.sku},'product'));
  if(meta.event)customBindings.push(...bindCustomFieldText($,body,{cost:meta.event.cost,venue:meta.event.venue},'event'));
  const slots=[],decorations={},blocks={},reasons=[],sectionNames=new Set();
  function slot(nodes,inline=false){
   const source=nodes.map(n=>$.html(n)).join(''),key='body'+(slots.length+1);
   const prose=load(source,null,false);prose('a[title],img[title]').removeAttr('title');prose('a:not([href])').attr('href','#migration-inert-link');
   prose('img[alt]').each((_,el)=>prose(el).attr('alt',prose(el).attr('alt').replace(/\s+/g,' ').trim()));
   // Turndown strips whitespace touching BR. A responsive theme may hide
   // those breaks, so keep the source separators without inventing new ones.
   const space='MIGRATIONBRSPACE'+hash(source)+'END';
   prose('br').each((_,el)=>{
    if(el.prev?.type==='text')el.prev.data=el.prev.data.replace(/\s+$/,space);
    if(el.next?.type==='text')el.next.data=el.next.data.replace(/^\s+/,space);
   });
   const md=markdown.turndown(prose.html()).replaceAll(space,' ').trim();
   if(!md)return null;
   const d=load(source,null,false),attrs=[];
   const indices={};d('*').each((_,el)=>{const tag=el.name,index=indices[tag]||0;indices[tag]=index+1;
    if(['span','mark','small','sup','sub','abbr','kbd'].includes(tag))return; // Inline presentation is already carried by Markdown.
    const saved=Object.fromEntries(Object.entries(el.attribs||{}).filter(([k])=>!['href','src','alt'].includes(k)));
    if(tag==='figure'){const image=d(el).find('img').first();attrs.push({tag:'img',index:d('img').index(image[0]),wrapFigure:{...el.attribs},attrs:{}});}
    if(Object.keys(saved).length||tag==='a'&&!el.attribs.href)attrs.push({tag,index,attrs:saved,...(tag==='a'&&!el.attribs.href?{removeHref:true}:{})});
   });
   const text=nodes.map(n=>n.type==='text'?n.data:$.html(n)).join('');
   const prefix=/^\s/.test(text)?' ':'';const suffix=/\s$/.test(text)?' ':'';
   const heading=d('h1,h2,h3,h4,h5,h6').first().text().trim(),image=d('img').first();
   const label=heading||(image.length&&!d.root().text().trim()?'image '+(image.attr('alt')||''):d.root().text().trim().split(/\s+/).slice(0,7).join(' '));
   const name=sectionName(label,sectionNames);
   decorations[key]=attrs;slots.push({key,name,markdown:md,inline,prefix,suffix,textHash:hash(d.root().text().replace(/\s+/g,' ').trim())});return 'MIGRATION_SLOT_'+key+'_END';
  }
  function utility(node){return Boolean(contentTitle&&node===primaryHeading[0])||$(node).is('nav,aside,[role="navigation"],[role="menu"],[role="menubar"],.ns-buttons,.sharedaddy,.sd-sharing,.wp-block-social-links');}
  function walk(parent){
   const children=parent.contents().toArray();
   const inline=inlineTags.has(parent[0]?.name)||/^h[1-6]$/.test(parent[0]?.name||'')||parent[0]?.name==='p';
   let i=0;
   while(i<children.length){const node=children[i];
    if(node.type==='comment'){$(node).remove();i++;continue;}
    if(node.type==='tag'&&(node.name==='br'||utility(node))){i++;continue;}
    if(compatible(node)){
     const run=[];let flow=null;
     while(i<children.length&&compatible(children[i])&&!utility(children[i])){
      const next=children[i],kind=next.type==='text'&&!next.data.trim()?null:next.type==='text'||inlineTags.has(next.name);
      // Markdown wraps inline prose in P when it shares a block run. Keep
      // source flow boundaries, while whitespace stays neutral between blocks.
      if(!inline&&flow!==null&&kind!==null&&kind!==flow)break;
      if(kind!==null)flow=kind;run.push(children[i++]);
     }
     const onlyInline=run.every(n=>n.type==='text'||inlineTags.has(n.name));
     const token=slot(run,inline||onlyInline);
     if(token){$(run[0]).replaceWith(token);for(const item of run.slice(1))$(item).remove();}
     continue;
    }
    i++;
    if(node.type!=='tag')continue;
    if(rich.has(node.name)){
     const capturedMedia=captureComponentMedia($.html(node)),content=capturedMedia?.html||$.html(node),id='block-'+hash(content),key='component'+(Object.keys(blocks).length+1);
     const file='templates/components/'+id+'.html';reasons.push({component:key,reason:'Rich '+node.name+' requires HTML semantics'});
     $(node).replaceWith('MIGRATION_COMPONENT_'+key+'_END');blocks[key]={file,html:content,...(capturedMedia?{media:capturedMedia.data}:{})};continue;
    }
    walk($(node));
   }
  }
  // In a known article body, block components are explicit Markdown shortcodes.
  // Their presence need not split otherwise continuous prose into layout slots.
  if(body[0]!==$.root()[0])body.children().each((_,node)=>{
   if(!rich.has(node.name)&&!(node.name==='figure'&&!compatible(node)))return;
   const capturedMedia=captureComponentMedia($.html(node)),content=capturedMedia?.html||$.html(node),key='component'+(Object.keys(blocks).length+1),file='templates/components/block-'+hash(content)+'.html';
   blocks[key]={file,html:content,...(capturedMedia?{media:capturedMedia.data}:{})};reasons.push({component:key,reason:'Rich '+node.name+' requires HTML semantics'});
   $(node).replaceWith('<p>{{component:'+key+'}}</p>');
  });
  walk(body);
  if(!slots.length&&body.find('p').toArray().some(el=>!$(el).parents().toArray().some(utility)&&$(el).text().trim().length>80))throw Error('Textual content was not converted into editable Markdown');
  let wrapper=$.html();
  wrapper=shell.replace('{{body}}',()=>wrapper);
  const front={...meta,...(Object.keys(sliderSequences).length?{slider_sequences:sliderSequences}:{}),title:contentTitle||meta.title,permalink:p.route,robots:p.robots||'index,follow',draft:false,layout_values:{},layout_attributes:{},components:{}};
  for(const [key,block] of Object.entries(blocks)){if(!components.has(block.file)){await writeFile(path.join(project,block.file),block.html);components.add(block.file);}front.components[key]=block.file;if(block.media){front.component_media||={};front.component_media[key]=block.media;}}
  const dom=load(wrapper,null,false);let next=0,attributeIndex=0;
  const heading=dom('main h1,article h1,.entry-title').first();
  if(heading.is('h1')&&!heading.find('*').length&&heading.text().trim()&&!heading.text().includes('MIGRATION_')){front.title=heading.text().trim();}

  const value=(text,field)=>{if(!field){field='value'+(++next);front.layout_values[field]=text;return marker('layout_values.'+field);}return marker(field);};
  dom('*').each((_,el)=>{
   const e=dom(el);
   if(el.name==='h1'&&e.text().trim()===front.title&&!e.find('*').length)e.text(value(front.title,'title'));
   if(el.name==='time'&&meta.date){if(e.attr('datetime')===meta.date)e.attr('datetime',value(meta.date,'date'));}
   const attrs=Object.fromEntries(Object.entries(el.attribs||{}).sort(([a],[b])=>a.localeCompare(b)));
   const attrKey='attrs'+attributeIndex++;
   front.layout_attributes[attrKey]=attrs;
   el.attribs={'data-migration-attributes':'MIGRATION_ATTRIBUTES_'+attrKey+'_END'};
   e.contents().filter((_,n)=>n.type==='text').each((_,n)=>{
    if(!n.data.trim()){if(n.data.includes('\u00a0'))n.data=value(n.data);else n.data=n.data?' ':'';return;}
    if(n.data.includes('MIGRATION_'))return;
    n.data=value(n.data,meta.author&&n.data.trim()===meta.author?'author':undefined);
   });
  });
  wrapper=dom.html().replace(/data-migration-attributes="(MIGRATION_ATTRIBUTES_attrs\d+_END)"/g,'$1');const shared=shareRepeats(wrapper,front);wrapper=shared.html;front.layout_values=shared.layout_values;front.layout_attributes=shared.layout_attributes;front.layout_repeats=shared.layout_repeats;
  for(const [file,html]of shared.templates){if(!repeatTemplates.has(file))await writeFile(path.join(project,file),html);repeatTemplates.add(file);}
    return {wrapper,front,slots,decorations,reasons,customBindings};
   })();
   if(conversionCache.size>=32)conversionCache.delete(conversionCache.keys().next().value);
   conversionCache.set(conversionKey,conversion);
  }else reusedConversions++;
  const {wrapper,slots,decorations,reasons,customBindings}=conversion;
  const front={...conversion.front,...meta,title:conversion.front.title,permalink:p.route,robots:p.robots||'index,follow',draft:false};
  const role=templateRole(sourcePages.get(p.route)||p,model.source,html);
  const family='content-'+hash(wrapper),variantId=role.role+'-'+family;
  if(!variants.has(variantId))variants.set(variantId,{id:variantId,role:role.role,html:wrapper,sample:front});
  recordVariants.set(file,variantId);front.custom_field_bindings=customBindings.filter(b=>b.field.startsWith('custom_fields.'));if(meta.product)front.product_bindings=customBindings.filter(b=>b.field.startsWith('product.'));if(meta.event)front.event_bindings=customBindings.filter(b=>b.field.startsWith('event.'));front.template_role=role.role;front.template_evidence=role.evidence;
  if(!families.has(family))await writeFile(path.join(project,'templates/content/'+family+'.html'),wrapper);families.add(family);
  front.content_slots=slots.map(({key,name,inline,prefix,suffix})=>({key,name,inline,prefix,suffix,decorations:decorations[key]}));
  front.template='migration';front.content_template='templates/content/'+family+'.html';
  const markdownBody=slots.length===1?slots[0].markdown:slots.map(s=>'<!-- content-slot:'+s.name+' -->\n\n'+s.markdown).join('\n\n');
  // Presentation bindings belong beside templates, not in the author's metadata.
  const presentation={layout_values:front.layout_values,layout_attributes:front.layout_attributes,layout_repeats:front.layout_repeats,components:front.components,content_slots:front.content_slots};
  const layoutData='templates/data/'+p.collection+'-'+p.slug+'.json';
  await writeFile(path.join(project,layoutData),JSON.stringify(presentation,null,2));
  const authorFront={...front,layout_data:layoutData};
  delete authorFront.layout_repeats;delete authorFront.layout_attributes;delete authorFront.layout_values;delete authorFront.components;delete authorFront.content_slots;
  await writeFile(path.join(project,file+'.md'),'---\n'+YAML.stringify(authorFront)+'---\n\n'+markdownBody+'\n');
  // The sidecar already holds presentation bindings and slot decorations.
  // Duplicating them here can exceed V8's maximum string length on large sites.
  layout.records[file]={metadata:authorFront,bodyHash:hash(markdownBody.trim()),metadataFingerprint:metadataFingerprint(front),slots:slots.map(({key,inline,textHash})=>({key,inline,textHash})),mode:!slots.length?'components-only':reasons.length?'markdown-with-components':slots.length>1?'markdown-with-layout':'markdown',components:reasons};
  await rm(path.join(project,file+'.html'),{force:true});await rm(path.join(project,file+'.json'),{force:true});
 }
 await writeFile(path.join(project,'templates/page-migration.html'),'MIGRATION_RENDER_START{{body}}MIGRATION_RENDER_END');
 await writeFile(path.join(project,'templates/post-migration.html'),'MIGRATION_RENDER_START{{body}}MIGRATION_RENDER_END');
 for(const name of temporaryShells)await rm(path.join(project,'templates/page-'+name+'.html'),{force:true});
 for(const name of await readdir(path.join(project,'templates/content')))if(/^content-[a-f0-9]+\.html$/.test(name)&&!families.has(name.slice(0,-5)))await rm(path.join(project,'templates/content',name));
 for(const name of await readdir(path.join(project,'templates/components')))if(/^block-[a-f0-9]+\.html$/.test(name)&&!components.has('templates/components/'+name))await rm(path.join(project,'templates/components',name));
 // Compile common structures across a role, then project each record's scalar
 // bindings into that shared structure. No page HTML goes into its Markdown.
 await writeFile(path.join(project,'template-roundtrip-report.json'),JSON.stringify({status:'running',records:[]}));
 const semantic=compileTemplateFamilies([...variants.values()]);
 await mkdir(path.join(project,'templates/partials'),{recursive:true});
 for(const [file,html]of semantic.files)await writeFile(path.join(project,file),html);
 const renderingCache=new Map(semantic.files),roundtrip=[];
 const relationshipRecords=nativeRelationshipIndex((model.pages||[]).map(p=>({type:p.wordpress?.type,id:p.wordpress?.id,route:p.route,title:p.wordpress?.title||p.title})));
 for(const file of repeatTemplates)renderingCache.set(file,await readFile(path.join(project,file),'utf8'));
 const invariants=templateInvariants(renderingCache);
 for(const [file,record]of Object.entries(layout.records)){
  const entry=semantic.plans.get(recordVariants.get(file)),meta=record.metadata;
  const data=JSON.parse(await readFile(path.join(project,meta.layout_data),'utf8'));
  const projected={...projectTemplateBindings(entry.plan,{...data,...meta}),components:data.components,content_slots:data.content_slots};
  const original={...data,...meta};
  const before=await renderBindings(variants.get(recordVariants.get(file)).html,{...original,__relationshipRecords:relationshipRecords},renderingCache);
  const after=await renderBindings(semantic.files.get(entry.file),{...original,...projected,__relationshipRecords:relationshipRecords},renderingCache);
  const identical=before===after||load(before,null,false).html()===load(after,null,false).html();
  roundtrip.push({file,role:meta.template_role,passed:identical,renderedHash:hash(after)});
  invariants.collect(entry.file,{...original,...projected});
  if(!identical){await writeFile(path.join(project,'template-roundtrip-report.json'),JSON.stringify({status:'failed',records:roundtrip},null,2));throw Error('Semantic template changed captured DOM: '+file);}
  meta.content_template=entry.file;
  const hydrated={...projected,...meta};delete hydrated.layout_data;
  record.metadataFingerprint=metadataFingerprint(hydrated);
  await writeFile(path.join(project,meta.layout_data),JSON.stringify(projected,null,2));
  const markdown=await readFile(path.join(project,file+'.md'),'utf8');
  await writeFile(path.join(project,file+'.md'),'---\n'+YAML.stringify(meta)+'---\n'+markdown.replace(/^---\n[\s\S]*?\n---\n/,''));
 }
 const readable=invariants.apply();
 for(const [file,html]of renderingCache)await writeFile(path.join(project,file),html);
 for(const item of roundtrip){
  const meta=layout.records[item.file].metadata,data=JSON.parse(await readFile(path.join(project,meta.layout_data),'utf8'));
  const compact={...invariants.prune(meta.content_template,{...data,...meta}),components:data.components,content_slots:data.content_slots};
  const hydrated={...compact,...meta};delete hydrated.layout_data;
  const rendered=await renderBindings(renderingCache.get(meta.content_template),{...hydrated,__relationshipRecords:relationshipRecords},renderingCache);
  if(hash(rendered)!==item.renderedHash){item.passed=false;await writeFile(path.join(project,'template-roundtrip-report.json'),JSON.stringify({status:'failed',phase:'readable-markup',records:roundtrip},null,2));throw Error('Readable template changed captured DOM: '+item.file);}
  layout.records[item.file].metadataFingerprint=metadataFingerprint(hydrated);
  await writeFile(path.join(project,meta.layout_data),JSON.stringify(compact,null,2));
 }
 const sharedData=await shareLayoutData(project,Object.values(layout.records).map(r=>r.metadata.layout_data));
 for(const dir of ['content','partials'])for(const name of await readdir(path.join(project,'templates',dir))){
  const file='templates/'+dir+'/'+name;
  if((/^content-[a-f0-9]+\.html$/.test(name)||dir==='partials'&&/-[a-f0-9]{12}\.html$/.test(name))&&!semantic.files.has(file))await rm(path.join(project,file),{force:true});
 }
 families.clear();for(const file of semantic.files.keys())if(file.startsWith('templates/content/'))families.add(file);
 await writeFile(path.join(project,'template-roundtrip-report.json'),JSON.stringify({status:'passed',records:roundtrip},null,2));
 await writeFile(path.join(project,'template-catalog.json'),JSON.stringify({schema:'semantic-templates/v1',sourceAliases,readable,sharedData,reusedConversions,roles:[...families].map(file=>({role:path.basename(file,'.html'),file,records:Object.values(layout.records).filter(r=>r.metadata.content_template===file).length})),partials:[...semantic.files.keys()].filter(f=>f.startsWith('templates/partials/')),sourceStructures:variants.size,method:'Shared role structure with ordered reusable sections; original DOM and bindings preserved'},null,2));
 await writeFile(path.join(project,'TEMPLATES.md'),`# Editing your captured theme

- Edit content in content/<collection>/*.md. Frontmatter selects content_template and layout_data.
- Named role templates are in templates/content/: home, archive, category, single-post, default-page, and detected custom types. Only roles supported by captured evidence are emitted.
- templates/partials/ contains shared site chrome and variable sections. Editing a shared partial updates every page using it. templates/repeats/ holds reusable cards and rows.
- Shared presentation bindings live in templates/data/shared.json. Each $shared reference resolves to one editable definition; changing it updates all uses.
- title controls captured plain-text page headings; seo_title controls the browser/search title. Rich headings remain in Markdown to preserve their inline styling.
- Page-specific attributes, ordered sections, optional blocks and decorations live in templates/data/*.json. layout_regions lists reusable partials in rendering order; an empty list omits a section. No complete page HTML is stored there.
- Edit menus.json for captured nested menus (stable item ids; use template to add an item from an existing item). Edit navigation.json for fallback navigation labels/destinations, assets/css for styles, and templates/layout.html for the document head.
- Run node scripts/site.mjs new --type posts --slug my-post to inherit a captured single-post template. Use --layout <role> to select a captured role explicitly. New content starts as a draft; edit its Markdown sections, then set draft: false.
- Source colours are preserved. Accessibility reports may flag inherited contrast issues. To opt into colour repair, add data-migration-contrast="repair" to the <html> element in templates/layout.html; review the visual changes after rebuilding.
- Run npm run build to regenerate the static output. Never edit output/ directly.

See template-catalog.json for detected roles, evidence about source aliases and reusable partials. A captured canonical duplicate is not proof of an independently migrated article. Shop/product templates preserve presentation; transactions and backend-only services are not recreated by a static export.
`);
 await writeFile(path.join(project,'content-layout.json'),JSON.stringify(layout,null,2));
 const usage={};for(const r of Object.values(layout.records)){const key=r.metadata.content_template;usage[key]=(usage[key]||0)+1;}
 for(const name of await readdir(path.join(project,'templates/repeats')))if(/^repeat-[a-f0-9]+\.html$/.test(name)&&!repeatTemplates.has('templates/repeats/'+name))await rm(path.join(project,'templates/repeats',name));
 const report={repeatTemplates:repeatTemplates.size,templateUsage:usage,reusedTemplates:Object.values(usage).filter(n=>n>1).length,pagesUsingSharedTemplates:Object.values(usage).filter(n=>n>1).reduce((a,b)=>a+b,0),schema:'content-source-report/v1',sourceOfTruth:'markdown-frontmatter',records:Object.entries(layout.records).map(([file,r])=>({file:file+'.md',mode:r.mode,slots:r.slots.length,components:r.components})),sharedContentTemplates:families.size,components:components.size,htmlSnapshotFallback:false};
 await writeFile(path.join(project,'content-source-report.json'),JSON.stringify(report,null,2));
 model.metrics.contentSource= {markdownFiles:report.records.length,sharedContentTemplates:families.size,components:components.size,htmlSnapshotFallback:false};
}
