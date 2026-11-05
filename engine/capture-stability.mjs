import {PNG} from 'pngjs';

// Opt-in proof capture: establish repeatability independently of the comparison
// target. Never choose a frame because it happens to resemble the other site.
export async function stableScreenshot(page, options = {}) {
 const {maxCaptures = 3, ...screenshotOptions} = options;
 if (!Number.isInteger(maxCaptures) || maxCaptures < 2 || maxCaptures > 5)
  throw new Error('Stable capture requires two to five attempts');
 const samples = [];
 let previous;
 for (let attempt = 1; attempt <= maxCaptures; attempt++) {
  const buffer = await page.screenshot({...screenshotOptions, path: undefined});
  const pixels = PNG.sync.read(buffer);
  samples.push(buffer);
  if (previous && previous.width === pixels.width && previous.height === pixels.height && previous.data.equals(pixels.data))
   return {buffer, samples, captures: attempt};
  previous = pixels;
 }
 const error = new Error('Screenshot did not stabilize within the capture limit');
 error.samples = samples;
 throw error;
}
