import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,symlink,rm,access} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createBuildStore} from '../app/build-store.mjs';
test('saved builds list compact metadata and delete only selected inactive builds',async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'build-store-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const a='a'.repeat(48),b='b'.repeat(48),c='c'.repeat(48);let active=b;
 for(const id of [a,b]){await mkdir(path.join(root,id,'project/output'),{recursive:true});await writeFile(path.join(root,id,'project/output/index.html'),'preview');await writeFile(path.join(root,id,'website.zip'),'zip');await writeFile(path.join(root,id,'job.json'),JSON.stringify({id,url:'https://example.com',status:'complete',summary:{status:'failed-quality-checks',large:'excluded'}}));}
 await mkdir(path.join(root,c));await writeFile(path.join(root,c,'job.json'),'broken json');
 const store=createBuildStore(root,{protectedBuild:id=>active===id});
 const result=await store.list();assert.equal(result.builds.length,3);assert.ok(result.freeBytes>0);
 const info=result.builds.find(j=>j.id===a);assert.equal(info.quality,'failed-quality-checks');assert.equal(info.hasPreview,true);assert.equal(info.hasDownload,true);assert.ok(info.sizeBytes>0);assert.equal(info.summary,undefined);
 assert.equal(result.builds.find(j=>j.id===b).canDelete,false);
 await assert.rejects(store.remove(b),{statusCode:409});await assert.rejects(store.remove('../outside'),{statusCode:400});
 await store.remove(a);await assert.rejects(access(path.join(root,a)));assert.equal(await readFile(path.join(root,b,'website.zip'),'utf8'),'zip');
 await store.remove(c);active=null;await store.remove(b);assert.equal((await store.list()).builds.length,0);
});
test('build deletion and accounting do not follow symlinks',async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'build-links-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const jobs=path.join(root,'jobs'),outside=path.join(root,'outside'),a='a'.repeat(48),b='b'.repeat(48);
 await mkdir(jobs);await mkdir(outside);await writeFile(path.join(outside,'keep'),'safe');
 await symlink(outside,path.join(jobs,a));const store=createBuildStore(jobs);
 await assert.rejects(store.remove(a),{statusCode:400});await rm(path.join(jobs,a));
 await mkdir(path.join(jobs,b));await symlink(outside,path.join(jobs,b,'assets'));await store.remove(b);
 assert.equal(await readFile(path.join(outside,'keep'),'utf8'),'safe');
});
