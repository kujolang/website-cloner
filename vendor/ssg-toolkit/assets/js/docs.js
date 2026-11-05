(function() {
	document.querySelectorAll('.docs-body h2, .docs-body h3').forEach(function(heading) {
		if (heading.id) {
			return;
		}
		var slug = heading.textContent.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
		var candidate = slug;
		var count = 2;
		while (document.getElementById(candidate)) {
			candidate = slug + '-' + count;
			count += 1;
		}
		heading.id = candidate;
	});

	document.querySelectorAll('pre').forEach(function(block) {
		var button = document.createElement('button');
		button.type = 'button';
		button.className = 'copy-code-button';
		button.textContent = 'Copy';
		button.addEventListener('click', function() {
			navigator.clipboard.writeText(block.innerText).then(function() {
				button.textContent = 'Copied';
				window.setTimeout(function() { button.textContent = 'Copy'; }, 1200);
			});
		});
		block.appendChild(button);
	});
})();
