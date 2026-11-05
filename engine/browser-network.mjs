import http from 'node:http';
import net from 'node:net';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {SafeNetwork} from './network.mjs';
import {DownloadQueue} from './download-queue.mjs';

export function captureTransport(value='http') {
  if(!['http','browser'].includes(value))throw Error('Capture transport must be http or browser');
  return value;
}
export const browserAttention = message => Object.assign(Error(message),{code:'BROWSER_ATTENTION'});

// Chromium uses its own TLS and session. This proxy only tunnels HTTPS; it
// validates and pins the destination address without inspecting TLS or cookies.
export async function publicBrowserProxy(network) {
  const sockets=new Set();
  const server=http.createServer(async(req,res)=>{
    try {
      if(!['GET','HEAD','OPTIONS'].includes(req.method))throw Error('Read-only browser session');
      const u=new URL(req.url);
      if(u.protocol!=='http:')throw Error('Invalid proxy request');
      const address=await network.address(u);
      const headers={...req.headers};delete headers['proxy-authorization'];delete headers['proxy-connection'];
      const upstream=http.request(u,{method:req.method,headers,agent:false,lookup:(_host,opts,cb)=>opts.all?cb(null,[address]):cb(null,address.address,address.family)},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res);});
      upstream.setTimeout(30000,()=>upstream.destroy());upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end();});
      req.pipe(upstream);
    }catch{res.writeHead(403);res.end('Destination or method blocked');}
  });
  server.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});
  server.on('connect',async(req,client,head)=>{
    try {
      const u=new URL('https://'+req.url),address=await network.address(u);
      if(u.pathname!=='/'||u.search||u.hash)throw Error('Invalid tunnel');
      const upstream=net.connect({host:address.address,port:Number(u.port)||443});
      sockets.add(upstream);upstream.on('close',()=>sockets.delete(upstream));
      upstream.setTimeout(60000,()=>upstream.destroy());
      upstream.on('error',()=>client.destroy());client.on('error',()=>upstream.destroy());client.on('close',()=>upstream.destroy());
      upstream.once('connect',()=>{client.write('HTTP/1.1 200 Connection Established\r\n\r\n');if(head.length)upstream.write(head);client.pipe(upstream);upstream.pipe(client);});
    }catch{client.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {url:'http://127.0.0.1:'+server.address().port,async close(){for(const s of sockets)s.destroy();await new Promise(r=>server.close(r));}};
}

export class BrowserNetwork extends SafeNetwork {
  constructor(options={}) {
    super({...options,concurrency:2,perHost:1});
    this.event=options.event||(()=>{});this.confirm=options.confirm;
    this.headless=options.headless??false;this.modes=new WeakMap();this.browserCapture=true;this.resourceQueue=new DownloadQueue({concurrency:4,perHost:2});
  }
  async initialize(source) {
    this.source=new URL(source);this.sourceOrigin=this.source.origin;await this.address(this.source);
    this.temp=await mkdtemp(path.join(os.tmpdir(),'cloner-browser-'));
    this.proxy=await publicBrowserProxy(this);
    try {
      this.browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:this.headless,proxy:{server:this.proxy.url},args:['--proxy-bypass-list=<-loopback>','--disable-quic','--force-webrtc-ip-handling-policy=disable_non_proxied_udp']});
      this.context=await this.browser.newContext({acceptDownloads:true,serviceWorkers:'block',viewport:{width:1440,height:1000}});
      await this.context.routeWebSocket('**/*',ws=>ws.close());
      this.context.on('page',page=>{setTimeout(()=>{if(!this.modes.has(page))page.close().catch(()=>{});},1000);});
      this.page=await this.newPage({bootstrap:true});
      await this.page.goto(source,{waitUntil:'domcontentloaded',timeout:30000}).catch(error=>{if(!this.page.url().startsWith(this.source.origin))throw error;});
      if(!this.confirm)throw browserAttention('Browser capture needs an interactive confirmation. Use the builder and continue after reviewing the source browser window.');
      this.event('Browser needs your review — handle any site prompts, then click Continue browser capture',{browserWaiting:true,browserReview:{title:await this.page.title(),origin:new URL(this.page.url()).origin,prompts:await this.page.locator('[role=dialog]:visible,.swal2-popup:visible').allTextContents().then(items=>items.map(text=>text.trim().slice(0,180)))}});
      let disconnected;
      try{await Promise.race([this.confirm(),new Promise((_,reject)=>{disconnected=()=>reject(browserAttention('Source browser was closed. Resume to open a new isolated session.'));this.browser.once('disconnected',disconnected);})]);}
      finally{this.browser.off('disconnected',disconnected);}
      this.event('Checking browser crawl permission',{browserWaiting:false});
      // Confirmation is not crawl permission. Fetch and enforce the actual rules.
      await this.allowed(this.source);
      Object.assign(this.modes.get(this.page),{bootstrap:false,capture:true});
    }catch(error){await this.close();throw error;}
  }
  async newPage(mode) {
    const page=await this.context.newPage();this.modes.set(page,mode);
    const session=await this.context.newCDPSession(page);
    const tree=await session.send('Page.getFrameTree');
    mode.pending=new Map();mode.sizes=new Map();mode.receivedBytes=0;
    const finish=id=>{mode.pending.get(id)?.();mode.pending.delete(id);mode.sizes.delete(id);};
    session.on('Network.loadingFinished',e=>finish(e.requestId));
    session.on('Network.loadingFailed',e=>finish(e.requestId));
    page.on('close',()=>{for(const resolve of mode.pending.values())resolve();mode.pending.clear();});
    session.on('Network.dataReceived',e=>{
      const size=(mode.sizes.get(e.requestId)||0)+e.dataLength;mode.sizes.set(e.requestId,size);
      this.bytes+=e.dataLength;mode.receivedBytes+=e.dataLength;
      if(size>(mode.maxFile||this.maxFile)||this.bytes>this.maxBytes){
        mode.error=Object.assign(Error('Browser download size limit exceeded'),{code:size>(mode.maxFile||this.maxFile)?'FILE_SIZE_LIMIT':'CRAWL_BUDGET'});
        if(!mode.raw)this.outage=mode.error;
        session.send('Page.stopLoading').catch(()=>{});
      }
    });
    session.on('Network.responseReceived',e=>{
      if(mode.raw||mode.bootstrap)return;
      const headers=Object.fromEntries(Object.entries(e.response.headers).map(([k,v])=>[k.toLowerCase(),v]));
      if(headers['x-amzn-waf-action']||headers['cf-mitigated']==='challenge'||[401,403,429,503].includes(e.response.status)){
        this.failResource(e.response.url,browserAttention(`Browser resource denied access (HTTP ${e.response.status}): ${new URL(e.response.url).origin}${new URL(e.response.url).pathname}`));
        if(this.outage)session.send('Page.stopLoading').catch(()=>{});
      }
    });
    await session.send('Network.enable');
    session.on('Fetch.requestPaused',request=>this.guard(session,page,tree.frameTree.frame.id,request));
    await session.send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
    return page;
  }
  async guard(session,page,mainFrame,paused) {
    const mode=this.modes.get(page),request=paused.request;
    try {
      const u=new URL(request.url);await this.address(u);
      if(!['GET','HEAD','OPTIONS'].includes(request.method))throw Error('Source writes blocked');
      if(!mode)throw Error('Unexpected browser window');
      if(mode.raw){
        if(paused.resourceType!=='Document'||paused.frameId!==mainFrame)return await session.send('Fetch.failRequest',{requestId:paused.requestId,errorReason:'BlockedByClient'});
        mode.hops=(mode.hops??-1)+1;
        if(mode.hops>4)throw Error('Redirect limit exceeded');
        if(mode.hops&&!mode.robots)await this.allowed(u);
      }else if(mode.bootstrap){
        if(paused.resourceType==='Document'&&paused.frameId===mainFrame&&u.origin!==this.source.origin)throw Error('Source review must remain on the requested origin');
      }else await this.allowed(u);
      if(!mode.raw){
        if(++this.requests>this.maxRequests||Date.now()-this.started>this.maxDurationMs)throw Error('Browser request budget exhausted');
        this.checkAvailability(u);
      }
      const proceed=()=>session.send('Fetch.continueRequest',{requestId:paused.requestId});
      if(mode.raw||mode.pending.has(paused.networkId))await proceed();
      else await this.resourceQueue.run(u.origin,async()=>{
        const delay=Number(this.robots.get(u.origin)?.getCrawlDelay('WebsiteReturn/0.1'))||0;
        if(delay){const at=Math.max(Date.now(),this.nextRequest.get(u.origin)||0);this.nextRequest.set(u.origin,at+delay*1000);await new Promise(r=>setTimeout(r,Math.max(0,at-Date.now())));}
        const finished=new Promise(resolve=>{if(paused.networkId)mode.pending.set(paused.networkId,resolve);else resolve();});
        try{await proceed();await finished;}finally{mode.pending.get(paused.networkId)?.();mode.pending.delete(paused.networkId);}
      });
    }catch(error){if(mode?.raw)mode.error=error;await session.send('Fetch.failRequest',{requestId:paused.requestId,errorReason:'BlockedByClient'}).catch(()=>{});}
  }
  async rawAttempt(url,redirects,robotsRequest,method,maxFile) {
    if(method!=='GET') {
      // Optional API probes are not implemented by pretending GET is OPTIONS.
      return {status:405,headers:{},body:Buffer.alloc(0),url};
    }
    if(++this.requests>this.maxRequests||Date.now()-this.started>this.maxDurationMs)throw Object.assign(Error('Crawl request/time budget exhausted'),{code:'CRAWL_BUDGET'});
    const u=new URL(url);await this.address(u);
    return this.queue.run(u.origin,async()=>{
      this.checkAvailability(u);
      const delay=Number(this.robots.get(u.origin)?.getCrawlDelay('WebsiteReturn/0.1'))||0;
      if(!robotsRequest&&delay){const at=Math.max(Date.now(),this.nextRequest.get(u.origin)||0);this.nextRequest.set(u.origin,at+delay*1000);await new Promise(r=>setTimeout(r,Math.max(0,at-Date.now())));}
      const mode={raw:true,robots:robotsRequest,maxFile},page=await this.newPage(mode);
      let response,download,downloadFile;
      page.on('response',r=>{if(r.request().isNavigationRequest())response=r;});
      const downloaded=new Promise(resolve=>page.once('download',d=>{download=d;resolve(d);}));
      try {
        try{await page.goto(url,{waitUntil:'domcontentloaded',timeout:this.requestDeadlineMs});}
        catch(error){if(mode.error)throw mode.error;if(!/Download is starting/i.test(error.message))throw error;await downloaded;}
        if(!response)throw Error('Browser returned no response');
        const headers=await response.allHeaders(),status=response.status();
        if(headers['x-amzn-waf-action']||headers['cf-mitigated']==='challenge'||[401,403,429,503].includes(status)) {
          const failure=browserAttention(`Browser access needs attention (HTTP ${status}) for ${u.origin}${u.pathname}. No protection was bypassed. Resume only after access is available.`);
          throw this.failResource(response.url(),failure);
        }
        if(Number(headers['content-length'])>maxFile)throw Object.assign(Error('Download size limit exceeded'),{code:'FILE_SIZE_LIMIT'});
        let body;
        if(download){downloadFile=path.join(this.temp,'download-'+Date.now()+'-'+Math.random().toString(16).slice(2));await download.saveAs(downloadFile);body=await readFile(downloadFile);}
        else body=await response.body();
        if(mode.error)throw mode.error;
        if(robotsRequest&&/^\s*(?:<!doctype\s+html|<html)/i.test(body.toString('utf8')))throw this.failResource(response.url(),browserAttention('Browser received an HTML page instead of robots rules. Review source access before resuming.'));
        this.bytes+=Math.max(0,body.length-mode.receivedBytes);
        if(body.length>maxFile||this.bytes>this.maxBytes)throw Object.assign(Error('Download size limit exceeded'),{code:body.length>maxFile?'FILE_SIZE_LIMIT':'CRAWL_BUDGET'});
        // Never persist cookies, auth headers or session state in cache/export.
        const safeHeaders=Object.fromEntries(['content-type','content-length','location','link','x-wp-totalpages','x-wp-total'].filter(k=>headers[k]!=null).map(k=>[k,headers[k]]));
        return {status,headers:safeHeaders,body,url:response.url()};
      }finally{await download?.cancel().catch(()=>{});await page.close();if(downloadFile)await rm(downloadFile,{force:true});}
    });
  }
  async captureContext() {
    const context=this.context,pages=[];
    return {newPage:async()=>{const page=await this.newPage({capture:true});pages.push(page);return page;},close:async()=>{await Promise.all(pages.map(page=>page.close()));}};
  }
  async close(){await this.browser?.close().catch(()=>{});if(this.proxy){const proxy=this.proxy;this.proxy=null;await proxy.close();}if(this.temp)await rm(this.temp,{recursive:true,force:true});}
}
