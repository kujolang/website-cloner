import {load} from 'cheerio';
// Disambiguate boilerplate only with unique headings that already exist on
// the source. Keep factual wording and leave ambiguous editorial cases alone.
export function repairDuplicateDescriptions(pages){
 const groups=new Map(),repairs=[];
 for(const p of pages){if(!p.description||/\b(noindex|none)\b/i.test(p.robots||''))continue;const key=p.description.trim();if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p);}
 for(const group of groups.values())if(group.length>1){
  const headings=group.map(p=>load(p.content||'')('h1').first().text().replace(/\s+/g,' ').trim());
  const labels=group.map((p,i)=>headings[i]&&headings.filter(h=>h===headings[i]).length===1?headings[i]:(p.title||'').trim());
  for(let i=0;i<group.length;i++){const p=group[i],heading=labels[i];if(!heading||labels.filter(h=>h===heading).length!==1||p.description.startsWith(heading))continue;
   const before=p.description;p.description=heading+(/[.!?]$/.test(heading)?' ':'. ')+before;
   repairs.push({route:p.route,field:'description',before,after:p.description,evidence:heading===headings[i]?'Unique captured primary heading':'Unique captured document title'});
  }
 }
 return repairs;
}
