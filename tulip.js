/* BLOOM v0.6 — hand-scrubbable botanical tulip.
   Dependency-free Canvas 2D study. This is a procedural rendering, not a photo. */
(() => {
  const canvas = document.getElementById('tulipCanvas');
  const stage = document.getElementById('stage');
  const svg = document.getElementById('flowerSvg');
  if (!canvas || !stage || !svg) return;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;
  let progress = Number(document.getElementById('bloomRange')?.value || 35) / 100;
  let enabled = false;
  let pixelWidth = 0, pixelHeight = 0;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const ease = t => t * t * (3 - 2 * t);

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
    }
    pixelWidth = rect.width;
    pixelHeight = rect.height;
    draw();
  }
  function petalOutline() {
    ctx.beginPath();
    ctx.moveTo(0, 3);
    ctx.bezierCurveTo(-26, -43, -55, -113, -62, -164);
    ctx.bezierCurveTo(-70, -193, -50, -214, -16, -214);
    ctx.quadraticCurveTo(0, -228, 18, -213);
    ctx.bezierCurveTo(54, -213, 72, -191, 62, -161);
    ctx.bezierCurveTo(56, -105, 23, -43, 0, 3);
    ctx.closePath();
  }
  function petal(angle, depth, index, t, front = false) {
    const variants = [-0.08, 0.02, 0.075, -0.025, 0.045, -0.055, 0.015, 0.07];
    const variation = variants[index % variants.length];
    ctx.save();
    ctx.translate(500 + Math.sin(angle) * 8, 360 + depth * 6);
    ctx.rotate(angle);
    ctx.scale((0.69 + 0.33 * t) * (1 + variation), 1 - 0.07 * t);
    ctx.shadowColor = 'rgba(88,32,50,.22)';
    ctx.shadowBlur = front ? 14 : 19;
    ctx.shadowOffsetY = 5;
    petalOutline();
    const gradient = ctx.createLinearGradient(-70, -145, 72, -135);
    gradient.addColorStop(0, '#823d59');
    gradient.addColorStop(.12, '#c06c83');
    gradient.addColorStop(.32, '#eeabb0');
    gradient.addColorStop(.52, front ? '#f9c6bd' : '#f5b7b4');
    gradient.addColorStop(.74, '#df8799');
    gradient.addColorStop(1, '#91475f');
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.save();
    ctx.clip();
    // Warm translucence along the upper lip, and shadow in the cup.
    let light = ctx.createRadialGradient(-12, -175, 7, -3, -155, 132);
    light.addColorStop(0, 'rgba(255,247,218,.47)');
    light.addColorStop(.43, 'rgba(255,208,192,.17)');
    light.addColorStop(1, 'rgba(106,34,62,.33)');
    ctx.fillStyle = light;
    ctx.fillRect(-90, -240, 180, 260);
    let shade = ctx.createLinearGradient(0, -220, 0, 8);
    shade.addColorStop(0, 'rgba(115,36,59,.22)');
    shade.addColorStop(.18, 'rgba(255,238,221,.10)');
    shade.addColorStop(.68, 'rgba(255,208,195,.05)');
    shade.addColorStop(1, 'rgba(79,29,50,.49)');
    ctx.fillStyle = shade;
    ctx.fillRect(-90, -240, 180, 260);
    // Fine irregular veins taper toward the petal tips.
    for (let i = -5; i <= 5; i++) {
      const x = i * 9;
      ctx.beginPath();
      ctx.moveTo(i * 1.3, -8);
      ctx.bezierCurveTo(x * .38, -65, x * 1.12 + Math.sin(i * 3) * 4, -145, x * .62, -207);
      ctx.strokeStyle = i % 2 ? 'rgba(123,51,74,.11)' : 'rgba(255,244,231,.19)';
      ctx.lineWidth = i % 2 ? .9 : 1.2;
      ctx.stroke();
    }
    ctx.restore();
    petalOutline();
    ctx.strokeStyle = 'rgba(113,46,67,.34)';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-38, -198);
    ctx.quadraticCurveTo(-3, -219, 32, -200);
    ctx.strokeStyle = 'rgba(255,243,220,.30)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
  function leaf(side, y, reach) {
    ctx.save();
    ctx.translate(500, y);
    ctx.scale(side, 1);
    ctx.beginPath();
    ctx.moveTo(0, 3);
    ctx.bezierCurveTo(36, -48, 78, -126, reach, -157);
    ctx.bezierCurveTo(reach - 7, -84, 93, -23, 0, 3);
    const g = ctx.createLinearGradient(0, -80, reach, -45);
    g.addColorStop(0, '#284d37');
    g.addColorStop(.35, '#6b9a66');
    g.addColorStop(.58, '#a0b98a');
    g.addColorStop(1, '#3c6d4b');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(reach * .58, -69, reach, -157);
    ctx.strokeStyle = 'rgba(225,239,193,.55)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
  function stem() {
    ctx.save();
    const stemGrad = ctx.createLinearGradient(487, 0, 514, 0);
    stemGrad.addColorStop(0, '#274a31');
    stemGrad.addColorStop(.28, '#517d4c');
    stemGrad.addColorStop(.64, '#9fbd81');
    stemGrad.addColorStop(1, '#315a38');
    ctx.beginPath();
    ctx.moveTo(498, 731);
    ctx.bezierCurveTo(493, 618, 516, 475, 500, 349);
    ctx.strokeStyle = 'rgba(37,70,43,.17)';
    ctx.lineWidth = 22;
    ctx.stroke();
    ctx.strokeStyle = stemGrad;
    ctx.lineWidth = 15;
    ctx.stroke();
    leaf(-1, 638, 206);
    leaf(1, 568, 205);
    ctx.restore();
  }
  function center(t) {
    const visibility = clamp((t - .28) * 2.4, 0, 1);
    if (!visibility) return;
    ctx.save();
    ctx.globalAlpha = visibility;
    ctx.translate(500, 359);
    ctx.scale(.8 + .2 * t, .65 + .35 * t);
    let g = ctx.createRadialGradient(0, 0, 3, 0, 0, 50);
    g.addColorStop(0, '#6d5937');
    g.addColorStop(.52, '#6e3c3d');
    g.addColorStop(1, 'rgba(88,31,50,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, 53, 36, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 7; i++) {
      const a = i * Math.PI * 2 / 7;
      const x = Math.cos(a) * 28, y = Math.sin(a) * 18;
      ctx.beginPath();
      ctx.moveTo(0, 4);
      ctx.quadraticCurveTo(x * .7, -18, x, y - 9);
      ctx.strokeStyle = '#e3b35d';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(x, y - 10, 6, 3.3, a, 0, Math.PI * 2);
      ctx.fillStyle = '#e9c675';
      ctx.fill();
    }
    ctx.restore();
  }
  function draw() {
    if (!enabled || !pixelWidth || !pixelHeight) return;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    const scale = Math.min(w / 1000, h / 740) * .90;
    ctx.translate(w / 2 - 500 * scale, h / 2 - 370 * scale);
    ctx.scale(scale, scale);
    const t = ease(progress);
    stem();
    // Rear petals spread out first, while front petals retain the cup silhouette.
    petal((-10 - 58 * t) * Math.PI / 180, -1, 0, t);
    petal((10 + 58 * t) * Math.PI / 180, -1, 1, t);
    petal((-3 + 2 * t) * Math.PI / 180, -1, 2, t);
    petal((-6 - 36 * t) * Math.PI / 180, 0, 3, t);
    petal((6 + 36 * t) * Math.PI / 180, 0, 4, t);
    center(t);
    petal((-8 - 17 * t) * Math.PI / 180, 1, 5, t, true);
    petal((8 + 17 * t) * Math.PI / 180, 1, 6, t, true);
    ctx.restore();
  }
  function sync() {
    enabled = stage.dataset.flower === 'tulip';
    canvas.style.display = enabled ? 'block' : 'none';
    if (enabled) svg.style.display = 'none';
    resize();
  }
  window.addEventListener('bloom:progress', e => {
    progress = clamp(e.detail.value / 100, 0, 1);
    draw();
  });
  window.addEventListener('bloom:flower', sync);
  window.addEventListener('resize', resize);
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas.parentElement);
  sync();
})();
