import { navigationHash } from './navigation.mjs';
import { webmcpHash } from './webmcp.mjs';
import { searchHash } from './search.mjs';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

// Reviewed source fingerprints, not JavaScript execution or heuristic transpilation.
// Elementor homepage snapshot 2026-10-19; see docs/motion.md for provenance.
export const reviewedScripts = {
  b17a58ac09e2d57de20ed5dd79e1b38ff367be99792c951de36b2fd0d84deeb1: 'elementor-hero-v1',
  e2f77a2bf84c6248d124ddea7cb67ac43b5f92d1bc8ce099ebe9a072c6dfbc5d: 'horizontal-cards-v1',
};
const presets = new Set(['fadeIn', 'fadeInUp', 'fadeInDown', 'fadeInLeft', 'fadeInRight', 'zoomIn']);
export function detectMotion($) {
  const motion = { schema: 'migration-motion/v1', adapters: [], entrances: [], unsupported: [] };
  $('[data-migration-reveal]').removeAttr('data-migration-reveal');
  $('[data-settings]').each((i, e) => {
    let settings;
    try { settings = JSON.parse($(e).attr('data-settings')); } catch { return; }
    const name = settings._animation || settings.animation;
    const responsive = Object.keys(settings).some(k => /^(?:_?animation)_(?:mobile|tablet|laptop|widescreen)/.test(k));
    if (name && name !== 'none') {
      // Never leave content hidden when its original animation controller is removed.
      $(e).removeClass('elementor-invisible');
      if (presets.has(name) && !responsive) {
        const id = `reveal-${motion.entrances.length}`;
        $(e).attr('data-migration-reveal', id);
        const delay = Number(settings._animation_delay ?? settings.animation_delay ?? 0);
        motion.entrances.push({ id, preset: name, duration: $(e).hasClass('animated-slow') ? 2000 : $(e).hasClass('animated-fast') ? 750 : 1000, delay: Number.isFinite(delay) ? Math.max(0, Math.min(5000, delay)) : 0 });
      } else motion.unsupported.push(`Entrance animation ${String(name).slice(0, 80)}${responsive ? ' with responsive overrides' : ''}`);
    }
    if (Object.keys(settings).some(k => /motion_fx/.test(k) && settings[k] === 'yes'))
      motion.unsupported.push('Elementor scrolling/mouse motion effects require an adapter');
  });
  $('script').each((i, e) => {
    const script = $(e).text().replace(/\r\n/g, '\n').trim();
    const digest = createHash('sha256').update(script).digest('hex');
    const adapter = reviewedScripts[digest];
    if (adapter) motion.adapters.push({ name: adapter, sourceSHA256: digest });
    else if (/ScrollTrigger\.(?:create|batch)|gsap\.timeline|\blottie\.|bodymovin|elementorFrontend\.hooks/.test(script))
      motion.unsupported.push(`Custom animation script requires review (SHA256 ${digest})`);
    const src = $(e).attr('src') || '';
    if (/(?:lottie|bodymovin|scrollmagic|aos(?:\.min)?\.js)/i.test(src))
      motion.unsupported.push('External animation runtime detected; configuration not imported');
  });
  motion.unsupported = [...new Set(motion.unsupported)];
  return motion;
}
export const runtimeSource = await readFile(new URL('../vendor/migration-motion.js', import.meta.url), 'utf8');
export const runtimeHash = 'sha256-' + createHash('sha256').update(runtimeSource).digest('base64');
export const motionCSP = `script-src '${navigationHash}' '${runtimeHash}' '${searchHash}' '${webmcpHash}' 'sha256-cW1BRtZqxmOJ3rChrOJxs/LvcNS3noD8t/a6Eif6BMQ=';`; // Previously shipped v1 remains previewable.
