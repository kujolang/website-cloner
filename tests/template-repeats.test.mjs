import test from 'node:test';import assert from 'node:assert/strict';import {shareRepeats} from '../engine/template-repeats.mjs';
test('variable-length rows use the same editable repeat template and scalar data',()=>{
 const data={layout_values:{value1:'One',value2:'Two'},layout_attributes:{attrs0:{class:'rows'},attrs1:{class:'first'},attrs2:{class:'second'}}};
 const one=shareRepeats('<ul MIGRATION_ATTRIBUTES_attrs0_END><li MIGRATION_ATTRIBUTES_attrs1_END>MIGRATION_VALUE_layout_values.value1_END</li></ul>',structuredClone(data));
 const two=shareRepeats('<ul MIGRATION_ATTRIBUTES_attrs0_END><li MIGRATION_ATTRIBUTES_attrs1_END>MIGRATION_VALUE_layout_values.value1_END</li><li MIGRATION_ATTRIBUTES_attrs2_END>MIGRATION_VALUE_layout_values.value2_END</li></ul>',structuredClone(data));
 assert.equal(one.html,two.html);assert.equal(one.templates.size,1);assert.equal(two.templates.size,1);assert.equal(Object.values(two.layout_repeats)[0].items.length,2);assert.equal(Object.values(two.layout_repeats)[0].items[1].layout_values.value1,'Two');
});
test('inline presentation markup leaves code examples literal',async()=>{
 const {protectInlineMarkup}=await import('../scripts/source-project.mjs');const map=new Map();
 const source='Text <span class="red">red</span> `literal <span>`\n```html\n<span>code</span>\n```';const result=protectInlineMarkup(source,map);
 const restored=result.replace(/MIGRATIONINLINE[a-f0-9]+END/g,key=>map.get(key));
 assert.ok(restored.includes('<code>literal &lt;span&gt;</code>'));assert.ok(restored.includes('Text <span class="red">red</span>'));
 assert.ok(result.includes('```html\n<span>code</span>\n```'));
});
