import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { extract } from "../engine/extract.mjs";
import { generate } from "../engine/generate.mjs";
import { localize } from "../engine/assets.mjs";

test("classic blog keeps all posts, nested wrappers, sidebar and responsive header", async () => {
  const html = '<html><head><title>Blog</title><style>.entry{color:red}</style></head><body class="home"><div id="page"><header><picture><source media="(min-width:600px)" srcset="/wide.webp 1x"><img src="/header.png"></picture></header><div id="main"><div id="primary"><div id="content"><article id="post-1"><h2>First</h2><div class="entry-content"><p>One</p></div></article><article id="post-2"><h2>Second</h2><div class="entry-content"><p>Two</p></div></article></div></div><aside>Sidebar</aside></div><footer>Footer</footer></div></body></html>';
  const p = extract(html, "https://example.org/");
  assert.match(p.content, /First/); assert.match(p.content, /Second/);
  assert.equal(p.sourceArticleCount, 2);
  assert.match(p.shell, /id="primary"/); assert.match(p.shell, /<aside>Sidebar/);
  assert.match(p.shell, /srcset="\/wide.webp 1x"/);
  assert.match(p.shell, /id="content">MIGRATION_CONTENT_SLOT_7c3e/);
  const dir = await mkdtemp(path.join(os.tmpdir(), "fidelity-"));
  try {
    const model = { source: p.url, identity: { title: p.title }, navigation: [], pages: [{ ...p, styles: [".entry{color:red}"] }, { ...p, route: "/second/", url: "https://example.org/second/", styles: [".entry{color:blue}"] }], design: {}, metrics: {} };
    await generate(model, dir);
    assert.equal(await readFile(path.join(dir, "assets/css/home.css"), "utf8"), ".entry{color:red}");
    assert.equal(await readFile(path.join(dir, "assets/css/second.css"), "utf8"), ".entry{color:blue}");
    const routes = JSON.parse(await readFile(path.join(dir, "routes.json")));
    assert.equal(routes[0].preservedShell, true);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("CSS imports and responsive media are localized while stylesheet order stays intact", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "assets-"));
  const requests = [];
  const network = { text: async url => url.endsWith("parent.css") ? '@import "child.css"; .parent{color:red}' : '.child{color:blue}', get: async url => { requests.push(url); return {status:200,headers:{"content-type":"image/png"},body:Buffer.from("png")}; } };
  const page = extract('<html><head><style>.first{color:green}</style><link rel="stylesheet" href="/parent.css"><style>.last{color:gray}</style></head><body><main><picture><source srcset="/wide.png 1x"><img src="/small.png"></picture></main></body></html>', 'https://example.org/');
  const model = { pages:[page], warnings:[], media:[],metrics:{} };
  try {
    await localize(model, network, dir);
    assert.match(page.styles[0], /first/); assert.match(page.styles[1], /child.*parent/s); assert.match(page.styles[2], /last/);
    assert.match(page.content, /srcset="\/assets\/media\//); assert.ok(requests.includes('https://example.org/wide.png'));
  } finally { await rm(dir, {recursive:true,force:true}); }
});

test("hidden plugin overlays and menu buttons retain their visibility state", () => {
  const p = extract('<html><body><main><p>Visible story</p></main><div class="overlay" style="display:none;position:fixed">Gallery</div><div hidden>Hidden panel</div><button class="menu-toggle" type="button" onclick="evil()">Menu</button></body></html>', 'https://example.org/');
  assert.match(p.shell, /style="display:none;position:fixed"/);
  assert.match(p.shell, /hidden/); assert.match(p.shell, /<button class="menu-toggle" type="button">Menu/);
  assert.doesNotMatch(p.shell,/onclick/);
});

test('inferred image dimensions preserve responsive height and explicit source CSS',async()=>{
 const {chromium}=await import('playwright');const dir=await mkdtemp(path.join(os.tmpdir(),'intrinsic-image-'));let browser;
 try{
  const p=extract('<html><body><main><img class="banner" src="/assets/media/a.webp"><img class="fixed" src="/assets/media/a.webp"></main></body></html>','https://example.org/');
  await generate({source:p.url,identity:{title:'Images'},pages:[p],media:[{path:'assets/media/a.webp',width:772,height:250}],navigation:[],design:{},metrics:{}},dir);
  const {execFile}=await import('node:child_process');const {promisify}=await import('node:util');await promisify(execFile)(process.execPath,['scripts/build.mjs'],{cwd:dir,timeout:60000});
  const {load}=await import('cheerio/slim');const html=load(await readFile(path.join(dir,'output/index.html'),'utf8'))('main').html(),css=await readFile(path.join(dir,'assets/css/agent.css'),'utf8');
  browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();await page.route('**/*',r=>r.abort());
  await page.setContent('<style>.banner{width:1160px}.fixed{height:80px;width:120px}</style><style>'+css+'</style>'+html);
  const heights=await page.locator('img').evaluateAll(els=>els.map(e=>e.getBoundingClientRect().height));assert.ok(Math.abs(heights[0]-1160*250/772)<1);assert.equal(heights[1],80);
 }finally{await browser?.close();await rm(dir,{recursive:true,force:true});}
});
