import test from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { packageProject, recoverCompleted } from '../engine/recovery.mjs';
import { migrate } from '../engine/pipeline.mjs';

test('recovery validates ZIP and report, preserves failed quality and rejects partial/mismatched artifacts', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'migration-recovery-'));
  try {
    await mkdir(path.join(dir, 'project/output'), { recursive: true });
    await writeFile(path.join(dir, 'project/output/index.html'), '<h1>Saved content</h1>');
    const report = { status: 'failed-quality-checks', pages: [{ route: '/', status: 200 }] };
    await writeFile(path.join(dir, 'checkpoint.json'), JSON.stringify({ stage: 'Preparing download' }));
    await writeFile(path.join(dir, 'report.json'), JSON.stringify(report));
    await writeFile(path.join(dir, 'project/migration-report.json'), JSON.stringify(report));
    await writeFile(path.join(dir, 'website.partial.zip'), 'interrupted junk');
    assert.equal(await recoverCompleted(dir), null);
    await packageProject(dir);
    assert.deepEqual(await recoverCompleted(dir), report);
    await writeFile(path.join(dir, 'report.json'), JSON.stringify({ ...report, status: 'needs-review' }));
    assert.equal(await recoverCompleted(dir), null);
    await writeFile(path.join(dir, 'website.zip'), (await readFile(path.join(dir, 'website.zip'))).subarray(0, 20));
    assert.equal(await recoverCompleted(dir), null);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('resume rejects a different source before any network access', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'migration-resume-'));
  try {
    await writeFile(path.join(dir, 'checkpoint.json'), JSON.stringify({ source: 'https://one.example/' }));
    await assert.rejects(migrate('https://two.example/', dir, { resume: true }), /matching migration checkpoint/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('packaging resume does not resolve or crawl the source and keeps review status', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'migration-package-resume-'));
  try {
    const source = 'https://unreachable.invalid/';
    const report = { status: 'needs-review', pages: [{ route: '/', status: 200 }] };
    await mkdir(path.join(dir, 'project/output'), { recursive: true });
    await writeFile(path.join(dir, 'project/output/index.html'), '<h1>Saved content</h1>');
    for (const [file, value] of Object.entries({ 'checkpoint.json': { source, stage: 'Preparing download' }, 'report.json': report, 'project/migration-report.json': report, 'project/site-model.json': { source, pages: [{ route: '/' }] } }))
      await writeFile(path.join(dir, file), JSON.stringify(value));
    const stages = [];
    const result = await migrate(source, dir, { resume: true, event: stage => stages.push(stage) });
    assert.equal(result.report.status, 'needs-review');
    assert.deepEqual(stages, ['Resuming download packaging']);
    assert.deepEqual(await recoverCompleted(dir), report);
    await rm(path.join(dir, 'project/output/index.html'));
    assert.equal(await recoverCompleted(dir), null);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('packaging stores compressed media, compresses editable sources and preserves extracted bytes', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'migration-media-package-'));
  try {
    await mkdir(path.join(dir, 'project/.ssg-output'), { recursive: true });
    const files = {
      'photo.webp': Buffer.from('already compressed payload '.repeat(500)),
      'PHOTO.PNG': Buffer.from('uppercase media payload '.repeat(500)),
      'article.md': Buffer.from('# Editable content\n\n'.repeat(500)),
      'style.css': Buffer.from('body { color: black; }\n'.repeat(500)),
    };
    for (const [name, bytes] of Object.entries(files)) await writeFile(path.join(dir, 'project', name), bytes);
    await writeFile(path.join(dir, 'project/site-model.json'), 'private intermediate');
    await writeFile(path.join(dir, 'project/.ssg-output/temporary'), 'temporary');
    await packageProject(dir);
    const archive = path.join(dir, 'website.zip');
    const { stdout: listing } = await exec('unzip', ['-lv', archive]);
    for (const name of ['photo.webp', 'PHOTO.PNG']) assert.match(listing, new RegExp('Stored[^\\n]*' + name.replace('.', '\\.')));
    for (const name of ['article.md', 'style.css']) assert.match(listing, new RegExp('Defl[^\\n]*' + name.replace('.', '\\.')));
    assert.doesNotMatch(listing, /site-model|temporary/);
    for (const [name, bytes] of Object.entries(files)) {
      const { stdout } = await exec('unzip', ['-p', archive, 'project/' + name], { encoding: 'buffer' });
      assert.deepEqual(stdout, bytes);
    }
    await rm(path.join(dir, 'project/photo.webp'));
    await packageProject(dir);
    const { stdout: refreshed } = await exec('unzip', ['-Z1', archive]);
    assert.doesNotMatch(refreshed, /photo\.webp/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
