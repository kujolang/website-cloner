#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Element {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.listeners = {};
    this.classList = {add() {}, remove() {}};
  }
  set textContent(value) { this.text = String(value); this.children = []; }
  get textContent() { return this.text || ''; }
  set innerHTML(value) {
    assert.ok(!value.includes('<img') && !value.includes('javascript:'), 'untrusted metadata reached an HTML sink');
    this.children = [];
  }
  appendChild(child) { this.children.push(child); }
  addEventListener(name, handler) { this.listeners[name] = handler; }
  contains() { return false; }
}

(async () => {
  const input = new Element('input');
  const panel = new Element('div');
  const records = [
    {title: 'Needle <img src=x onerror=alert(1)>', description: '<img src=x onerror=alert(2)>', url: '/safe/'},
    {title: 'Needle unsafe', url: 'javascript:alert(1)'},
    {title: 'Needle data', url: 'data:text/html,bad'},
    {title: 'Needle absolute', url: 'https://docs.example.test/absolute/'}
  ];
  const sourceRoot = process.env.SSG_TEST_SOURCE_ROOT || path.resolve(__dirname, '..');
  vm.runInNewContext(fs.readFileSync(path.join(sourceRoot, 'starters/docs-site/assets/js/docs.js'), 'utf8'), {
    document: {
      getElementById(id) { return id === 'docs-search' ? input : panel; },
      querySelectorAll() { return []; },
      createElement(tag) { return new Element(tag); },
      addEventListener() {}
    },
    fetch: async () => ({ok: true, json: async () => ({items: records})}),
    URL, location: {href: 'https://docs.example.test/start/'}
  });
  await new Promise(resolve => setImmediate(resolve));
  input.value = 'Needle';
  input.listeners.input();
  assert.equal(panel.children.length, 2);
  assert.equal(panel.children[0].href, 'https://docs.example.test/safe/');
  assert.equal(panel.children[0].children[0].textContent, records[0].title);
  assert.equal(panel.children[0].children[1].textContent, records[0].description);
  input.listeners.keydown({key: 'Escape'});
  assert.equal(input.value, '');
  assert.equal(panel.children.length, 0);
  console.log('Docs search runtime contract passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
