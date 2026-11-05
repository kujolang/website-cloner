#!/usr/bin/env python3
"""Install five disposable, genuine WordPress fixtures, without Docker/MySQL."""
import argparse, hashlib, json, pathlib, shutil, subprocess, urllib.request, zipfile
HERE=pathlib.Path(__file__).resolve().parent
SITES=[('gutenberg',9411,'Field Notes Studio','twentytwentyfive'),('classic',9412,'Oak & Ink','twentytwentyone'),('elementor',9413,'Northline Design','twentytwentyone'),('blog',9414,'Trail Journal','twentytwentyone'),('brochure',9415,'Harbor Workshop','twentytwentyfive')]
DOWNLOADS={'wordpress.zip':'https://wordpress.org/wordpress-6.8.3.zip','sqlite.zip':'https://downloads.wordpress.org/plugin/sqlite-database-integration.2.2.23.zip','elementor.zip':'https://downloads.wordpress.org/plugin/elementor.3.32.4.zip','classic.zip':'https://downloads.wordpress.org/theme/twentytwentyone.2.6.zip'}
def main():
 p=argparse.ArgumentParser(); p.add_argument('--runtime',default='work/fixtures'); p.add_argument('--site',choices=[site[0] for site in SITES],help='Install one fixture instead of the full suite'); args=p.parse_args(); root=pathlib.Path(args.runtime).resolve(); cache=root/'cache';cache.mkdir(parents=True,exist_ok=True)
 selected=[site for site in SITES if not args.site or site[0]==args.site]
 downloads={name:url for name,url in DOWNLOADS.items() if name in {'wordpress.zip','sqlite.zip'} or (name=='elementor.zip' and any(site[0]=='elementor' for site in selected)) or (name=='classic.zip' and any(site[3]=='twentytwentyone' for site in selected))}
 for name,url in downloads.items():
  if not (cache/name).exists(): urllib.request.urlretrieve(url,cache/name)
 manifest=[]
 for kind,port,title,theme in selected:
  site=root/'wordpress'
  if (root/f'{kind}-ready.json').exists():
   manifest.append(json.loads((root/f'{kind}-ready.json').read_text()));continue
  site.mkdir(parents=True,exist_ok=True)
  with zipfile.ZipFile(cache/'wordpress.zip') as z:
   for info in z.infolist():
    rel=pathlib.PurePosixPath(info.filename).relative_to('wordpress')
    if not rel.parts: continue
    target=site/rel
    if info.is_dir(): target.mkdir(parents=True,exist_ok=True)
    else: target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(z.read(info))
  for file,dest in [('sqlite.zip','wp-content/plugins')]+([('classic.zip','wp-content/themes')] if theme=='twentytwentyone' else [])+([('elementor.zip','wp-content/plugins')] if kind=='elementor' else []):
   with zipfile.ZipFile(cache/file) as z:z.extractall(site/dest)
  shutil.copy(site/'wp-content/plugins/sqlite-database-integration/db.copy',site/'wp-content/db.php')
  config="""<?php
 define('DB_NAME','fixture');define('DB_USER','fixture');define('DB_PASSWORD','');define('DB_HOST','localhost');define('DB_CHARSET','utf8');define('DB_COLLATE','');
 define('FQDBDIR',getenv('FIXTURE_DB_DIR').'/');define('WP_DEBUG',false);define('DISABLE_WP_CRON',true);define('AUTOMATIC_UPDATER_DISABLED',true);define('WP_AUTO_UPDATE_CORE',false);define('DISALLOW_FILE_MODS',true);
 $table_prefix='wp_';if(!defined('ABSPATH'))define('ABSPATH',__DIR__.'/');require_once ABSPATH.'wp-settings.php';
"""
  (site/'wp-config.php').write_text(config)
  env=__import__('os').environ.copy();(root/'databases'/kind).mkdir(parents=True,exist_ok=True)
  env.update(FIXTURE_DB_DIR=str(root/'databases'/kind),FIXTURE_KIND=kind,FIXTURE_TITLE=title,FIXTURE_URL=f'http://127.0.0.1:{port}',FIXTURE_THEME=theme)
  result=subprocess.run(['php','-d','error_reporting=22527',str(HERE/'seed.php'),str(site)],env=env,text=True,capture_output=True)
  (root/f'{kind}-setup.log').write_text(result.stdout+result.stderr)
  if result.returncode or f'Seeded {kind}' not in result.stdout: raise RuntimeError(f'{kind} failed; inspect {root}/{kind}-setup.log')
  record={'id':kind,'url':f'http://127.0.0.1:{port}','port':port,'title':title,'theme':theme,'wordpress':'6.8.3','database':'SQLite integration 2.2.23','elementor':'3.32.4' if kind=='elementor' else None,'expected_pages':4,'expected_posts':30 if kind=='blog' else 2,'authorized':True}
  (root/f'{kind}-ready.json').write_text(json.dumps(record,indent=2));manifest.append(record)
 (root/'manifest.json').write_text(json.dumps(manifest,indent=2))
 (root/'downloads.json').write_text(json.dumps({k:{'url':v,'sha256':hashlib.sha256((cache/k).read_bytes()).hexdigest()} for k,v in downloads.items()},indent=2))
 print(json.dumps(manifest,indent=2))
if __name__=='__main__':main()
