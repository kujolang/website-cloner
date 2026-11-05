import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const baseNavigationRuntime=(await readFile(new URL('../vendor/migration-navigation.js',import.meta.url),'utf8'))+'\n'+(await readFile(new URL('../vendor/migration-accessibility.js',import.meta.url),'utf8'));
export const navigationRuntime=baseNavigationRuntime;
export const navigationHash='sha256-'+createHash('sha256').update(navigationRuntime).digest('base64');
