// Independent installed-plugin export: edit native records in a disposable copy.
import assert from 'node:assert/strict';
import {mkdtemp,cp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import path from 'node:path';import {createHash} from 'node:crypto';import {load} from 'cheerio';
import {parseContent,YAML} from '../../scripts/source-project.mjs';import {run} from '../../engine/pipeline.mjs';
const artifact=path.resolve('artifacts/platform/events-heldout'),source=path.join(artifact,'project'),dir=await mkdtemp(path.join(tmpdir(),'heldout-event-authoring-'));
const cases=[
 {slug:'coastal-design-lab',start:'2028-11-04 10:00:00',end:'2028-11-06 12:00:00',utc:'20281104T170000Z',utcEnd:'20281106T200000Z',selector:'.tribe-events-start-datetime',label:'November 4, 2028 @ 10:00 am'},
 {slug:'open-studio-day',start:'2028-09-19 00:00:00',end:'2028-09-19 23:59:59',utc:'20280919',utcEnd:'20280920',selector:'.tribe-events-start-date',label:'September 19, 2028'},
 {slug:'morning-gathering',start:'2028-07-18 10:00:00',end:'2028-07-18 11:00:00',utc:'20280718T090000Z',utcEnd:'20280718T100000Z',selector:'.tribe-events-start-date',label:'July 18, 2028'},
 {slug:'summer-residency',start:'2028-12-30 00:00:00',end:'2029-01-02 23:59:59',utc:'20281230',utcEnd:'20290103',selector:'.tribe-events-start-date',label:'December 30, 2028'}
];
try{
 await cp(source,dir,{recursive:true,filter:p=>!['output','.ssg-output','.ssg-content','.ssg-templates'].includes(path.basename(p))});
 await cp(new URL('../../vendor/export-source.mjs',import.meta.url),path.join(dir,'scripts/source.mjs'));
 const routes=JSON.parse(await readFile(path.join(dir,'routes.json'))),before=new Map();
 for(const c of cases){const route=routes.find(r=>r.route===`/event/${c.slug}/`);assert.ok(route);const relative=path.join('content',route.collection,route.slug+'.md'),raw=await readFile(path.join(source,relative),'utf8');before.set(relative,raw);const p=parseContent(raw,relative);p.meta.event.start=c.start;p.meta.event.end=c.end;p.meta.event.venue.address='42 Edited Harbor Road';assert.ok(p.body.includes('Explore materials and local creative work'));p.body=p.body.replace('Explore materials and local creative work','Updated native Markdown description');await writeFile(path.join(dir,relative),'---\n'+YAML.stringify(p.meta)+'---\n'+p.body);}
 await run(process.execPath,['scripts/build.mjs'],{cwd:dir,timeout:120000});
 const report=JSON.parse(await readFile(path.join(dir,'events-report.json'))),results=[];
 for(const c of cases){const route=`/event/${c.slug}/`,r=report.pages.find(r=>r.route===route);assert.ok(r);assert.deepEqual(r.presentationIssues,[],route);const html=await readFile(path.join(dir,'output',route,'index.html'),'utf8'),$=load(html);assert.equal($(c.selector).text().trim(),c.label,route);assert.match($('body').text(),/42 Edited Harbor Road/);assert.match($('body').text(),/Updated native Markdown description/);const ics=await readFile(path.join(dir,'output',r.calendar),'utf8');assert.ok(ics.includes('DTSTART'+(c.utc.includes('T')?':':';VALUE=DATE:')+c.utc),route);assert.ok(ics.includes('DTEND'+(c.utcEnd.includes('T')?':':';VALUE=DATE:')+c.utcEnd),route);results.push({route,markdownUpdated:true,calendarEnd:c.utcEnd,updatedStart:$(c.selector).text().trim(),calendarStart:c.utc,presentationIssues:r.presentationIssues});}
 for(const [file,raw]of before)assert.equal(await readFile(path.join(source,file),'utf8'),raw);
 const templates=JSON.parse(await readFile(path.join(source,'content-source-report.json')));assert.equal(templates.templateUsage['templates/content/single-tribe-events.html'],4);
 await writeFile(path.join(artifact,'heldout-authoring-check.json'),JSON.stringify({cases:results,sharedEventTemplates:1,sourceMutated:false,sourceRequests:0,aiCalls:0,runtimeSHA256:createHash('sha256').update(await readFile('vendor/export-source.mjs')).digest('hex')},null,2));console.log(JSON.stringify({cases:results.length,sourceMutated:false}));
}finally{await rm(dir,{recursive:true,force:true});}
