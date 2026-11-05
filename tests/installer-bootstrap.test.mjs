import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,copyFile,rm} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
const run=promisify(execFile);
for(const corrupt of [false,true])test(`Node bootstrap ${corrupt?'rejects incorrect checksum':'installs verified private runtime without system Node'}`,{skip:!['darwin','linux'].includes(process.platform)},async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cloner-bootstrap-'));
 const bin=path.join(root,'bin'),source=path.join(root,'source'),base=path.join(root,'home');
 const name=`node-v22.23.4-${process.platform}-${process.arch}`;
 const archive=path.join(root,name+'.tar.gz');
 try{
  await mkdir(bin);await mkdir(path.join(source,'scripts'),{recursive:true});
  await copyFile(new URL('../install.sh',import.meta.url),path.join(source,'install.sh'));
  await writeFile(path.join(source,'scripts/install.mjs'),'// stub stage two');
  await mkdir(path.join(root,name,'bin'),{recursive:true});
  await writeFile(path.join(root,name,'bin/node'),'#!/bin/bash\nprintf "%s" "$1" > "$MARKER"\n',{mode:0o755});
  await writeFile(path.join(bin,'node'),'#!/bin/bash\nexit 1\n',{mode:0o755});
  await run('tar',['-czf',archive,'-C',root,name]);
  const hash=corrupt?'0'.repeat(64):createHash('sha256').update(await readFile(archive)).digest('hex');
  await writeFile(path.join(root,'SHASUMS256.txt'),`${hash}  ${name}.tar.gz\n`);
  await writeFile(path.join(bin,'curl'),'#!/bin/bash\nwhile [ "$#" -gt 0 ]; do case "$1" in https:*) url="$1";; -o) shift; out="$1";; esac; shift; done\ncase "$url" in *SHASUMS256.txt) cp "$FIXTURE/SHASUMS256.txt" "$out";; *) cp "$FIXTURE_ARCHIVE" "$out";; esac\n',{mode:0o755});
  const marker=path.join(root,'invoked');
  const command=()=>run('/bin/bash',[path.join(source,'install.sh')],{env:{...process.env,PATH:bin+':/usr/bin:/bin',CLONER_HOME:base,FIXTURE:root,FIXTURE_ARCHIVE:archive,MARKER:marker}});
  if(corrupt){await assert.rejects(command());await assert.rejects(readFile(marker),{code:'ENOENT'});}
  else{await command();assert.equal(await readFile(marker,'utf8'),path.join(source,'scripts/install.mjs'));}
 }finally{await rm(root,{recursive:true,force:true});}
});
