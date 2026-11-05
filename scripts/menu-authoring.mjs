import {createHash} from 'node:crypto';
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,16);
const textNodes=node=>{const out=[];for(const child of node.children||[]){if(child.type==='text'&&child.data.trim())out.push(child);else if(child.type==='tag'&&!['svg','i','script','style'].includes(child.name)&&!/(?:toggle|icon|screen-reader)/i.test(child.attribs?.class||''))out.push(...textNodes(child));}return out;};
const label=node=>textNodes(node).map(n=>n.data.trim()).join(' ');
function tree($,list,prefix='',templates=new Map()){
 if(prefix.split('-').length>12)return null;
 const items=[];
 for(const [index,node] of $(list).children('li').toArray().entries()){
  const li=$(node),anchor=li.find('a').filter((_,a)=>$(a).closest('li')[0]===node).first();
  if(!anchor.length||!anchor.attr('href')||!label(anchor[0]))return null;
  const id=prefix+(index+1),sub=li.children('ul').first();
  const children=sub.length?tree($,sub[0],id+'-',templates):[];if(children===null)return null;
  templates.set(id,node);items.push({id,label:label(anchor[0]),url:anchor.attr('href'),...(children.length?{children}:{})});
 }
 return items;
}
export function remapMenuURL(value,moved){
 if(moved.has(value))return moved.get(value);
 const split=value.search(/[?#]/);if(split>=0&&moved.has(value.slice(0,split))){const target=moved.get(value.slice(0,split));return target?target+value.slice(split):undefined;}
 return value;
}
export function inspectMenus($,base='',moved=new Map()){
 const originalRoutes=new Map([...moved].filter(([from,to])=>to&&from!==to).map(([from,to])=>[to,from]));
 const found=[];
 $('nav').each((_,nav)=>{
  const lists=$(nav).find('ul').filter((_,ul)=>!$(ul).parentsUntil(nav,'ul').length);
  if(lists.length!==1)return;
  const templates=new Map(),items=tree($,lists[0],'',templates);if(!items?.length)return;
  const normalize=nodes=>nodes.map(n=>{const url=base&&n.url.startsWith(base+'/')?n.url.slice(base.length):n.url;return {...n,url:remapMenuURL(url,originalRoutes),...(n.children?{children:normalize(n.children)}:{})};});
  const data=normalize(items);found.push({id:'menu-'+hash(data),items:data,list:lists[0],templates,nav});
 });return found;
}
function destination(value,base,moved){
 if(typeof value!=='string'||/[\x00-\x20\\]/.test(value)||!(/^(?:\/(?!\/)|#|https?:\/\/|mailto:|tel:)/i.test(value)))throw Error('Unsafe menu destination');
 const url=remapMenuURL(value,moved);if(!url)throw Error('Menu destination belongs to removed content');return url.startsWith('/')?base+url:url;
}
export function renderMenu($,menu,items,{base='',moved=new Map()}={}){
 if(!Array.isArray(items))throw Error('Menu items must be an array');
 const used=new Set();
 function render(nodes,depth=0){
  if(depth>12)throw Error('Menu nesting exceeds twelve levels');
  return nodes.map(item=>{
   if(!item||typeof item.id!=='string'||!item.id||used.has(item.id))throw Error('Menu item ids must be unique');used.add(item.id);
   const source=menu.templates.get(item.template||item.id);if(!source)throw Error('New menu items need a captured template id');
   if(typeof item.label!=='string'||!item.label.trim())throw Error('Menu label must be nonempty text');
   const li=$(source).clone(),anchor=li.find('a').filter((_,a)=>$(a).closest('li')[0]===li[0]).first(),parts=textNodes(anchor[0]);
   if(!parts.length)throw Error('Menu label has no editable text node');parts[0].data=item.label;for(const part of parts.slice(1))part.data='';anchor.attr('href',destination(item.url,base,moved));
   if(item.template){li.find('[id]').addBack('[id]').removeAttr('id');li.find('[aria-controls]').addBack('[aria-controls]').removeAttr('aria-controls');}
   const sub=li.children('ul').first(),children=item.children||[];if(!Array.isArray(children))throw Error('Menu children must be an array');
   if(children.length){if(!sub.length)throw Error('A parent menu item needs a captured parent template');sub.empty().append(render(children,depth+1));}
   else if(sub.length){sub.remove();li.removeClass('menu-item-has-children parent-has-child');li.find('.hfe-menu-toggle,.sub-arrow,.wp-block-navigation__submenu-icon').remove();li.find('[aria-expanded]').removeAttr('aria-expanded').removeAttr('aria-controls');const trigger=li.children('.hfe-has-submenu-container');if(trigger.length)trigger.replaceWith(anchor);}
   return li[0];
  });
 }
 const rendered=render(items);$(menu.list).empty().append(rendered);
}

// Recompute WordPress menu states after authoring. Never derive ancestry from
// URL prefixes: only actual nested menu parents receive ancestor styling.
export function refreshMenuCurrentState($,nav,{route,base=''}={}){
 if(!route)return;
 const scope=$(nav),classes='current-menu-item current-menu-parent current-menu-ancestor current_page_item current_page_parent current_page_ancestor';
 const owned=selector=>scope.find(selector).filter((_,el)=>$(el).closest('nav')[0]===nav);
 owned('li').removeClass(classes);owned('a[aria-current]').removeAttr('aria-current');
 const path=value=>{try{if(!value.startsWith('/')||value.startsWith('//'))return null;const url=new URL(value,'https://local.invalid');if(url.search)return null;return url.pathname.replace(/\/$/,'')||'/';}catch{return null;}};
 const target=path(base+route);
 for(const a of owned('a[href]').toArray()){
  if(target===null||path($(a).attr('href'))!==target)continue;
  const li=$(a).closest('li');if(!li.length)continue;
  $(a).attr('aria-current','page');li.addClass('current-menu-item');
  const isPage=li.hasClass('menu-item-object-page');if(isPage)li.addClass('current_page_item');
  const parents=li.parentsUntil(nav,'li');parents.addClass('current-menu-ancestor');parents.first().addClass('current-menu-parent');
  if(isPage){parents.addClass('current_page_ancestor');parents.first().addClass('current_page_parent');}
 }
}
