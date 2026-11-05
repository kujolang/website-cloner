import {calendarListConfig} from '../scripts/calendar-list-config.mjs';
import {calendarDatePattern} from '../scripts/calendar-labels.mjs';
import {captureSmartSliders} from './slider-data.mjs';
import {captureGalleryItems} from './gallery-data.mjs';
// Preserve bounded declarative component data, never source executable code.
export function captureComponentData($){
 const warnings=[...captureGalleryItems($),...captureSmartSliders($)];
 $('[data-js="tribe-events-view"]').each((_,el)=>{
  const root=$(el);for(const name of ['data-view-rest-url','data-view-rest-method','data-view-rest-nonce'])root.removeAttr(name);let data;try{data=JSON.parse(root.find('[data-js="tribe-events-view-data"]').first().text());}catch{return;}
  if(!data||typeof data!=='object'||Array.isArray(data))return;
  const list=calendarListConfig(data,root.find('.tribe-events-calendar-list__event-row').length);if(list)root.attr('data-migration-calendar-list',JSON.stringify(list));
  const compact=calendarDatePattern(data.date_formats?.compact);if(compact)root.attr('data-migration-calendar-compact-format',compact);
  const week=data.start_of_week;if((Number.isInteger(week)&&week>=0&&week<=6)||(typeof week==='string'&&/^[0-6]$/.test(week)))root.attr('data-migration-calendar-week-start',String(week));
  if(!data.breakpoints||typeof data.breakpoints!=='object'||Array.isArray(data.breakpoints))return;
  const entries=Object.entries(data.breakpoints||{}).filter(([key,value])=>/^[a-z][a-z0-9-]{0,30}$/.test(key)&&Number.isFinite(value)&&value>=0&&value<=10000);
  if(entries.length&&entries.length<=20)root.attr('data-migration-container-breakpoints',JSON.stringify({prefix:'tribe-common--breakpoint-',widths:Object.fromEntries(entries)}));
 });
 return warnings;
}
