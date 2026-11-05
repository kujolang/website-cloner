import test from 'node:test';import assert from 'node:assert/strict';
import {contentText,contentCoverage} from '../engine/content-text.mjs';
test('coverage uses semantic block boundaries rather than serialized indentation',()=>{
 const source=contentText('<h2>Drew Barton</h2><p>Founder</p><p>A <strong>better</strong> way.</p>');
 const actual=contentText('<h2>Drew Barton</h2>\n\n<p>Founder</p>\n<p>A <strong>better</strong> way.</p>');assert.equal(source,'Drew Barton Founder A better way.');assert.equal(contentCoverage(source,actual),1);
 assert.ok(contentCoverage(source,contentText('<h2>Drew Barton</h2><p>A better way.</p>'))<.98);
 assert.equal(contentCoverage('one one two','one two'),2/3);
 assert.notEqual(contentText('<p>co<strong>operate</strong></p>'),contentText('<p>co <strong>operate</strong></p>'));
});
