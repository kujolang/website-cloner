import test from 'node:test';
import assert from 'node:assert/strict';
import {wordpressCatalog} from '../engine/wordpress.mjs';
test('editor-only REST types do not become pages and one unsupported endpoint cannot discard later public types', async () => {
  const calls=[], model={warnings:[]};
  const types={
    wp_navigation:{rest_base:'navigation'},
    wp_font_face:{rest_base:'font-families/(?P<font_family_id>[\\d]+)/font-faces'},
    unsupported:{rest_base:'nested/unsupported'},
    book:{rest_base:'books',rest_namespace:'library/v1'},
  };
  const taxonomies={nav_menu:{rest_base:'menus',types:['nav_menu_item']},wp_pattern_category:{rest_base:'wp_pattern_category',types:['wp_block']},genre:{rest_base:'genres',types:['book']}};
  const network={async get(url){calls.push(url);const pathname=new URL(url).pathname;return{status:200,body:JSON.stringify(pathname.endsWith('/types')?types:pathname.endsWith('/taxonomies')?taxonomies:[]),headers:{}};}};
  const wp=await wordpressCatalog(model,network,'https://wp.example',async()=>{},()=>{});
  assert.deepEqual(wp.types.map(x=>x.slug),['page','post','book']);
  assert.deepEqual(wp.taxonomies.map(x=>x.slug),['genre','category','post_tag']);
  assert.equal(model.warnings.length,1);
  assert.match(model.warnings[0],/unsupported skipped/);
  assert.ok(calls.every(url=>!url.includes('/menus?')&&!url.includes('/wp_pattern_category?')));
});
