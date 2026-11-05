import test from 'node:test';
import assert from 'node:assert/strict';
import {platformTargets,platformSupportReport,inspectPlatformPage} from '../engine/platform-support.mjs';

const page=html=>({route:'/example/',url:'https://example.org/example/',sourceHTML:html});
test('all 20 targets have unique public descriptors, without site domains',()=>{
 assert.equal(platformTargets.length,20);
 assert.equal(new Set(platformTargets.map(t=>t.id)).size,20);
 for(const target of platformTargets){assert.ok(target.capabilities.length);assert.ok(target.slugs.length);}
});
for(const target of platformTargets){
 test(`asset evidence detects ${target.name} without assuming functionality`,()=>{
  const report=platformSupportReport([page(`<script src="/wp-content/plugins/${target.slugs[0]}/public/app.js?ver=1"></script>`)]);
  const found=report.plugins.find(p=>p.id===target.id);
  assert.ok(found);assert.equal(found.status,'unverified');assert.deepEqual(found.routes,['/example/']);
 });
}
test('localized capture retains plugin markup evidence when source assets are renamed',()=>{
 const report=platformSupportReport([page('<div class="elementor" data-elementor-id="23"><div class="wpcf7"><form></form></div></div>')]);
 assert.deepEqual(report.plugins.map(p=>p.id),['elementor','contact-form-7']);
 assert.match(report.plugins[1].requiredConnection,/delivery/);
});
test('prose, anchor links and JavaScript strings do not identify installed plugins',()=>{
 const p=page('<p>Elementor WooCommerce Yoast SEO</p><a href="/wp-content/plugins/woocommerce/test">Example</a><script>const sample="class=wpforms-container";</script>');
 assert.deepEqual(inspectPlatformPage(p).detected,[]);
});
test('plugin slug matching requires directory boundaries',()=>{
 assert.equal(inspectPlatformPage(page('<script src="/wp-content/plugins/woocommerce-fake/app.js"></script>')).detected.length,0);
});
test('recognizes stripped SEO generator comments and optimized asset cache paths',()=>{
 const p=page('<!-- This site is optimized with the Yoast SEO plugin v1 --><link href="/wp-content/cache/autoptimize/css/hash.css">');
 assert.deepEqual(inspectPlatformPage(p).detected.map(x=>x.id),['yoast','autoptimize']);
});
test('fallback uses extracted fragments and never invents private fields or redirect rules',()=>{
 const report=platformSupportReport([{route:'/',content:'<div class="tribe-events">Events</div>'}]);
 assert.deepEqual(report.plugins.map(p=>p.id),['events-calendar']);
 assert.match(report.detectionPolicy,/does not mean absent/);
 assert.equal(report.plugins[0].status,'unverified');
});
test('reports aggregate routes without retaining captured scripts, form values or raw HTML',()=>{
 const report=platformSupportReport([page('<div class="wpcf7"><input value="private-value"></div>'),{...page('<div class="wpcf7"></div>'),route:'/contact/'}]);
 assert.deepEqual(report.plugins[0].routes,['/example/','/contact/']);
 assert.ok(!JSON.stringify(report).includes('private-value'));
});
