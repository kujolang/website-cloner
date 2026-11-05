import {load} from 'cheerio';
import http from 'node:http';
import { fileResponse } from '../engine/static.mjs';
import { checkAgentExport } from '../scripts/check-agent-export.mjs';
import { verifyAgentExport } from '../engine/verify-agent-export.mjs';
import { prefixPreview } from '../app/preview.mjs';
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm, cp } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { generate } from "../engine/generate.mjs";
import { run } from "../engine/pipeline.mjs";
import { chromium } from "playwright";
import { runtimeHash } from "../engine/motion.mjs";
import { serveStatic } from "../engine/static.mjs";
test(
  "editable shared templates build real SSG with nested routes and GitHub prefix",
  { timeout: 120000 },
  async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "return-export-"));
    try {
      const model = {
        source: "https://example.org/",
        identity: { title: "Example" },
        navigation: [],
        design: {
          accent: "#123456",
          background: "#ffffff",
          text: "#222222",
          contentWidth: 1000,
          spacing: 24,
          navigation: "source",
        },
        metrics: {},
        pages: [
          {
            url: "https://example.org/",
            route: "/",
            title: "Home",
            description: "Home description",
            sourceHTML: '<head><script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage","name":"Source schema","url":"https://example.org/"}</script><meta property="og:title" content="Source social"></head>',
            lang: "en",
            canonical: "https://example.org/",
            family: "page",
            motion: { schema: "migration-motion/v1", adapters: [], entrances: [], unsupported: [] },
            header:
              '<header><nav class="sk-navigation"><a href="/2026/story/">Story</a></nav></header>',
            footer: "",
            content: '<h1>Real content</h1><p>Original text</p><video poster="/assets/cover.webp"></video><img srcset="/assets/a.webp 390w, /assets/b.webp 1440w">',
            styles: [],
            bodyClass: "",
            mainClass: "",
            mainStyle: "",
            mainId: "main",
            wrapperClass: "",
          },
          {
            url: "https://example.org/2026/story/",
            route: "/2026/story/",
            title: "Story",
            description: "Story description",
            lang: "en",
            canonical: "https://example.org/2026/story/",
            family: "page",
            header: "",
            footer: "",
            content: '<h1>Story</h1><a href="../../">Home</a>',
            styles: [],
            bodyClass: "",
            mainClass: "",
            mainStyle: "",
            mainId: "main",
            wrapperClass: "",
          },
        ],
      };
      // Extensionless parent routes must coexist with descendants in either order.
      for (const route of ["/domains/child/", "/domains", "/pricing", "/pricing/details", "/legacy.html"]) {
        model.pages.push({ ...model.pages[1], route, canonical: "https://example.org" + route, url: "https://example.org" + route });
      }
      model.pages.push({ ...model.pages[1], route: "/domains/", canonical: "https://example.org/domains/", url: "https://example.org/domains/" });
      model.pages.find(p=>p.route==="/domains").canonical="https://example.org/domains/";
      model.pages.push({...model.pages[1],route:"/excluded/",robots:"noindex",title:"Hidden listing"});
      await generate(model, dir);
      const platforms=JSON.parse(await readFile(path.join(dir,'platform-support.json'),'utf8'));
      assert.equal(platforms.schema,'website-cloner-platform-support/v1');
      assert.equal(platforms.pages.length,model.pages.length);
      assert.equal(JSON.parse(await readFile(path.join(dir,'forms.json'),'utf8')).schema,'website-cloner-forms/v1');
      await run(process.execPath, ["scripts/build.mjs"], {
        cwd: dir,
        timeout: 60000,
        env: {
          ...process.env,
          SITE_URL: "https://owner.github.io/repo",
          BASE_PATH: "/repo",
        },
      });
      let home = await readFile(path.join(dir, "output/index.html"), "utf8");
      assert.match(home, /<title>Home<\/title>/);
      assert.ok(home.includes(runtimeHash));
      assert.match(home, /name="migration-motion"/);
      assert.match(home, /"@type":"WebPage"/);
      assert.doesNotMatch(home, /"publisher"/);
      const sitemap = await readFile(path.join(dir, "output/sitemap.xml"), "utf8");
      assert.equal((sitemap.match(/<loc>https:\/\/owner.github.io\/repo\/domains\/<\/loc>/g) || []).length, 1);
      assert.equal(load(home)('h1').first().text(),'Real content');
      assert.doesNotMatch(home, /&lt;h1/);
      assert.match(home, /poster="\/repo\/assets\/cover.webp"/);
      assert.match(home, /srcset="\/repo\/assets\/a.webp 390w, \/repo\/assets\/b.webp 1440w"/);
      assert.match(home, /href="\/repo\/2026\/story\/"/);
      assert.match(home, /href="https:\/\/owner.github.io\/repo\/"/);
      assert.doesNotMatch(home, /example.org\/page-000/);
      const agentIndex = JSON.parse(await readFile(path.join(dir,"output/.well-known/kujo-site-index.json"),"utf8"));
      assert.ok(agentIndex.items.some(i=>i.url==="/2026/story/"));
      assert.ok(!agentIndex.items.some(i=>i.url==="/excluded/"));
      const llms = await readFile(path.join(dir,"output/llms.txt"),"utf8");
      assert.ok(llms.includes("https://owner.github.io/repo/2026/story/"));
      assert.ok(!llms.includes("/excluded/"));
      const prefixed = http.createServer((req,res)=>fileResponse(res,path.join(dir,"output"),new URL(req.url,"http://localhost").pathname.replace(/^\/repo/,""),{preview:false}));
      await new Promise(r=>prefixed.listen(0,"127.0.0.1",r));
      const pb=await chromium.launch({channel:'chrome',headless:true});
      try {
        const pg=await pb.newPage();
        await pg.addInitScript(()=>Object.defineProperty(document,'modelContext',{value:{registerTool(t){(window.tools ||= {})[t.name]=t;}}}));
        await pg.goto(`http://127.0.0.1:${prefixed.address().port}/repo/2026/story/`);
        const result=await pg.evaluate(async()=>{
          const t=window.tools; const info=await t.get_site_info.execute({});
          const search=await t.search_site.execute({query:'Story'});
          const content=await t.get_content.execute({url:'/repo/2026/story/'});
          const list=await t.list_content.execute({type:'pages'});
          let rejects=false;try{await t.get_content.execute({url:'https://evil.invalid/'});}catch{rejects=true;}
          return {names:Object.keys(t),info,search,content,list,rejects};
        });
        assert.equal(result.names.length,4);assert.equal(result.content.url,'/repo/2026/story/');assert.ok(result.rejects);
        assert.ok(result.search.results.every(i=>i.url.startsWith('/repo/')));
      } finally {await pb.close();await new Promise(r=>prefixed.close(r));}
      const story = await readFile(
        path.join(dir, "output/2026/story/index.html"),
        "utf8",
      );
      assert.match(story, /href="\/repo\/"/);
      assert.equal(load(home)('script[data-cloner-component]').length,0);
      const layoutPath=path.join(dir,'templates/layout.html');
      const component='<section data-migration-tabs><div role="tablist"><button role="tab" aria-controls="tab-first">First tab</button><button role="tab" aria-controls="tab-second">Second tab</button></div><div role="tabpanel" id="tab-first">First answer</div><div role="tabpanel" id="tab-second">Second answer</div></section>';
      await writeFile(layoutPath,(await readFile(layoutPath,'utf8')).replace('</body>',component+'</body>'));
      const sourceFile=path.join(dir,"content/pages/home.md");
      const originalSource=await readFile(sourceFile,'utf8');
      await writeFile(sourceFile,originalSource.replace('Source schema','Edited schema').replace('Source social','Edited social')+'\n\nEdited content\n');
      await run(process.execPath, ["scripts/build.mjs"], {
        cwd: dir,
        timeout: 60000,
      });
      home = await readFile(path.join(dir, "output/index.html"), "utf8");
      assert.match(home, /Edited content/);
      assert.equal(JSON.parse(load(home)('script[type="application/ld+json"]').first().text()).name,'Edited schema');
      assert.equal(load(home)('meta[property="og:title"]').attr('content'),'Edited social');
      const index = JSON.parse(await readFile(path.join(dir, "output/assets/search-index.json"), "utf8"));
      assert.match(index.find(p => p.route === "/").text, /Edited content/);
      assert.ok(index.some(p => p.route === "/2026/story/"));
      const server = await serveStatic(path.join(dir, "output"));
      try {
        assert.equal((await fetch(server.url + "/")).status, 200);
        const browser = await chromium.launch({ channel: 'chrome', headless: true });
        try {
          const discovery = await verifyAgentExport(browser,dir,server.url);
          assert.equal(discovery.status,'passed',JSON.stringify(discovery));
          const page = await browser.newPage();
          const previewId='a'.repeat(48);
          await page.addInitScript(()=>Object.defineProperty(document,'modelContext',{value:{registerTool(t){(window.tools ||= {})[t.name]=t;}}}));
          await page.route('**/*',async route=>{
            const u=new URL(route.request().url());
            const response=await fetch(server.url+u.pathname.replace('/'+previewId,''));
            const type=response.headers.get('content-type') || '';
            const body=type.includes('text/html')?prefixPreview(await response.text(),previewId):Buffer.from(await response.arrayBuffer());
            await route.fulfill({status:response.status,contentType:type,body});
          });
          await page.goto(server.url+'/'+previewId+'/2026/story/');
          const previewContent=await page.evaluate(()=>window.tools.get_content.execute({url:location.pathname}));
          assert.equal(previewContent.url,'/'+previewId+'/2026/story/');
          await page.unroute('**/*');
          await page.goto(server.url);
          assert.equal(await page.locator('script[data-cloner-component="tabs"]').count(),1);
          await page.getByRole('tab',{name:'Second tab'}).click();
          assert.equal(await page.locator('#tab-second').isVisible(),true);
          assert.equal(await page.locator('#tab-first').isVisible(),false);
          await page.waitForFunction(() => document.documentElement.dataset.migrationMotion === 'active');
        } finally { await browser.close(); }
        assert.equal((await fetch(server.url + "/2026/story/")).status, 200);
        for (const route of ["/domains", "/domains/child/", "/pricing", "/pricing/details", "/legacy.html"]) {
          const response = await fetch(server.url + route);
          assert.equal(response.status, 200, route);
          assert.match(response.headers.get("content-type"), /text\/html/, route);
          assert.equal(load(await response.text())('h1').first().text(),'Story',route);
        }
        const llmsPath=path.join(dir,'output/llms.txt');
        const originalLlms=await readFile(llmsPath,'utf8');await writeFile(llmsPath,'# Missing entries');
        await assert.rejects(checkAgentExport(path.join(dir,'output'),JSON.parse(await readFile(path.join(dir,'routes.json'),'utf8'))),/Missing llms route/);
        await writeFile(llmsPath,originalLlms);
      } finally {
        await server.close();
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
);
