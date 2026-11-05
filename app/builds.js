const buildList = document.querySelector('#build-list');
const buildMessage = document.querySelector('#build-message');
const refreshBuilds = document.querySelector('#refresh-builds');
const formatBytes = bytes => `${(bytes / 1024 ** 3).toFixed(2)} GiB`;
function buildLink(label, href, icon) {
  const a = document.createElement('a'); a.textContent = label; a.href = href; a.className = 'button build-action';
  if (icon) {const img = document.createElement('img'); img.className='ui-icon'; img.src=`/icons/${icon}.svg`; img.alt=''; a.prepend(img);}
  return a;
}
async function loadBuilds() {
  refreshBuilds.disabled = true; buildMessage.textContent = 'Checking saved builds…';
  try {
    const response = await fetch('/api/jobs'); const data = await response.json();
    if (!response.ok) throw Error(data.error);
    document.querySelector('#build-storage').textContent = `${data.builds.length} saved builds · ${formatBytes(data.builds.reduce((sum,b)=>sum+b.sizeBytes,0))} of files · ${formatBytes(data.freeBytes)} disk space available`;
    buildList.replaceChildren();
    for (const build of data.builds) {
      const row = document.createElement('article'); row.className='saved-build';
      const title = document.createElement('h3'); title.textContent=build.url;
      const details = document.createElement('p'); details.className='fine';
      const date = build.createdAt ? new Date(build.createdAt).toLocaleString() : 'Date unavailable';
      details.textContent=`${build.status} · ${date} · ${formatBytes(build.sizeBytes)}${build.quality ? ` · ${build.quality}` : ''}`;
      if(build.timing) {const minutes=Math.floor(build.timing.workMs/60000);details.textContent+=` · Work: ${minutes}m ${Math.floor(build.timing.workMs/1000)%60}s · Waiting: ${Math.floor(build.timing.waitMs/60000)}m`;}
      const actions=document.createElement('div'); actions.className='build-actions';
      const view = buildLink('View build',`/?job=${build.id}`,'device-desktop'); view.classList.add('secondary');
      if(build.hasPreview) {
        const a=buildLink('Preview',build.preview,'eye'); a.target='_blank'; a.rel='noopener';
        actions.append(a);
      }
      if(build.hasDownload) {
        const download = buildLink('Download ZIP',`/api/jobs/${build.id}/download`,'download'); download.classList.add('secondary'); actions.append(download);
      }
      actions.append(view);
      const remove=document.createElement('button'); remove.type='button';remove.className='secondary build-action build-delete';remove.textContent='Delete build';remove.disabled=!build.canDelete;
      const trash = document.createElement('span'); trash.className='ui-icon delete-icon'; trash.setAttribute('aria-hidden','true');
      const deleteLabel = document.createElement('span'); deleteLabel.textContent='Delete build'; remove.replaceChildren(trash,deleteLabel);
      remove.setAttribute('aria-label',`Delete build for ${build.url}`);
      if(!build.canDelete)remove.title='Running or queued builds cannot be deleted';
      remove.addEventListener('click',async()=>{
        if(!confirm(`Permanently delete ${build.url} (${date})? This removes its preview, downloaded assets, editable source, and ZIP. It cannot be undone.`))return;
        remove.disabled=true;deleteLabel.textContent='Deleting…';
        try{const r=await fetch(`/api/jobs/${build.id}`,{method:'DELETE'});const result=await r.json();if(!r.ok)throw Error(result.error);
          if(new URL(location.href).searchParams.get('job')===build.id){location.href='/';return;}
          await loadBuilds();buildMessage.textContent='Build deleted. Disk space is available for another migration.';
        }catch(error){buildMessage.textContent=error.message;remove.disabled=false;deleteLabel.textContent='Delete build';}
      });
      actions.append(remove);row.append(title,details,actions);buildList.append(row);
    }
    buildMessage.textContent=data.builds.length ? '' : 'No saved builds yet. Start a migration above.';
  }catch(error){buildMessage.textContent=`Unable to load builds: ${error.message}`;}
  finally{refreshBuilds.disabled=false;}
}
refreshBuilds.addEventListener('click',loadBuilds);
document.addEventListener('builds-changed',loadBuilds);
loadBuilds();
