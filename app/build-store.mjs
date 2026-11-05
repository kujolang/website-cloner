import {timingSnapshot} from './timing.mjs';
import path from 'node:path';
import {readdir, readFile, lstat, rm, statfs} from 'node:fs/promises';

export const validBuildId = id => /^[a-f0-9]{48}$/.test(id);
const fail = (message, statusCode) => Object.assign(new Error(message), {statusCode});
export function createBuildStore(root, {protectedBuild = () => false, current = () => null, previewOrigin = 'http://127.0.0.1:4311'} = {}) {
  const deleting = new Set(), sizes = new Map();
  async function directory(id) {
    if (!validBuildId(id)) throw fail('Invalid build ID', 400);
    const dir = path.join(root, id), info = await lstat(dir);
    if (!info.isDirectory() || info.isSymbolicLink()) throw fail('Invalid build directory', 400);
    return dir;
  }
  async function bytes(dir) {
    let total = 0;
    for (const entry of await readdir(dir, {withFileTypes:true})) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) total += await bytes(file);
      else { const info = await lstat(file); total += info.size; }
    }
    return total;
  }
  return {
    deleting,
    invalidate:id=>sizes.delete(id),
    async list() {
      const builds = [];
      for (const id of await readdir(root)) {
        if (!validBuildId(id) || deleting.has(id)) continue;
        try {
          const dir = await directory(id);
          let job;
          try {job = current(id) || JSON.parse(await readFile(path.join(dir, 'job.json'), 'utf8'));}
          catch {job = {status:'unavailable'};}
          const locked = protectedBuild(id);
          if (locked) sizes.delete(id);
          const sizeBytes = sizes.get(id) ?? await bytes(dir);
          if (!locked) sizes.set(id, sizeBytes);
          builds.push({id, url:job.url || 'Incomplete build', status:job.status,
            quality:job.summary?.status || null, timing:timingSnapshot(job.timing), createdAt:job.createdAt || null,
            sizeBytes, canDelete:!locked, preview: `${previewOrigin}/${id}/`,
            hasPreview:await lstat(path.join(dir, 'project/output/index.html')).then(s=>s.isFile()).catch(()=>false),
            hasDownload:job.status==='complete' && await lstat(path.join(dir, 'website.zip')).then(s=>s.isFile()).catch(()=>false)});
        } catch (error) {if(error.code!=='ENOENT' && error.statusCode!==400) throw error;}
      }
      const disk = await statfs(root);
      return {builds:builds.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')), freeBytes:disk.bavail*disk.bsize};
    },
    async remove(id) {
      if (!validBuildId(id)) throw fail('Invalid build ID',400);
      if (protectedBuild(id) || deleting.has(id)) throw fail('This build is active or queued. Wait until it finishes before deleting it.',409);
      deleting.add(id);
      try {const dir=await directory(id); await rm(dir,{recursive:true,force:false}); sizes.delete(id);}
      finally {deleting.delete(id);}
    },
  };
}
