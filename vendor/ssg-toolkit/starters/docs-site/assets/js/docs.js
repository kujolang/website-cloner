(function() {
	var input = document.getElementById('docs-search');
	var panel = document.getElementById('docs-search-results');
	var index = [];

	var render = function(items, query) {
		if (!panel) {
			return;
		}
		if (!query) {
			panel.classList.remove('is-open');
			panel.innerHTML = '';
			return;
		}
		if (!items.length) {
			panel.innerHTML = '<p class="docs-search-empty">No results found.</p>';
			panel.classList.add('is-open');
			return;
		}
		panel.textContent = '';
		items.slice(0, 8).forEach(function(item) {
			var url;
			try {
				url = new URL(item.url, location.href);
			} catch (error) {
				return;
			}
			if (url.protocol !== 'https:' && url.protocol !== 'http:') {
				return;
			}
			var link = document.createElement('a');
			var title = document.createElement('strong');
			var description = document.createElement('span');
			link.href = url.href;
			title.textContent = item.title;
			description.textContent = item.description || item.section || item.route || '';
			link.appendChild(title);
			link.appendChild(description);
			panel.appendChild(link);
		});
		panel.classList.add('is-open');
	};

	var search = function(query) {
		var q = query.trim().toLowerCase();
		if (!q) {
			return [];
		}
		return index.filter(function(item) {
			var haystack = [
				item.title,
				item.description,
				item.section,
				item.audience,
				item.difficulty,
				item.status,
				item.version,
				(item.tags || []).join(' '),
				(item.headings || []).join(' '),
				item.text
			].join(' ').toLowerCase();
			return haystack.indexOf(q) >= 0;
		});
	};

	if (input && panel) {
		fetch('/assets/js/docs-search-index.json')
			.then(function(response) { return response.ok ? response.json() : {items: []}; })
			.then(function(payload) { index = payload.items || []; })
			.catch(function() { index = []; });

		input.addEventListener('input', function() {
			render(search(input.value), input.value.trim());
		});
		input.addEventListener('keydown', function(event) {
			if (event.key === 'Escape') {
				input.value = '';
				render([], '');
			}
		});
		document.addEventListener('click', function(event) {
			if (!panel.contains(event.target) && event.target !== input) {
				panel.classList.remove('is-open');
			}
		});
	}

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
})();
