"""Import only committed, pinned MIT toolkit sources; never copy generated sites."""
import subprocess,pathlib,tarfile,io,json,os
root=pathlib.Path(__file__).resolve().parents[1]
ssg=pathlib.Path(os.environ.get('SSG_REPO', root.parent/'ssg'))
ability=pathlib.Path(os.environ.get('ABILITY_REPO', root.parent/'ability'))
for repo,commit,target in [(ssg,'615bdb30abd3aba1b1fdc640e934931327c1e083',root/'vendor/ssg-toolkit'),(ability,'be093e62bc93e5ec01e99e7da16c5657507ac820',root/'vendor/ssg-toolkit/kennel_packages/ability')]:
 data=subprocess.check_output(['git','-C',str(repo),'archive',commit])
 target.mkdir(parents=True,exist_ok=True)
 with tarfile.open(fileobj=io.BytesIO(data)) as tar:
  for member in tar.getmembers():
   if member.name.startswith('/') or '..' in pathlib.PurePosixPath(member.name).parts or not (member.isfile() or member.isdir()):raise ValueError('Unsafe archive member')
  tar.extractall(target)
print('Pinned SSG toolkit and Ability dependency imported')
