import {statfs} from 'node:fs/promises';
// Keep room for atomic checkpoints and the OS, then estimate remaining copies
// from this migration's actual content/assets. No recursive filesystem scans.
export const diskReserveBytes=128_000_000;
export const startupFreeBytes=256_000_000;
export async function freeBytes(dir){const disk=await statfs(dir);return Number(disk.bavail)*Number(disk.bsize);}
export function diskRequirement(model,phase='build'){
 if(!model)return startupFreeBytes;
 const pages=model.pages||[];
 const content=pages.reduce((sum,p)=>sum+['sourceHTML','content','shell'].reduce((n,key)=>n+Buffer.byteLength(p[key]||''),0),0);
 const media=(model.media||[]).reduce((sum,m)=>sum+(Number.isFinite(m.bytes)&&m.bytes>0?m.bytes:0),0);
 // Crawl/downloads need checkpoint headroom; build/package need output and ZIP
 // copies too. Unknown future assets are monitored as they arrive, not guessed.
 const extra=phase==='collect'?content*2:content*3+media*(phase==='package'?2:3)+pages.length*64_000;
 return Math.ceil(diskReserveBytes+Math.max(64_000_000,extra));
}
export function diskSpaceLabel(bytes){return bytes>=1e9?`${(bytes/1e9).toFixed(1)} GB`:`${Math.ceil(bytes/1e6)} MB`;}
export async function checkDiskSpace(dir,{model,phase='build',disk=freeBytes}={}){
 const requiredFreeBytes=diskRequirement(model,phase),availableBytes=await disk(dir);
 if(availableBytes<requiredFreeBytes)throw Object.assign(Error(`Migration needs about ${diskSpaceLabel(requiredFreeBytes)} free for ${phase}; ${diskSpaceLabel(availableBytes)} available. Saved work will resume when space is available.`),{code:'DISK_SPACE',requiredFreeBytes,availableBytes});
 return {requiredFreeBytes,availableBytes,phase};
}
