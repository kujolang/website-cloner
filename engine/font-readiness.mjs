// FontFaceSet.ready can remain pending indefinitely on a stalled font response.
// Do not produce a visual baseline using unverified fallback typography.
export async function waitForFonts(page, timeoutMs = 10000) {
  const ready = await page.evaluate(async timeout => {
    let timer;
    try {
      return await Promise.race([
        document.fonts.ready.then(() => true),
        new Promise(resolve => { timer = setTimeout(() => resolve(false), timeout); }),
      ]);
    } finally { clearTimeout(timer); }
  }, timeoutMs);
  if (!ready) throw Error(`Font readiness timed out after ${timeoutMs}ms; visual evidence is incomplete`);
}
