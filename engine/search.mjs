import {readFile} from 'node:fs/promises';import{createHash}from'node:crypto';
export const searchRuntime = await readFile(new URL('../vendor/migration-search.js',import.meta.url),'utf8');
export const searchHash = 'sha256-'+createHash('sha256').update(searchRuntime).digest('base64');
