// Interpret known optimizer data contracts; never execute source handlers.
export function backgroundURL(raw, base) {
  if (!raw) return null;
  const value=raw.trim(), match=/^url\(\s*(["']?)([^"'()]+)\1\s*\)$/i.exec(value);
  const candidate=(match?match[2]:value).trim();
  if (/[\\\x00-\x1f]/.test(candidate)||(!match&&/[()]/.test(candidate))) return null;
  try { const u=new URL(candidate,base);return /^https?:$/.test(u.protocol)?u.href:null; } catch { return null; }
}
export function promoteDeferredAssets($, base) {
  $('img,source').each((_,el)=>{
    const node=$(el);let promoted=false;
    for(const [target,keys] of [['src',['data-lazy-src','data-src','data-original']],['srcset',['data-lazy-srcset','data-srcset']]]) {
      const value=keys.map(key=>node.attr(key)).find(Boolean);
      if(!value)continue;
      const candidates=target==='srcset'?value.split(',').map(x=>x.trim().split(/\s+/)[0]):[value];
      if(!candidates.length||!candidates.every(x=>backgroundURL(x,base)))continue;
      node.attr(target,value);keys.forEach(key=>node.removeAttr(key));promoted=true;
    }
    if(promoted){
      const sizes=node.attr('data-lazy-sizes')||node.attr('data-sizes');
      if(sizes&&sizes!=='auto')node.attr('sizes',sizes);
      node.removeAttr('data-lazy-sizes').removeAttr('data-sizes');
      node.removeClass('lazyload lazyloading').addClass('lazyloaded');
      if(node.attr('data-lazyloaded')!==undefined)node.addClass('litespeed-loaded');
    }
  });
  $('link[onload]').each((_,el)=>{
    const node=$(el),statements=(node.attr('onload')||'').split(';').map(s=>s.trim()).filter(Boolean);
    const assignments={};
    if(!statements.length||!statements.every(statement=>{
      if(/^this\.onload\s*=\s*null$/.test(statement))return true;
      const match=/^this\.(rel|media)\s*=\s*(['"])([^'"]+)\2$/.exec(statement);
      if(!match)return false;
      if(match[1]==='rel'&&match[3]!=='stylesheet')return false;
      if(match[1]==='media'&&!/^[\w\s():.,/-]+$/.test(match[3]))return false;
      assignments[match[1]]=match[3];return true;
    }))return;
    if(node.attr('rel')==='preload'&&node.attr('as')==='style'&&assignments.rel==='stylesheet'){
      const href=backgroundURL(node.attr('href'),base),media=assignments.media||node.attr('media')||'';
      const duplicate=$('link[rel=stylesheet]').toArray().some(other=>backgroundURL($(other).attr('href'),base)===href&&($(other).attr('media')||'')===media);
      if(!duplicate)node.attr('rel','stylesheet');
    }
    if(node.attr('rel')==='stylesheet'&&assignments.media)node.attr('media',assignments.media);
  });
}
