#!/usr/bin/env python3
"""Keep five WordPress fixture servers alive; Ctrl-C stops all child processes."""
import argparse,json,os,pathlib,subprocess,time,importlib.util
p=argparse.ArgumentParser();p.add_argument('--runtime',default='work/fixtures');a=p.parse_args();root=pathlib.Path(a.runtime).resolve();processes=[];database=None
try:
 entries=json.loads((root/'manifest.json').read_text())
 if any('MariaDB' in entry.get('database','') for entry in entries):
  spec=importlib.util.spec_from_file_location('platform_database',pathlib.Path(__file__).with_name('platform-database.py'));module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);database=module.start(root)
 for entry in json.loads((root/'manifest.json').read_text()):
  env=os.environ.copy();env['FIXTURE_DB_DIR']=str(root/'databases'/entry['id']);env['FIXTURE_DB_HOST']='localhost:'+str(root/'mysql.sock')
  log=open(root/(entry['id']+'-server.log'),'a')
  processes.append(subprocess.Popen(['php','-d','error_reporting=22527','-S',f"127.0.0.1:{entry['port']}",'-t',str(root/'wordpress'),str(pathlib.Path(__file__).with_name('router.php'))],env=env,stdout=log,stderr=log))
  print(entry['url'],flush=True)
 while all(p.poll() is None for p in processes):time.sleep(1)
finally:
 for p in processes:p.terminate()

 if database:database.terminate();database.wait(timeout=20)
