import path from 'node:path';
import { auditProject, writeAudit } from '../engine/audit.mjs';
const project=path.resolve(process.argv[2] || '');
if(!process.argv[2])throw Error('Usage: npm run audit:site -- PROJECT [REPORT_DIRECTORY] [--no-performance]');
const dir=path.resolve(process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : path.join(project,'audit'));
const report=await auditProject(project,{phase:process.env.AUDIT_PHASE || 'after',performance:!process.argv.includes('--no-performance')});
await writeAudit(report,dir);console.log(JSON.stringify({status:report.status,...report.summary,dir}));
