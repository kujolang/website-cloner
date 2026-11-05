import {build} from 'esbuild';
const result=await build({metafile:true,entryPoints:['scripts/source-project.mjs'],bundle:true,platform:'node',target:'node22',format:'esm',outfile:'vendor/export-source.mjs',legalComments:'eof',banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"}});

const {readFile,writeFile}=await import('node:fs/promises');
const packages=[...new Set(Object.keys(result.metafile.inputs).filter(p=>p.includes('node_modules/')).map(p=>p.split('node_modules/')[1].split('/')[0]))].sort();
let licenses='Bundled export runtime dependencies (built with esbuild 0.28.2).\n';
for(const name of packages){const p=JSON.parse(await readFile('node_modules/'+name+'/package.json','utf8'));licenses+='\n## '+name+' '+p.version+' ('+p.license+')\n';for(const file of ['LICENSE','LICENSE.md','LICENSE.txt']){try{licenses+=await readFile('node_modules/'+name+'/'+file,'utf8');break;}catch(e){if(e.code!=='ENOENT')throw e;}}}
licenses+='\n## PhotoSwipe 4.1.3 (MIT), selectively included gallery renderer\n'+await readFile('vendor/PHOTOSWIPE-LICENSE','utf8');
await writeFile('vendor/EXPORT-DEPENDENCIES.txt',licenses);

await build({entryPoints:['scripts/calendar-runtime.mjs'],bundle:true,platform:'browser',target:'es2022',format:'iife',outfile:'scripts/component-calendar.js',legalComments:'eof'});
