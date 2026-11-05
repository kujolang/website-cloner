// Recognize a rendered line-truncation component by its measurement structure,
// not a site name or review class. Keep its visible copy editable in Markdown.
export function markTruncation($){
 $('span[width]').each((_,el)=>{
  const root=$(el),children=root.children('span');if(children.length!==2)return;
  const content=children.eq(0),suffix=children.eq(1),style=suffix.attr('style')||'';
  if(!/position\s*:\s*fixed/i.test(style)||!/visibility\s*:\s*hidden/i.test(style)||!suffix.find('a[href]').length||!/^\s*(?:\.{3}|…)/.test(suffix.text()))return;
  const lines=content.find('br').length+1;if(lines>12)return;
  root.attr('data-migration-truncate-lines',String(lines));content.attr('data-migration-truncate-content','true');suffix.attr('data-migration-truncate-suffix','true');
 });
}
