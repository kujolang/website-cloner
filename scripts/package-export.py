"""Deterministic source+frontend archive; exclude caches, secrets and generated evidence."""
import pathlib,tarfile,sys,hashlib
out=pathlib.Path(sys.argv[1]); allowed=['content','templates','assets','static','scripts','abilities','kennel_packages','tools','output']
files=[]
for name in allowed:
 p=pathlib.Path(name)
 if p.exists():files.extend(p.rglob('*'))
files.extend(p for p in pathlib.Path('.').iterdir() if p.is_file() and (p.suffix in ['.json','.yml','.yaml','.md','.kujo','.toml','.lock'] or 'LICENSE' in p.name or p.name=='EXPORT-DEPENDENCIES.txt') and not p.name.startswith('.') and p.name not in ['site-model.json','agent-trace.json','migration-report.json','validation-report.json'])
with out.open('xb') as target:
 with tarfile.open(fileobj=target,mode='w') as tar:
  for p in sorted(set(files)):
   if p.is_symlink():raise ValueError('Refusing symlink '+str(p))
   if not p.is_file() or any(part in ['.git','node_modules','tmp','work','__pycache__'] for part in p.parts):continue
   info=tar.gettarinfo(str(p),arcname='website/'+str(p));info.mtime=0;info.uid=info.gid=0;info.uname=info.gname='';info.mode=0o644
   with p.open('rb') as source:tar.addfile(info,source)
digest=hashlib.sha256()
with out.open('rb') as source:
 for chunk in iter(lambda:source.read(1024*1024),b''):digest.update(chunk)
print(str(out),digest.hexdigest())
