import {publicPackageURL} from './public-dependencies.mjs';
import { DownloadQueue } from "./download-queue.mjs";
import http from "node:http";
import https from "node:https";
import dns from "node:dns/promises";
import ipaddr from "ipaddr.js";
import robotsParser from "robots-parser";
export const AGENT = "WebsiteReturn/0.1";
export function normalize(input) {
  const u = new URL(input.includes("://") ? input : `https://${input}`);
  if (!["http:", "https:"].includes(u.protocol) || u.username || u.password)
    throw Error("Use a public HTTP or HTTPS website URL without credentials.");
  u.hash = "";
  if (u.search)
    throw Error("Start with a website address without a query string.");
  return u;
}
export function publicIP(address) {
  try {
    let p = ipaddr.parse(address);
    if (p.isIPv4MappedAddress?.()) p = p.toIPv4Address();
    return p.range() === "unicast";
  } catch {
    return false;
  }
}
export class SafeNetwork {
  constructor({
    fixtureOrigins = [],
    maxRequests = 4000,
    maxBytes = 512_000_000,
    maxFile = 5_000_000,
    maxDurationMs = 1_200_000,
    requestTimeoutMs = 12000,
    requestDeadlineMs = 15000,
    retryDelayMs = 1000,
    concurrency = 12, perHost = 6,
    pauseOnOutage = false,
    sourceOrigin = null,
  } = {}) {
    this.queue = new DownloadQueue({concurrency, perHost});
    this.pauseOnOutage = pauseOnOutage;
    this.outage = null;
    this.sourceOrigin = sourceOrigin ? new URL(sourceOrigin).origin : null;
    this.externalFailures = new Map();
    this.retries = 0; this.failures = 0; this.cacheBytes = 0;
    this.inflight = new Map();
    this.requestTimeoutMs = requestTimeoutMs;
    this.requestDeadlineMs = requestDeadlineMs;
    this.retryDelayMs = retryDelayMs;
    this.fixtures = new Set(fixtureOrigins);
    this.maxRequests = maxRequests;
    this.maxBytes = maxBytes;
    this.maxFile = maxFile;
    this.maxDurationMs = maxDurationMs;
    this.requests = 0;
    this.bytes = 0;
    this.cache = new Map();
    this.robots = new Map();
    this.robotsLoading = new Map();
    this.denied = [];
    this.publicPackageSubstitutions = new Map();
    this.nextRequest = new Map();
    this.started = Date.now();
  }
  isExternal(url) {
    return !!this.sourceOrigin && new URL(url).origin !== this.sourceOrigin;
  }
  // A denied embed/CDN must not poison every request to the source site.
  // Remember the external origin for this attempt; never retry around its denial.
  failResource(url, error) {
    if (!this.isExternal(url)) { this.outage = error; return error; }
    const origin = new URL(url).origin;
    error.code = 'EXTERNAL_RESOURCE_UNAVAILABLE';
    this.externalFailures.set(origin, error);
    return error;
  }
  checkAvailability(url) {
    if (this.outage) throw this.outage;
    const error = this.externalFailures.get(new URL(url).origin);
    if (error) throw error;
  }
  async address(u) {
    if (!["http:", "https:"].includes(u.protocol) || u.username || u.password)
      throw Error("Blocked URL scheme or credentials");
    const host = u.hostname.replace(/^\[|\]$/g, "");
    if (this.fixtures.has(u.origin)) {
      if (host !== "127.0.0.1")
        throw Error("Fixture exception must be exact IPv4 loopback");
      return { address: host, family: 4 };
    }
    if (u.port && !["80", "443"].includes(u.port))
      throw Error("Nonstandard ports are blocked");
    let timer;
    const all = await Promise.race([
      dns.lookup(host, { all: true }),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(Error("DNS deadline exceeded"),{code:"ETIMEDOUT",timeoutKind:"dns"})), 8000);
      }),
    ]).finally(() => clearTimeout(timer));
    if (!all.length || all.some((x) => !publicIP(x.address)))
      throw Error("Private, reserved or internal destination blocked");
    return all[0];
  }
  async raw(url, redirects = 0, robotsRequest = false, method = "GET", maxFile = this.maxFile) {
    this.checkAvailability(url);
    for (let attempt = 0; ; attempt++) {
      try {
        const result = await this.rawAttempt(url, redirects, robotsRequest, method, maxFile);
        if (this.pauseOnOutage && [429,503].includes(result.status)) {
          const retry = result.headers["retry-after"];
          const delay = /^\d+$/.test(retry||"") ? Number(retry)*1000 : Date.parse(retry)-Date.now();
          const failure = Object.assign(Error(`Source returned HTTP ${result.status} for ${new URL(url).origin}${new URL(url).pathname}; downloads paused to respect the server.`), {code:"SOURCE_UNAVAILABLE",retryAfterMs:Number.isFinite(delay)?Math.max(0,Math.min(3600000,delay)):30000});
          throw this.failResource(result.url || url, failure);
        }
        return result;
      }
      catch (error) {
        if (error.retryExhausted || !["ETIMEDOUT", "ECONNRESET", "EAI_AGAIN", "ECONNREFUSED"].includes(error.code)) throw error;
        if (attempt >= 2) {
          error.retryExhausted = true;
          error.failedURL = new URL(url).href;
          const detail=['dns','idle','deadline'].includes(error.timeoutKind)?`; ${error.timeoutKind} timeout`:'';
          error.message = `Source request failed after 3 attempts: ${new URL(url).origin}${new URL(url).pathname} (${error.code}${detail}). Check the source website and resume this saved migration.`;
          this.failures++;
          if (this.pauseOnOutage) {
            error.code = "SOURCE_UNAVAILABLE";
            this.failResource(error.failedURL || url, error);
          }
          throw error;
        }
        this.retries++;
        await new Promise(resolve => setTimeout(resolve, this.retryDelayMs * (attempt + 1)));
      }
    }
  }
  async rawAttempt(url, redirects, robotsRequest, method, maxFile) {
    const u = new URL(url);
    if (
      ++this.requests > this.maxRequests ||
      Date.now() - this.started > this.maxDurationMs
    )
      throw Object.assign(Error("Crawl request/time budget exhausted"), { code: "CRAWL_BUDGET" });
    const addr = await this.address(u);
    return this.queue.run(u.origin, async () => {
    this.checkAvailability(url);
    if (!robotsRequest) {
      const delay = Number(this.robots.get(u.origin)?.getCrawlDelay(AGENT)) || 0;
      if (delay > 0) {
        const at = Math.max(Date.now(), this.nextRequest.get(u.origin) || 0);
        if (at - this.started > this.maxDurationMs)
          throw Object.assign(Error('Crawl time budget exhausted while respecting crawl delay'), { code: 'CRAWL_BUDGET' });
        this.nextRequest.set(u.origin, at + delay * 1000);
        if (at > Date.now()) await new Promise(resolve => setTimeout(resolve, at - Date.now()));
      }
    }
    const result = await new Promise((resolve, reject) => {
      const req = (u.protocol === "https:" ? https : http).get(
        u,
        {
          method,
          headers: { "user-agent": AGENT, "accept-encoding": "identity" },
          // Node's family autoselection requests all answers; keep either
          // callback shape pinned to the single destination checked above.
          lookup: (_h, options, cb) =>
            options.all
              ? cb(null, [addr])
              : cb(null, addr.address, addr.family),
          agent: false,
          timeout: this.requestTimeoutMs,
        },
        (res) => {
          const chunks = [];
          let size = 0;
          res.on("data", (b) => {
            size += b.length;
            this.bytes += b.length;
            if (size > maxFile || this.bytes > this.maxBytes) {
              res.destroy(Object.assign(Error("Download size limit exceeded"), { code: this.bytes > this.maxBytes ? "CRAWL_BUDGET" : "FILE_SIZE_LIMIT" }));
              return;
            }
            chunks.push(b);
          });
          res.on("error", reject);
          res.on("end", () =>
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: Buffer.concat(chunks),
              url: u.href,
            }),
          );
        },
      );
      const deadline = setTimeout(
        () => req.destroy(Object.assign(Error("Absolute download deadline exceeded"), {code:"ETIMEDOUT",timeoutKind:"deadline"})),
        this.requestDeadlineMs,
      );
      req.on("close", () => clearTimeout(deadline));
      req.on("timeout", () => req.destroy(Object.assign(Error("Request timeout"), {code:"ETIMEDOUT",timeoutKind:"idle"})));
      req.on("error", reject);
    });
    return result;
    }).then(async result => {
    if (
      [301, 302, 303, 307, 308].includes(result.status) &&
      result.headers.location
    ) {
      if (redirects >= 4) throw Error("Redirect limit exceeded");
      const target = new URL(result.headers.location, u);
      // Robots redirects still pass address validation in raw(), but must not
      // recursively wait for their own unfinished permission lookup.
      if (robotsRequest) return this.raw(target.href, redirects + 1, true, method, maxFile);
      await this.allowed(target);
      const final = await this.raw(target.href, redirects + 1, false, method, maxFile);
      return {...final, redirects:[{from:u.href,to:target.href,status:result.status},...(final.redirects||[])]};
    }
    return result;
    });
  }
  async allowed(u) {
    this.checkAvailability(u);
    try { await this.address(u); }
    catch(error) {
      if(this.pauseOnOutage && ["ETIMEDOUT","EAI_AGAIN"].includes(error.code)) {
        throw this.failResource(u, Object.assign(error,{code:"SOURCE_UNAVAILABLE"}));
      }
      throw error;
    }
    if (!this.robotsLoading.has(u.origin)) {
      // Share in-flight permission checks; failed checks must be retried, never
      // treated as permission or cached forever after a transient outage.
      const pending = (async () => {
        const r = await this.raw(u.origin + "/robots.txt", 0, true);
        // RFC 9309 section 2.3.1.3: unavailable robots (4xx) is not a
        // resource access ban. Timeouts, rate limits and server failures remain
        // fail-closed; actual resource 401/403 responses are never bypassed.
        const unavailable=r.status>=400&&r.status<500&&![408,429].includes(r.status);
        if (r.status!==200&&!unavailable) throw Error("Cannot establish robots permission (HTTP "+r.status+")");
        const parser = robotsParser(u.origin + "/robots.txt", r.status === 200 ? r.body.toString() : "");
        this.robots.set(u.origin, parser);

      })().catch(error=>{this.robotsLoading.delete(u.origin);throw error;});
      this.robotsLoading.set(u.origin, pending);
    }
    await this.robotsLoading.get(u.origin);
    if (this.robots.get(u.origin).isAllowed(u.href, AGENT) === false)
      throw Error("Disallowed by robots.txt");
  }
  async get(url, { maxFile = this.maxFile } = {}) {
    const u = new URL(url);
    u.hash = "";
    if (this.cache.has(u.href)) return this.cache.get(u.href);
    const key = u.href + ":" + maxFile;
    if (this.inflight.has(key)) return this.inflight.get(key);
    const task = (async () => {
      try { await this.allowed(u); }
      catch(error){
        const alternate=error.message==='Disallowed by robots.txt'?publicPackageURL(u.href):null;
        if(!alternate)throw error;
        const result=await this.get(alternate,{maxFile});
        if(result.status!==200)throw error;
        this.publicPackageSubstitutions.set(u.href,{source:u.href,packageURL:alternate,reason:'Original distribution disallows crawling; exact version from public npm distribution'});
        return result;
      }
      const r = await this.raw(u.href,0,false,"GET",maxFile);
      if (![408,429,500,502,503,504].includes(r.status) && r.body.length <= 8_000_000) {
        while (this.cacheBytes + r.body.length > 32_000_000 && this.cache.size) {
          const oldest = this.cache.keys().next().value;
          this.cacheBytes -= this.cache.get(oldest).body.length; this.cache.delete(oldest);
        }
        if (!this.cache.has(u.href)) { this.cache.set(u.href, r); this.cacheBytes += r.body.length; }
      }
      return r;
    })();
    this.inflight.set(key, task);
    try { return await task; } finally { this.inflight.delete(key); }
  }
  async options(url) {
    const u=new URL(url);await this.allowed(u);return this.raw(u.href,0,false,'OPTIONS');
  }
  async head(url) {
    const u=new URL(url);await this.allowed(u);return this.raw(u.href,0,false,'HEAD');
  }
  async text(url) {
    const r = await this.get(url);
    if (r.status !== 200) throw Error(`HTTP ${r.status}: ${url}`);
    return r.body.toString();
  }
}
