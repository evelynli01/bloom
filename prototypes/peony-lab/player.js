/* No dependencies or network services. Works from file:// or a static server. */
(() => {
  'use strict';
  const config = window.PEONY_SEQUENCE;
  const $ = id => document.getElementById(id);
  const canvas = $('flower'), ctx = canvas.getContext('2d');
  const range = $('progress'), output = $('amount'), loading = $('loading');
  const controls = ['open', 'close', 'pause', 'previous', 'next', 'loop', 'speed', 'progress'];
  const images = new Array(config.count);
  let progress = 0, direction = 0, lastDirection = 1, loop = false;
  let ready = false, lastTime = 0, rendered = -1, animation = 0, loaded = 0;
  canvas.width = config.width; canvas.height = config.height;
  function show(value) {
    progress = Math.max(0, Math.min(1, value));
    const index = Math.round(progress * (config.count - 1));
    range.value = String(progress * 100);
    output.value = `${Math.round(progress * 100)}%`;
    $('frame').textContent = `Frame ${index + 1} / ${config.count}`;
    if (images[index] && rendered !== index) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(images[index], 0, 0, canvas.width, canvas.height);
      rendered = index;
      canvas.setAttribute('aria-label', `Pink peony at ${Math.round(progress * 100)} percent bloom`);
    }
  }
  function playback(value) {
    direction = value;
    if (value) lastDirection = value;
    $('open').setAttribute('aria-pressed', String(value === 1));
    $('close').setAttribute('aria-pressed', String(value === -1));
    $('pause').setAttribute('aria-pressed', String(value === 0));
    cancelAnimationFrame(animation); animation = 0; lastTime = 0;
    if (direction && ready) animation = requestAnimationFrame(tick);
  }
  function tick(time) {
    if (!direction) return;
    const dt = lastTime ? Math.min((time - lastTime) / 1000, .1) : 0;
    lastTime = time;
    show(progress + direction * dt * Number($('speed').value) / config.duration);
    if ((progress >= 1 && direction > 0) || (progress <= 0 && direction < 0)) {
      if (loop) { playback(-direction); return; }
      playback(0); return;
    }
    animation = requestAnimationFrame(tick);
  }
  function step(delta) {
    playback(0);
    show((Math.round(progress * (config.count - 1)) + delta) / (config.count - 1));
  }
  $('open').onclick = () => playback(1);
  $('close').onclick = () => playback(-1);
  $('pause').onclick = () => playback(0);
  $('previous').onclick = () => step(-1);
  $('next').onclick = () => step(1);
  range.oninput = () => { playback(0); show(Number(range.value) / 100); };
  $('loop').onclick = () => {
    loop = !loop;
    $('loop').setAttribute('aria-pressed', String(loop));
    $('loop').textContent = loop ? 'Loop on' : 'Loop off';
  };
  document.addEventListener('keydown', e => {
    if (!ready || e.altKey || e.ctrlKey || e.metaKey || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (['Space', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.code)) e.preventDefault();
    if (e.code === 'Space') playback(direction ? 0 : progress >= 1 ? -1 : progress <= 0 ? 1 : lastDirection);
    if (e.code === 'ArrowLeft') step(-1);
    if (e.code === 'ArrowRight') step(1);
    if (e.code === 'Home' || e.code === 'End') { playback(0); show(e.code === 'End' ? 1 : 0); }
  });
  document.addEventListener('visibilitychange', () => { lastTime = 0; });
  async function load(index) {
    const image = new Image();
    const path = config.paths ? config.paths[index] : `frames/frame-${String(index).padStart(3, '0')}.${config.format || 'webp'}`;
    await new Promise((resolve, reject) => {
      image.onload = resolve; image.onerror = () => reject(new Error(`Cannot load ${path}`)); image.src = path;
    });
    if (image.decode) await image.decode();
    images[index] = image;
    loaded++;
    loading.textContent = `Preparing the flower · ${Math.round(loaded / config.count * 100)}%`;
    if (index === 0) show(0);
  }
  async function init() {
    try {
      await load(0);
      // Limit concurrent decoding, preserving responsiveness during preload.
      let cursor = 1;
      await Promise.all(Array.from({ length: Math.min(4, config.count - 1) }, async () => {
        while (cursor < config.count) { const i = cursor++; await load(i); }
      }));
      ready = true; loading.hidden = true;
      controls.forEach(id => $(id).disabled = false);
      const queryProgress = Number(new URLSearchParams(location.search).get('p') || 0);
      show(queryProgress / 100);
      document.documentElement.dataset.ready = 'true';
    } catch (error) {
      loading.textContent = `${error.message}. Keep the frames folder beside index.html and reload.`;
      loading.classList.add('error');
      document.documentElement.dataset.error = error.message;
    }
  }
  // Read-only diagnostic state for reproducible playback checks.
  window.peonyState = () => ({ ready, progress, direction, frame: rendered, loaded, count: config.count, loop });
  init();
})();
