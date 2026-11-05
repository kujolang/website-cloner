/* Website Return trusted motion runtime v2. No eval, network, source scripts or HTML injection. */
(() => {
  'use strict';
  let config;
  try { config = JSON.parse(document.querySelector('meta[name="migration-motion"]')?.content || '{}'); } catch { return; }
  if (config.schema !== 'migration-motion/v1') return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = n => Math.max(0, Math.min(1, n));
  const mix = (a, b, p) => a + (b - a) * p;
  const slice = (p, start, end) => clamp((p - start) / (end - start));
  let dispose = () => {};
  function setup() {
    dispose();
    const cleanups = [], ticks = [];
    let firstFrame = true;
    const remembered = new Map();
    const remember = el => { if (el && !remembered.has(el)) remembered.set(el, el.getAttribute('style')); return el; };
    const style = (el, values) => { if (el) Object.assign(remember(el).style, values); };
    const own = f => cleanups.push(f);
    dispose = () => {
      cleanups.reverse().forEach(f => f());
      for (const [el, original] of remembered) original === null ? el.removeAttribute('style') : el.setAttribute('style', original);
    };
    document.documentElement.dataset.migrationMotion = reduced.matches ? 'reduced' : 'active';
    if (reduced.matches) return;
    const frames = {
      fadeIn: { opacity: [0, 1] }, fadeInUp: { opacity: [0, 1], transform: ['translateY(100%)', 'none'] },
      fadeInDown: { opacity: [0, 1], transform: ['translateY(-100%)', 'none'] },
      fadeInLeft: { opacity: [0, 1], transform: ['translateX(-100%)', 'none'] },
      fadeInRight: { opacity: [0, 1], transform: ['translateX(100%)', 'none'] },
      zoomIn: { opacity: [0, 1], transform: ['scale(.3)', 'none'] },
    };
    // Observe without hiding the baseline: JS failures and no-JS exports remain readable.
    for (const item of config.entrances || []) {
      if (!/^reveal-\d+$/.test(item.id) || !frames[item.preset]) continue;
      const el = document.querySelector(`[data-migration-reveal="${item.id}"]`);
      if (!el) continue;
      const observer = new IntersectionObserver(entries => {
        if (!entries.some(e => e.isIntersecting)) return;
        const animation = el.animate(frames[item.preset], { duration: Math.max(0, Math.min(3000, item.duration || 1000)), delay: Math.max(0, Math.min(5000, item.delay || 0)), easing: 'ease-out', fill: 'backwards' });
        own(() => animation.cancel());
        observer.disconnect();
      });
      observer.observe(el); own(() => observer.disconnect());
    }
    // Pinning has a normal-flow spacer and is completely removed on resize/reduced motion.
    function pin(el, distance, top = 0) {
      const rect = el.getBoundingClientRect();
      const wrapper = document.createElement('div');
      wrapper.dataset.migrationPin = '';
      Object.assign(wrapper.style, { position: 'relative', height: `${rect.height + distance}px`, width: '100%' });
      el.before(wrapper); wrapper.appendChild(el);
      // Imported clipping containers can become a sticky scroll ancestor even though
      // the document is the actual scroller. Translate within the spacer in that case.
      let clipped = false;
      for (let ancestor = wrapper.parentElement; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
        const css = getComputedStyle(ancestor);
        if (/(hidden|auto|scroll)/.test(css.overflowX + ' ' + css.overflowY)) clipped = true;
      }
      wrapper.dataset.migrationPinTop = String(top);
      style(el, { position: clipped ? 'relative' : 'sticky', top: clipped ? '0px' : `${top}px`, margin: '0', width: '100%' });
      own(() => { wrapper.before(el); wrapper.remove(); });
      return () => {
        const progress = clamp((top - wrapper.getBoundingClientRect().top) / distance);
        if (clipped) el.style.translate = `0 ${progress * distance}px`;
        wrapper.dataset.migrationProgress = String(progress);
        return progress;
      };
    }
    const adapters = new Set((config.adapters || []).map(a => a.name));
    if (adapters.has('elementor-hero-v1') && innerWidth >= 1024) {
      const shell = document.querySelector('.hero-shell'), scroll = document.querySelector('.hero-scroll');
      const media = document.querySelector('.hero-primary-media'), content = document.querySelector('.hero-primary-content');
      const secondary = document.querySelector('.hero-secondary'), center = document.querySelector('.hero-secondary-center');
      const target = document.querySelector('.video-target');
      if (shell && scroll && media && content && secondary && target) {
        const m = media.getBoundingClientRect(), t = target.getBoundingClientRect();
        if (m.width > 1 && m.height > 1 && t.width > 1 && t.height > 1) {
          const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
          const dx = t.left - m.left, dy = t.top - m.top + 2 * rem, sx = t.width / m.width, sy = t.height / m.height;
          const progress = pin(shell, Math.max(0, scroll.offsetHeight - innerHeight) + innerHeight * 1.5);
          style(shell, { isolation: 'isolate' });
          style(content, { zIndex: '3', position: getComputedStyle(content).position === 'static' ? 'relative' : getComputedStyle(content).position });
          style(media, { zIndex: '2', transformOrigin: '0 0', overflow: 'hidden', position: getComputedStyle(media).position === 'static' ? 'relative' : getComputedStyle(media).position });
          style(secondary, { zIndex: '1', visibility: 'visible' });
          style(target, { opacity: '0', visibility: 'hidden' });
          const images = [...secondary.querySelectorAll('img.hp-img-hero-secondary:not(.video-target)')];
          const overlay = document.createElement('img');
          overlay.alt = ''; overlay.src = target.currentSrc || target.src;
          Object.assign(overlay.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none', zIndex: '2' });
          media.appendChild(overlay); own(() => overlay.remove());
          ticks.push(() => {
            const p = progress(), time = p * 1.1, move = slice(time, .08, .78);
            style(content, { opacity: String(1 - slice(time, 0, .33)), pointerEvents: p > .3 ? 'none' : '' });
            style(media, { transform: `translate(${dx * move}px,${dy * move}px) scale(${mix(1, sx, move)},${mix(1, sy, move)})`, padding: `${.75 * (1 - move)}rem` });
            style(secondary, { opacity: String(slice(time, .18, .38)), pointerEvents: p < .3 ? 'none' : '' });
            const enter = 1 - Math.pow(1 - slice(time, .35, .70), 3);
            images.forEach(el => style(el, { opacity: String(enter), transform: `scale(${mix(.85, 1, enter)})` }));
            const rise = 1 - Math.pow(1 - slice(time, .35, 1.1), 4);
            style(center, { opacity: String(rise), visibility: 'visible', transform: `translateY(${120 * (1 - rise)}px)` });
            overlay.style.opacity = String(slice(p, .90, .97));
          });
        }
      }
    }
    if (adapters.has('horizontal-cards-v1') && innerWidth >= 1025) {
      const section = document.querySelector('#scrollPinArea'), cards = section?.querySelector('.scrollCards');
      if (cards) {
        const css = getComputedStyle(section);
        const distance = Math.max(0, cards.scrollWidth - section.clientWidth + parseFloat(css.paddingLeft || 0) + parseFloat(css.paddingRight || 0));
        if (distance > 0) {
          const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
          const progress = pin(section, distance, Math.max((innerHeight - cards.offsetHeight) / 2 + 15, rem * 3));
          let current = progress();
          style(cards, { willChange: 'transform' });
          ticks.push(dt => {
            const target = progress(); // Pinning tracks physical scroll immediately.
            // Exponential damping is independent of frame rate and stops when settled.
            current = firstFrame ? target : current + (target - current) * (1 - Math.exp(-dt / 180));
            if (Math.abs(target - current) * distance < .1) current = target;
            style(cards, { transform: `translate3d(${-distance * current}px,0,0)` });
            cards.dataset.migrationMotionPending = current === target ? 'false' : 'true';
            return current !== target;
          });
          own(() => delete cards.dataset.migrationMotionPending);
        }
      }
    }
    let frame = 0, previousTime = 0;
    const render = time => {
      frame = 0;
      const dt = previousTime ? Math.min(64, time - previousTime) : 16.67;
      previousTime = time;
      let pending = false;
      for (const tick of ticks) pending = tick(dt) === true || pending;
      firstFrame = false;
      if (pending) frame = requestAnimationFrame(render);
      else previousTime = 0;
    };
    const update = () => { if (!frame) frame = requestAnimationFrame(render); };
    addEventListener('scroll', update, { passive: true });
    own(() => { removeEventListener('scroll', update); cancelAnimationFrame(frame); });
    update();
  }
  let timer;
  addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(setup, 150); });
  reduced.addEventListener('change', setup);
  // Geometry is measured after local fonts and images have settled.
  const boot = () => (document.fonts?.ready || Promise.resolve()).then(setup);
  if (document.readyState === 'complete') boot(); else addEventListener('load', boot, { once: true });
})();
