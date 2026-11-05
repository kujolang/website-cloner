import safeParser from 'postcss-safe-parser';
// Keep source h1 presentation when additional primary headings are demoted.
// :where leaves the replacement at the original type-selector specificity.
export function headingCSS(css){
 const root=safeParser(css);
 root.walkRules(rule=>{rule.selector=frameSelector(rule.selector).replace(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(?<![\w.#-])h1(?![\w-])/g,(match,quoted)=>quoted||':is(h1,div:where([data-migration-source-heading="h1"]))');});
 // Local fonts must eventually replace fallback glyphs even on slow devices.
 // Keep remote/local() faces and explicit block/swap policies unchanged.
 root.walkAtRules(/^font-face$/i,rule=>{
  const localized=rule.nodes?.some(n=>n.type==='decl'&&n.prop.toLowerCase()==='src'&&/url\(\s*["']?\.\.\/media\/[^)"']+\.(?:woff2?|ttf|otf)(?:[?#][^)"']*)?["']?\s*\)/i.test(n.value));
  if(localized)rule.walkDecls(/^font-display$/i,d=>{if(/^(fallback|optional)$/i.test(d.value.trim()))d.value='swap';});
 });
 return root.toString();
}

// Rewrite type selectors only; leave attribute values, strings and class names alone.
export function frameSelector(selector){
 return selector.replace(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\[[^\]]*\])|(?<![\w.#:\\-])iframe(?![\w-])/gi,(match,protectedToken)=>protectedToken||'migration-frame');
}
