import {createHash} from 'node:crypto';
import {load} from 'cheerio/slim';
// A whole, uniformly rendered list is evidence for adding/reordering its items.
export function bindRelationshipLists($,root,relationships){
 const bindings=[],lists={},templates=new Map();
 for(const [field,relation]of Object.entries(relationships)){
  if(!relation.many||!relation.items.length)continue;
  const sources=new Set(relation.items.map(item=>item.source));
  if(Object.entries(relationships).some(([key,other])=>key!==field&&(other.many?other.items:[other]).some(item=>sources.has(item.source))))continue;
  const items=[];let valid=true;
  for(const target of relation.items){
   const matches=root.find('a[href]').filter((_,node)=>{try{const u=new URL($(node).attr('href'),target.source);return u.href===target.source;}catch{return false;}});
   if(matches.length!==1){valid=false;break;}
   const anchor=matches.first(),li=anchor.closest('li'),list=li.parent();
   if(!li.length||!list.is('ul,ol')||li.find('a').length!==1||li.find('[id]').length||li.attr('id')||list.closest('nav,header,footer,form').length||li.text().trim()!==target.title){valid=false;break;}
   const copy=load($.html(li),null,false),a=copy('a'),texts=[];
   function visit(node){if(node.type==='text'&&node.data.trim())texts.push(node);for(const child of node.children||[])visit(child);}
   visit(a[0]);if(texts.length!==1||texts[0].data.trim()!==target.title){valid=false;break;}
   a.attr('href','MIGRATION_LINK_relationship_item_END');texts[0].data=texts[0].data.replace(target.title,'MIGRATION_RELATIONTITLE_relationship_item_END');
   items.push({li:li[0],list:list[0],html:copy.html()});
  }
  if(!valid||items.some(item=>item.list!==items[0].list||item.html!==items[0].html))continue;
  const list=$(items[0].list),children=list.children().toArray();
  if(children.length!==items.length||children.some((node,i)=>node!==items[i].li)||list.contents().toArray().some(node=>node.type==='text'?node.data.trim():node.type!=='tag'))continue;
  const gaps=[];for(let i=0;i<items.length-1;i++){let gap='',node=items[i].li.next;while(node&&node!==items[i+1].li){gap+=node.data||'';node=node.next;}gaps.push(gap);}
  if(gaps.some(gap=>gap!==gaps[0]))continue;
  const prefix=list[0].children[0]?.type==='text'?list[0].children[0].data:'',last=list[0].children.at(-1),suffix=last?.type==='text'?last.data:'';
  const html=items[0].html,file='templates/repeats/relationship-'+createHash('sha256').update(html).digest('hex').slice(0,20)+'.html';templates.set(file,html);
  lists[field]={template:file,prefix,suffix,separator:gaps[0]||'',nullable:relation.nullable};
  list.empty().text('MIGRATION_RELATIONLIST_'+field+'_END');list[0].children[0].migrationCustomField=true;
  for(let node=list[0];node;node=node.parent){node.migrationCustomField=true;if(node===root[0])break;}
  bindings.push({field,evidence:'Public post references and uniform complete relationship list'});
 }
 return {bindings,lists,templates};
}
