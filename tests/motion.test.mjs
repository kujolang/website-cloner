import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { chromium } from 'playwright';
import { extract } from '../engine/extract.mjs';
import { runtimeSource, motionCSP } from '../engine/motion.mjs';
import { serveStatic } from '../engine/static.mjs';
import { prefixPreview } from '../app/preview.mjs';

test('motion extraction admits declarative presets, reports custom code, never exports scripts', () => {
  const p = extract(`<main><div class="elementor-invisible animated-fast" data-settings='{"_animation":"fadeInUp","_animation_delay":200}'>Visible</div><div class="elementor-invisible" data-settings='{"animation":"spinUnknown"}'>Also visible</div><script>gsap.timeline(); alert('untrusted')</script><div data-settings='{"motion_fx_translateY_effect":"yes"}'></div></main>`, 'https://example.org/');
  assert.deepEqual(p.motion.entrances, [{ id: 'reveal-0', preset: 'fadeInUp', duration: 750, delay: 200 }]);
  assert.equal(p.motion.unsupported.length, 3);
  assert.match(p.content, /data-migration-reveal="reveal-0"/);
  assert.doesNotMatch(p.content, /<script|elementor-invisible|alert/);
});

test('trusted runtime scrolls cards, reverses, restores reduced-motion/mobile and blocks injected JS', { timeout: 30000 }, async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'migration-motion-'));
  const config = { schema: 'migration-motion/v1', adapters: [{ name: 'horizontal-cards-v1' }], entrances: [{ id: 'reveal-0', preset: 'fadeIn', duration: 50, delay: 0 }] };
  const html = `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; ${motionCSP}"><meta name="migration-motion" content='${JSON.stringify(config)}'><style>body{margin:0}#scrollPinArea{width:100%;height:200px;overflow:hidden}.scrollCards{display:flex;width:2400px;height:200px;background:linear-gradient(90deg,red,blue)}.space{height:1000px}</style><div class="space"></div><div style="overflow:hidden"><section id="scrollPinArea"><div class="scrollCards"></div></section></div><p data-migration-reveal="reveal-0">Readable</p><div class="space"></div><script>window.sourceExecuted=true</script><script>${runtimeSource}</script>`;
  // Preview rewriting must not alter the trusted runtime bytes and invalidate the CSP hash.
  assert.ok(prefixPreview(html, 'a'.repeat(48)).includes(`<script>${runtimeSource}</script>`));
  await writeFile(path.join(dir, 'index.html'), html);
  const server = await serveStatic(dir);
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(server.url);
    await page.waitForSelector('[data-migration-pin]');
    assert.equal(await page.evaluate(() => window.sourceExecuted), undefined);
    await page.waitForTimeout(100);
    const positions = await page.evaluate(() => new Promise(resolve => {
      const values = []; scrollTo({top:1300,behavior:'instant'});
      function tick(){ values.push(new DOMMatrix(getComputedStyle(document.querySelector('.scrollCards')).transform).m41); if(values.length<30)requestAnimationFrame(tick);else resolve(values); }
      requestAnimationFrame(tick);
    }));
    assert.ok(new Set(positions.map(x=>Math.round(x))).size > 5, 'scroll input should produce intermediate positions, not one-frame snapping');
    await page.waitForFunction(() => new DOMMatrix(getComputedStyle(document.querySelector('.scrollCards')).transform).m41 < -100);
    assert.ok(await page.locator('#scrollPinArea').evaluate(e => Math.abs(e.getBoundingClientRect().top - 365) < 2));
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForFunction(() => new DOMMatrix(getComputedStyle(document.querySelector('.scrollCards')).transform).m41 === 0);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => !document.querySelector('[data-migration-pin]'));
    assert.equal(await page.locator('.scrollCards').evaluate(e => getComputedStyle(e).transform), 'none');
    assert.equal(await page.locator('[data-migration-reveal]').isVisible(), true);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForSelector('[data-migration-pin]');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => !document.querySelector('[data-migration-pin]'));
    const nojs = await browser.newContext({ javaScriptEnabled: false });
    const baseline = await nojs.newPage(); await baseline.goto(server.url);
    assert.equal(await baseline.locator('[data-migration-reveal]').isVisible(), true);
    await nojs.close();
  } finally { await browser.close(); await server.close(); await rm(dir, { recursive: true, force: true }); }
});

test('hero reconstruction preserves absolute media layout and reaches its scroll endpoint', { timeout: 30000 }, async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'migration-hero-'));
  const config = { schema: 'migration-motion/v1', adapters: [{ name: 'elementor-hero-v1' }], entrances: [] };
  const html = `<!doctype html><meta name="migration-motion" content='${JSON.stringify(config)}'><style>*{box-sizing:border-box}body{margin:0}.hero-shell{height:900px}.hero-scroll{height:900px}.hero-primary-media{position:absolute;top:0;left:0;width:100%;height:900px;background:pink}.hero-primary-content{position:absolute;top:100px}.hero-secondary{position:absolute;top:0;height:900px;width:100%}.video-target{position:absolute;top:600px;left:400px;width:200px;height:100px}.hero-secondary-center{margin-top:350px}.tail{height:1500px}</style><section class="hero-shell"><div class="hero-scroll"><div class="hero-primary-media"></div><h1 class="hero-primary-content">Original heading</h1><div class="hero-secondary"><h2 class="hero-secondary-center">Second heading</h2><img class="video-target" alt="" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"></div></div></section><div class="tail"></div><script>${runtimeSource}</script>`;
  await writeFile(path.join(dir, 'index.html'), html);
  const server = await serveStatic(dir), browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(server.url); await page.waitForSelector('[data-migration-pin]');
    assert.equal(await page.locator('.hero-primary-media').evaluate(el => getComputedStyle(el).position), 'absolute');
    assert.equal(await page.locator('.hero-primary-media').evaluate(el => el.offsetHeight), 900);
    await page.evaluate(() => scrollTo({ top: 1350, behavior: 'instant' }));
    await page.waitForFunction(() => document.querySelector('[data-migration-pin]').dataset.migrationProgress === '1');
    assert.equal(await page.locator('.hero-primary-content').evaluate(el => el.style.opacity), '0');
    assert.equal(await page.locator('.hero-secondary').evaluate(el => el.style.opacity), '1');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => !document.querySelector('[data-migration-pin]'));
    assert.equal(await page.locator('.hero-primary-media').evaluate(el => el.hasAttribute('style')), false);
  } finally { await browser.close(); await server.close(); await rm(dir, { recursive: true, force: true }); }
});
