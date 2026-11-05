(()=>{
 const $=s=>document.querySelector(s);let build=null,generation=0,revision=0;
 const text=(tag,value)=>{const el=document.createElement(tag);el.textContent=value;return el;};
 async function api(url,body){const response=await fetch(url,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const result=await response.json();if(!response.ok)throw Error(result.error||'Compatibility request failed');return result;}
 async function refresh(){
  if(!build)return;const current=++generation;$('#compatibility-status').textContent='Loading compatibility report...';$('#compatibility-forms').replaceChildren();$('#compatibility-rebuild').hidden=true;
  try{
   const report=await api(`/api/jobs/${build}/compatibility`);if(current!==generation)return;revision=report.revision;
   $('#compatibility-status').textContent=report.pendingConfiguration?'Settings saved. Rebuild to apply them.':report.available?'Compatibility report loaded.':'This older build has no platform inventory. Rebuild from cache to create it.';
   $('#compatibility-rebuild').hidden=!report.pendingConfiguration;
   const plugins=$('#compatibility-plugins');plugins.replaceChildren(text('h3','Detected plugins'));
   if(!report.plugins.length)plugins.append(text('p','No plugins identified from the available public evidence.'));
   for(const p of report.plugins){const row=document.createElement('article');row.append(text('strong',p.name),text('p',`${p.routeCount} captured pages · ${p.status==='unverified'?'Compatibility not fully verified':p.status}`));if(p.requiredConnection)row.append(text('p',p.requiredConnection));if(p.limitation)row.append(text('p',p.limitation));plugins.append(row);}
   const components=$('#compatibility-components');components.replaceChildren(text('h3','Selected local components'));for(const c of report.components)components.append(text('p',`${c.id}: ${c.pages} pages · ${c.bytesPerPage} bytes per matching page. Selection is not an interaction test.`));if(!report.components.length)components.append(text('p','No component selection report available.'));
   const seo=$('#compatibility-seo');seo.replaceChildren(text('h3','SEO preservation advisories'));for(const issue of report.seoIssues)seo.append(text('p',`${issue.kind.replaceAll('-',' ')}: ${issue.count} occurrences across ${issue.routes.length} pages.`));if(!report.seoIssues.length)seo.append(text('p','No preservation advisories recorded. This is not a complete SEO audit.'));
   if(report.redirects)seo.append(text('h3','Redirect export'),text('p',`${report.redirects.httpRules} Cloudflare HTTP rules · ${report.redirects.staticFallbacks} static navigation fallbacks · ${report.redirects.issues} advisories. GitHub Pages fallbacks do not preserve HTTP status. See redirect-report.json for details.`));
   if(report.redirectImport){
    const form=document.createElement('form');form.className='compatibility-form';
    const label=text('label','Redirection JSON export');label.htmlFor='redirect-import-file';
    const file=document.createElement('input');file.id='redirect-import-file';file.type='file';file.accept='.json,application/json';file.required=true;
    const button=text('button','Import redirect rules');button.type='submit';const message=text('p','');message.setAttribute('role','status');
    form.append(label,file,text('p',`${report.redirectImport.count} saved rules. Import replaces the previous rule file. Rebuild to apply; unsupported rules are reported, not simulated.`),button,message);seo.append(form);
    form.addEventListener('submit',async event=>{event.preventDefault();button.disabled=true;const target=build;try{const data=JSON.parse(await file.files[0].text());await api(`/api/jobs/${target}/redirects`,{data,fingerprint:report.redirectImport.fingerprint});if(build===target)await refresh();}catch(error){message.textContent=error.message;}finally{button.disabled=false;}});
   }
   const forms=$('#compatibility-forms');forms.replaceChildren(text('h3','Form delivery'));
   if(!report.forms.length)forms.append(text('p','No submission forms identified.'));
   for(const item of report.forms){
    const form=document.createElement('form');form.className='compatibility-form';form.append(text('h4',`${item.provider} · ${item.route}`),text('p',`Last build: ${item.status.replaceAll('-',' ')}`));
    if(item.status==='requires-commerce-connection'){form.append(text('p','Cart and checkout need a commerce integration. A generic form delivery endpoint cannot process purchases.'));forms.append(form);continue;}
    const id='delivery-'+item.id,label=text('label','Delivery endpoint');label.htmlFor=id;const input=document.createElement('input');input.id=id;input.type='text';input.value=item.delivery?.endpoint||'';input.placeholder='https://your-service.example/contact or /api/contact';input.maxLength=2048;input.autocomplete='off';
    const formatLabel=text('label','Submission format'),select=document.createElement('select');select.id=id+'-format';formatLabel.htmlFor=select.id;for(const [value,name]of [['multipart','Multipart (supports files)'],['json','JSON (text fields)']]){const option=text('option',name);option.value=value;select.append(option);}select.value=item.delivery?.format||'multipart';
    const button=text('button','Save form settings');button.type='submit';const message=text('p','');message.setAttribute('role','status');
    form.append(label,input,formatLabel,select,text('p','Use a public submission endpoint, never a private API key. The service must return JSON {"ok":true} with a successful HTTP status. Leave blank to disconnect.'),button,message);
    form.addEventListener('submit',async event=>{event.preventDefault();button.disabled=true;const target=build;try{await api(`/api/jobs/${target}/forms`,{id:item.id,endpoint:input.value.trim()||null,format:select.value,revision});if(build===target)await refresh();}catch(error){message.textContent=error.message;}finally{button.disabled=false;}});forms.append(form);
   }
  }catch(error){if(current===generation)$('#compatibility-status').textContent=error.message;}
 }
 $('#compatibility-rebuild').addEventListener('click',async()=>{const button=$('#compatibility-rebuild');button.disabled=true;try{await api(`/api/jobs/${build}/rebuild`,{retryAssets:false});location.href='/?job='+build;}catch(error){$('#compatibility-status').textContent=error.message;}finally{button.disabled=false;}});
 document.addEventListener('hosting-build',event=>{build=event.detail.id;refresh();});
})();
