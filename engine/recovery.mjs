import { readFile, stat, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
// Already-compressed assets gain little from another deflate pass. Keep editable
// HTML, CSS, JS, SVG and Markdown compressed; ZIP still checks every entry's CRC.
const storedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'woff', 'woff2', 'mp4', 'webm', 'mp3', 'ogg', 'zip', 'gz']
  .flatMap(ext => ['.' + ext, '.' + ext.toUpperCase()]).join(':');

export async function packageProject(dir) {
  const partial = path.join(dir, 'website.partial.zip');
  // zip updates existing archives: remove any interrupted attempt first, so stale files cannot survive.
  await rm(partial, { force: true });
  await run('zip', ['-q1r', '-n', storedExtensions, partial, 'project', '-x', 'project/site-model.json', 'project/.ssg-*', 'project/.ssg-*/*'], { cwd: dir, timeout: 900000 });
  await run('unzip', ['-tq', partial], { timeout: 900000 });
  await rename(partial, path.join(dir, 'website.zip'));
}

export async function validatePreparedOutput(dir, report) {
  if (!['verified-within-scope', 'needs-review', 'failed-quality-checks'].includes(report?.status) || !report.pages?.length)
    throw Error('No verified migration report to package');
  const root = path.resolve(dir, 'project/output');
  for (const page of report.pages.filter(p => p.status === 200)) {
    if (typeof page.route !== 'string' || !page.route.startsWith('/')) throw Error('Invalid saved route');
    const name = page.route.endsWith('/') || !path.posix.extname(page.route) ? path.posix.join(page.route, 'index.html') : page.route;
    const file = path.resolve(root, '.' + decodeURIComponent(name));
    if (!file.startsWith(root + path.sep) || !(await stat(file)).isFile()) throw Error('Saved output is missing; rebuild before packaging');
  }
}

// A packaging/metadata failure must not force a new crawl or masquerade as good fidelity.
export async function recoverCompleted(dir) {
  try {
    const checkpoint = JSON.parse(await readFile(path.join(dir, 'checkpoint.json')));
    if (checkpoint.stage !== 'Preparing download') return null;
    const report = JSON.parse(await readFile(path.join(dir, 'report.json')));
    if (!['verified-within-scope', 'needs-review', 'failed-quality-checks'].includes(report.status) || !report.pages?.length) return null;
    await validatePreparedOutput(dir, report);
    const archived = await run('unzip', ['-p', path.join(dir, 'website.zip'), 'project/migration-report.json'], { maxBuffer: 8e6 });
    if (JSON.stringify(JSON.parse(archived.stdout)) !== JSON.stringify(report)) return null;
    await run('unzip', ['-tq', path.join(dir, 'website.zip')], { timeout: 900000 });
    return report;
  } catch { return null; }
}
