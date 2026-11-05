import {calendarToday} from './calendar-clock.mjs';
import {calendarMonthGrid} from './calendar-view.mjs';
export function renderCalendarMonth(manifest,presentation,day,{fragment,locale='en',today=calendarToday()}={}){
 const weeks=calendarMonthGrid(manifest,day,presentation.weekStartsOn??0),shells=presentation.shells;
 if(!shells.month||!shells.monthCell||!shells.monthMobile||!shells.monthMobileDay)throw Error('Month calendar templates are missing');
 const grid=fragment(shells.month).firstElementChild,mobile=fragment(shells.monthMobile).firstElementChild,body=grid.querySelector('tbody');
 const rootId='calendar-'+day.slice(0,7),label=value=>new Intl.DateTimeFormat(locale,{timeZone:'UTC',dateStyle:'long'}).format(new Date(value+'T00:00:00Z'));
 for(const week of weeks){const row=shells.monthWeek?fragment(shells.monthWeek).firstElementChild:document.createElement('tr');
  for(const data of week){const cell=fragment(data.events.length&&shells.monthEventCell?shells.monthEventCell:shells.monthCell).firstElementChild;
   for(const suffix of ['current','past','other-month','past-month','next-month'])cell.classList.remove('tribe-events-calendar-month__day--'+suffix);
   const sourceMonth=today.slice(5,7),cellMonth=data.date.slice(5,7);
   for(const [suffix,active]of [['current',data.date===today],['past',data.date<today],['other-month',cellMonth!==sourceMonth],['past-month',cellMonth<sourceMonth],['next-month',cellMonth>sourceMonth]])if(active)cell.classList.add('tribe-events-calendar-month__day--'+suffix);
   const id=rootId+'-'+data.date,desktop=cell.querySelector('.tribe-events-calendar-month__day-cell--desktop'),button=cell.querySelector('.tribe-events-calendar-month__day-cell--mobile');
   if(desktop){desktop.id=id;cell.setAttribute('aria-labelledby',id);}
   for(const time of cell.querySelectorAll('time')){time.setAttribute('datetime',data.date);time.textContent=String(Number(data.date.slice(8)));}
   for(const text of cell.querySelectorAll('.tribe-common-a11y-visual-hide'))text.textContent=text.textContent.replace(/\d+/,String(data.events.length));
   if(!data.events.length)for(const icon of cell.querySelectorAll('.tribe-events-calendar-month__mobile-events-icon'))icon.remove();
   const panel=fragment(shells.monthMobileDay).firstElementChild;panel.id=id+'-mobile';panel.classList.remove('tribe-events-calendar-month-mobile-events__mobile-day--show');panel.hidden=data.date!==today;panel.tabIndex=-1;if(data.date===today)panel.classList.add('tribe-events-calendar-month-mobile-events__mobile-day--show');
   if(button){button.setAttribute('aria-controls',panel.id);button.setAttribute('aria-expanded','false');button.setAttribute('aria-label',label(data.date)+', '+data.events.length+(data.events.length===1?' event':' events'));button.classList.toggle('tribe-events-calendar-month__day-cell--selected',data.date===today);button.setAttribute('aria-expanded',String(data.date===today));button.dataset.calendarDay=data.date;
    button.addEventListener('click',()=>{const open=button.getAttribute('aria-expanded')!=='true';for(const b of grid.querySelectorAll('[data-calendar-day]')){b.setAttribute('aria-expanded','false');b.classList.remove('tribe-events-calendar-month__day-cell--selected');}for(const p of mobile.children){p.hidden=true;p.classList.remove('tribe-events-calendar-month-mobile-events__mobile-day--show');}if(open){button.setAttribute('aria-expanded','true');button.classList.add('tribe-events-calendar-month__day-cell--selected');panel.hidden=false;panel.classList.add('tribe-events-calendar-month-mobile-events__mobile-day--show');panel.focus({preventScroll:true});}});
    panel.addEventListener('keydown',e=>{if(e.key==='Escape'){panel.hidden=true;panel.classList.remove('tribe-events-calendar-month-mobile-events__mobile-day--show');button.setAttribute('aria-expanded','false');button.classList.remove('tribe-events-calendar-month__day-cell--selected');button.focus();}});
   }
   const container=cell.querySelector('.tribe-events-calendar-month__events');if(!container)throw Error('Month event container is missing');container.replaceChildren();
   for(const item of data.events){const templates=presentation.entries[item.event.route],kind=item.multiday?'monthMultiday':'month';if(!templates?.[kind]||!templates.monthMobile)throw Error('Month event templates are missing');
    const card=fragment(templates[kind]).firstElementChild;
    // Each repeated tooltip needs a unique accessible ID for its date cell.
    const ids=new Map();for(const e of card.querySelectorAll('[id]')){const prior=e.id;e.id=id+'-'+prior;ids.set(prior,e.id);}for(const e of card.querySelectorAll('[aria-describedby],[data-tooltip-content]')){for(const attr of ['aria-describedby','data-tooltip-content']){const value=e.getAttribute(attr);if(value){const key=value.replace(/^#/,'');if(ids.has(key))e.setAttribute(attr,(value.startsWith('#')?'#':'')+ids.get(key));}}}
    if(item.multiday){for(const c of [...card.classList])if(/^tribe-events-calendar-month__multiday-event--/.test(c))card.classList.remove(c);card.classList.add('tribe-events-calendar-month__multiday-event--width-'+item.width);if(item.display)card.classList.add('tribe-events-calendar-month__multiday-event--display');if(item.startsHere)card.classList.add('tribe-events-calendar-month__multiday-event--start');if(item.endsThisWeek)card.classList.add('tribe-events-calendar-month__multiday-event--end');}
    container.append(card);panel.append(fragment(templates.monthMobile));
   }
   if(!data.events.length){const empty=document.createElement('p');empty.textContent='No events for this date.';panel.append(empty);}row.append(cell);mobile.append(panel);
  }body.append(row);
 }
 return {grid,mobile};
}
