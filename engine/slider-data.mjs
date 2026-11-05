// Read declarative JSON members only. Never evaluate a source initializer.
function objectMember(text,key){
 const match=new RegExp('"'+key+'"\\s*:\\s*\\{').exec(text);if(!match)return null;
 const start=match.index+match[0].length-1;let depth=0,quoted=false,escape=false;
 for(let i=start;i<Math.min(text.length,start+65536);i++){
  const c=text[i];if(quoted){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')quoted=false;continue;}
  if(c==='"')quoted=true;else if(c==='{')depth++;else if(c==='}'&&!--depth){try{return JSON.parse(text.slice(start,i+1));}catch{return null;}}
 }return null;
}
export function captureSmartSliders($){
 const warnings=[];if(!$('.n2-ss-slider').length)return warnings;
 const configs=new Map();
 $('script').each((_,node)=>{const text=$(node).text();if(text.length>2*1024*1024)return;
 const matches=[...text.matchAll(/new\s+_N2\.SmartSlider(Simple|Carousel|Showcase|Block)\(\s*(['"])([a-zA-Z0-9_-]{1,100})\2\s*,/g)];
 for(let i=0;i<matches.length;i++){
  const m=matches[i],chunk=text.slice(m.index+m[0].length,matches[i+1]?.index||text.length);
  const responsive=objectMember(chunk,'responsive'),controls=objectMember(chunk,'controls'),autoplay=objectMember(chunk,'autoplay'),animation=objectMember(chunk,'mainanimation');
  if(m[1]!=='Simple'||!responsive||!controls||!autoplay||!animation){configs.set(m[3],null);continue;}
  const base=responsive.base,queries=responsive.mediaQueries;
  if(!base||!Number.isFinite(base.slideWidth)||base.slideWidth<=0||base.slideWidth>20000||!Number.isFinite(base.slideHeight)||base.slideHeight<=0||base.slideHeight>20000||!queries||typeof queries!=='object'){configs.set(m[3],null);continue;}
  const carousel=/"carousel"\s*:\s*([01])/.exec(chunk);const data={version:1,type:'simple',responsive,controls,autoplay,animation,carousel:carousel?Number(carousel[1]):1};
  // Round-trip JSON is inert, bounded data. Functions/callbacks never enter it.
  if(JSON.stringify(data).length<=65536)configs.set(m[3],data);
 }
 });
 $('.n2-ss-slider').each((_,node)=>{const root=$(node),id=root.attr('id'),data=configs.get(id);root.removeAttr('data-cloner-smart-slider');
  if(data){root.attr('data-cloner-smart-slider',JSON.stringify(data));if(data.responsive.type!=='auto'||root.find('.n2-ss-layer[data-sstype=slide]').children().length||Number(data.autoplay.enabled)===1)warnings.push({component:'smart-slider',reason:'Configuration captured; full-width/layout layers or autoplay need separate fidelity verification',sourceId:id||null});}else warnings.push({component:'smart-slider',reason:'Source slider configuration unavailable or unsupported; interaction fidelity requires review',sourceId:id||null});
 });return warnings;
}
