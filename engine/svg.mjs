import sanitizeHtml from 'sanitize-html';
export const svgTags = ['svg','g','path','circle','ellipse','rect','line','polyline','polygon','defs','clipPath','mask','linearGradient','radialGradient','stop','title','desc','symbol','use','text','tspan'];
const attributes = ['id','class','xmlns','viewBox','width','height','x','y','x1','y1','x2','y2','cx','cy','r','rx','ry','d','points','fill','fill-rule','fill-opacity','stroke','stroke-width','stroke-linecap','stroke-linejoin','stroke-opacity','stroke-dasharray','opacity','transform','clip-path','clip-rule','mask','offset','stop-color','stop-opacity','gradientUnits','gradientTransform','preserveAspectRatio','href','xlink:href','role','aria-label','aria-labelledby','aria-describedby','aria-hidden','focusable','style','font-family','font-size','font-weight','text-anchor','dx','dy'];
export const svgStyles = {
  'font-family': [/^[\p{L}\p{N} _,'"-]+$/u],
  'font-size': [/^[\d.]+(?:px|em|rem|%)?$/],
  'font-weight': [/^(?:normal|bold|[1-9]00)$/],
  fill: [/^(?:#[a-f\d]{3,8}|none|currentColor|[a-z]+)$/i, /^var\(--[a-zA-Z0-9_-]+(?:,\s*(?:#[a-f\d]{3,8}|[a-z]+))?\)$/i],
  stroke: [/^(?:#[a-f\d]{3,8}|none|currentColor|[a-z]+)$/i, /^var\(--[a-zA-Z0-9_-]+(?:,\s*(?:#[a-f\d]{3,8}|[a-z]+))?\)$/i],
  'fill-rule': [/^(?:evenodd|nonzero)$/],
  'clip-rule': [/^(?:evenodd|nonzero)$/],
  'stroke-linejoin': [/^(?:round|miter|bevel)$/],
  'stroke-miterlimit': [/^[\d.]+$/],
};
export const svgAttributes = Object.fromEntries(svgTags.map(tag=>[tag,attributes]));
export function safeSvgAttributes(tag, attrs) {
  if (!svgTags.includes(tag)) return {tagName:tag,attribs:attrs};
  const safe={};
  for(const [key,raw] of Object.entries(attrs)) {
    // XML whitespace is legal in paths, points and transforms. Normalize it;
    // retain the rejection of other controls and executable/resource values.
    const value=raw.replace(/[\t\n\r]/g, ' ');
    if (!attributes.includes(key) || /[\\<>\x00-\x1f]|\/\*/.test(value)) continue;
    if (key === 'style') {
      // sanitize-html applies the property allowlist after this transform.
      if (!/url\s*\(|expression|javascript|@/i.test(value)) safe[key] = value;
      continue;
    }
    if (key === "xmlns" && value !== "http://www.w3.org/2000/svg") continue;
    if (['href','xlink:href'].includes(key) && !/^#[\w.-]+$/.test(value)) continue;
    if (/url\s*\(/i.test(value) && !/^url\(\s*#[\w.-]+\s*\)$/.test(value)) continue;
    if (/javascript:|data:|https?:|\/\//i.test(value) && key!=='xmlns') continue;
    safe[key]=value;
  }
  return {tagName:tag,attribs:safe};
}
export function sanitizeSvg(text) {
  // Discard inert exporter headers without ever resolving a DTD. Reject entity
  // definitions/internal subsets rather than expanding untrusted XML.
  if (/<!ENTITY|<!DOCTYPE[^>]*\[/i.test(text)) throw Error('SVG entities are unsupported');
  text = text.replace(/<\?xml\s[\s\S]*?\?>/gi, '').replace(/<!DOCTYPE\s+svg\b[^>]*>/gi, '');
  if (/<!DOCTYPE/i.test(text)) throw Error('Invalid SVG declaration');
  const result=sanitizeHtml(text,{allowedTags:svgTags,allowedAttributes:svgAttributes,allowedStyles:{'*':svgStyles},parser:{lowerCaseTags:false,lowerCaseAttributeNames:false},transformTags:{'*':safeSvgAttributes},allowedSchemes:[],allowProtocolRelative:false});
  if(!/^\s*<svg[\s>]/.test(result))throw Error('Invalid SVG');
  return result;
}
