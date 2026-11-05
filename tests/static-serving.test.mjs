import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,symlink,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {serveStatic,resolveStaticFile} from '../engine/static.mjs';
test('static serving preserves binary bytes and blocks paths and symbolic links outside root',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'static-boundary-')),root=path.join(dir,'public');let server;
 try {
  await mkdir(root);await writeFile(path.join(root,'index.html'),'home');await writeFile(path.join(dir,'private.txt'),'secret');
  const bytes=Buffer.alloc(2*1024*1024,73);await writeFile(path.join(root,'download.zip'),bytes);
  await symlink(path.join(dir,'private.txt'),path.join(root,'leak.txt'));
  await symlink(dir,path.join(root,'outside'));
  server=await serveStatic(root);
  const response=await fetch(server.url+'/download.zip');assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'application/zip');assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);
  assert.equal(await (await fetch(server.url+'/')).text(),'home');
  for(const route of ['/leak.txt','/outside/private.txt'])assert.equal((await fetch(server.url+route)).status,404);
  for(const route of ['/../private.txt','/%2e%2e/private.txt','/%00','/a\\b'])await assert.rejects(resolveStaticFile(root,route));
 } finally {await server?.close();await rm(dir,{recursive:true,force:true});}
});
