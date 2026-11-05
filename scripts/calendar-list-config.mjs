const pageNumber=url=>{const query=['tribe_paged','paged','page'].map(k=>url.searchParams.get(k)).find(v=>v!==null);const value=query??(/\/page\/(\d+)\/?$/.exec(url.pathname)?.[1])??'1';return /^[1-9]\d{0,5}$/.test(value)?Number(value):null;};
// A short final page cannot establish a configured page size. Only a full
// source page with a next-page link provides that evidence.
export function calendarListConfig(data,visibleCount){
 if(!data||typeof data!=='object'||(data.view_slug??data.slug)!=='list'||data.past===true||data.is_past===true)return null;
 let url;try{url=new URL(data.url);if(!['http:','https:'].includes(url.protocol))return null;}catch{return null;}
 const page=pageNumber(url);if(!page)return null;
 const selected=data.url_event_date;let date='today';if(typeof selected==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(selected)){const parsed=new Date(selected+'T00:00:00Z');if(Number.isFinite(+parsed)&&parsed.toISOString().slice(0,10)===selected)date=selected;}
 const result={page,date};
 if(data.next_url){try{const next=new URL(data.next_url,url);const ids=data.events;if(next.origin===url.origin&&pageNumber(next)===page+1&&Array.isArray(ids)&&ids.length===visibleCount&&ids.length>0&&ids.length<=1000&&ids.every(id=>Number.isInteger(id)&&id>0)&&new Set(ids).size===ids.length)result.pageSize=ids.length;}catch{}}
 return result;
}
