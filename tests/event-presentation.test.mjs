import test from 'node:test';import assert from 'node:assert/strict';import{load}from'cheerio';import{normalizeEventDates,eventFormat,formatEventValue,renderEventDates}from'../scripts/event-presentation.mjs';
const original={start:'2027-11-07 01:30:00',end:'2027-11-07 02:30:00',utc_start:'2027-11-07 05:30:00',utc_end:'2027-11-07 07:30:00',timezone:'America/New_York',all_day:false};
test('local and UTC edits synchronize through named and fixed timezones without guessing DST ambiguities',()=>{
 assert.equal(normalizeEventDates({...original,utc_start:'2027-11-07 06:30:00'},original).start,'2027-11-07 01:30:00');
 const moved=normalizeEventDates({...original,start:'2027-12-08 10:00:00',end:'2027-12-08 12:00:00'},original);assert.equal(moved.utc_start,'2027-12-08 15:00:00');assert.equal(moved.utc_end,'2027-12-08 17:00:00');
 assert.throws(()=>normalizeEventDates({...original,start:'2027-11-07 01:45:00'},original),/Ambiguous/);
 assert.equal(normalizeEventDates({...original,start:'2027-11-07 01:45:00',utc_start:'2027-11-07 06:45:00'},original).utc_start,'2027-11-07 06:45:00');
 assert.throws(()=>normalizeEventDates({...original,start:'2027-03-14 02:30:00',end:'2027-03-14 04:00:00'},original),/does not exist/);
 assert.throws(()=>normalizeEventDates({...original,start:'2027-12-08 10:00:00',utc_start:'2027-12-08 10:00:00'},original),/disagree/);
 assert.equal(normalizeEventDates({...original,start:'2027-12-08 10:00:00',end:'2027-12-08 12:00:00',timezone:'UTC+05:45'},original).utc_start,'2027-12-08 04:15:00');
 assert.throws(()=>normalizeEventDates({...original,start:'2027-02-30 10:00:00'},original),/Invalid/);
});
test('recognized source date formats retain their punctuation, locale, and time conventions',()=>{
 for(const text of ['November 7, 2027 @ 1:30 am','07/11/2027','2027-11-07','November 2027','Sun']){const spec=eventFormat(text,original.start);assert.ok(spec,text);assert.equal(formatEventValue(original.start,spec),text);}
 const french=eventFormat('7 novembre 2027',original.start,'fr');assert.equal(formatEventValue('2027-12-08 10:00:00',french,'fr'),'8 décembre 2027');assert.equal(eventFormat('Some day soon',original.start),null);assert.equal(eventFormat('07/07/2027','2027-07-07 10:00:00'),null);
});
test('event display edits preserve nested date tags and expose unsupported formats',()=>{
 const $=load('<time class="tribe-events-calendar-list__event-date-tag-datetime"><span class="tribe-events-calendar-list__event-date-tag-weekday">Sun</span><span class="tribe-events-calendar-list__event-date-tag-daynum">7</span></time><time class="tribe-events-calendar-list__event-datetime"><span class="tribe-event-date-start">November 7, 2027 @ 1:30 am</span> - <span class="tribe-event-time">2:30 am</span></time><abbr class="tribe-events-start-date">November 7, 2027</abbr>');const moved=normalizeEventDates({...original,start:'2027-12-08 10:00:00',end:'2027-12-08 12:00:00'},original);assert.deepEqual(renderEventDates($,moved,original),[]);assert.equal($('.tribe-event-date-start').text(),'December 8, 2027 @ 10:00 am');assert.equal($('.tribe-event-time').text(),'12:00 pm');assert.equal($('.tribe-events-calendar-list__event-date-tag-daynum').text(),'8');assert.equal($('.tribe-events-calendar-list__event-date-tag-weekday').text(),'Wed');assert.equal($('time').first().children().length,2);assert.equal($('time').first().attr('datetime'),'2027-12-08');
 const other=load('<span class="tribe-event-date-start">Soon!</span>');assert.ok(renderEventDates(other,moved,original).length);assert.equal(other('span').text(),'Soon!');
});
test('unchanged partial public records remain reportable and new local dates derive UTC',()=>{
 const partial={...original,utc_start:'',utc_end:''};assert.deepEqual(normalizeEventDates(partial,partial),partial);const fresh=normalizeEventDates({start:'2028-01-08 10:00:00',end:'2028-01-08 12:00:00',timezone:'America/New_York',all_day:false});assert.equal(fresh.utc_start,'2028-01-08 15:00:00');
 const $=load('<div class="tribe-events-meta-group-details"><span class="tribe-event-date-start">November 7, 2027 @ 1:30 am</span></div>');assert.ok(renderEventDates($,{...original,all_day:true},original).some(x=>x.includes('layout')));
});
test('timed multi-day detail values update with source punctuation and preserve neighboring markup',()=>{
 const before={...original,start:'2027-11-07 01:30:00',end:'2027-11-08 02:30:00'},after=normalizeEventDates({...before,start:'2028-01-08 10:00:00',end:'2028-01-09 12:00:00'},before);
 const $=load('<div class="tribe-events-meta-group-details"><ul class="tribe-events-meta-list"><li class="tribe-events-meta-item"><span class="tribe-events-start-datetime-label">Start:</span><span class="tribe-events-meta-value"><abbr class="tribe-events-start-datetime" title="2027-11-07">November 7, 2027 @ 1:30 am</abbr><span class="custom-note">Local venue time</span></span></li><li class="tribe-events-meta-item"><span class="tribe-events-end-datetime-label">End:</span><span class="tribe-events-meta-value"><abbr class="tribe-events-end-datetime" title="2027-11-08">November 8, 2027 @ 2:30 am</abbr></span></li></ul></div>');
 assert.deepEqual(renderEventDates($,after,before),[]);assert.equal($('.tribe-events-start-datetime').text(),'January 8, 2028 @ 10:00 am');assert.equal($('.tribe-events-end-datetime').text(),'January 9, 2028 @ 12:00 pm');assert.equal($('.tribe-events-start-datetime').attr('title'),'2028-01-08');assert.equal($('.tribe-events-end-datetime').attr('title'),'2028-01-09');assert.equal($('.custom-note').text(),'Local venue time');assert.equal($('li').length,2);
 const unsupported=load('<abbr class="tribe-events-start-datetime">custom source phrase</abbr>');assert.ok(renderEventDates(unsupported,after,before).some(x=>x.includes('Unsupported')));assert.equal(unsupported('abbr').text(),'custom source phrase');
});
test('nested source timezone labels survive time edits and follow daylight saving changes',()=>{
 const before={start:'2028-01-08 10:00:00',end:'2028-01-08 12:00:00',utc_start:'2028-01-08 18:00:00',utc_end:'2028-01-08 20:00:00',timezone:'America/Los_Angeles',all_day:false};
 const after=normalizeEventDates({...before,start:'2028-07-08 10:00:00',end:'2028-07-08 13:00:00'},before);
 const $=load('<div class="tribe-events-start-time published dtstart">10:00 am - 12:00 pm <span class="tribe-events-abbr tribe-events-time-zone published">PST</span></div>');
 assert.deepEqual(renderEventDates($,after,before),[]);assert.equal($('.tribe-events-start-time').text(),'10:00 am - 1:00 pm PDT');assert.equal($('.tribe-events-time-zone').length,1);assert.ok($('.tribe-events-time-zone').hasClass('published'));
 const unknown=load('<span class="tribe-events-time-zone">Venue standard time</span>');assert.ok(renderEventDates(unknown,after,before).some(x=>x.includes('Unsupported event timezone')));assert.equal(unknown('span').text(),'Venue standard time');
 const unchanged=load('<span class="tribe-events-time-zone">PST</span>');assert.deepEqual(renderEventDates(unchanged,before,before),[]);assert.equal(unchanged('span').text(),'PST');
});
test('source time ranges retain dash and spacing conventions after edits',()=>{
 const before={...original,start:'2027-11-07 10:00:00',end:'2027-11-07 11:00:00'},after={...before,start:'2028-07-18 10:00:00',end:'2028-07-18 13:00:00'};
 for(const separator of [' – ','—',' - ']){const $=load('<div class="tribe-events-start-time">10:00 am'+separator+'11:00 am</div>');assert.deepEqual(renderEventDates($,after,before),[]);assert.equal($('.tribe-events-start-time').text(),'10:00 am'+separator+'1:00 pm');}
});
