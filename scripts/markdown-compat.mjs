import {createHash} from 'node:crypto';
const marker=body=>'MIGRATION_HEADING_'+createHash('sha256').update(body).digest('hex').slice(0,20)+'_';
// Current Kujo renders ATX levels 1–3. Encode only real level 4–6 headings
// through level 3, then restore their level after native inline rendering.
export function nativeMarkdownInput(records){return records.map(record=>{
 let fence=null;const token=marker(record.body);
 const body=record.body.split('\n').map(line=>{
  const delimiter=/^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
  if(delimiter){if(!fence)fence={char:delimiter[1][0],length:delimiter[1].length};else if(delimiter[1][0]===fence.char&&delimiter[1].length>=fence.length&&!delimiter[2].trim())fence=null;return line;}
  if(fence)return line;
  return line.replace(/^ {0,3}(#{4,6})(?:[ \t]+|$)/,(_,hashes)=>'### '+token+hashes.length+' ');
 }).join('\n');return {...record,body};
});}
export function restoreNativeHeadings(rendered,records){for(const record of records){const token=marker(record.body);if(typeof rendered[record.id]==='string')rendered[record.id]=rendered[record.id].replace(new RegExp('<h3>'+token+'([456]) ([\\s\\S]*?)</h3>','g'),(_,level,content)=>`<h${level}>${content}</h${level}>`);}return rendered;}
