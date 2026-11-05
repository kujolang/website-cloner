export function formatFieldNumber(value,spec){
 if(typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>=1e21||!Number.isInteger(spec.digits)||spec.digits<0||spec.digits>12||(spec.digits>0&&!spec.decimal)||(spec.decimal&&spec.decimal===spec.group)||!['','.',','].includes(spec.decimal)||!['','.',',',' ','\u00a0','\u202f'].includes(spec.group))throw Error('Invalid numeric field formatting');
 const [integer,fraction]=Math.abs(value).toFixed(spec.digits).split('.');
 return String(spec.prefix||'')+(value<0?'-':'')+(spec.group?integer.replace(/\B(?=(\d{3})+(?!\d))/g,spec.group):integer)+(spec.digits?spec.decimal+fraction:'')+String(spec.suffix||'');
}
// Infer only a lossless formatting of a known schema-number; never scale or round evidence.
export function inferFieldNumber(text,value){
 if(typeof value!=='number'||!Number.isFinite(value)||String(value)===text)return null;
 const match=/^([^\d]*?)(-?\d(?:[\d., \u00a0\u202f]*\d)?)([^\d]*)$/.exec(text);if(!match)return null;
 const [,prefix,raw,suffix]=match,candidates=[];if(/[()+-]/.test(prefix+suffix))return null;
 for(const decimal of ['','.',','])for(const group of ['','.',',',' ','\u00a0','\u202f']){
  if(decimal&&decimal===group||group&&!raw.includes(group))continue;
  const pieces=decimal?raw.split(decimal):[raw];if(pieces.length>2)continue;
  const digits=pieces[1]?.length||0;if(decimal&&!digits||digits>12)continue;
  const stripped=group?raw.split(group).join(''):raw,number=decimal?stripped.replace(decimal,'.'):stripped;
  if(!/^-?\d+(?:\.\d+)?$/.test(number)||Number(number)!==value)continue;
  const spec={prefix,suffix,decimal,group,digits};try{if(formatFieldNumber(value,spec)===text)candidates.push(spec);}catch{}
 }
 return candidates.length===1?candidates[0]:null;
}
