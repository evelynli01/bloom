/* Three-step gesture tutorial. No flower picker or automatic camera access. */
(() => {
  'use strict';
  const dialog = document.getElementById('gestureGuide');
  const api = window.BloomGuide;
  if (!dialog || !api) return;
  const title = document.getElementById('guideTitle');
  const intro = document.getElementById('guideIntro');
  const progress = document.getElementById('guideProgress');
  const panels = [...dialog.querySelectorAll('[data-guide-step]')];
  const back = document.getElementById('guideBack');
  const next = document.getElementById('guideNext');
  const headings = [
    ['Start with just one hand.', 'Either hand works. The first hand the camera sees becomes your bloom hand.'],
    ['Your other hand changes flowers.', 'Keep your bloom hand visible, then bring in your second hand.'],
    ['Two hands. Two different jobs.', 'Keep the same roles as you explore all four flowers.']
  ];
  let step = 0;
  let returnFocus = null;
  let destination = null;
  function showStep(index) {
    step = Math.max(0, Math.min(panels.length - 1, index));
    panels.forEach((panel, i) => { panel.hidden = i !== step; });
    [title.textContent, intro.textContent] = headings[step];
    progress.textContent = `Step ${step + 1} of ${panels.length}`;
    back.hidden = step === 0;
    next.textContent = step === 0 ? 'Next: your other hand →'
      : step === 1 ? 'Next: use both together →'
      : api.cameraIsActive() ? 'Continue blooming' : 'Enable camera & try';
    document.getElementById('guideCameraNote').textContent = api.cameraIsActive()
      ? 'Camera stays on; gesture controls pause while this guide is open.'
      : 'Camera access is optional and starts only when you choose to enable it.';
    dialog.scrollTop = 0;
    title.focus();
  }
  function open() {
    if (dialog.open) return;
    returnFocus = document.activeElement;
    destination = null;
    window.BLOOM_GUIDE_OPEN = true;
    document.body.classList.add('bloom-guide-open');
    dialog.showModal();
    showStep(0);
  }
  back.addEventListener('click', () => showStep(step - 1));
  next.addEventListener('click', () => {
    if (step < panels.length - 1) { showStep(step + 1); return; }
    destination = 'camera';
    dialog.close();
    // An explicit click is the only tutorial action that requests a camera.
    if (!api.cameraIsActive()) api.startCamera();
  });
  document.getElementById('closeGuide').addEventListener('click', () => dialog.close());
  document.getElementById('guideManual').addEventListener('click', () => {
    api.stopCamera();
    destination = 'manual';
    dialog.close();
  });
  dialog.addEventListener('close', () => {
    window.BLOOM_GUIDE_OPEN = false;
    document.body.classList.remove('bloom-guide-open');
    api.resume();
    if (destination === 'manual') api.openManual();
    else if (destination === 'camera') document.getElementById('gestureHelp').focus();
    else if (returnFocus && returnFocus !== document.body) returnFocus.focus();
    else document.getElementById('cameraBtn').focus();
  });
  document.getElementById('gestureHelp').addEventListener('click', open);
  open();
})();
