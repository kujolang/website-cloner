import path from 'node:path';
import { mkdir } from 'node:fs/promises';

// Behavior evidence is separate from script-disabled source pixel comparisons.
// These checks prove exported motion runs; they do not prove a live source timeline matches.
export async function verifyMotion(browser, model, origin, evidence) {
  const results = [];
  await mkdir(path.join(evidence, 'motion'), { recursive: true });
  for (const capture of model.captures || []) {
    const motion = model.pages.find(p => p.route === capture.route)?.motion;
    if (!motion || !(motion.adapters.length || motion.entrances.length)) continue;
    const context = await browser.newContext({ viewport: capture.viewport, serviceWorkers: 'block' });
    const page = await context.newPage(), errors = [], failures = [];
    page.setDefaultTimeout(10000);
    page.on('pageerror', error => errors.push(error.message));
    await context.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
    page.on('requestfailed', request => failures.push(request.url()));
    const result = { route: capture.route, viewport: capture.viewport.name, samples: [], errors, failures, equivalence: 'reconstructed-not-source-compared' };
    try {
      await page.goto(origin + capture.route, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForFunction(() => document.documentElement.dataset.migrationMotion === 'active');
      const expectedPins = motion.adapters.filter(a => a.name === 'elementor-hero-v1' ? capture.viewport.width >= 1024 : a.name === 'horizontal-cards-v1' && capture.viewport.width >= 1025).length;
      const pins = await page.locator('[data-migration-pin]').count();
      if (pins !== expectedPins) errors.push(`Expected ${expectedPins} pinned sequences; found ${pins}`);
      for (let index = 0; index < pins; index++) {
        for (const progress of [0, .5, 1]) {
          await page.evaluate(({ index, progress }) => {
            const wrapper = document.querySelectorAll('[data-migration-pin]')[index];
            const child = wrapper.firstElementChild;
            const distance = wrapper.offsetHeight - child.offsetHeight;
            scrollTo({ top: scrollY + wrapper.getBoundingClientRect().top - Number(wrapper.dataset.migrationPinTop) + distance * progress, behavior: 'instant' });
          }, { index, progress });
          await page.waitForFunction(({ index, progress }) => Math.abs(Number(document.querySelectorAll('[data-migration-pin]')[index].dataset.migrationProgress) - progress) < .01, { index, progress });
          await page.waitForFunction(() => !document.querySelector('[data-migration-motion-pending="true"]'));
          await page.evaluate(async () => {
            await Promise.race([Promise.all([...document.images].filter(el => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }).map(el => el.decode().catch(() => {}))), new Promise(resolve => setTimeout(resolve, 3000))]);
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          });
          const state = await page.evaluate(index => ({
            pinTop: document.querySelectorAll('[data-migration-pin]')[index].firstElementChild.getBoundingClientRect().top,
            expectedPinTop: Number(document.querySelectorAll('[data-migration-pin]')[index].dataset.migrationPinTop),
            scrollY,
            heroTransform: document.querySelector('.hero-primary-media')?.style.transform,
            cardsTransform: document.querySelector('.scrollCards')?.style.transform,
            missingVisibleImages: [...document.images].filter(el => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.width > 0 && el.getAttribute('src') && (!el.complete || !el.naturalWidth); }).length,
          }), index);
          if (Math.abs(state.pinTop - state.expectedPinTop) > 3) errors.push(`Sequence ${index} did not stay pinned at progress ${progress}`);
          const file = `${capture.file.replace(/\.png$/, '')}-sequence-${index}-${progress}.png`;
          await page.screenshot({ path: path.join(evidence, 'motion', file) });
          result.samples.push({ sequence: index, progress, ...state, file });
          if (state.missingVisibleImages) errors.push(`Missing visible images at sequence ${index}, progress ${progress}`);
        }
      }
      for (let index = 0; index < pins; index++) {
        const values = result.samples.filter(s => s.sequence === index).map(s => JSON.stringify([s.heroTransform, s.cardsTransform]));
        if (new Set(values).size < 2) errors.push(`Sequence ${index} did not change with scroll`);
      }
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForFunction(() => document.documentElement.dataset.migrationMotion === 'reduced');
      result.reducedMotionRestored = (await page.locator('[data-migration-pin]').count()) === 0;
      if (!result.reducedMotionRestored) errors.push('Reduced motion left pinned content');
      result.status = errors.length || failures.length ? 'failed' : 'passed';
    } catch (error) { errors.push(error.message); result.status = 'failed'; }
    finally { await context.close(); }
    results.push(result);
  }
  return results;
}
