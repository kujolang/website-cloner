import test from 'node:test';import assert from 'node:assert/strict';import {calendarView,calendarPeriod,shiftCalendarDate,calendarMonthGrid} from '../scripts/calendar-view.mjs';
const event=(route,start,end,allDay=false)=>({route,title:route,description:'',venue:'Harbor',start,end,allDay});
const manifest={schema:'website-cloner-calendar/v1',events:[event('/multi/','2028-03-11 10:00:00','2028-03-13 12:00:00'),event('/midnight/','2028-03-12 20:00:00','2028-03-13 00:00:00'),event('/all-day/','2028-03-13 00:00:00','2028-03-13 23:59:59',true),event('/year/','2028-12-30 00:00:00','2029-01-02 23:59:59',true)]};
test('calendar day/month queries include overlapping local dates without inventing recurrences',()=>{
 assert.deepEqual(calendarView(manifest,{date:'2028-03-13'}).map(e=>e.route),['/multi/','/all-day/']);
 assert.equal(calendarView(manifest,{date:'2029-01-01',view:'month'})[0].route,'/year/');
 assert.equal(calendarView(manifest,{date:'2028-03-01',view:'month'}).length,3);
 assert.equal(calendarView(manifest,{date:'2028-03-01',view:'list',query:'harbor'}).length,4);
 assert.equal(calendarView(manifest,{date:'2030-01-01'}).length,0);
});
test('navigation handles leap years and month/year boundaries, rejecting invalid input',()=>{
 assert.equal(shiftCalendarDate('2028-02-28','day',1),'2028-02-29');assert.equal(shiftCalendarDate('2028-12-31','month',1),'2029-01-01');assert.equal(shiftCalendarDate('2028-01-31','month',-1),'2027-12-01');assert.deepEqual(calendarPeriod('2028-02-13','month'),{start:'2028-02-01',end:'2028-02-29'});
 assert.throws(()=>calendarPeriod('2027-02-29'),/Invalid/);assert.throws(()=>calendarPeriod('2028-02-29','decade'),/Unknown/);assert.throws(()=>shiftCalendarDate('2028-01-01','day',2),/direction/);
});
test('month grids preserve week starts and split multi-day spans at week boundaries',()=>{
 const weeks=calendarMonthGrid(manifest,'2028-03-12',1);assert.equal(weeks[0][0].date,'2028-02-28');assert.equal(weeks.at(-1).at(-1).date,'2028-04-02');
 const cells=weeks.flat();const first=cells.find(c=>c.date==='2028-03-11').events.find(e=>e.event.route==='/multi/');assert.equal(first.width,2);assert.equal(first.display,true);assert.equal(first.endsThisWeek,false);
 const continuation=cells.find(c=>c.date==='2028-03-12').events.find(e=>e.event.route==='/multi/');assert.equal(continuation.display,false);
 const following=cells.find(c=>c.date==='2028-03-13').events.find(e=>e.event.route==='/multi/');assert.equal(following.width,1);assert.equal(following.display,true);assert.equal(following.startsHere,false);assert.equal(following.endsThisWeek,true);
 assert.ok(!cells.find(c=>c.date==='2028-03-13').events.some(e=>e.event.route==='/midnight/'));assert.throws(()=>calendarMonthGrid(manifest,'2028-03-01',7),/week start/);
});
