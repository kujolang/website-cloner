import test from 'node:test';
import assert from 'node:assert/strict';
import {prefixPreview} from '../app/preview.mjs';
test('preview prefixes responsive sources and video posters as well as normal links',()=>{
 const id='a'.repeat(48);const html=prefixPreview('<a href="/domains">Link</a><video poster="/assets/poster.webp"></video><img src="/assets/fallback.webp" srcset="/assets/small.webp 390w, /assets/large.webp 1440w"><a href="https://example.org/">External</a>',id);
 for(const path of ['/domains','/assets/poster.webp','/assets/fallback.webp','/assets/small.webp','/assets/large.webp'])assert.ok(html.includes('/'+id+path));
 assert.match(html,/href="https:\/\/example.org\/"/);assert.throws(()=>prefixPreview('', '../'));
});
test('preview adds monochrome scrollbars without modifying the source HTML',()=>{
 const source='<html><head><title>Site</title></head><body>Content</body></html>';
 const themed=prefixPreview(source,'b'.repeat(48));
 assert.match(themed,/<head><style data-cloner-preview-scrollbars>/);
 assert.match(themed,/scrollbar-color:#666 #eee!important/);
 assert.ok(!source.includes('data-cloner-preview-scrollbars'));
 assert.match(themed,/<title>Site<\/title>/);
});
