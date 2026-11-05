#!/usr/bin/env python3
"""Pinned, loopback-only plugin fixtures; separate from saved user migrations."""
import argparse, hashlib, json, os, pathlib, subprocess, urllib.request, zipfile, importlib.util, re, socket
HERE=pathlib.Path(__file__).resolve().parent
PRESETS={
 'ultimate':{'wordpress':'7.1.3','plugin':'header-footer-elementor','version':'2.9.5','extra_plugins':{'elementor':'4.3.5'},'port':9437,'title':'Navigation Workshop','runtime':'work/uae'},
 'smartslider':{'wordpress':'7.1.3','plugin':'smart-slider-3','version':'3.5.1.39','port':9436,'title':'Slider Workshop','runtime':'work/smartslider'},
 'cookieyes':{'wordpress':'7.1.3','plugin':'cookie-law-info','version':'3.5.7','port':9435,'title':'Consent Workshop','runtime':'work/cookieyes'},
 'complianz':{'wordpress':'7.1.3','plugin':'complianz-gdpr','version':'7.5.6','port':9434,'title':'Privacy Workshop','runtime':'work/complianz'},
 'litespeed':{'wordpress':'7.1.3','plugin':'litespeed-cache','version':'7.9.2','port':9433,'title':'Optimized Workshop','runtime':'work/lscache'},
 'redirects':{'wordpress':'7.1.3','plugin':'redirection','version':'5.10.1','port':9432,'title':'Redirect Studio','runtime':'work/redir'},
 'addons':{'wordpress':'7.1.3','plugin':'essential-addons-for-elementor-lite','version':'6.8.7','extra_plugins':{'elementor':'4.3.5'},'port':9431,'title':'Creative Workshop','runtime':'work/ea'},
 'spectra':{'wordpress':'7.1.3','plugin':'ultimate-addons-for-gutenberg','version':'2.20.5','port':9430,'title':'Block Studio','runtime':'work/spectra'},
 'optimizer':{'wordpress':'7.1.3','plugin':'autoptimize','version':'3.1.16','port':9429,'title':'Optimized Studio','runtime':'work/opt'},
 'content':{'wordpress':'7.1.3','plugin':'advanced-custom-fields','version':'6.8.10','plugin_url':'https://github.com/AdvancedCustomFields/acf/releases/download/6.8.10/advanced-custom-fields-6.8.10.zip','extra_plugins':{'custom-post-type-ui':'1.19.3'},'port':9428,'title':'Design Collection','runtime':'work/content'},
 'commerce':{'wordpress':'7.1.3','plugin':'woocommerce','version':'11.2.1','port':9427,'title':'Workshop Store','runtime':'work/woo'},
 'widgets':{'wordpress':'7.1.3','plugin':'elementor','version':'4.3.5','port':9426,'title':'Component Studio','runtime':'work/el'},
 'aioseo':{'wordpress':'7.1.3','plugin':'all-in-one-seo-pack','version':'5.0.3','port':9425,'title':'Community Journal','runtime':'work/aio'},
 'rankmath':{'wordpress':'7.1.3','plugin':'seo-by-rank-math','version':'1.0.280','port':9424,'title':'Community Journal','runtime':'work/rm'},
 'yoast':{'wordpress':'7.1.3','plugin':'wordpress-seo','version':'28.7','port':9423,'title':'Community Journal','runtime':'work/seo'},
 'wpforms':{'wordpress':'7.1.3','plugin':'wpforms-lite','version':'2.0.3','port':9422,'title':'Community Requests','runtime':'work/wpf'},
 'events':{'wordpress':'6.9','plugin':'the-events-calendar','version':'6.18.2','port':9420,'title':'Community Calendar','runtime':'work/platform-fixtures'},
 'forms':{'wordpress':'7.1.3','plugin':'contact-form-7','version':'6.2.3','port':9421,'title':'Community Forms','runtime':'work/cf7'},
}
def extract(archive,dest,prefix=None):
 with zipfile.ZipFile(archive) as z:
  for member in z.infolist():
   rel=pathlib.PurePosixPath(member.filename)
   if rel.is_absolute() or '..' in rel.parts: raise ValueError('Unsafe archive path')
   if prefix: rel=rel.relative_to(prefix)
   if not rel.parts: continue
   target=dest/rel
   if member.is_dir():target.mkdir(parents=True,exist_ok=True)
   else:target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(z.read(member))
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--kind',choices=PRESETS,default='events');parser.add_argument('--runtime');parser.add_argument('--port',type=int);parser.add_argument('--theme',choices=['twentytwentyone','twentytwentythree','twentytwentyfour','twentytwentyfive'],default='twentytwentyone');a=parser.parse_args();preset=dict(PRESETS[a.kind]);
 if a.port is not None:
  if not a.runtime or not 1024<=a.port<=65535:raise ValueError('Alternate fixture ports require a separate runtime and port1024..65535')
  preset['port']=a.port
 root=pathlib.Path(a.runtime or preset['runtime']).resolve();cache=root/'cache';cache.mkdir(parents=True,exist_ok=True)
 manifest=root/'manifest.json'
 if manifest.exists() and any(entry.get('id')!=a.kind for entry in json.loads(manifest.read_text())):raise ValueError('Use a separate runtime directory for each installed-plugin fixture.')
 ready=root/(a.kind+'-ready.json')
 if ready.exists():
  existing=json.loads(ready.read_text())
  if existing['port']!=preset['port'] or existing.get('themeSlug','twentytwentyone')!=a.theme:raise ValueError('Existing fixture configuration differs; use a separate runtime')
  print(ready.read_text());return
 with socket.socket() as probe:probe.bind(('127.0.0.1',preset['port']))
 PACKAGES={'wordpress.zip':'https://wordpress.org/wordpress-'+preset['wordpress']+'.zip','classic.zip':'https://downloads.wordpress.org/theme/twentytwentyone.2.6.zip',a.kind+'.zip':preset.get('plugin_url','https://downloads.wordpress.org/plugin/'+preset['plugin']+'.'+preset['version']+'.zip')}
 for slug,version in preset.get('extra_plugins',{}).items():PACKAGES[slug+'.zip']='https://downloads.wordpress.org/plugin/'+slug+'.'+version+'.zip'
 for name,url in PACKAGES.items():
  target=cache/name
  if not target.exists():
   temp=target.with_suffix('.download');urllib.request.urlretrieve(url,temp);temp.rename(target)
 receipts={name:{'url':url,'sha256':hashlib.sha256((cache/name).read_bytes()).hexdigest()} for name,url in PACKAGES.items()}
 (root/'downloads.json').write_text(json.dumps(receipts,indent=2))
 site=root/'wordpress'
 extract(cache/'wordpress.zip',site,'wordpress');extract(cache/'classic.zip',site/'wp-content/themes');extract(cache/(a.kind+'.zip'),site/'wp-content/plugins')
 for slug in preset.get('extra_plugins',{}):extract(cache/(slug+'.zip'),site/'wp-content/plugins')
 (site/'wp-content/db.php').unlink(missing_ok=True)
 (site/'wp-config.php').write_text("""<?php
 define('DB_NAME','fixture');define('DB_USER','root');define('DB_PASSWORD','');define('DB_HOST',getenv('FIXTURE_DB_HOST'));define('DB_CHARSET','utf8');define('DB_COLLATE','');
 define('FQDBDIR',getenv('FIXTURE_DB_DIR').'/');define('WP_DEBUG',false);define('DISABLE_WP_CRON',true);define('AUTOMATIC_UPDATER_DISABLED',true);define('WP_AUTO_UPDATE_CORE',false);define('DISALLOW_FILE_MODS',true);
 $table_prefix='wp_';if(!defined('ABSPATH'))define('ABSPATH',__DIR__.'/');require_once ABSPATH.'wp-settings.php';
""")
 config=site/'wp-config.php';config.write_text(config.read_text().replace('<?php',"<?php\n define('NONCE_SALT','"+os.urandom(32).hex()+"');",1))
 mu=site/'wp-content/mu-plugins';mu.mkdir(exist_ok=True)
 (mu/'fixture-network.php').write_text("<?php add_filter('pre_http_request',function(){return new WP_Error('fixture_no_outbound','Fixture external requests are disabled.');}); add_filter('pre_wp_mail', '__return_false');")
 db=root/'databases'/a.kind;db.mkdir(parents=True,exist_ok=True);env=os.environ.copy();env.update(FIXTURE_DB_DIR=str(db),FIXTURE_DB_HOST='localhost:'+str(root/'mysql.sock'),FIXTURE_KIND=a.kind,FIXTURE_TITLE=preset['title'],FIXTURE_URL='http://127.0.0.1:'+str(preset['port']),FIXTURE_THEME=a.theme)
 steps=[['php','-d','error_reporting=22527',str(HERE/'seed.php'),str(site)],['php','-d','error_reporting=22527',str(HERE/('seed-'+a.kind+'.php')),str(site),'activate'],['php','-d','error_reporting=22527',str(HERE/('seed-'+a.kind+'.php')),str(site),'seed']]
 spec=importlib.util.spec_from_file_location('platform_database',HERE/'platform-database.py');database=importlib.util.module_from_spec(spec);spec.loader.exec_module(database);server=database.start(root)
 try:
  for index,command in enumerate(steps):
   result=subprocess.run(command,env=env,text=True,capture_output=True);(root/f'{a.kind}-step-{index}.log').write_text(result.stdout+result.stderr)
   if result.returncode:raise RuntimeError(f'Fixture step {index} failed; inspect local setup log')
 finally:
  server.terminate();server.wait(timeout=20)
 theme_css=(site/'wp-content/themes'/a.theme/'style.css').read_text()
 theme_name=re.search(r'(?mi)^Theme Name:\s*(.+)$',theme_css).group(1).strip();theme_version=re.search(r'(?mi)^Version:\s*(.+)$',theme_css).group(1).strip()
 record={'id':a.kind,'url':'http://127.0.0.1:'+str(preset['port']),'port':preset['port'],'wordpress':preset['wordpress'],'plugins':{preset['plugin']:preset['version'],**preset.get('extra_plugins',{})},'database':'MariaDB isolated Unix socket','theme':theme_name+' '+theme_version,'themeSlug':a.theme,'authorized':True,'outbound_http':False,'outbound_mail':False}
 ready.write_text(json.dumps(record,indent=2));(root/'manifest.json').write_text(json.dumps([record],indent=2));print(json.dumps(record))
if __name__=='__main__':main()
