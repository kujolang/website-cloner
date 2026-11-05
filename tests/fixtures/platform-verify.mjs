import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';import path from 'node:path';
const root=path.resolve(process.argv[2]||'work/platform-fixtures');const manifest=JSON.parse(await readFile(path.join(root,'manifest.json')));const site=manifest.find(x=>x.id==='events');
assert.equal(new URL(site.url).hostname,'127.0.0.1');
assert.match(await readFile(path.join(root,'wordpress/wp-includes/version.php'),'utf8'),/\$wp_version = '6\.9'/);
assert.match(await readFile(path.join(root,'wordpress/wp-content/plugins/the-events-calendar/the-events-calendar.php'),'utf8'),/Version: 6\.18\.2/);
const response=await fetch(site.url+'/wp-json/tribe/events/v1/events?start_date=2027-01-01&end_date=2029-01-01&per_page=10');assert.equal(response.status,200);
const data=await response.json();assert.equal(data.events.length,2);const results=[];
for(const event of data.events){
 assert.equal(event.status,'publish');assert.equal(event.timezone,'America/New_York');assert.ok(event.utc_start_date);assert.ok(event.utc_end_date);assert.equal(event.venue.venue,'Community Hall');assert.ok(new Date(event.utc_end_date+'Z')>=new Date(event.utc_start_date+'Z'));
 const r=await fetch(event.url);assert.equal(r.status,200);const html=await r.text();assert.match(html,/single-tribe_events/);assert.match(html,/the-events-calendar/);assert.match(html,/Join our local community/);results.push({id:event.id,url:event.url,all_day:event.all_day,start:event.start_date,end:event.end_date,utc_start:event.utc_start_date,utc_end:event.utc_end_date,htmlBytes:Buffer.byteLength(html)});
}
assert.equal(results.filter(x=>x.all_day).length,1);
const report={fixture:site,verifiedAt:new Date().toISOString(),events:results,scope:'Installed source API and rendered page checks; migration fidelity is separate.'};await writeFile(path.join(root,'runtime-evidence.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
