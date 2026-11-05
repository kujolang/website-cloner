import {createHash} from 'node:crypto';

// Compare one record at a time without retaining a second copy of every
// page's presentation bindings in the project-wide manifest.
export function metadataFingerprint(metadata){
 const json=JSON.stringify(metadata,(_,value)=>value&&typeof value==='object'&&!Array.isArray(value)
  ?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)))
  :value);
 return createHash('sha256').update(json).digest('hex');
}
