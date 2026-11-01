// RepVision Web - Live Hammer Curl Rep Counter (Mobile & PC)

const DOWN_ANGLE = 150;
const UP_ANGLE = 60;
const MIN_VISIBILITY = 0.5;
const TRAIL_LEN = 20;

// Joint Indices matching MediaPipe Pose
const JOINTS = {
    LEFT_SHOULDER: 11,
    RIGHT_SHOULDER: 12,
    LEFT_ELBOW: 13,
    RIGHT_ELBOW: 14,
    LEFT_WRIST: 15,
    RIGHT_WRIST: 16
};

const BONES = [
    [JOINTS.LEFT_SHOULDER, JOINTS.LEFT_ELBOW],
    [JOINTS.LEFT_ELBOW, JOINTS.LEFT_WRIST],
    [JOINTS.RIGHT_SHOULDER, JOINTS.RIGHT_ELBOW],
    [JOINTS.RIGHT_ELBOW, JOINTS.RIGHT_WRIST],
    [JOINTS.LEFT_SHOULDER, JOINTS.RIGHT_SHOULDER]
];

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

        // Safe relative base path
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

        // Unlock Web Audio on iOS Safari & mobile Chrome
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

        // Unlock SpeechSynthesis for mobile Safari
        if ('speechSynthesis' in window) {
            try {
                const silentUtterance = new SpeechSynthesisUtterance('');
                window.speechSynthesis.speak(silentUtterance);
            } catch (e) {}
        }
    }

    // Preload key audio buffers into memory
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

        // 1. Try playing via decoded Web Audio buffer (guaranteed no autoplay rejection)
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

        // 2. Try HTML5 Audio element
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

            // Two-tone bell chime: D5 (587.33Hz) + A5 (880Hz)
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

        // 3. Voice counting: try recorded wav first, fallback to browser speech synthesis
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
            this.speak("Sound working!");
        }, 300);
    }
}

// App Controller
const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const repCountEl = document.getElementById('repCount');
const repStatusEl = document.getElementById('repStatus');
const angleBadgeEl = document.getElementById('angleBadge');
const startOverlay = document.getElementById('startOverlay');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const muteBtn = document.getElementById('muteBtn');
const cameraFlipBtn = document.getElementById('cameraFlipBtn');
const testAudioBtn = document.getElementById('testAudioBtn');

let repCount = 0;
let repStage = null; // null -> "down" -> "up"
let currentFacingMode = 'user'; // 'user' (front) or 'environment' (back)
const soundManager = new SoundManager();

// One Euro filters for joints & angle
const xyFilters = {};
Object.values(JOINTS).forEach(j => {
    xyFilters[j] = [new OneEuro(30, 1.5, 0.02), new OneEuro(30, 1.5, 0.02)];
});
const angleFilter = new OneEuro(30, 1.0, 0.01);
const trails = { L: [], R: [] };

// Initialize MediaPipe Pose
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
    const w = canvasElement.width;
    const h = canvasElement.height;

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, w, h);

    if (!results.poseLandmarks) {
        canvasCtx.restore();
        return;
    }

    const lm = results.poseLandmarks;
    const pts = {};

    // Filter joint coordinates in pixel space
    Object.values(JOINTS).forEach(j => {
        const p = lm[j];
        if (p && p.visibility >= MIN_VISIBILITY) {
            const fx = xyFilters[j][0].filter(p.x * w);
            const fy = xyFilters[j][1].filter(p.y * h);
            pts[j] = [fx, fy];
        }
    });

    // Compute elbow angles
    const angles = {};
    const arms = {
        [JOINTS.LEFT_ELBOW]: [JOINTS.LEFT_SHOULDER, JOINTS.LEFT_ELBOW, JOINTS.LEFT_WRIST],
        [JOINTS.RIGHT_ELBOW]: [JOINTS.RIGHT_SHOULDER, JOINTS.RIGHT_ELBOW, JOINTS.RIGHT_WRIST]
    };

    for (const [elbow, [s, e, wr]] of Object.entries(arms)) {
        if (pts[s] && pts[e] && pts[wr]) {
            angles[elbow] = angleAt(pts[s], pts[e], pts[wr]);
        }
    }

    // Combine both arms into one smoothed signal
    const validAngles = Object.values(angles).filter(a => a !== null);
    if (validAngles.length > 0) {
        const rawAvg = validAngles.reduce((a, b) => a + b, 0) / validAngles.length;
        const combined = angleFilter.filter(rawAvg);

        // State Machine Rep Counting
        if (combined > DOWN_ANGLE) {
            repStage = 'down';
            repStatusEl.textContent = 'Down';
            repStatusEl.style.color = '#3cdc78';
        } else if (combined < UP_ANGLE && repStage === 'down') {
            repStage = 'up';
            repCount += 1;
            repCountEl.textContent = repCount;
            repStatusEl.textContent = 'Curl!';
            repStatusEl.style.color = '#5ae6d2';
            soundManager.playRep(repCount);
        }

        angleBadgeEl.textContent = `Angle: ${Math.round(combined)}°`;
    }

    // Trails for wrists
    if (pts[JOINTS.LEFT_WRIST]) {
        trails.L.push(pts[JOINTS.LEFT_WRIST]);
        if (trails.L.length > TRAIL_LEN) trails.L.shift();
    }
    if (pts[JOINTS.RIGHT_WRIST]) {
        trails.R.push(pts[JOINTS.RIGHT_WRIST]);
        if (trails.R.length > TRAIL_LEN) trails.R.shift();
    }

    // Draw hand trails
    [trails.L, trails.R].forEach(trail => {
        for (let i = 1; i < trail.length; i++) {
            const alpha = i / trail.length;
            canvasCtx.strokeStyle = `rgba(90, 230, 210, ${alpha})`;
            canvasCtx.lineWidth = 4;
            canvasCtx.beginPath();
            canvasCtx.moveTo(trail[i - 1][0], trail[i - 1][1]);
            canvasCtx.lineTo(trail[i][0], trail[i][1]);
            canvasCtx.stroke();
        }
    });

    // Draw Skeleton Bones
    BONES.forEach(([a, b]) => {
        if (pts[a] && pts[b]) {
            canvasCtx.strokeStyle = '#3cdc78';
            canvasCtx.lineWidth = 4;
            canvasCtx.beginPath();
            canvasCtx.moveTo(pts[a][0], pts[a][1]);
            canvasCtx.lineTo(pts[b][0], pts[b][1]);
            canvasCtx.stroke();
        }
    });

    // Draw Joint Dots
    Object.values(JOINTS).forEach(j => {
        if (pts[j]) {
            const [x, y] = pts[j];
            canvasCtx.fillStyle = '#ffffff';
            canvasCtx.strokeStyle = '#3cdc78';
            canvasCtx.lineWidth = 2.5;
            canvasCtx.beginPath();
            canvasCtx.arc(x, y, 6, 0, 2 * Math.PI);
            canvasCtx.fill();
            canvasCtx.stroke();
        }
    });

    // Draw Angle Text next to Elbows
    for (const [elbow, ang] of Object.entries(angles)) {
        if (pts[elbow] && ang !== null) {
            const [x, y] = pts[elbow];
            canvasCtx.fillStyle = '#ffffff';
            canvasCtx.font = 'bold 16px sans-serif';
            canvasCtx.fillText(`${Math.round(ang)}°`, x + 10, y - 8);
        }
    }

    canvasCtx.restore();
}

// Start Camera Stream
let cameraStream = null;
async function startCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
    }

    const constraints = {
        video: {
            facingMode: currentFacingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 }
        },
        audio: false
    };

    try {
        cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
        videoElement.srcObject = cameraStream;
        await videoElement.play();

        canvasElement.width = videoElement.videoWidth || 640;
        canvasElement.height = videoElement.videoHeight || 480;

        // Process frames in a loop
        processVideoLoop();
    } catch (err) {
        alert('Could not access camera: ' + err.message);
    }
}

async function processVideoLoop() {
    if (!videoElement.paused && !videoElement.ended) {
        if (canvasElement.width !== videoElement.videoWidth) {
            canvasElement.width = videoElement.videoWidth;
            canvasElement.height = videoElement.videoHeight;
        }
        await pose.send({ image: videoElement });
    }
    requestAnimationFrame(processVideoLoop);
}

// Event Listeners
startBtn.addEventListener('click', () => {
    soundManager.init();
    soundManager.preloadKeySounds();
    soundManager.playChime(); // Immediate audible confirmation that sound is active
    startOverlay.style.display = 'none';
    startCamera();
});

if (testAudioBtn) {
    testAudioBtn.addEventListener('click', () => {
        soundManager.testAudio();
    });
}

// Global unlock on first touch/click anywhere on page
window.addEventListener('click', () => {
    soundManager.init();
}, { once: true });

window.addEventListener('touchstart', () => {
    soundManager.init();
}, { once: true });

resetBtn.addEventListener('click', () => {
    repCount = 0;
    repStage = null;
    repCountEl.textContent = '0';
    repStatusEl.textContent = 'Ready';
    repStatusEl.style.color = '#5ae6d2';
    angleBadgeEl.textContent = 'Angle: --°';
    soundManager.playReset();
});

muteBtn.addEventListener('click', () => {
    soundManager.muted = !soundManager.muted;
    muteBtn.textContent = soundManager.muted ? '🔇' : '🔊';
});

cameraFlipBtn.addEventListener('click', () => {
    currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    // Mirror front camera, do not mirror back camera
    videoElement.style.transform = currentFacingMode === 'user' ? 'scaleX(-1)' : 'scaleX(1)';
    canvasElement.style.transform = currentFacingMode === 'user' ? 'scaleX(-1)' : 'scaleX(1)';
    startCamera();
});

