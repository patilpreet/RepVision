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

// Sound Manager with Web Audio API + Audio Elements
class SoundManager {
    constructor() {
        this.audioCtx = null;
        this.muted = false;
        this.audioCache = new Map();
        this.custom20Audio = new Audio('sounds/custom_20_plus.mp3');
        this.custom35Audio = new Audio('sounds/custom_35_plus.mp3');
    }

    init() {
        if (!this.audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioContext();
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    playChime() {
        if (this.muted || !this.audioCtx) return;
        const now = this.audioCtx.currentTime;

        // Two-tone bell chime: D5 (587.33Hz) + A5 (880Hz)
        const osc1 = this.audioCtx.createOscillator();
        const osc2 = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(587.33, now);

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880.0, now);

        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.25);
        osc2.stop(now + 0.25);
    }

    playRep(num) {
        if (this.muted) return;
        this.init();
        this.playChime();

        // Tiered custom audio:
        // >= 35: custom 35+ sound
        // 20 to 34: custom 20+ sound
        if (num >= 35) {
            this.custom35Audio.currentTime = 0;
            this.custom35Audio.play().catch(() => {});
        } else if (num >= 20) {
            this.custom20Audio.currentTime = 0;
            this.custom20Audio.play().catch(() => {});
        }

        // Voice counting (1, 2, 3...)
        const audioSrc = `sounds/${num}.wav`;
        let audio = this.audioCache.get(audioSrc);
        if (!audio) {
            audio = new Audio(audioSrc);
            this.audioCache.set(audioSrc, audio);
        }
        audio.currentTime = 0;
        audio.play().catch(e => {
            // Speech synthesis fallback if sound file not loaded
            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(String(num));
                utterance.rate = 1.3;
                window.speechSynthesis.speak(utterance);
            }
        });
    }

    playReset() {
        if (this.muted || !this.audioCtx) return;
        const now = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.frequency.setValueAtTime(330, now);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
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
    startOverlay.style.display = 'none';
    startCamera();
});

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
