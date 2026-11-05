import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import { SafeNetwork, publicIP, normalize } from "../engine/network.mjs";
import { clean } from "../engine/extract.mjs";
import { validRoute } from "../engine/generate.mjs";
import { validateDesign, reconstruct } from "../engine/reconstruct.mjs";
test("hostname requests use the pinned address with family autoselection on or off", async () => {
  const server = http.createServer((req, res) => res.end(req.headers.host));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const previous = net.getDefaultAutoSelectFamily();
  try {
    const network = new SafeNetwork();
    // Stand in for validated DNS without relying on external DNS or networking.
    network.address = async () => ({ address: "127.0.0.1", family: 4 });
    const host = `pinned.invalid:${server.address().port}`;
    for (const enabled of [true, false]) {
      net.setDefaultAutoSelectFamily(enabled);
      const response = await network.raw(`http://${host}/`);
      assert.equal(response.status, 200);
      assert.equal(response.body.toString(), host);
    }
  } finally {
    net.setDefaultAutoSelectFamily(previous);
    await new Promise((resolve) => server.close(resolve));
  }
});
test("SSRF: block private/reserved, mapped IPv6 and unsafe schemes", async () => {
  for (const ip of [
    "127.0.0.1",
    "10.1.2.3",
    "169.254.169.254",
    "192.168.0.1",
    "172.16.2.3",
    "0.0.0.0",
    "::1",
    "::ffff:127.0.0.1",
    "fe80::1",
    "fc00::1",
    "224.1.1.1",
  ])
    assert.equal(publicIP(ip), false, ip);
  assert.equal(publicIP("8.8.8.8"), true);
  for (const u of ["file:///etc/passwd", "http://user:pass@example.com"])
    assert.throws(() => normalize(u));
  await assert.rejects(new SafeNetwork().get("http://127.0.0.1/"));
});
test("routes cannot escape output; nested WP routes supported", () => {
  for (const r of ["/../x", "/%2e%2e/x", "//x", "/a\\b", "/a/%2fetc"])
    assert.throws(() => validRoute(r));
  assert.equal(validRoute("/2026/10/story/"), "/2026/10/story/");
});
test("HTML strips execution, embeds, controls and template injection", () => {
  const value = clean(
    '<script>alert(1)</script><iframe src="/secret"></iframe><img src=x onerror="alert(1)"><a href="javascript:alert(1)">x</a><form action="https://evil.test"><input></form>{{navigation}}',
  );
  assert.doesNotMatch(
    value,
    /script|iframe|onerror|javascript|<form|<input|\{\{/,
  );
});
test("AI schema rejects code and retries twice then falls back", async () => {
  assert.throws(() =>
    validateDesign({
      accent: "#abcdef",
      background: "#ffffff",
      text: "#000000",
      contentWidth: 900,
      spacing: 20,
      navigation: "source",
      script: "evil",
    }),
  );
  const original = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls++;
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: '{"script":"x"}' } }],
        usage: { prompt_tokens: 3, completion_tokens: 4 },
      }),
    );
  };
  try {
    const model = {
      pages: [],
      warnings: [],
      metrics: { aiCalls: 0, inputTokens: 0, outputTokens: 0 },
    };
    await reconstruct(model, {
      enabled: true,
      endpoint: "http://test/v1",
      modelName: "fixture",
    });
    assert.equal(calls, 2);
    assert.equal(model.design.method, "deterministic");
    assert.equal(model.metrics.inputTokens, 6);
  } finally {
    global.fetch = original;
  }
});
test("safe network follows robots, blocks private redirects and file limits", async () => {
  const s = http.createServer((req, res) => {
    if (req.url === "/robots.txt")
      return res.end("User-agent: *\nDisallow: /secret");
    if (req.url === "/redirect") {
      res.writeHead(302, { location: "http://127.0.0.1:1/" });
      return res.end();
    }
    if (req.url === "/big") return res.end("x".repeat(3000));
    res.end("ok");
  });
  await new Promise((r) => s.listen(0, "127.0.0.1", r));
  const origin = "http://127.0.0.1:" + s.address().port;
  try {
    const n = new SafeNetwork({ fixtureOrigins: [origin], maxFile: 2000 });
    assert.equal(await n.text(origin + "/"), "ok");
    await assert.rejects(n.text(origin + "/secret"), /robots/);
    await assert.rejects(n.text(origin + "/redirect"), /port|Private/);
    await assert.rejects(n.text(origin + "/big"), /size/);
  } finally {
    s.close();
  }
});

test("discovery adopts checked redirect origin for canonical www sites", async () => {
  const { discover } = await import("../engine/extract.mjs");
  const html =
    "<html><title>Canonical site</title><body><main><p>Content</p></main></body></html>";
  const network = {
    robots: new Map(),
    requests: 0,
    maxRequests: 20,
    started: Date.now(),
    get: async (url) =>
      url === "https://example.test/"
        ? {
            status: 200,
            url: "https://www.example.test/",
            redirects:[{from:"https://example.test/",to:"https://www.example.test/",status:301}],
            body: Buffer.from(html),
          }
        : { status: 404, url, body: Buffer.from("") },
    text: async () => {
      throw Error("not found");
    },
  };
  const result = await discover("https://example.test/", network, {
    maxPages: 1,
  });
  assert.equal(result.source, "https://www.example.test/");
  assert.equal(result.pages[0].url, result.source);
  assert.deepEqual(result.observedRedirects,[{from:"https://example.test/",to:"https://www.example.test/",status:301}]);
});

test('robots unavailable responses follow RFC9309 while disallow and outages stay closed',async()=>{
 for(const status of [200,403,404,410,429,503]){
  const network=new SafeNetwork();network.address=async()=>({address:'8.8.8.8',family:4});
  network.raw=async()=>({status,body:Buffer.from(status===200?'User-agent: *\nDisallow: /private':'Access Denied')});
  if([429,503].includes(status))await assert.rejects(network.allowed(new URL('https://example.com/a')),/Cannot establish/);
  else {await network.allowed(new URL('https://example.com/a'));if(status===200)await assert.rejects(network.allowed(new URL('https://example.com/private')),/Disallowed/);}
 }
});

test('public schema OPTIONS retains robots, address, and redirect checks without GET cache collision',async()=>{
 const seen=[];const server=http.createServer((req,res)=>{seen.push([req.method,req.url]);if(req.url==='/robots.txt')return res.end('User-agent: *\nDisallow: /private');if(req.url==='/redirect'){res.writeHead(302,{Location:'/schema'});return res.end();}if(req.url==='/unsafe'){res.writeHead(302,{Location:'http://127.0.0.2/schema'});return res.end();}res.end(req.method);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{const origin=`http://127.0.0.1:${server.address().port}`,network=new SafeNetwork({fixtureOrigins:[origin]});
 assert.equal((await network.get(origin+'/schema')).body.toString(),'GET');assert.equal((await network.options(origin+'/schema')).body.toString(),'OPTIONS');assert.equal((await network.options(origin+'/redirect')).body.toString(),'OPTIONS');
 await assert.rejects(network.options(origin+'/private'),/Disallowed/);await assert.rejects(network.options(origin+'/unsafe'));assert.ok(!seen.some(([,url])=>url==='/private'));
 }finally{await new Promise(resolve=>server.close(resolve));}
});
