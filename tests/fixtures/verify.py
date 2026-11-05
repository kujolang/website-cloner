#!/usr/bin/env python3
"""Read-only assertions against actual running fixture REST/HTML endpoints."""
import json,pathlib,urllib.request
results=[]
for port in range(9411,9416):
 base=f'http://127.0.0.1:{port}'
 def get(path):return urllib.request.urlopen(base+path,timeout=30).read()
 pages=json.loads(get('/wp-json/wp/v2/pages?per_page=100'));posts=json.loads(get('/wp-json/wp/v2/posts?per_page=100'));html=get('/').decode()
 assert len(pages)==4,(base,len(pages));assert len(posts)==(30 if port==9414 else 2)
 assert 'WordPress 6.8.3' in html
 assert 'elementor-widget-heading' in html if port==9413 else True
 assert '<form' in get('/contact/').decode() if port==9415 else True
 for item in pages+posts:assert urllib.request.urlopen(item['link'],timeout=30).status==200,item['link']
 assert b'<sitemapindex' in get('/wp-sitemap.xml')
 results.append({'url':base,'pages':len(pages),'posts':len(posts),'elementor_rendered':'elementor-widget-heading' in html,'homepage_bytes':len(html),'generator_wordpress':True,'page_routes':[x['link'] for x in pages],'all_content_routes_status':200,'core_sitemap':True})
p=pathlib.Path(__file__).with_name('runtime-evidence.json');p.write_text(json.dumps(results,indent=2)+'\n');print(json.dumps(results,indent=2))
