// ui.js - UI animations and reactive observers for RepVision
(() => {
  const $ = id => document.getElementById(id);
  const card = $('counterCard'), count = $('repCount'), status = $('repStatus'),
        angle = $('angleBadge'), ring = $('ringFill'), mute = $('muteBtn'), overlay = $('startOverlay');
  const C = 339.3;

  if (!card || !count) return;

  // Rep count: pop animation + card flash on every change
  let last = count.textContent;
  new MutationObserver(() => {
    const now = count.textContent;
    if (now === last) return;
    last = now;
    [count, card].forEach((el, i) => {
      if (!el) return;
      const c = i ? 'flash' : 'bump';
      el.classList.remove(c);
      void el.offsetWidth;
      el.classList.add(c);
    });
  }).observe(count, {childList: true, characterData: true, subtree: true});

  // Dynamic Ring Progress: driven by card.dataset.progress or angle
  new MutationObserver(() => {
    if (!ring) return;
    if (card.dataset.progress !== undefined) {
      const p = parseFloat(card.dataset.progress);
      if (!isNaN(p)) {
        ring.style.strokeDashoffset = C * (1 - Math.max(0, Math.min(1, p)));
        return;
      }
    }
    // Fallback: parse angle if progress dataset isn't set
    const a = parseFloat((angle.textContent.match(/-?\d+(\.\d+)?/) || [])[0]);
    if (isNaN(a)) return;
    const p = Math.max(0, Math.min(1, (170 - a) / 130));
    ring.style.strokeDashoffset = C * (1 - p);
  }).observe(card, {attributes: true, attributeFilter: ['data-progress']});

  // Status: keeps the glowing dot, sets state for color
  let busy = false;
  new MutationObserver(() => {
    if (busy || !status) return;
    busy = true;
    const t = status.textContent.trim();
    if (!status.querySelector('.dot')) {
      status.textContent = '';
      status.insertAdjacentHTML('afterbegin', '<i class="dot"></i>');
      status.append(t);
    }
    if (/up|curl|top|logged/i.test(t)) {
      card.dataset.state = 'up';
    } else if (/down|extend|holding/i.test(t)) {
      card.dataset.state = 'down';
    } else {
      card.dataset.state = 'idle';
    }
    busy = false;
  }).observe(status, {childList: true, characterData: true, subtree: true});

  // Mute button: if text emoji is inserted, swap it for the SVG icon
  let swapping = false;
  new MutationObserver(() => {
    if (swapping || !mute || mute.querySelector('svg')) return;
    swapping = true;
    const off = /🔇|🔈|off|mute/i.test(mute.textContent) && !/🔊/.test(mute.textContent);
    mute.innerHTML = `<svg><use href="#i-${off ? 'mute' : 'vol'}"/></svg>`;
    swapping = false;
  }).observe(mute, {childList: true, characterData: true, subtree: true});

  // Overlay exit transition
  const startBtn = $('startBtn');
  if (startBtn && overlay) {
    startBtn.addEventListener('click', () => overlay.classList.add('is-leaving'));
  }
})();
