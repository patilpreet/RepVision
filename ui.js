// ui.js - UI animations and reactive observers for RepVision
(() => {
  const $ = id => document.getElementById(id);
  const card = $('counterCard'), count = $('repCount'), status = $('repStatus'),
    angle = $('angleBadge'), ring = $('ringFill'), mute = $('muteBtn'), overlay = $('startOverlay');
  const C = 326.7;

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
  }).observe(count, { childList: true, characterData: true, subtree: true });

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
  }).observe(card, { attributes: true, attributeFilter: ['data-progress'] });

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
  }).observe(status, { childList: true, characterData: true, subtree: true });

  // Mute button: if text emoji is inserted, swap it for the SVG icon
  let swapping = false;
  new MutationObserver(() => {
    if (swapping || !mute || mute.querySelector('svg')) return;
    swapping = true;
    const off = /🔇|🔈|off|mute/i.test(mute.textContent) && !/🔊/.test(mute.textContent);
    mute.innerHTML = `<svg><use href="#i-${off ? 'mute' : 'vol'}"/></svg>`;
    swapping = false;
  }).observe(mute, { childList: true, characterData: true, subtree: true });

  // Overlay exit transition
  const startBtn = $('startBtn');
  if (startBtn && overlay) {
    startBtn.addEventListener('click', () => overlay.classList.add('is-leaving'));
  }
})();
/* RepVision extras: loads after ui.js and only drives existing buttons, so it never touches your counting logic. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
  const typing = t => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);

  /* toast */
  const toast = el('div', 'rv-toast'); document.body.appendChild(toast);
  let toastTimer;
  const say = msg => { toast.textContent = msg; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 1900); };

  /* has the workout started? */
  const overlay = $('#startOverlay');
  const started = () => {
    if (!overlay) return true;
    const cs = getComputedStyle(overlay);
    return overlay.classList.contains('is-leaving') || cs.display === 'none' || cs.visibility === 'hidden';
  };

  /* keep the screen awake during a workout */
  let lock = null;
  const wake = async () => { try { if (navigator.wakeLock) lock = await navigator.wakeLock.request('screen'); } catch (e) { } };
  document.addEventListener('visibilitychange', () => { if (!document.hidden && t0) wake(); });

  /* session clock inside the logo pill */
  const brand = $('.brand');
  const clock = el('span', 'session-time'); clock.hidden = true;
  if (brand) brand.appendChild(clock);
  let t0 = 0;
  const begin = () => {
    if (t0) return;
    t0 = Date.now(); clock.hidden = false; clock.textContent = '00:00'; wake();
    setInterval(() => {
      const s = Math.floor((Date.now() - t0) / 1000);
      clock.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    }, 1000);
  };
  if (overlay) new MutationObserver(() => { if (started()) begin(); }).observe(overlay, { attributes: true, attributeFilter: ['class', 'style'] });

  /* tiny haptic tick on every new rep */
  const rc = $('#repCount');
  if (rc) new MutationObserver(() => {
    if (navigator.vibrate && parseInt(rc.textContent, 10) > 0) navigator.vibrate(18);
  }).observe(rc, { childList: true, characterData: true, subtree: true });

  /* fullscreen */
  const toggleFs = () => {
    const d = document;
    if (!d.fullscreenElement) { if (d.documentElement.requestFullscreen) d.documentElement.requestFullscreen(); }
    else d.exitFullscreen();
  };

  /* shortcuts sheet */
  const keys = [['Space', 'Add a rep'], ['U', 'Undo rep'], ['R', 'Reset counter'], ['T', 'Rest timer'], ['Enter', 'Finish set / Start'], ['M', 'Mute'],
  ['C', 'Flip camera'], ['E', 'Exercise catalog'], ['G', 'Goal and sound'], ['L', 'Workout log'], ['F', 'Fullscreen'], ['?', 'This list']];
  const kb = el('div', 'kbd-sheet',
    '<div class="kbd-card"><h3>Shortcuts</h3>' +
    keys.map(k => '<div class="kbd-row"><kbd>' + k[0] + '</kbd><span>' + k[1] + '</span></div>').join('') + '</div>');
  kb.hidden = true; document.body.appendChild(kb);
  kb.addEventListener('click', () => { kb.hidden = true; });

  /* header buttons (desktop only, see CSS) */
  const bar = $('.controls-top');
  if (bar) {
    const mk = (title, svg, fn) => {
      const b = el('button', 'icon-btn rv-desk', svg); b.type = 'button'; b.title = title;
      b.addEventListener('click', fn); bar.appendChild(b);
    };
    mk('Fullscreen (F)', '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>', toggleFs);
    mk('Shortcuts (?)', '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M7 10h.01M11 10h.01M15 10h.01M8 14h8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>', () => { kb.hidden = !kb.hidden; });
  }

  /* mouse clicks should not leave focus on a button, so Space keeps adding reps */
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('button');
    if (b && e.detail > 0) setTimeout(() => b.blur(), 0);
  });

  /* keyboard shortcuts */
  const map = { ' ': '#addRepBtn', u: '#undoRepBtn', r: '#resetBtn', Enter: '#finishSetBtn', m: '#muteBtn', c: '#cameraFlipBtn', e: '#exerciseSelectBtn', g: '#goalBtn', l: '#logBtn' };
  document.addEventListener('keydown', e => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
    if (e.key === 'Escape') { kb.hidden = true; return; }
    if (e.key === '?') { kb.hidden = !kb.hidden; return; }
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === 'f') { toggleFs(); return; }
    if ((k === ' ' || k === 'Enter') && e.target.tagName === 'BUTTON') return;
    if (!started()) { if (k === 'Enter') { e.preventDefault(); const s = $('#startBtn'); if (s) s.click(); } return; }
    if ($('.modal-sheet.is-open')) return;
    const sel = map[k]; if (!sel) return;
    const b = $(sel); if (!b) return;
    e.preventDefault(); b.click();
    if (k === 'm') say('Sound toggled');
  });
})();