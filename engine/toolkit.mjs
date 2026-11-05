import {cp,readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
const root=new URL('../vendor/ssg-toolkit/',import.meta.url);
export async function exportToolkit(project){
 await mkdir(path.join(project,'tools'),{recursive:true});
 await cp(root,path.join(project,'tools/ssg'),{recursive:true});
 for(const name of ['abilities','kennel_packages','kennel.toml','kennel.lock'])await cp(new URL(name,root),path.join(project,name),{recursive:true});
 await cp(new URL('scripts/ability-inspect.py',root),path.join(project,'scripts/ability-inspect.py'));
 await cp(new URL('scripts/docgen_reduce.py',root),path.join(project,'scripts/docgen_reduce.py'));
 await mkdir(path.join(project,'tests'),{recursive:true});
 await cp(new URL('tests/ability_pack_tests.kujo',root),path.join(project,'tests/ability_pack_tests.kujo'));
 let runtime=await readFile(path.join(project,'abilities/runtime.kujo'),'utf8');
 runtime=runtime.replace('[kujo_bin, "run", "build.kujo", "--", "--site-url", site_url, "--output", output]','["node", "scripts/build.mjs", "--site-url", site_url, "--output", output]');
 await writeFile(path.join(project,'abilities/runtime.kujo'),runtime);
 await writeFile(path.join(project,'scripts/validate-generated-output.sh'),'#!/usr/bin/env bash\nset -euo pipefail\nnode scripts/site.mjs validate --output "${1:-output}"\n');
 await writeFile(path.join(project,'scripts/build-parallel.sh'),'#!/usr/bin/env bash\nset -euo pipefail\nexport SSG_WORKERS="${2:-2}"\nshift 2\nnode scripts/build.mjs "$@"\n');
 await writeFile(path.join(project,'TOOLKIT.md'),'# Native SSG toolkit\n\nPinned upstream sources, documentation, tests and the docs starter are in tools/ssg/. The root Ability adapter invokes the migration-aware build and validator; public WebMCP has no write authority. Kennel Ability 1.0.1 is vendored offline at its pinned commit. Run `npm run ssg:check` for the offline Ability contract. Use `npm run docs:import -- --target-repo /path/to/repository` to generate Markdown into this site through the native DocGen bridge, then `npm run build`. Run `npm run docs:starter -- destination` for an independent native docs starter. Advanced upstream contracts can be run from tools/ssg; install its pinned esbuild dependency before minifier tests. Upstream --watch is a documented no-op; this project provides a working `npm run dev` watcher.\n');
}
