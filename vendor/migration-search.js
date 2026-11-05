(() => {
  const forms = document.querySelectorAll('[data-migration-search]');
  if (!forms.length) return;
  let indexPromise;
  const indexLink = document.querySelector('link[rel="migration-search-index"]');
  const root = indexLink && new URL('../', indexLink.href);
  const dialog = document.createElement('dialog'); dialog.className = 'migration-search-dialog';
  const close = document.createElement('button'); close.type = 'button'; close.textContent = 'Close search';
  const status = document.createElement('p'); status.setAttribute('role', 'status');
  const results = document.createElement('ul');
  dialog.append(close, status, results); document.body.append(dialog);
  close.onclick = () => dialog.close();
  let invocation = 0;
  async function search(input, kind) {
    const query = input.value.trim(); if (!query) { input.focus(); return; }
    const current = ++invocation; results.replaceChildren(); status.textContent = 'Searching local pages…';
    if (!dialog.open) dialog.showModal();
    try {
      if (!indexLink) throw Error('Missing local index');
      indexPromise ||= fetch(indexLink.href).then(r => { if (!r.ok) throw Error('Index unavailable'); return r.json(); }).catch(e => { indexPromise = null; throw e; });
      const documents = await indexPromise; if (current !== invocation) return;
      const terms = query.toLocaleLowerCase().split(/\s+/);
      let count = 0;
      for (const item of documents) {
        if(kind&&item.kind!==kind)continue;
        if (!terms.every(term => (item.title + ' ' + item.text).toLocaleLowerCase().includes(term))) continue;
        if (typeof item.route !== 'string' || !item.route.startsWith('/') || item.route.startsWith('//') || /[\\\x00-\x20]/.test(item.route)) continue;
        const target = new URL(item.route.slice(1), root); if (target.origin !== location.origin || !target.pathname.startsWith(root.pathname)) continue;
        const li = document.createElement('li'), a = document.createElement('a'), snippet = document.createElement('p');
        a.href = target.href; a.textContent = item.title; snippet.textContent = item.text.slice(0, 220);
        li.append(a, snippet); results.append(li); count++;
      }
      status.textContent = `${count} local result${count === 1 ? '' : 's'} for “${query}”`;
    } catch { status.textContent = 'The local search index could not be loaded. Please try again.'; }
  }
  for (const form of forms) {
    const eventInput=form.matches('.tribe-events-c-search')?form.querySelector('input[name="tribe-events-views[tribe-bar-search]"]'):null;
    const textInputs=form.querySelectorAll('input[type="text"],input:not([type])');
    const input = eventInput||form.querySelector('input[type="search"],input[name="s"],input[name="q"]')||(textInputs.length===1?textInputs[0]:null);
    const kind=eventInput?'event':null;
    const button = form.querySelector('button,input[type="submit"],input[type="button"]'); if (!input || !button) continue;
    const collapsed = () => form.classList.contains('wp-block-search__searchfield-hidden') || input.hidden || input.getAttribute('aria-hidden') === 'true';
    const open = () => { form.classList.remove('wp-block-search__searchfield-hidden'); input.hidden = false; input.setAttribute('aria-hidden', 'false'); input.tabIndex = 0; button.setAttribute('aria-expanded', 'true'); input.focus(); };
    button.addEventListener('click', e => { e.preventDefault(); if (collapsed()) open(); else search(input,kind); });
    form.addEventListener('submit', e => { e.preventDefault(); search(input,kind); });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); search(input,kind); } });
  }
})();
