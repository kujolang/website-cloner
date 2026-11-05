import test from 'node:test';import assert from 'node:assert/strict';import {htmlMetadata} from '../engine/html-metadata.mjs';
test('single article metadata comes from explicit source fields',()=>{
 const m=htmlMetadata('<body class="single-post"><time datetime="2026-10-21">Today</time><a rel="author">Jane</a><div class="wp-block-post-terms taxonomy-category"><a>News</a></div><a rel="tag">Release</a></body>');assert.deepEqual(m,{documentTypes:[],date:'2026-10-21',author:'Jane',categories:['News'],tags:['Release']});
 assert.equal(htmlMetadata('<body><article><time datetime="2020-01-01">Old article</time><a rel="author">Someone</a></article></body>').date,'');
});

test('primary structured types exclude related articles on another URL',()=>{
 const html='<script type="application/ld+json">'+JSON.stringify({'@graph':[{'@type':'WebPage',url:'https://example.com/shop/widget/'},{'@type':'Product',url:'https://example.com/shop/widget/'},{'@type':'BlogPosting',url:'https://example.com/blog/related/'}]})+'</script>';
 assert.deepEqual(htmlMetadata(html,'https://example.com/shop/widget/').documentTypes,['Product']);
});
