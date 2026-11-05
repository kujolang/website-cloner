// Adapted from kujolang.ai/assets/js/site.js, 2026-10-22. See brand/README.md.
  function enhanceHeroDither() {
    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    var bayer8 = [
      [0, 48, 12, 60, 3, 51, 15, 63],
      [32, 16, 44, 28, 35, 19, 47, 31],
      [8, 56, 4, 52, 11, 59, 7, 55],
      [40, 24, 36, 20, 43, 27, 39, 23],
      [2, 50, 14, 62, 1, 49, 13, 61],
      [34, 18, 46, 30, 33, 17, 45, 29],
      [10, 58, 6, 54, 9, 57, 5, 53],
      [42, 26, 38, 22, 41, 25, 37, 21]
    ];

    document.querySelectorAll('.home-hero__media, .page-hero__media, .tool-hero__media').forEach(function (media) {
      var image = media.querySelector('img');
      if (!image) return;

      var canvas = media.querySelector('[data-hero-dither]');
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.className = 'hero-dither-canvas';
        canvas.dataset.heroDither = '';
        canvas.setAttribute('aria-hidden', 'true');
        media.appendChild(canvas);
      }

      var context = canvas.getContext('2d', { willReadFrequently: true });
      var sourceCanvas = document.createElement('canvas');
      var sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });
      var sourceLuminance = null;
      var outputPixels = null;
      var frame = 0;
      var lastTick = 0;
      var resizeFrame = 0;
      var animationFrame = 0;
      var isReady = false;
      var isVisible = true;

      if (!context || !sourceContext) return;

      function sizeCanvas() {
        // The canvas is intentionally low resolution: CSS scales the ordered
        // dither back over the hero, while each animation frame touches far
        // fewer pixels and leaves the main thread available for interaction.
        var width = Math.max(1, Math.ceil(media.clientWidth / 4));
        var height = Math.max(1, Math.ceil(media.clientHeight / 4));
        canvas.width = width;
        canvas.height = height;
        sourceCanvas.width = width;
        sourceCanvas.height = height;

        var scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
        var drawWidth = image.naturalWidth * scale;
        var drawHeight = image.naturalHeight * scale;
        sourceContext.clearRect(0, 0, width, height);
        sourceContext.drawImage(image, width - drawWidth, (height - drawHeight) / 2, drawWidth, drawHeight);

        var sourcePixels = sourceContext.getImageData(0, 0, width, height).data;
        sourceLuminance = new Float32Array(width * height);
        for (var pixel = 0; pixel < sourceLuminance.length; pixel += 1) {
          var sourceIndex = pixel * 4;
          sourceLuminance[pixel] = (0.299 * sourcePixels[sourceIndex] + 0.587 * sourcePixels[sourceIndex + 1] + 0.114 * sourcePixels[sourceIndex + 2] - 128) * 1.12 + 128;
        }
        outputPixels = context.createImageData(width, height);
      }

      function drawFrame() {
        if (!sourceLuminance || !outputPixels) return;
        var width = canvas.width;
        var height = canvas.height;
        var target = outputPixels.data;
        var driftX = Math.floor(frame / 2) % 8;
        var driftY = Math.floor(frame / 3) % 8;
        var thresholdShift = reducedMotion.matches ? 0 : Math.sin(frame * 0.36) * 7;

        for (var y = 0; y < height; y += 1) {
          for (var x = 0; x < width; x += 1) {
            var pixelIndex = y * width + x;
            var targetIndex = pixelIndex * 4;
            var matrix = bayer8[(y + driftY) % 8][(x + driftX) % 8];
            var threshold = 94 + matrix * 1.88 + thresholdShift;
            var value = sourceLuminance[pixelIndex] > threshold ? 244 : 14;
            target[targetIndex] = value;
            target[targetIndex + 1] = value;
            target[targetIndex + 2] = value;
            target[targetIndex + 3] = 255;
          }
        }

        context.putImageData(outputPixels, 0, 0);
        canvas.dataset.ditherReady = 'true';
        canvas.dataset.ditherFrame = String(frame);
        frame += 1;
      }

      function stop() {
        if (!animationFrame) return;
        window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }

      function render(now) {
        animationFrame = 0;
        if (!isReady || !isVisible || document.hidden || reducedMotion.matches) return;
        if (now - lastTick >= 1000 / 4) {
          lastTick = now;
          drawFrame();
        }
        animationFrame = window.requestAnimationFrame(render);
      }

      function start() {
        if (animationFrame || !isReady || !isVisible || document.hidden || reducedMotion.matches) return;
        lastTick = 0;
        animationFrame = window.requestAnimationFrame(render);
      }

      function setup() {
        sizeCanvas();
        isReady = true;
        drawFrame();
        start();
      }

      function handleResize() {
        window.cancelAnimationFrame(resizeFrame);
        resizeFrame = window.requestAnimationFrame(function () {
          sizeCanvas();
          drawFrame();
        });
      }

      function handleVisibility() {
        if (document.hidden) stop();
        else start();
      }

      if ('IntersectionObserver' in window) {
        var visibilityObserver = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.target !== media) return;
            isVisible = entry.isIntersecting;
            if (isVisible) start();
            else stop();
          });
        });
        visibilityObserver.observe(media);
      }

      if (image.complete && image.naturalWidth) setup();
      else image.addEventListener('load', setup, { once: true });
      window.addEventListener('resize', handleResize);
      document.addEventListener('visibilitychange', handleVisibility);
      reducedMotion.addEventListener('change', function () {
        drawFrame();
        if (reducedMotion.matches) stop();
        else start();
      });
    });
  }


enhanceHeroDither();
