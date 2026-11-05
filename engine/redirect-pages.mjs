// A followed HTTP redirect is evidence of an alias, not a second authored page.
// Only remove it when the complete observed chain ends at a separately captured
// local document. Query-sensitive, cyclic and incomplete chains remain intact.
export function withoutRedirectCopies(model) {
  const origin = new URL(model.source).origin;
  const edges = new Map();
  for (const r of model.observedRedirects || []) {
    try {
      const from = new URL(r.from), to = new URL(r.to, from);
      if (![301,302,303,307,308].includes(r.status) || from.origin !== origin || to.origin !== origin || from.search || to.search || from.hash || to.hash) continue;
      edges.set(from.href, to.href);
    } catch {}
  }
  const documents = new Set(model.pages.filter(p => p.url === p.documentURL).map(p => p.url));
  const pages = model.pages.filter(p => {
    if (!p.documentURL || p.url === p.documentURL || !documents.has(p.documentURL)) return true;
    let current = p.url;
    const seen = new Set();
    while (edges.has(current) && !seen.has(current)) {
      seen.add(current); current = edges.get(current);
    }
    return current !== p.documentURL || seen.has(current);
  });
  return {...model, pages};
}
