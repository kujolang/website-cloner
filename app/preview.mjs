import {motionCSP} from '../engine/motion.mjs';
import {componentScriptHashes} from '../scripts/component-export.mjs';
export const previewScriptCSP=motionCSP.replace(/;$/, ' '+componentScriptHashes.map(hash=>"'"+hash+"'").join(' ')+';');

// Exported pages use root-relative paths; the app hosts each preview under a job.
export function prefixPreview(html, id) {
  if (!/^[a-f0-9]{48}$/.test(id)) throw Error('Invalid preview ID');
  const prefix = `/${id}/`;
  const themed = html.replace(/<head\b[^>]*>/i, '$&' + previewScrollbarStyle);
  return themed.replace(/url\(\s*(&quot;|["']?)\/(?!\/)/gi, (_,quote)=>'url('+quote+prefix).replace(/\b(href|src|poster)="\/(?!\/)/g, `$1="${prefix}`)
    .replace(/srcset="([^"]*)"/g, (_, values) => 'srcset="' + values.split(',').map(value => value.trim().replace(/^\/(?!\/)/, prefix)).join(', ') + '"');
}

// Preview chrome only: never written to the exported site's assets or templates.
const previewScrollbarStyle = `<style data-cloner-preview-scrollbars>
html,body,*{scrollbar-color:#666 #eee!important;scrollbar-width:thin!important}
::-webkit-scrollbar{width:10px!important;height:10px!important}
::-webkit-scrollbar-track{background:#eee!important}
::-webkit-scrollbar-thumb{background:#666!important;border:2px solid #eee!important;border-radius:0!important}
::-webkit-scrollbar-thumb:hover{background:#111!important}
</style>`;
