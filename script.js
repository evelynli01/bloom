
const DATA = {
  spring: {
    name: 'Spring', desc: 'Fresh greens, soft breezes and early blooms.',
    flowers: [
      { id: 'peony', name: 'Peony', latin: 'Paeonia', fact: 'Peonies usually bloom in late spring or early summer in temperate climates.', color: ['#f0b6c6', '#aa668b'] },
      { id: 'iris', name: 'Bearded Iris', latin: 'Iris germanica', fact: 'Bearded irises typically bloom in spring. Their upright standards and downward falls create a distinctive shape.', color: ['#b7a4e2', '#6656a4'] }
    ]
  },
  summer: {
    name: 'Summer', desc: 'Golden sunlight and long, warm days.',
    flowers: [
      { id: 'rose', name: 'Classic Red Rose', latin: 'Rosa × hybrida', fact: 'Many garden roses bloom from late spring through summer, depending on the cultivar.', color: ['#bd2345', '#70132d'] },
      { id: 'gardenia', name: 'Gardenia', latin: 'Gardenia jasminoides', fact: 'Gardenias often bloom from late spring through summer, with smooth ivory petals and a characteristic spiral.', color: ['#fff8e7', '#d4c8a9'] }
    ]
  }
};

const $ = id => document.getElementById(id);
const stage = $('stage');
const range = $('bloomRange');
const amount = $('amount');
const svg = $('flowerSvg');
const petals = $('petalGroup');
const core = $('core');
const stamens = $('stamens');

let season = 'spring';
let flower = 'peony';
let bloom = 0;
let lastGesture = 0;

// Legacy image fallback for the Canvas peony: alpha-preserving deformation of the
// supplied blossom. This avoids the double-image ghosting from crossfading
// four atlas tiles. It is a 2D approximation, not true petal animation.
//
// Optional upgrade: place 61 matching frames named frame-000.webp through
// frame-060.webp inside assets/peony-frames/. The renderer will then use
// those actual animation frames instead of the deformation fallback.
const PEONY_ATLAS = 'assets/peony-atlas.png';
const PEONY_FRAMES = 'assets/peony-frames/';
const PEONY_FRAME_COUNT = 61;
let peonyAtlasReady = false;
let peonySequence = null;

const atlasArtwork = document.querySelector('.artwork');
const atlas = document.createElement('canvas');
atlas.id = 'peonyAtlas';
atlas.width = 768;
atlas.height = 768;
atlas.setAttribute('role', 'img');
atlas.setAttribute('aria-label', 'Pink peony responding to your hand gesture');
atlas.style.cssText = [
  'position:absolute', 'left:50%', 'top:50%',
  'transform:translate(-50%,-50%)',
  'height:100%', 'width:auto', 'max-width:100%',
  'aspect-ratio:1/1', 'display:none', 'pointer-events:none',
  'filter:drop-shadow(0 20px 20px rgba(105,66,75,.11))'
].join(';');
atlasArtwork.append(atlas);

const peonyCtx = atlas.getContext('2d', { alpha: true });
const atlasImage = new Image();
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const smooth = t => t * t * (3 - 2 * t);

function paintPeony(t) {
  if (!peonyAtlasReady || !peonyCtx) return;
  const p = clamp(t, 0, 1);
  peonyCtx.clearRect(0, 0, 768, 768);

  // With a true animation sequence, each hand position maps to one frame.
  // No crossfades: the selected frame is drawn at full opacity.
  if (peonySequence) {
    const index = Math.round(p * (peonySequence.length - 1));
    peonyCtx.drawImage(peonySequence[index], 0, 0, 768, 768);
    return;
  }

  // Fallback: continuously deform ONE fully opened flower from the atlas.
  // Upper petals are gathered more than lower petals; the base stays put.
  // This does not create new petal geometry, but it is smooth, reversible,
  // and avoids the transparent ghost images of the previous crossfade.
  const closed = 1 - smooth(p);
  const baseY = 610;
  const vertical = 1 - closed * .075;
  const step = 2;
  peonyCtx.imageSmoothingEnabled = true;
  peonyCtx.imageSmoothingQuality = 'high';

  for (let y = 0; y < 768; y += step) {
    const relative = clamp((y - 90) / 530, 0, 1);
    const petalDepth = smooth(relative);
    const closedWidth = .46 + .34 * petalDepth;
    const widthFactor = 1 - closed * (1 - closedWidth);
    const rowWidth = 768 * widthFactor;
    const x = (768 - rowWidth) / 2;
    const rowY = baseY + (y - baseY) * vertical;
    peonyCtx.drawImage(
      atlasImage,
      768, 768 + y, 768, step,
      x, rowY, rowWidth, step * vertical + .5
    );
  }
}

atlasImage.onload = () => {
  peonyAtlasReady = true;
  if (flower === 'peony') render();
  if (!window.BLOOM_PEONY_READY) loadPeonySequence();
};
atlasImage.onerror = () => {
  peonyAtlasReady = false;
  console.warn('Peony asset missing: assets/peony-atlas.png');
};
atlasImage.src = PEONY_ATLAS;

// Check one frame first so an absent sequence does not trigger 61 404s.
async function loadPeonySequence() {
  const load = src => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
  const path = i => PEONY_FRAMES + `frame-${String(i).padStart(3, '0')}.webp`;
  try {
    const first = await load(path(0));
    const rest = await Promise.all(
      Array.from({ length: PEONY_FRAME_COUNT - 1 }, (_, i) => load(path(i + 1)))
    );
    peonySequence = [first, ...rest];
    if (flower === 'peony' && !window.BLOOM_PEONY_READY) {
      $('assetStatus').textContent = 'Using smooth, hand-scrubbable peony animation frames.';
      paintPeony(bloom / 100);
    }
  } catch (_) {
    // The existing peony-atlas.png works without a frame sequence.
    peonySequence = null;
  }
}

const GARDEN = Object.entries(DATA).flatMap(
  ([season, info]) =>
    info.flowers.map(f => ({
      season,
      flower: f.id,
      name: f.name
    }))
);

let gardenIndex = 0;

// Existing illustrated flowers remain as fallbacks.
const NS = 'http://www.w3.org/2000/svg';

// Species-specific illustrated petals for the seven remaining flowers.
// Each path has its own silhouette; all remain scrubbable by the existing bloom state.
const SPECIES = {
  daffodil:{count:6,rows:1,shape:'M0 12 C-30 -28 -74 -65 -53 -119 Q-43 -143 -24 -139 Q0 -159 24 -139 Q43 -143 53 -119 C74 -65 30 -28 0 12Z',radius:126,inner:0,center:39},
  sunflower:{count:19,rows:2,shape:'M0 12 Q-21 -37 -24 -107 Q-21 -145 0 -190 Q21 -145 24 -107 Q21 -37 0 12Z',radius:145,inner:0,center:62},
  zinnia:{count:13,rows:3,shape:'M0 12 C-40 -26 -65 -80 -45 -133 Q-32 -149 -18 -135 Q0 -153 18 -135 Q32 -149 45 -133 C65 -80 40 -26 0 12Z',radius:115,inner:0,center:28},
  chrysanthemum:{count:23,rows:3,shape:'M0 12 Q-15 -52 -14 -124 Q-16 -171 -2 -181 Q17 -180 13 -137 Q13 -58 0 12Z',radius:139,inner:0,center:21},
  aster:{count:17,rows:2,shape:'M0 12 Q-20 -43 -16 -105 Q-15 -157 0 -178 Q15 -157 16 -105 Q20 -43 0 12Z',radius:133,inner:0,center:38},
  hellebore:{count:5,rows:2,shape:'M0 12 C-56 -27 -88 -95 -57 -142 Q-27 -176 0 -151 Q27 -176 57 -142 C88 -95 56 -27 0 12Z',radius:124,inner:0,center:34},
  camellia:{count:9,rows:4,shape:'M0 12 C-46 -22 -80 -78 -56 -135 Q-32 -166 0 -145 Q32 -166 56 -135 C80 -78 46 -22 0 12Z',radius:112,inner:0,center:23}
};
let layers=[];
function buildIllustratedFlower(id){
  const spec=SPECIES[id] || SPECIES.camellia;
  petals.replaceChildren();layers=[];
  for(let layer=0;layer<spec.rows;layer++){
    const count=spec.count+(layer===0?0:Math.max(-5,-layer*2));
    for(let i=0;i<count;i++){
      const g=document.createElementNS(NS,'g');
      const path=document.createElementNS(NS,'path');
      path.setAttribute('d',spec.shape);path.setAttribute('fill','url(#petal)');
      path.setAttribute('stroke','var(--petal-edge,#bd8a9c)');path.setAttribute('stroke-width','1.4');path.setAttribute('stroke-opacity','.34');
      g.append(path);petals.append(g);layers.push({g,layer,i,count,rows:spec.rows,radius:spec.radius});
    }
  }
  document.querySelector('#core circle')?.setAttribute('r',String(spec.center));
}
buildIllustratedFlower('daffodil');

for (let i = 0; i < 24; i++) {
  const a = i * Math.PI * 2 / 24;
  const ln = document.createElementNS(NS, 'line');

  const attrs = {
    x1: 500 + Math.cos(a) * 4,
    y1: 365 + Math.sin(a) * 4,
    x2: 500 + Math.cos(a) * 27,
    y2: 365 + Math.sin(a) * 27,
    stroke: '#c79753',
    'stroke-width': 2
  };

  for (const [key, val] of Object.entries(attrs)) {
    ln.setAttribute(key, val);
  }

  stamens.append(ln);
}

// Bloom progress is controlled by either the slider or the webcam.
function setBloom(v) {
  bloom = clamp(Number(v), 0, 100);

  range.value = String(Math.round(bloom));
  amount.textContent = `${Math.round(bloom)}%`;
  $('sliderValue').textContent = amount.textContent;
  $('progressFill').style.width = `${bloom}%`;

  const t = bloom / 100;

  layers.forEach(({ g, layer, i, count }) => {
    const a =
      (-7 + (i - (count - 1) / 2) * 3) * (1 - t) +
      (i * 360 / count + layer * 12) * t;

    const spread = 9 + layer * 5 + (94 - layer * 12) * t;
    const size = Math.max(.47, 1.04 - layer * .15);

    g.setAttribute(
      'transform',
      `translate(500 365)
       rotate(${a})
       translate(0 ${-spread})
       scale(${(.30 + .70 * t) * size} ${(.68 + .28 * t) * size})`
    );
  });

  core.setAttribute(
    'opacity',
    String(clamp((t - .25) / .5, 0, 1))
  );

  core.setAttribute(
    'transform',
    `translate(500 365) scale(${.4 + .6 * t}) translate(-500 -365)`
  );

  if (flower === 'peony' && peonyAtlasReady && !window.BLOOM_PEONY_READY) {
    paintPeony(t);
  }

  window.dispatchEvent(
    new CustomEvent('bloom:progress', {
      detail: { value: bloom }
    })
  );
}

// Seasonal scenery.
function backdrop(s) {
  const tree =
    '<path d="M70 900 Q85 700 65 530" stroke="#a8ad8b" stroke-width="8" fill="none" opacity=".25"/>';

  const paths = {
    spring: `
      <g opacity=".5">
        <path d="M0 800 Q200 740 430 800 T900 805 T1200 790 L1200 900 H0Z" fill="#dce7d3"/>
        ${tree}
        ${Array.from({ length: 18 }, (_, i) => `
          <circle
            cx="${40 + i * 68}"
            cy="${795 + Math.sin(i * 1.4) * 19}"
            r="${6 + i % 3 * 2}"
            fill="${i % 2 ? '#f1bdcb' : '#e9d99b'}"
          />
        `).join('')}
      </g>
    `,

    summer: `
      <g opacity=".53">
        <circle cx="1010" cy="165" r="90" fill="#f8dfa4"/>
        <path d="M0 755 Q250 705 570 770 T1200 730 L1200 900 H0Z" fill="#ecd9b4"/>
        <path d="M0 790 Q300 752 650 795 T1200 777" fill="none" stroke="#e7c99b" stroke-width="9"/>
      </g>
    `,

    autumn: `
      <g opacity=".48">
        <path d="M0 805 Q260 755 520 802 T1200 785 L1200 900 H0Z" fill="#ead3bd"/>
        ${Array.from({ length: 19 }, (_, i) => `
          <ellipse
            cx="${(i * 113 + 45) % 1200}"
            cy="${110 + (i * 137) % 690}"
            rx="${10 + i % 3 * 4}"
            ry="${5 + i % 4 * 2}"
            transform="rotate(${i * 29} ${(i * 113 + 45) % 1200} ${110 + (i * 137) % 690})"
            fill="${i % 2 ? '#c28c68' : '#d6a77a'}"
          />
        `).join('')}
      </g>
    `,

    winter: `
      <g opacity=".53">
        <path d="M0 805 Q210 780 450 802 T950 788 T1200 800 L1200 900 H0Z" fill="#d9e6ec"/>
        ${Array.from({ length: 40 }, (_, i) => `
          <circle
            cx="${(i * 197 + 41) % 1200}"
            cy="${(i * 131 + 73) % 780}"
            r="${2 + i % 3 * 2}"
            fill="#b4ccd9"
          />
        `).join('')}
      </g>
    `
  };

  $('landscape').innerHTML = paths[s];
}

// Flower gallery navigation.
let flowerTransitioning = false;
function showFlower(index) {
  const next = (index + GARDEN.length) % GARDEN.length;
  if (next === gardenIndex || flowerTransitioning) return;
  const direction = index > gardenIndex ? 1 : -1;
  const chosen = GARDEN[next];
  const artwork = document.querySelector('.artwork');
  const label = document.querySelector('.flower-label');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const change = () => {
    gardenIndex = next;
    season = chosen.season;
    flower = chosen.flower;
    render();
  };
  if (reduced || !artwork?.animate) { change(); return; }
  flowerTransitioning = true;
  // Slide the outgoing botanical illustration off-screen, then bring in the
  // incoming one from the opposite side. The webcam and controls stay fixed.
  const out = artwork.animate([
    {transform:'translateX(0)',opacity:1},
    {transform:`translateX(${-direction * 72}vw)`,opacity:0}
  ], {duration:340,easing:'cubic-bezier(.55,0,.8,.35)',fill:'forwards'});
  if (label) label.animate([
    {transform:'translateX(0)',opacity:1},
    {transform:`translateX(${-direction * 40}px)`,opacity:0}
  ], {duration:250,easing:'ease-in'});
  out.finished.catch(()=>{}).then(()=>{
    out.cancel();
    change();
    const incoming = artwork.animate([
      {transform:`translateX(${direction * 72}vw)`,opacity:0},
      {transform:'translateX(0)',opacity:1}
    ], {duration:420,easing:'cubic-bezier(.18,.7,.2,1)',fill:'both'});
    if (label) label.animate([
      {transform:`translateX(${direction * 40}px)`,opacity:0},
      {transform:'translateX(0)',opacity:1}
    ], {duration:380,easing:'ease-out'});
    incoming.finished.catch(()=>{}).then(()=>{
      incoming.cancel();
      flowerTransitioning = false;
    });
  });
}

function render() {
  const d = DATA[season];
  const f = d.flowers.find(x => x.id === flower) || d.flowers[0];

  flower = f.id;
  stage.className = 'stage ' + season;

  backdrop(season);

  const current = GARDEN.findIndex(
    x => x.season === season && x.flower === flower
  );

  gardenIndex = current < 0 ? 0 : current;

  $('headerSeason').textContent = d.name;

  $('flowerCount').textContent =
    String(gardenIndex + 1).padStart(2, '0') +
    ' of ' +
    String(GARDEN.length).padStart(2, '0');

  $('seasonPill').textContent =
    d.name + ' / ' +
    String(gardenIndex + 1).padStart(2, '0');

  $('stageNote').textContent = d.name + ' / ' + d.desc;

  $('flower-fact').textContent =
    f.fact + ' Flowering times vary by location, climate, and variety.';

  $('species').textContent = f.latin + ' / ' + f.name;

  $('caption').textContent =
    'A layered botanical study · spread to unfold its petals.';

  if (!['peony','rose','iris','gardenia'].includes(flower)) buildIllustratedFlower(flower);
  const greenery=document.getElementById('greenerySvg');
  if(greenery) greenery.style.opacity=flower==='sunflower' ? '.96' : '1';
  svg.style.setProperty('--petal-mid', f.color[0]);
  svg.style.setProperty('--petal-edge', f.color[1]);

  $('flowerDots').replaceChildren(
    ...GARDEN.map((item, i) => {
      const b = document.createElement('button');

      b.type = 'button';
      b.className = 'flower-dot';

      b.setAttribute(
        'aria-label',
        `${item.name} · ${DATA[item.season].name} · ${i + 1} of ${GARDEN.length}`
      );

      b.setAttribute('aria-current', String(i === gardenIndex));

      b.title = `${item.name} · ${DATA[item.season].name}`;

      b.addEventListener('click', () => showFlower(i));

      return b;
    })
  );

  svg.style.display =
    ['peony','rose','iris','gardenia'].includes(flower) && window.BLOOM_PEONY_READY
      ? 'none'
      : 'block';

  atlas.style.display =
    flower === 'peony' && peonyAtlasReady && !window.BLOOM_PEONY_READY
      ? 'block'
      : 'none';

  $('assetStatus').textContent = 'Soft botanical Canvas study · pinch to close, spread to bloom.';

  stage.dataset.flower = flower;
  setBloom(bloom);

  window.dispatchEvent(
    new CustomEvent('bloom:flower', {
      detail: { flower }
    })
  );
}

// Manual bloom slider.
range.addEventListener('input', () => {
  setBloom(range.value);
});

// Webcam and MediaPipe hand tracking.
let stream = null;
let landmarker = null;
let cameraActive = false;
let raf = 0;
let lastVideoTime = -1;
let smoothed = null;
let filteredHand = null;
let lastHandFrame = 0;
let lastBloomWrist = null;
let navigationHand = { armed: false, pose: null, since: 0 };
let bloomHandLabel = null;
let bloomHandMissingSince = 0;
let allHandsMissingSince = 0;
let lastFlowerFist = 0;

// MediaPipe's left/right handedness is more reliable for maintaining a role
// than the order of hands returned each frame. The bloom hand is locked until
// the camera is restarted; the other hand is navigation only.
function handLabel(results, i) {
  return results.handednesses?.[i]?.[0]?.categoryName ||
         results.handedness?.[i]?.[0]?.categoryName || null;
}
function handPose(points) {
  const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
  const palm = Math.max(.025, distance(points[0], points[9]));
  const fingers = [[8,6,5],[12,10,9],[16,14,13],[20,18,17]];
  let straight = 0, curled = 0;
  for (const [tip, pip, mcp] of fingers) {
    const tipToWrist = distance(points[tip],points[0]);
    const pipToWrist = distance(points[pip],points[0]);
    const tipToBase = distance(points[tip],points[mcp]);
    const pipToBase = distance(points[pip],points[mcp]);
    // A finger must be curled at BOTH its middle joint and toward its palm.
    // One, two, or three raised fingers can never count as a fist.
    const folded = tipToBase < pipToBase * 1.28 &&
                   tipToWrist < pipToWrist + palm * .12;
    const extended = tipToBase > pipToBase * 1.48 &&
                     tipToWrist > pipToWrist + palm * .12;
    if (folded) curled++;
    if (extended) straight++;
  }
  // Thumb must be tucked near the index-finger base, not pointing outward.
  const thumbTucked = distance(points[4],points[5]) < palm * .90 ||
                      distance(points[4],points[9]) < palm * .88;
  return curled === 4 && thumbTucked ? 'fist' :
         straight === 4 ? 'open' : 'other';
}

const webcam = $('webcam');
const overlay = $('overlay');
const ctx = overlay.getContext('2d');

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    $('cameraStatus').textContent =
      'Webcam access requires HTTPS or localhost in a supported browser.';
    return;
  }

  const btn = $('cameraBtn');

  btn.disabled = true;
  btn.textContent = 'Starting…';

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: 640 },
        height: { ideal: 480 }
      },
      audio: false
    });

    webcam.srcObject = stream;
    await webcam.play();

    $('cameraStatus').textContent = 'Loading hand tracking…';

    const mod = await import(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm'
    );

    const vision = await mod.FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
    );

    try {
      landmarker = await mod.HandLandmarker.createFromOptions(
        vision,
        {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          numHands: 2
        }
      );
    } catch (_) {
      landmarker = await mod.HandLandmarker.createFromOptions(
        vision,
        {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'CPU'
          },
          runningMode: 'VIDEO',
          numHands: 2
        }
      );
    }

    cameraActive = true;

    $('cameraBox').classList.add('active');

    btn.textContent = 'Running';
    $('stopBtn').disabled = false;
    $('cameraStatus').textContent = 'Show your hand';

    tick();
  } catch (err) {
    $('cameraStatus').textContent =
      'Could not start hand tracking: ' +
      (err?.message || 'Check camera permissions and internet connection.');

    stopCamera();
  } finally {
    btn.disabled = cameraActive;
  }
}

function tick() {
  if (!cameraActive) return;

  try {
    if (
      webcam.readyState >= 2 &&
      webcam.currentTime !== lastVideoTime
    ) {
      lastVideoTime = webcam.currentTime;

      const res = landmarker.detectForVideo(
        webcam,
        performance.now()
      );

      ctx.clearRect(0, 0, overlay.width, overlay.height);

      if (res.landmarks?.length) {
        allHandsMissingSince = 0;
        const now = performance.now();
        const detected = res.landmarks;
        // Lock bloom to the physical hand that started the gesture.
        // Never transfer bloom to the navigation hand when one disappears.
        const labels = detected.map((_, i) => handLabel(res, i));
        if (!bloomHandLabel && labels[0]) bloomHandLabel = labels[0];
        let primaryIndex = bloomHandLabel ? labels.indexOf(bloomHandLabel) : 0;
        // Fallback if handedness labels are unavailable: use wrist proximity,
        // but do not adopt a distant navigation hand as the bloom hand.
        if (primaryIndex < 0 && labels.every(x => !x) && lastBloomWrist) {
          let best = Infinity;
          detected.forEach((hand, i) => {
            const d = Math.hypot(hand[0].x-lastBloomWrist.x, hand[0].y-lastBloomWrist.y);
            if (d < best) { best = d; primaryIndex = i; }
          });
          if (best > .24) primaryIndex = -1;
        }
        if (primaryIndex < 0 && !labels.some(Boolean) && !lastBloomWrist) primaryIndex = 0;
        const raw = primaryIndex >= 0 ? detected[primaryIndex] : null;
        let pts = null;
        if (raw) {
          lastBloomWrist = { x: raw[0].x, y: raw[0].y };
          bloomHandMissingSince = 0;
          const elapsed = lastHandFrame ? Math.min(80, now - lastHandFrame) : 33;
          lastHandFrame = now;
          pts = raw.map((point, i) => {
            const previous = filteredHand?.[i];
            if (!previous) return { x: point.x, y: point.y, z: point.z };
            const jump = Math.hypot(point.x - previous.x, point.y - previous.y);
            const alpha = jump > .16 ? .16 : jump > .07 ? .30 : .47;
            const adjusted = 1 - Math.pow(1 - alpha, elapsed / 33);
            return {
              x: previous.x + (point.x - previous.x) * adjusted,
              y: previous.y + (point.y - previous.y) * adjusted,
              z: previous.z + (point.z - previous.z) * adjusted
            };
          });
          filteredHand = pts;
        } else {
          if (!bloomHandMissingSince) bloomHandMissingSince = now;
          if (now - bloomHandMissingSince > 300) {
            filteredHand = null;
            lastHandFrame = 0;
          }
        }

        // Draw the complete 21-point skeleton on BOTH hands.
        // Video and overlay are mirrored together via CSS.
        const chains = [
          [0, 1, 2, 3, 4], [0, 5, 6, 7, 8],
          [0, 9, 10, 11, 12], [0, 13, 14, 15, 16],
          [0, 17, 18, 19, 20], [5, 9, 13, 17]
        ];
        function drawSkeleton(points, color, tipColor) {
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.strokeStyle = color;
          ctx.lineWidth = 2.5;
          for (const chain of chains) {
            ctx.beginPath();
            chain.forEach((i, j) => {
              const pt = points[i];
              if (j) ctx.lineTo(pt.x * overlay.width, pt.y * overlay.height);
              else ctx.moveTo(pt.x * overlay.width, pt.y * overlay.height);
            });
            ctx.stroke();
          }
          points.forEach((pt, i) => {
            ctx.beginPath();
            ctx.arc(pt.x * overlay.width, pt.y * overlay.height,
              i === 4 || i === 8 ? 5 : 2.3, 0, Math.PI * 2);
            ctx.fillStyle = i === 4 || i === 8 ? tipColor : color;
            ctx.fill();
          });
        }
        const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
        if (pts) {
          drawSkeleton(pts, '#dcf6c4', '#ffd19b');
          const palm = Math.max(.02, dist(pts[5], pts[17]), dist(pts[0], pts[9]) * .85);
          const pinch = dist(pts[4], pts[8]) / palm;
          const target = clamp((pinch - .22) / 1.25 * 100, 0, 100);
          smoothed = smoothed === null ? target : smoothed * .73 + target * .27;
          setBloom(smoothed);
        }

        // Second hand: show an open palm to arm, then close into a fist
        // to advance EXACTLY one flower. Reopen before advancing again.
        const navIndex = detected.findIndex((_, i) => i !== primaryIndex &&
          (!bloomHandLabel || !labels[i] || labels[i] !== bloomHandLabel));
        if (navIndex >= 0) {
          const other = detected[navIndex];
          drawSkeleton(other, '#ffcebb', '#ffad87');
          const pose = handPose(other);
          if (pose !== navigationHand.pose) {
            navigationHand.pose = pose;
            navigationHand.since = now;
          }
          if (pose === 'open' && now - navigationHand.since > 180) {
            navigationHand.armed = true;
          }
          if (pose === 'fist' && navigationHand.armed &&
              now - navigationHand.since > 170 && now - lastFlowerFist > 650) {
            navigationHand.armed = false;
            lastFlowerFist = now;
            showFlower(gardenIndex + 1);
          }
        } else {
          // A hand leaving the frame must not count as a new gesture.
          navigationHand = { armed: false, pose: null, since: 0 };
        }

        if (now - lastGesture > 350) {
          $('cameraStatus').textContent = detected.length > 1
            ? `Two hands · bloom ${Math.round(smoothed ?? bloom)}% · open palm → full fist to advance`
            : `Hand tracked · ${Math.round(smoothed ?? bloom)}%`;
          lastGesture = now;
        }
      } else {
        const now = performance.now();
        if (!allHandsMissingSince) allHandsMissingSince = now;
        // When BOTH hands have left for half a second, forget the roles.
        // The first hand to return becomes the new bloom hand.
        if (now - allHandsMissingSince > 500) {
          bloomHandLabel = null;
          lastBloomWrist = null;
          bloomHandMissingSince = 0;
          smoothed = null;
          navigationHand = { armed:false, pose:null, since:0 };
        }
        if (now - lastGesture > 800) {
        filteredHand = null; lastHandFrame = 0; navigationHand = { armed: false, pose: null, since: 0 };
        $('cameraStatus').textContent =
          'Looking for your hand…';
        }
      }
    }
  } catch (err) {
    $('cameraStatus').textContent =
      'Tracking stopped: ' + err.message;

    stopCamera();
    return;
  }

  raf = requestAnimationFrame(tick);
}

function stopCamera() {
  cameraActive = false;
  cancelAnimationFrame(raf);

  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }

  webcam.srcObject = null;

  ctx.clearRect(
    0,
    0,
    overlay.width,
    overlay.height
  );

  $('cameraBox').classList.remove('active');

  $('cameraBtn').disabled = false;
  $('cameraBtn').textContent = 'Enable';
  $('stopBtn').disabled = true;

  smoothed = null;
  filteredHand = null; lastHandFrame = 0;
  lastVideoTime = -1;
  lastBloomWrist = null; bloomHandLabel = null; bloomHandMissingSince = 0; allHandsMissingSince = 0;
  navigationHand = { armed: false, pose: null, since: 0 };
  lastFlowerFist = 0;
}

$('cameraBtn').addEventListener('click', startCamera);

$('stopBtn').addEventListener('click', () => {
  stopCamera();

  $('cameraStatus').textContent =
    'Camera is off. Use the slider or enable it again.';
});

window.addEventListener('pagehide', stopCamera);

// Flower gallery buttons.
$('prevFlower').addEventListener(
  'click',
  () => showFlower(gardenIndex - 1)
);

$('nextFlower').addEventListener(
  'click',
  () => showFlower(gardenIndex + 1)
);

// Horizontal trackpad navigation.
let wheelSum = 0;
let lastWheel = 0;
let wheelCooldown = 0;

stage.addEventListener('wheel', e => {
  if (
    Math.abs(e.deltaX) < Math.abs(e.deltaY) * 1.25 ||
    Math.abs(e.deltaX) < 2
  ) return;

  if (e.target.closest('.pip,.settings-panel,.toolbar')) {
    return;
  }

  e.preventDefault();

  const now = performance.now();

  if (now < wheelCooldown) return;

  if (now - lastWheel > 650) {
    wheelSum = 0;
  }

  lastWheel = now;
  wheelSum += e.deltaX;

  if (Math.abs(wheelSum) > 65) {
    showFlower(
      gardenIndex + (wheelSum > 0 ? 1 : -1)
    );

    wheelSum = 0;
    wheelCooldown = now + 600;
  }
}, { passive: false });

// Drag/swipe the flower area to navigate.
const artwork = $('flowerSvg').closest('.artwork');

let swipeStart = null;

artwork.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;

  swipeStart = {
    id: e.pointerId,
    x: e.clientX,
    y: e.clientY
  };

  artwork.setPointerCapture(e.pointerId);
});

artwork.addEventListener('pointerup', e => {
  if (
    !swipeStart ||
    swipeStart.id !== e.pointerId
  ) return;

  const dx = e.clientX - swipeStart.x;
  const dy = e.clientY - swipeStart.y;

  swipeStart = null;

  if (
    Math.abs(dx) > 65 &&
    Math.abs(dx) > Math.abs(dy) * 1.2
  ) {
    showFlower(
      gardenIndex + (dx < 0 ? 1 : -1)
    );
  }
});

artwork.addEventListener(
  'pointercancel',
  () => swipeStart = null
);

// Settings panel.
const panel = $('settingsPanel');
const settingsBtn = $('settingsBtn');

function toggleSettings(open) {
  panel.hidden = !open;

  settingsBtn.setAttribute(
    'aria-expanded',
    String(open)
  );
}

settingsBtn.addEventListener(
  'click',
  () => toggleSettings(panel.hidden)
);

$('closeSettings').addEventListener(
  'click',
  () => toggleSettings(false)
);

// Keyboard navigation.
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    toggleSettings(false);
  }

  if (
    e.altKey ||
    e.ctrlKey ||
    e.metaKey ||
    ['INPUT', 'SELECT', 'TEXTAREA'].includes(
      document.activeElement?.tagName
    )
  ) return;

  if (e.key === 'ArrowRight') {
    showFlower(gardenIndex + 1);
  }

  if (e.key === 'ArrowLeft') {
    showFlower(gardenIndex - 1);
  }
});

// The camera and flower label share a fixed CSS corner dock.

// Start Bloom.
render();
