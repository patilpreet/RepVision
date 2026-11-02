// UI layer only: reads what app.js writes into the DOM and animates it.
(() => {
  const $ = id => document.getElementById(id);
  const card = $('counterCard'), count = $('repCount'), status = $('repStatus'),
        angle = $('angleBadge'), ring = $('ringFill'), mute = $('muteBtn'), overlay = $('startOverlay');
  const C = 339.3;

  // Rep count: pop animation + ring flash on every change
  let last = count.textContent;
  new MutationObserver(() => {
    const now = count.textContent;
    if (now === last) return;
    last = now;
    [count, card].forEach((el, i) => {
      const c = i ? 'flash' : 'bump';
      el.classList.remove(c); void el.offsetWidth; el.classList.add(c);
    });
  }).observe(count, {childList: true, characterData: true, subtree: true});

  // Angle: drives the ring (curl up = ring fills)
  new MutationObserver(() => {
    const a = parseFloat((angle.textContent.match(/-?\d+(\.\d+)?/) || [])[0]);
    if (isNaN(a)) return;
    const p = Math.max(0, Math.min(1, (170 - a) / 130));
    ring.style.strokeDashoffset = C * (1 - p);
  }).observe(angle, {childList: true, characterData: true, subtree: true});

  // Status: keeps the dot, sets a state for colour
  let busy = false;
  new MutationObserver(() => {
    if (busy) return; busy = true;
    const t = status.textContent.trim();
    if (!status.querySelector('.dot')) {
      status.textContent = '';
      status.insertAdjacentHTML('afterbegin', '<i class="dot"></i>');
      status.append(t);
    }
    card.dataset.state = /up|curl|top/i.test(t) ? 'up' : /down|extend/i.test(t) ? 'down' : 'idle';
    busy = false;
  }).observe(status, {childList: true, characterData: true, subtree: true});

  // Mute button: if app.js writes an emoji, swap it for the SVG icon
  let swapping = false;
  new MutationObserver(() => {
    if (swapping || mute.querySelector('svg')) return; swapping = true;
    const off = /🔇|🔈|off|mute/i.test(mute.textContent) && !/🔊/.test(mute.textContent);
    mute.innerHTML = `<svg><use href="#i-${off ? 'mute' : 'vol'}"/></svg>`;
    swapping = false;
  }).observe(mute, {childList: true, characterData: true, subtree: true});

  // Overlay exit transition
  $('startBtn').addEventListener('click', () => overlay.classList.add('is-leaving'));
})();
