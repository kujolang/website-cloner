import {createHash} from 'node:crypto';
const name=value=>String(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export const taxonomyName = type => type === 'category' ? 'categories' : type === 'post_tag' ? 'tags' : 'wp' + name(type).replaceAll('-', '') + (/^[a-z0-9]+$/.test(type) ? '' : createHash('sha256').update(type).digest('hex').slice(0,8));
