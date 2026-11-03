// app.js - RepVision Multi-Exercise Web Application

const MIN_VISIBILITY = 0.5;
const TRAIL_LEN = 16;

// One Euro Filter implementation in JavaScript
class OneEuro {
  constructor(fps = 30, minCutoff = 1.5, beta = 0.02, dCutoff = 1.0) {
    this.fps = fps;
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.xPrev = null;
    this.dxPrev = 0.0;
  }

  alpha(cutoff) {
    const tau = 1.0 / (2 * Math.PI * cutoff);
    return 1.0 / (1.0 + tau * this.fps);
  }

  filter(x) {
    if (this.xPrev === null) {
      this.xPrev = x;
      return x;
    }
    const dx = (x - this.xPrev) * this.fps;
    const aD = this.alpha(this.dCutoff);
    const dxHat = aD * dx + (1 - aD) * this.dxPrev;
    const a = this.alpha(this.minCutoff + this.beta * Math.abs(dxHat));
    const xHat = a * x + (1 - a) * this.xPrev;
    this.xPrev = xHat;
    this.dxPrev = dxHat;
    return xHat;
  }
}

// Calculate angle at point b formed by a-b-c
function angleAt(a, b, c) {
  if (!a || !b || !c) return null;
  const ba = [a[0] - b[0], a[1] - b[1]];
  const bc = [c[0] - b[0], c[1] - b[1]];
  const dot = ba[0] * bc[0] + ba[1] * bc[1];
  const magBA = Math.hypot(ba[0], ba[1]);
  const magBC = Math.hypot(bc[0], bc[1]);
  const denom = magBA * magBC;
  if (denom < 1e-6) return null;
  const cos = Math.min(1.0, Math.max(-1.0, dot / denom));
  return (Math.acos(cos) * 180) / Math.PI;
}

// Sound Manager with Web Audio API + Audio Elements + SpeechSynthesis
class SoundManager {
  constructor() {
    this.audioCtx = null;
    this.muted = false;
    this.unlocked = false;
    this.bufferCache = new Map();

    this.baseUrl = new URL('.', window.location.href).href;
    this.custom20Url = new URL('sounds/custom_20_plus.mp3', this.baseUrl).href;
    this.custom35Url = new URL('sounds/custom_35_plus.mp3', this.baseUrl).href;
  }

  init() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    if (!this.unlocked && this.audioCtx) {
      try {
        const buffer = this.audioCtx.createBuffer(1, 1, 22050);
        const source = this.audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.audioCtx.destination);
        source.start(0);
        this.unlocked = true;
      } catch (e) {
        console.warn('Audio unlock note:', e);
      }
    }

    if ('speechSynthesis' in window) {
      try {
        const silentUtterance = new SpeechSynthesisUtterance('');
        window.speechSynthesis.speak(silentUtterance);
      } catch (e) {}
    }
  }

  preloadKeySounds() {
    if (!this.audioCtx) return;
    this.loadAudioBuffer(this.custom20Url);
    this.loadAudioBuffer(this.custom35Url);
    for (let i = 1; i <= 5; i++) {
      this.loadAudioBuffer(new URL(`sounds/${i}.wav`, this.baseUrl).href);
    }
  }

  async loadAudioBuffer(url) {
    if (!this.audioCtx) return null;
    if (this.bufferCache.has(url)) {
      return this.bufferCache.get(url);
    }
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      const decoded = await this.audioCtx.decodeAudioData(arrayBuffer);
      this.bufferCache.set(url, decoded);
      return decoded;
    } catch (e) {
      return null;
    }
  }

  async playSoundUrl(url, volume = 1.0, fallbackFn = null) {
    if (this.muted) return;
    this.init();

    if (this.audioCtx) {
      try {
        let buffer = await this.loadAudioBuffer(url);
        if (buffer) {
          const source = this.audioCtx.createBufferSource();
          const gain = this.audioCtx.createGain();
          gain.gain.value = volume;
          source.buffer = buffer;
          source.connect(gain);
          gain.connect(this.audioCtx.destination);
          source.start(0);
          return true;
        }
      } catch (e) {
        console.warn('Web Audio playback failed, falling back:', e);
      }
    }

    try {
      const audio = new Audio(url);
      audio.volume = volume;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          if (fallbackFn) fallbackFn();
        });
      }
      return true;
    } catch (e) {
      if (fallbackFn) fallbackFn();
      return false;
    }
  }

  playChime() {
    if (this.muted) return;
    this.init();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      const osc1 = this.audioCtx.createOscillator();
      const osc2 = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880.0, now);

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.3);
      osc2.stop(now + 0.3);
    } catch (e) {
      console.warn('Chime oscillator error:', e);
    }
  }

  speak(text) {
    if (this.muted) return;
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(String(text));
        utterance.rate = 1.3;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        window.speechSynthesis.speak(utterance);
      } catch (e) {}
    }
  }

  playRep(num) {
    if (this.muted) return;
    this.init();

    // 1. Instant bell chime SFX
    this.playChime();

    // 2. Tiered custom motivation/milestone audio
    if (num >= 35) {
      this.playSoundUrl(this.custom35Url, 1.0);
    } else if (num >= 20) {
      this.playSoundUrl(this.custom20Url, 1.0);
    }

    // 3. Voice counting
    const wavUrl = new URL(`sounds/${num}.wav`, this.baseUrl).href;
    this.playSoundUrl(wavUrl, 1.0, () => {
      this.speak(num);
    });
  }

  playReset() {
    if (this.muted) return;
    this.init();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.frequency.setValueAtTime(330, now);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.18);
    } catch (e) {}

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  testAudio() {
    this.init();
    this.playChime();
    setTimeout(() => {
      this.speak('Sound working!');
    }, 300);
  }
}

// ---------------- Application State & Initialization ----------------
const soundManager = new SoundManager();

// DOM Elements
const videoElement       = document.getElementById('webcam');
const canvasElement      = document.getElementById('output_canvas');
const canvasCtx          = canvasElement.getContext('2d');
const counterCard        = document.getElementById('counterCard');
const repCountEl         = document.getElementById('repCount');
const repStatusEl        = document.getElementById('repStatus');
const angleBadgeEl       = document.getElementById('angleBadge');
const counterHeaderLabel = document.getElementById('counterHeaderLabel');
const hudExerciseTitle   = document.getElementById('hudExerciseTitle');
const currentExerciseName= document.getElementById('currentExerciseName');
const placementHint      = document.getElementById('placementHint');
const hintViewBadge      = document.getElementById('hintViewBadge');
const hintText           = document.getElementById('hintText');
const startOverlay       = document.getElementById('startOverlay');
const startBtn           = document.getElementById('startBtn');
const startChooseExBtn   = document.getElementById('startChooseExBtn');
const modalExerciseTitle = document.getElementById('modalExerciseTitle');
const modalViewTag       = document.getElementById('modalViewTag');
const modalMuscleTag     = document.getElementById('modalMuscleTag');
const modalTipText       = document.getElementById('modalTipText');

// Buttons
const exerciseSelectBtn  = document.getElementById('exerciseSelectBtn');
const addRepBtn          = document.getElementById('addRepBtn');
const undoRepBtn         = document.getElementById('undoRepBtn');
const resetBtn           = document.getElementById('resetBtn');
const finishSetBtn       = document.getElementById('finishSetBtn');
const tuningBtn          = document.getElementById('tuningBtn');
const logBtn             = document.getElementById('logBtn');
const testAudioBtn       = document.getElementById('testAudioBtn');
const cameraFlipBtn      = document.getElementById('cameraFlipBtn');
const muteBtn            = document.getElementById('muteBtn');

// Manual Mode Elements
const manualOverlay      = document.getElementById('manualOverlay');
const manualExName       = document.getElementById('manualExName');
const manualRepDisplay   = document.getElementById('manualRepDisplay');
const manualBigAddBtn    = document.getElementById('manualBigAddBtn');

// Direct Exercise Buttons Navigation Bar & Start Picker
const quickMuscleStrip   = document.getElementById('quickMuscleStrip');
const quickExerciseStrip = document.getElementById('quickExerciseStrip');
const startExerciseGrid  = document.getElementById('startExerciseGrid');

// Modals
const exerciseModal      = document.getElementById('exerciseModal');
const exerciseBackdrop   = document.getElementById('exerciseBackdrop');
const closeExerciseBtn   = document.getElementById('closeExerciseBtn');
const muscleTabs         = document.getElementById('muscleTabs');
const exerciseList       = document.getElementById('exerciseList');

const finishSetModal     = document.getElementById('finishSetModal');
const finishBackdrop     = document.getElementById('finishBackdrop');
const closeFinishBtn     = document.getElementById('closeFinishBtn');
const finishRepsVal      = document.getElementById('finishRepsVal');
const finishModeVal      = document.getElementById('finishModeVal');
const finishStatLbl      = document.getElementById('finishStatLbl');
const setWeightInput     = document.getElementById('setWeightInput');
const confirmSaveSetBtn  = document.getElementById('confirmSaveSetBtn');
const discardSetBtn      = document.getElementById('discardSetBtn');

const logModal           = document.getElementById('logModal');
const logBackdrop        = document.getElementById('logBackdrop');
const closeLogBtn        = document.getElementById('closeLogBtn');
const logItemsList       = document.getElementById('logItemsList');
const logSummaryText     = document.getElementById('logSummaryText');
const clearAllLogsBtn    = document.getElementById('clearAllLogsBtn');

const tuningPanel        = document.getElementById('tuningPanel');
const closeTuningBtn     = document.getElementById('closeTuningBtn');
const tuneAngle          = document.getElementById('tuneAngle');
const tuneStage          = document.getElementById('tuneStage');
const tuneFps            = document.getElementById('tuneFps');
const tuneSide           = document.getElementById('tuneSide');
const tuneJointsVis      = document.getElementById('tuneJointsVis');
const tuneStart          = document.getElementById('tuneStart');
const tuneEnd            = document.getElementById('tuneEnd');
const tuneSaveBtn        = document.getElementById('tuneSaveBtn');
const tuneResetBtn       = document.getElementById('tuneResetBtn');

// Active Exercise & Counter
let currentExercise = null;
let repCounter = null;
let currentFacingMode = 'user'; // 'user' (front) or 'environment' (back)
let cameraStream = null;
let cameraActive = false;

// Filters
const xyFilters = {};
const angleFilter = new OneEuro(30, 1.0, 0.01);
const trails = { L: [], R: [] };

// FPS tracking
let lastFrameTime = performance.now();
let fpsSmoothed = 30;

// Tuning overrides cache from localStorage
let tuningOverrides = {};
try {
  const saved = localStorage.getItem('repvision_tuning_overrides');
  if (saved) tuningOverrides = JSON.parse(saved);
} catch (e) {
  console.warn('Could not read tuning overrides:', e);
}

// ---------------- Exercise Selection & Configuration ----------------
function getActiveExerciseConfig(ex) {
  const override = tuningOverrides[ex.id];
  if (override) {
    return {
      ...ex,
      start: typeof override.start === 'number' ? override.start : ex.start,
      end:   typeof override.end === 'number'   ? override.end   : ex.end
    };
  }
  return { ...ex };
}

function selectExercise(exerciseId) {
  const baseEx = getExerciseById(exerciseId);
  currentExercise = getActiveExerciseConfig(baseEx);

  try {
    localStorage.setItem('repvision_selected_exercise', exerciseId);
  } catch (e) {}

  // Re-initialize RepCounter with active exercise config
  repCounter = new RepCounter(currentExercise, (count) => {
    soundManager.playRep(count);
  });
  window.currentRepCounter = repCounter;

  // Reset xyFilters for all relevant landmark indices
  if (currentExercise.joints) {
    currentExercise.joints.forEach(j => {
      const idxs = LANDMARK_INDICES[j];
      if (idxs) {
        xyFilters[idxs.left] = [new OneEuro(30, 1.5, 0.02), new OneEuro(30, 1.5, 0.02)];
        xyFilters[idxs.right] = [new OneEuro(30, 1.5, 0.02), new OneEuro(30, 1.5, 0.02)];
      }
    });
  }

  // Update UI Elements
  currentExerciseName.textContent = currentExercise.name;
  hudExerciseTitle.textContent    = currentExercise.name;
  modalExerciseTitle.textContent  = currentExercise.name;
  modalViewTag.textContent        = (currentExercise.view || 'front') + ' view';
  modalMuscleTag.textContent      = currentExercise.muscle;
  modalTipText.textContent        = currentExercise.tip || 'Stand back so your body is in frame.';

  hintViewBadge.textContent = (currentExercise.view || 'front').toUpperCase();
  if (currentExercise.mode === 'timer') {
    hintText.textContent = `Hold straight line (${currentExercise.start}° to ${currentExercise.end}°)`;
    counterHeaderLabel.textContent = 'Hold (s)';
  } else if (currentExercise.mode === 'manual') {
    hintText.textContent = 'Manual exercise - use +1 button to log reps';
    counterHeaderLabel.textContent = 'Reps';
  } else {
    const isCurl = currentExercise.start > currentExercise.end;
    const startText = isCurl ? `Extend past ${currentExercise.start}°` : `Lower past ${currentExercise.start}°`;
    const endText   = isCurl ? `curl below ${currentExercise.end}°` : `press above ${currentExercise.end}°`;
    hintText.textContent = `${startText}, then ${endText}`;
    counterHeaderLabel.textContent = 'Reps';
  }

  if (currentExercise.view === 'side') {
    hintText.textContent = 'Stand sideways to camera. ' + hintText.textContent;
  }

  // Manual mode screen toggle
  if (currentExercise.mode === 'manual') {
    manualOverlay.style.display = 'flex';
    manualExName.textContent = currentExercise.name;
    manualRepDisplay.textContent = '0';
  } else {
    manualOverlay.style.display = 'none';
  }

  // Update Tuning Panel Inputs
  tuneStart.value = currentExercise.start || 0;
  tuneEnd.value   = currentExercise.end   || 0;

  // Reset count display
  updateHUDDisplays();

  // Update Start Button Text
  if (startBtn) {
    startBtn.textContent = `Start ${currentExercise.name}`;
  }

  // Sync Quick Exercise Bar
  if (currentNavCategory !== 'all' && currentExercise.muscle !== currentNavCategory) {
    currentNavCategory = currentExercise.muscle;
    document.querySelectorAll('.muscle-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.muscle === currentNavCategory);
    });
    renderQuickExerciseButtons(currentNavCategory);
  } else {
    document.querySelectorAll('.ex-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.id === currentExercise.id);
    });
  }

  // Scroll active button into view in top strip
  if (quickExerciseStrip) {
    const activeBtn = quickExerciseStrip.querySelector(`.ex-btn[data-id="${currentExercise.id}"]`);
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  // Sync Start Screen Exercise Picker Buttons
  document.querySelectorAll('.start-ex-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.id === currentExercise.id);
  });

  // Highlight in modal if open
  renderExerciseList(currentActiveMuscleTab);
}

function updateHUDDisplays() {
  if (!repCounter) return;
  repCountEl.textContent = repCounter.reps;
  repStatusEl.textContent = repCounter.statusText;
  counterCard.dataset.progress = repCounter.progress.toFixed(3);
  if (manualRepDisplay) manualRepDisplay.textContent = repCounter.reps;
}

// ---------------- Direct Exercise Buttons on Website ----------------
let currentNavCategory = 'all';

function initQuickExerciseBar() {
  if (!quickMuscleStrip || !quickExerciseStrip) return;

  quickMuscleStrip.innerHTML = '';
  MUSCLE_GROUPS.forEach(mg => {
    const btn = document.createElement('button');
    btn.className = `muscle-btn ${mg.id === currentNavCategory ? 'active' : ''}`;
    btn.dataset.muscle = mg.id;
    btn.innerHTML = `<span>${mg.icon || '💪'}</span><span>${mg.name}</span>`;
    btn.addEventListener('click', () => {
      currentNavCategory = mg.id;
      document.querySelectorAll('.muscle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderQuickExerciseButtons(currentNavCategory);
    });
    quickMuscleStrip.appendChild(btn);
  });

  renderQuickExerciseButtons(currentNavCategory);
}

function renderQuickExerciseButtons(categoryId = 'all') {
  if (!quickExerciseStrip) return;
  quickExerciseStrip.innerHTML = '';

  const list = categoryId === 'all' 
    ? EXERCISES 
    : EXERCISES.filter(e => e.muscle === categoryId);

  list.forEach(ex => {
    const btn = document.createElement('button');
    btn.className = `ex-btn ${currentExercise && ex.id === currentExercise.id ? 'active' : ''}`;
    btn.dataset.id = ex.id;
    btn.title = `${ex.name} (${ex.view || 'front'} view)`;

    let tag = ex.view || 'front';
    if (ex.mode === 'timer') tag = 'timer';
    if (ex.mode === 'manual') tag = 'manual';

    btn.innerHTML = `
      <span class="ex-btn-icon">${ex.icon || '⚡'}</span>
      <span class="ex-btn-name">${ex.name}</span>
      <span class="ex-btn-tag">${tag}</span>
    `;

    btn.addEventListener('click', () => {
      selectExercise(ex.id);
    });

    quickExerciseStrip.appendChild(btn);
  });
}

// ---------------- Direct Exercise Buttons on Start Overlay ----------------
function initStartScreenExercisePicker() {
  if (!startExerciseGrid) return;
  startExerciseGrid.innerHTML = '';

  EXERCISES.forEach(ex => {
    const btn = document.createElement('button');
    btn.className = `start-ex-btn ${currentExercise && ex.id === currentExercise.id ? 'active' : ''}`;
    btn.dataset.id = ex.id;
    btn.innerHTML = `<span>${ex.icon || '⚡'}</span><span>${ex.name}</span>`;
    btn.addEventListener('click', () => {
      selectExercise(ex.id);
    });
    startExerciseGrid.appendChild(btn);
  });
}

// ---------------- Exercise Picker Modal ----------------
let currentActiveMuscleTab = 'all';

function initExercisePicker() {
  muscleTabs.innerHTML = '';
  MUSCLE_GROUPS.forEach(mg => {
    const btn = document.createElement('button');
    btn.className = `tab-btn ${mg.id === currentActiveMuscleTab ? 'active' : ''}`;
    btn.textContent = `${mg.icon || ''} ${mg.name}`.trim();
    btn.addEventListener('click', () => {
      currentActiveMuscleTab = mg.id;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderExerciseList(mg.id);
    });
    muscleTabs.appendChild(btn);
  });

  renderExerciseList(currentActiveMuscleTab);
}

function renderExerciseList(muscleId) {
  exerciseList.innerHTML = '';
  const filtered = muscleId === 'all' 
    ? EXERCISES 
    : EXERCISES.filter(e => e.muscle === muscleId);

  filtered.forEach(ex => {
    const item = document.createElement('button');
    item.className = `exercise-item ${ex.id === currentExercise.id ? 'selected' : ''}`;
    
    let rangeBadge = '';
    if (ex.mode === 'timer') {
      rangeBadge = `<span class="ex-badge angles">Timer</span>`;
    } else if (ex.mode === 'manual') {
      rangeBadge = `<span class="ex-badge mode">Manual</span>`;
    } else {
      rangeBadge = `<span class="ex-badge angles">${ex.start}° → ${ex.end}°</span>`;
    }

    item.innerHTML = `
      <div class="ex-info">
        <span class="ex-name">${ex.name}</span>
        <div class="ex-tags">
          <span class="ex-badge view">${ex.view}</span>
          ${rangeBadge}
        </div>
        <span class="ex-tip">${ex.tip}</span>
      </div>
      ${ex.id === currentExercise.id ? '<div class="ex-check"><svg><use href="#i-check"/></svg></div>' : ''}
    `;

    item.addEventListener('click', () => {
      selectExercise(ex.id);
      closeModal(exerciseModal);
    });

    exerciseList.appendChild(item);
  });
}

function openModal(modalEl) {
  modalEl.style.display = 'flex';
  modalEl.setAttribute('aria-hidden', 'false');
}

function closeModal(modalEl) {
  modalEl.style.display = 'none';
  modalEl.setAttribute('aria-hidden', 'true');
}

// ---------------- Session Log Persistence (localStorage) ----------------
const LOG_KEY = 'repvision_session_log';

function getSessionLogs() {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('Error reading session log:', e);
    return [];
  }
}

function saveSessionLogs(logs) {
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(logs));
  } catch (e) {
    console.warn('Error saving session log:', e);
  }
}

function logCompletedSet(weight = null) {
  if (!repCounter || repCounter.reps <= 0) return;

  const logs = getSessionLogs();
  const newSet = {
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    exerciseId: currentExercise.id,
    exerciseName: currentExercise.name,
    reps: repCounter.reps,
    unit: currentExercise.mode === 'timer' ? 'sec' : 'reps',
    mode: currentExercise.mode === 'manual' ? 'manual' : (currentExercise.mode === 'timer' ? 'timer' : 'camera'),
    weight: typeof weight === 'number' && !isNaN(weight) && weight > 0 ? weight : null
  };

  logs.unshift(newSet);
  saveSessionLogs(logs);

  soundManager.playChime();
  repCounter.reset();
  updateHUDDisplays();
}

function deleteLogItem(id) {
  let logs = getSessionLogs();
  logs = logs.filter(l => l.id !== id);
  saveSessionLogs(logs);
  renderLogModal();
}

function clearAllLogs() {
  if (confirm('Clear today\'s workout log?')) {
    saveSessionLogs([]);
    renderLogModal();
  }
}

function renderLogModal() {
  const logs = getSessionLogs();
  logItemsList.innerHTML = '';

  const todayStr = new Date().toDateString();
  const todayLogs = logs.filter(l => new Date(l.timestamp).toDateString() === todayStr);

  const totalReps = todayLogs.reduce((acc, l) => acc + (l.unit === 'reps' ? l.reps : 0), 0);
  logSummaryText.textContent = `${todayLogs.length} sets completed today (${totalReps} total reps)`;

  if (todayLogs.length === 0) {
    logItemsList.innerHTML = `<div class="log-empty">No sets recorded yet today. Complete a set and tap ✓ Finish!</div>`;
    return;
  }

  todayLogs.forEach(set => {
    const timeStr = new Date(set.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const item = document.createElement('div');
    item.className = 'log-item';
    item.innerHTML = `
      <div class="log-item-info">
        <span class="log-item-title">${set.exerciseName}</span>
        <div class="log-item-meta">
          <span>${timeStr}</span>
          <span>•</span>
          <span>${set.mode.toUpperCase()}</span>
          ${set.weight ? `<span>• ${set.weight} kg/lbs</span>` : ''}
        </div>
      </div>
      <div style="display:flex;align-items:center;">
        <span class="log-item-stat">${set.reps} <small style="font-size:12px;color:var(--mute)">${set.unit}</small></span>
        <button class="log-del-btn" title="Delete set" data-id="${set.id}">
          <svg><use href="#i-trash"/></svg>
        </button>
      </div>
    `;

    item.querySelector('.log-del-btn').addEventListener('click', (ev) => {
      ev.stopPropagation();
      deleteLogItem(set.id);
    });

    logItemsList.appendChild(item);
  });
}

// ---------------- MediaPipe Pose Processing ----------------
const pose = new Pose({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
});

pose.setOptions({
  modelComplexity: 1,
  smoothLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

pose.onResults(onPoseResults);

function onPoseResults(results) {
  // Update FPS calculation
  const now = performance.now();
  const delta = now - lastFrameTime;
  lastFrameTime = now;
  if (delta > 0) {
    fpsSmoothed = 0.9 * fpsSmoothed + 0.1 * (1000 / delta);
  }

  const w = canvasElement.width;
  const h = canvasElement.height;

  canvasCtx.save();
  canvasCtx.clearRect(0, 0, w, h);

  if (currentExercise.mode === 'manual') {
    canvasCtx.restore();
    return;
  }

  if (!results.poseLandmarks) {
    repCounter.update(null, now);
    updateHUDDisplays();
    canvasCtx.restore();
    return;
  }

  const lm = results.poseLandmarks;
  const pts = {};

  // Extract the 3 joints for current exercise
  const [j0, j1, j2] = currentExercise.joints;
  const leftIdxs  = [LANDMARK_INDICES[j0].left,  LANDMARK_INDICES[j1].left,  LANDMARK_INDICES[j2].left];
  const rightIdxs = [LANDMARK_INDICES[j0].right, LANDMARK_INDICES[j1].right, LANDMARK_INDICES[j2].right];

  const allIdxs = [...leftIdxs, ...rightIdxs];
  allIdxs.forEach(idx => {
    const p = lm[idx];
    if (p && p.visibility >= MIN_VISIBILITY) {
      if (!xyFilters[idx]) {
        xyFilters[idx] = [new OneEuro(30, 1.5, 0.02), new OneEuro(30, 1.5, 0.02)];
      }
      const fx = xyFilters[idx][0].filter(p.x * w);
      const fy = xyFilters[idx][1].filter(p.y * h);
      pts[idx] = [fx, fy];
    }
  });

  // Check left and right side visibility
  const leftVisible  = leftIdxs.every(idx  => pts[idx]);
  const rightVisible = rightIdxs.every(idx => pts[idx]);

  const avgVisL = leftIdxs.reduce((sum, idx)  => sum + (lm[idx]?.visibility || 0), 0) / 3;
  const avgVisR = rightIdxs.reduce((sum, idx) => sum + (lm[idx]?.visibility || 0), 0) / 3;

  let computedAngle = null;
  let activeSideChosen = 'none';
  let activeBones = [];
  let pivotJoints = [];

  if (currentExercise.sides === 'best') {
    // Choose whichever side has higher average visibility
    if (leftVisible && rightVisible) {
      if (avgVisL >= avgVisR) {
        computedAngle = angleAt(pts[leftIdxs[0]], pts[leftIdxs[1]], pts[leftIdxs[2]]);
        activeSideChosen = 'left';
        activeBones.push([leftIdxs[0], leftIdxs[1]], [leftIdxs[1], leftIdxs[2]]);
        pivotJoints.push({ pt: pts[leftIdxs[1]], ang: computedAngle });
      } else {
        computedAngle = angleAt(pts[rightIdxs[0]], pts[rightIdxs[1]], pts[rightIdxs[2]]);
        activeSideChosen = 'right';
        activeBones.push([rightIdxs[0], rightIdxs[1]], [rightIdxs[1], rightIdxs[2]]);
        pivotJoints.push({ pt: pts[rightIdxs[1]], ang: computedAngle });
      }
    } else if (leftVisible) {
      computedAngle = angleAt(pts[leftIdxs[0]], pts[leftIdxs[1]], pts[leftIdxs[2]]);
      activeSideChosen = 'left';
      activeBones.push([leftIdxs[0], leftIdxs[1]], [leftIdxs[1], leftIdxs[2]]);
      pivotJoints.push({ pt: pts[leftIdxs[1]], ang: computedAngle });
    } else if (rightVisible) {
      computedAngle = angleAt(pts[rightIdxs[0]], pts[rightIdxs[1]], pts[rightIdxs[2]]);
      activeSideChosen = 'right';
      activeBones.push([rightIdxs[0], rightIdxs[1]], [rightIdxs[1], rightIdxs[2]]);
      pivotJoints.push({ pt: pts[rightIdxs[1]], ang: computedAngle });
    }
  } else {
    // 'both' mode: average available sides
    const angL = leftVisible  ? angleAt(pts[leftIdxs[0]],  pts[leftIdxs[1]],  pts[leftIdxs[2]])  : null;
    const angR = rightVisible ? angleAt(pts[rightIdxs[0]], pts[rightIdxs[1]], pts[rightIdxs[2]]) : null;

    if (angL !== null && angR !== null) {
      computedAngle = (angL + angR) / 2;
      activeSideChosen = 'both';
      activeBones.push([leftIdxs[0], leftIdxs[1]], [leftIdxs[1], leftIdxs[2]],
                       [rightIdxs[0], rightIdxs[1]], [rightIdxs[1], rightIdxs[2]]);
      pivotJoints.push({ pt: pts[leftIdxs[1]], ang: angL }, { pt: pts[rightIdxs[1]], ang: angR });
    } else if (angL !== null) {
      computedAngle = angL;
      activeSideChosen = 'left';
      activeBones.push([leftIdxs[0], leftIdxs[1]], [leftIdxs[1], leftIdxs[2]]);
      pivotJoints.push({ pt: pts[leftIdxs[1]], ang: angL });
    } else if (angR !== null) {
      computedAngle = angR;
      activeSideChosen = 'right';
      activeBones.push([rightIdxs[0], rightIdxs[1]], [rightIdxs[1], rightIdxs[2]]);
      pivotJoints.push({ pt: pts[rightIdxs[1]], ang: angR });
    }
  }

  // Smooth combined angle with OneEuro filter
  let smoothedAngle = null;
  if (computedAngle !== null) {
    smoothedAngle = angleFilter.filter(computedAngle);
  }

  // Update RepCounter state machine
  repCounter.update(smoothedAngle, now);
  updateHUDDisplays();

  // Angle Badge in HUD
  if (smoothedAngle !== null) {
    angleBadgeEl.textContent = `Angle: ${Math.round(smoothedAngle)}°`;
  } else {
    angleBadgeEl.textContent = 'Angle: --°';
  }

  // Draw active bones
  activeBones.forEach(([a, b]) => {
    if (pts[a] && pts[b]) {
      canvasCtx.strokeStyle = '#6fe3b0';
      canvasCtx.lineWidth = 4;
      canvasCtx.beginPath();
      canvasCtx.moveTo(pts[a][0], pts[a][1]);
      canvasCtx.lineTo(pts[b][0], pts[b][1]);
      canvasCtx.stroke();
    }
  });

  // Draw active joint dots
  allIdxs.forEach(idx => {
    if (pts[idx]) {
      const [x, y] = pts[idx];
      canvasCtx.fillStyle = '#ffffff';
      canvasCtx.strokeStyle = '#6fe3b0';
      canvasCtx.lineWidth = 2.5;
      canvasCtx.beginPath();
      canvasCtx.arc(x, y, 6, 0, 2 * Math.PI);
      canvasCtx.fill();
      canvasCtx.stroke();
    }
  });

  // Draw angle labels next to pivot joints
  pivotJoints.forEach(({ pt, ang }) => {
    if (pt && ang !== null) {
      canvasCtx.fillStyle = '#ffffff';
      canvasCtx.font = 'bold 15px sans-serif';
      canvasCtx.fillText(`${Math.round(ang)}°`, pt[0] + 12, pt[1] - 8);
    }
  });

  // Live Tuning Panel Update
  if (tuningPanel && tuningPanel.style.display !== 'none') {
    tuneAngle.textContent = smoothedAngle !== null ? `${Math.round(smoothedAngle)}°` : '--°';
    tuneStage.textContent = repCounter.stage;
    tuneFps.textContent   = Math.round(fpsSmoothed);
    tuneSide.textContent  = activeSideChosen;

    tuneJointsVis.innerHTML = `
      <div class="vis-row"><span>${j0}</span><span>${avgVisL.toFixed(2)} / ${avgVisR.toFixed(2)}</span></div>
      <div class="vis-row"><span>${j1}</span><span>${(lm[LANDMARK_INDICES[j1].left]?.visibility || 0).toFixed(2)} / ${(lm[LANDMARK_INDICES[j1].right]?.visibility || 0).toFixed(2)}</span></div>
      <div class="vis-row"><span>${j2}</span><span>${(lm[LANDMARK_INDICES[j2].left]?.visibility || 0).toFixed(2)} / ${(lm[LANDMARK_INDICES[j2].right]?.visibility || 0).toFixed(2)}</span></div>
    `;
  }

  canvasCtx.restore();
}

// ---------------- Camera Feed Loop ----------------
async function startCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
  }

  const constraints = {
    video: {
      facingMode: currentFacingMode,
      width:  { ideal: 1280 },
      height: { ideal: 720 }
    },
    audio: false
  };

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
    videoElement.srcObject = cameraStream;
    await videoElement.play();

    canvasElement.width  = videoElement.videoWidth  || 640;
    canvasElement.height = videoElement.videoHeight || 480;

    cameraActive = true;
    processVideoLoop();
  } catch (err) {
    alert('Could not access camera: ' + err.message);
  }
}

async function processVideoLoop() {
  if (!videoElement.paused && !videoElement.ended && cameraActive) {
    if (canvasElement.width !== videoElement.videoWidth) {
      canvasElement.width  = videoElement.videoWidth;
      canvasElement.height = videoElement.videoHeight;
    }
    if (currentExercise.mode !== 'manual') {
      await pose.send({ image: videoElement });
    }
  }
  requestAnimationFrame(processVideoLoop);
}

// ---------------- Event Listeners & Wire-up ----------------
function setupEventListeners() {
  // Start Workout
  startBtn.addEventListener('click', () => {
    soundManager.init();
    soundManager.preloadKeySounds();
    soundManager.playChime();
    startOverlay.classList.add('is-leaving');
    setTimeout(() => {
      startOverlay.style.display = 'none';
    }, 600);
    startCamera();
  });

  if (startChooseExBtn) {
    startChooseExBtn.addEventListener('click', () => {
      openModal(exerciseModal);
    });
  }

  // Exercise Picker
  exerciseSelectBtn.addEventListener('click', () => {
    openModal(exerciseModal);
  });
  closeExerciseBtn.addEventListener('click', () => {
    closeModal(exerciseModal);
  });
  exerciseBackdrop.addEventListener('click', () => {
    closeModal(exerciseModal);
  });

  // HUD Quick Action Buttons
  addRepBtn.addEventListener('click', () => {
    repCounter.addRep();
    updateHUDDisplays();
  });
  manualBigAddBtn.addEventListener('click', () => {
    repCounter.addRep();
    updateHUDDisplays();
  });

  undoRepBtn.addEventListener('click', () => {
    repCounter.undoRep();
    updateHUDDisplays();
  });

  resetBtn.addEventListener('click', () => {
    repCounter.reset();
    soundManager.playReset();
    updateHUDDisplays();
  });

  // Finish Set
  finishSetBtn.addEventListener('click', () => {
    finishRepsVal.textContent = repCounter.reps;
    finishModeVal.textContent = currentExercise.mode.toUpperCase();
    finishStatLbl.textContent = currentExercise.mode === 'timer' ? 'Seconds Held' : 'Reps Done';
    setWeightInput.value = '';
    openModal(finishSetModal);
  });

  closeFinishBtn.addEventListener('click', () => {
    closeModal(finishSetModal);
  });
  finishBackdrop.addEventListener('click', () => {
    closeModal(finishSetModal);
  });
  discardSetBtn.addEventListener('click', () => {
    closeModal(finishSetModal);
  });

  confirmSaveSetBtn.addEventListener('click', () => {
    const weight = parseFloat(setWeightInput.value);
    logCompletedSet(weight);
    closeModal(finishSetModal);
  });

  // Log Modal
  logBtn.addEventListener('click', () => {
    renderLogModal();
    openModal(logModal);
  });
  closeLogBtn.addEventListener('click', () => {
    closeModal(logModal);
  });
  logBackdrop.addEventListener('click', () => {
    closeModal(logModal);
  });
  clearAllLogsBtn.addEventListener('click', () => {
    clearAllLogs();
  });

  // Tuning Panel Toggle
  tuningBtn.addEventListener('click', () => {
    toggleTuningPanel();
  });
  closeTuningBtn.addEventListener('click', () => {
    tuningPanel.style.display = 'none';
  });

  // Keyboard shortcut 'd' to toggle tuning panel
  window.addEventListener('keydown', (e) => {
    if (e.key === 'd' || e.key === 'D') {
      if (e.target.tagName !== 'INPUT') {
        toggleTuningPanel();
      }
    }
  });

  tuneSaveBtn.addEventListener('click', () => {
    const newStart = parseFloat(tuneStart.value);
    const newEnd   = parseFloat(tuneEnd.value);
    if (!isNaN(newStart) && !isNaN(newEnd)) {
      tuningOverrides[currentExercise.id] = { start: newStart, end: newEnd };
      try {
        localStorage.setItem('repvision_tuning_overrides', JSON.stringify(tuningOverrides));
      } catch (e) {}
      selectExercise(currentExercise.id);
      alert(`Overrides saved for ${currentExercise.name}: ${newStart}° -> ${newEnd}°`);
    }
  });

  tuneResetBtn.addEventListener('click', () => {
    delete tuningOverrides[currentExercise.id];
    try {
      localStorage.setItem('repvision_tuning_overrides', JSON.stringify(tuningOverrides));
    } catch (e) {}
    selectExercise(currentExercise.id);
    alert(`Reset ${currentExercise.name} to default angles.`);
  });

  // Test sound
  testAudioBtn.addEventListener('click', () => {
    soundManager.testAudio();
  });

  // Mute Toggle
  muteBtn.addEventListener('click', () => {
    soundManager.muted = !soundManager.muted;
    muteBtn.innerHTML = soundManager.muted 
      ? '<svg><use href="#i-mute"/></svg>' 
      : '<svg><use href="#i-vol"/></svg>';
  });

  // Flip Camera
  cameraFlipBtn.addEventListener('click', () => {
    currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    videoElement.style.transform  = currentFacingMode === 'user' ? 'scaleX(-1)' : 'scaleX(1)';
    canvasElement.style.transform = currentFacingMode === 'user' ? 'scaleX(-1)' : 'scaleX(1)';
    startCamera();
  });

  // Unmute / AudioContext prime on first touch anywhere
  window.addEventListener('click', () => soundManager.init(), { once: true });
  window.addEventListener('touchstart', () => soundManager.init(), { once: true });
}

function toggleTuningPanel() {
  if (tuningPanel.style.display === 'none' || !tuningPanel.style.display) {
    tuningPanel.style.display = 'flex';
    tuneStart.value = currentExercise.start;
    tuneEnd.value   = currentExercise.end;
  } else {
    tuningPanel.style.display = 'none';
  }
}

// ---------------- Bootstrap ----------------
let initialExId = 'hammer_curl';
try {
  const saved = localStorage.getItem('repvision_selected_exercise');
  if (saved) initialExId = saved;
} catch (e) {}

initQuickExerciseBar();
initStartScreenExercisePicker();
selectExercise(initialExId);
initExercisePicker();
setupEventListeners();
