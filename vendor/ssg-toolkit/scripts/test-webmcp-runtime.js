#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const runtimePath = process.argv[2];
const indexPath = process.argv[3];
if (!runtimePath || !indexPath) throw new Error('usage: test-webmcp-runtime.js <runtime> <index>');

const source = fs.readFileSync(runtimePath, 'utf8');
const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

async function load(data, supported = true) {
	const tools = [];
	let fetches = 0;
	let registrationSignal;
	const context = {
		AbortController,
		AbortSignal,
		URL,
		Error,
		Promise,
		Array,
		Object,
		String,
		Number,
		JSON,
		location: {origin: 'https://example.test', href: 'https://example.test/docs/'},
		addEventListener() {},
		fetch: async (_url, options) => {
			fetches += 1;
			if (options.signal?.aborted) throw options.signal.reason;
			return {ok: true, json: async () => data};
		},
		document: {
			modelContext: supported ? {
				registerTool: async (tool, options) => {
					tools.push(tool);
					registrationSignal = options.signal;
				}
			} : undefined,
			currentScript: {dataset: {kujoSiteIndex: '.well-known/kujo-site-index.json'}},
			baseURI: 'https://example.test/docs/'
		}
	};
	vm.runInNewContext(source, context, {filename: runtimePath});
	await new Promise(resolve => setImmediate(resolve));
	return {tools, fetches: () => fetches, registrationSignal};
}

(async () => {
	const unsupported = await load(index, false);
	assert.equal(unsupported.tools.length, 0);
	assert.equal(unsupported.fetches(), 0);

	const loaded = await load(index);
	assert.deepEqual(loaded.tools.map(tool => tool.name), [
		'get_site_info', 'search_site', 'list_content', 'get_content'
	]);
	assert.ok(loaded.registrationSignal instanceof AbortSignal);
	for (const tool of loaded.tools) {
		assert.equal(tool.annotations.readOnlyHint, true);
		assert.equal(tool.annotations.untrustedContentHint, true);
		assert.equal(tool.inputSchema.additionalProperties, false);
	}
	assert.equal(loaded.fetches(), 0, 'index must be lazy-loaded');

	const byName = Object.fromEntries(loaded.tools.map(tool => [tool.name, tool]));
	const info = await byName.get_site_info.execute({});
	assert.equal(info.schema, 'kujo-ssg-site-index/v1');
	assert.equal(loaded.fetches(), 1);

	const searchable = index.items.find(item => item.searchable);
	const search = await byName.search_site.execute({query: searchable.title, limit: 10});
	assert.equal(search.results[0].id, searchable.id);
	assert.ok(search.results.length <= 10);
	assert.equal(loaded.fetches(), 1, 'index must be cached in memory');

	const type = index.content_types.find(entry => entry.count > 0);
	const listed = await byName.list_content.execute({type: type.name, limit: 1});
	assert.equal(listed.type, type.name);
	assert.ok(listed.items.length <= 1);

	const exact = await byName.get_content.execute({id: searchable.id});
	assert.equal(exact.id, searchable.id);
	assert.ok(exact.summary.length <= 600);
	await assert.rejects(() => byName.get_content.execute({id: searchable.id, url: searchable.url}), /exactly one/);
	await assert.rejects(() => byName.get_content.execute({id: 'missing:record'}), /not found/);
	await assert.rejects(() => byName.list_content.execute({}), /type is required/);
	await assert.rejects(() => byName.list_content.execute({type: 'unknown'}), /unknown content type/);
	await assert.rejects(() => byName.search_site.execute({query: 'x', limit: 11}), /limit/);
	await assert.rejects(() => byName.search_site.execute({query: 'x', surprise: true}), /unknown argument/);
	const excluded = index.items.find(item => item.searchable === false);
	if (excluded) {
		const excludedSearch = await byName.search_site.execute({query: excluded.title, limit: 10});
		assert.ok(!excludedSearch.results.some(item => item.id === excluded.id));
		assert.equal((await byName.get_content.execute({id: excluded.id})).id, excluded.id);
		const excludedList = await byName.list_content.execute({type: excluded.type, limit: 10});
		assert.ok(excludedList.items.some(item => item.id === excluded.id));
	}
	const taxonomyType = index.content_types.find(entry => entry.taxonomies?.length);
	if (taxonomyType) {
		const taxonomyItem = index.items.find(item => item.type === taxonomyType.name && Object.keys(item.taxonomies || {}).length);
		const taxonomyName = Object.keys(taxonomyItem.taxonomies)[0];
		const taxonomyList = await byName.list_content.execute({type: taxonomyType.name, taxonomy: {[taxonomyName]: [taxonomyItem.taxonomies[taxonomyName][0]]}, limit: 10});
		assert.ok(taxonomyList.items.some(item => item.id === taxonomyItem.id));
	}

	const malformed = await load({...index, schema: 'unsupported/v9'});
	await assert.rejects(() => malformed.tools[0].execute({}), /unsupported or malformed/);
	const cancelled = await load(index);
	const controller = new AbortController();
	controller.abort();
	await assert.rejects(() => cancelled.tools[0].execute({}, {signal: controller.signal}), /Abort/);

	console.log('WebMCP runtime unit tests passed');
})().catch(error => {
	console.error(error);
	process.exit(1);
});
