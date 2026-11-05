// Move whole-block presentation spans beside the template. Partial text spans
// remain inline because their boundaries cannot safely follow arbitrary edits.
export function extractProsePresentation($){
 const decorations=[];
 const targets=$('p,h1,h2,h3,h4,h5,h6,li,blockquote').toArray();
 const root=$.root(),significant=node=>node.contents().filter((_,n)=>n.type!=='text'||n.data.trim());
 if(significant(root).length===1&&significant(root)[0].name==='span')targets.push(root[0]);
 for(const target of targets){const node=$(target),wrappers=[];
  while(significant(node).length===1&&significant(node)[0].name==='span'){
   const span=significant(node).first();wrappers.push({...span[0].attribs});span.replaceWith(span.contents());
  }
  if(wrappers.length)decorations.push({tag:target===root[0]?'p':target.name,index:target===root[0]?0:$(target.name).index(target),attrs:{},wrapContents:wrappers});
 }
 return decorations;
}
