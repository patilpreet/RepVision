// animator.js - Procedural Vector Biomechanical Exercise Animation Engine for RepVision
// Inspired by GymMane / Everkinetic vector exercise motion libraries with Pinterest minimal-maximalist aesthetics.

class ExerciseAnimator {
  constructor(canvasId, options = {}) {
    this.canvas = typeof canvasId === 'string' ? document.getElementById(canvasId) : canvasId;
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.exercise = null;
    this.isPlaying = true;
    this.speed = options.speed || 1.0;
    this.animFrameId = null;
    this.currentAngle = 0;
    this.currentPhase = 0; // 0 to 1
    this.repDurationMs = 2600; // time for one full rep cycle
    this.lastTime = performance.now();
    this.phaseText = 'START';
    this.onAngleUpdate = options.onAngleUpdate || null;

    // Retina display scaling
    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.start();
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = rect.width || 320;
    const height = rect.height || 210;

    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.logicalWidth = width;
    this.logicalHeight = height;
    this.dpr = dpr;
  }

  setExercise(exerciseConfig) {
    this.exercise = exerciseConfig;
    if (!this.exercise) return;
    this.currentAngle = this.exercise.start || 150;
    this.lastTime = performance.now();
  }

  play() {
    this.isPlaying = true;
  }

  pause() {
    this.isPlaying = false;
  }

  togglePlay() {
    this.isPlaying = !this.isPlaying;
    return this.isPlaying;
  }

  start() {
    const loop = (timestamp) => {
      this.update(timestamp);
      this.render();
      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  stop() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  update(timestamp) {
    if (!this.isPlaying || !this.exercise) return;

    const delta = (timestamp - this.lastTime) * this.speed;
    this.lastTime = timestamp;

    const t = (timestamp % this.repDurationMs) / this.repDurationMs;
    // Cosine ease-in-out cycle: 0 -> 1 -> 0
    this.currentPhase = (1 - Math.cos(t * 2 * Math.PI)) / 2;

    const start = this.exercise.start || 150;
    const end = this.exercise.end || 60;
    this.currentAngle = Math.round(start + (end - start) * this.currentPhase);

    if (this.exercise.mode === 'timer') {
      this.phaseText = 'ISOMETRIC HOLD';
    } else if (this.currentPhase < 0.1) {
      this.phaseText = 'START POSITION';
    } else if (this.currentPhase > 0.9) {
      this.phaseText = 'PEAK CONTRACTION';
    } else if (start > end) {
      this.phaseText = t < 0.5 ? 'CONCENTRIC (FLEXING)' : 'ECCENTRIC (EXTENDING)';
    } else {
      this.phaseText = t < 0.5 ? 'CONCENTRIC (PRESSING)' : 'ECCENTRIC (LOWERING)';
    }

    if (this.onAngleUpdate) {
      this.onAngleUpdate(this.currentAngle, this.currentPhase, this.phaseText);
    }
  }

  render() {
    if (!this.canvas || !this.ctx) return;
    const ctx = this.ctx;
    const w = this.logicalWidth;
    const h = this.logicalHeight;
    const dpr = this.dpr || 1;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    // Dark sleek gradient background with grid lines
    this.drawStageBackground(ctx, w, h);

    if (this.exercise) {
      // Kinematic Mannequin Animation
      this.drawKinematicFigure(ctx, w, h, this.exercise, this.currentAngle, this.currentPhase);
      // On-canvas Telemetry Overlays
      this.drawTelemetryOverlay(ctx, w, h, this.exercise, this.currentAngle, this.currentPhase);
    } else {
      this.drawPlaceholder(ctx, w, h);
    }

    ctx.restore();
  }

  drawStageBackground(ctx, w, h) {
    // Pinterest minimal dark stage
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#0a0d14');
    bgGrad.addColorStop(1, '#0e121b');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle ambient floor plane
    const floorY = h * 0.88;
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.moveTo(w * 0.1, floorY);
    ctx.lineTo(w * 0.9, floorY);
    ctx.stroke();

    // Subtle vertical coordinate grid markers
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    for (let x = w * 0.2; x < w * 0.9; x += w * 0.2) {
      ctx.beginPath();
      ctx.moveTo(x, h * 0.1);
      ctx.lineTo(x, floorY);
      ctx.stroke();
    }
  }

  drawPlaceholder(ctx, w, h) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = '600 12px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Select an exercise to preview motion guide', w / 2, h / 2);
  }

  drawKinematicFigure(ctx, w, h, ex, angle, phase) {
    const cx = w * 0.5;
    const cy = h * 0.52;
    const view = ex.view || 'front';
    const id = ex.id || '';

    // Color theme
    const boneColor = 'rgba(226, 232, 240, 0.75)'; // crisp slate white
    const dimBoneColor = 'rgba(148, 163, 184, 0.35)'; // depth side
    const activeJointColor = '#00f0ff'; // Electric Cyan
    const highlightMint = '#00f59b'; // Fluorescent Mint
    const arcColor = 'rgba(0, 240, 255, 0.7)';

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Route to appropriate procedural kinematic model based on movement geometry
    if (id === 'hammer_curl' || id === 'dumbbell_curl') {
      this.drawFrontCurl(ctx, cx, cy, angle, phase, boneColor, activeJointColor, arcColor);
    } else if (id === 'squat') {
      this.drawSideSquat(ctx, cx, cy, angle, phase, boneColor, activeJointColor, arcColor);
    } else if (id === 'pushup') {
      this.drawSidePushup(ctx, cx, cy, angle, phase, boneColor, activeJointColor, arcColor);
    } else if (id === 'plank') {
      this.drawSidePlank(ctx, cx, cy, angle, phase, boneColor, activeJointColor);
    } else if (id === 'shoulder_press') {
      this.drawFrontShoulderPress(ctx, cx, cy, angle, phase, boneColor, activeJointColor, arcColor);
    } else if (id === 'overhead_extension') {
      this.drawSideOverheadExtension(ctx, cx, cy, angle, phase, boneColor, activeJointColor, arcColor);
    } else if (id === 'pushdown') {
      this.drawSidePushdown(ctx, cx, cy, angle, phase, boneColor, activeJointColor, arcColor);
    } else if (id === 'bench_dip') {
      this.drawSideBenchDip(ctx, cx, cy, angle, phase, boneColor, activeJointColor, arcColor);
    } else if (id === 'dumbbell_press') {
      this.drawSideDumbbellPress(ctx, cx, cy, angle, phase, boneColor, activeJointColor, arcColor);
    } else if (id === 'lateral_raise') {
      this.drawFrontLateralRaise(ctx, cx, cy, angle, phase, boneColor, activeJointColor, arcColor);
    } else if (id === 'front_raise') {
      this.drawSideFrontRaise(ctx, cx, cy, angle, phase, boneColor, activeJointColor, arcColor);
    } else if (id === 'pullup') {
      this.drawFrontPullup(ctx, cx, cy, angle, phase, boneColor, activeJointColor, arcColor);
    } else if (id === 'lat_pulldown') {
      this.drawFrontLatPulldown(ctx, cx, cy, angle, phase, boneColor, activeJointColor, arcColor);
    } else if (id === 'single_arm_row') {
      this.drawSideSingleArmRow(ctx, cx, cy, angle, phase, boneColor, activeJointColor, arcColor);
    } else if (id === 'deadlift') {
      this.drawSideDeadlift(ctx, cx, cy, angle, phase, boneColor, activeJointColor, arcColor);
    } else if (id === 'lunge') {
      this.drawSideLunge(ctx, cx, cy, angle, phase, boneColor, activeJointColor, arcColor);
    } else if (id === 'leg_extension') {
      this.drawSideLegExtension(ctx, cx, cy, angle, phase, boneColor, activeJointColor, arcColor);
    } else if (id === 'glute_bridge') {
      this.drawSideGluteBridge(ctx, cx, cy, angle, phase, boneColor, activeJointColor, arcColor);
    } else if (id === 'situp') {
      this.drawSideSitup(ctx, cx, cy, angle, phase, boneColor, activeJointColor, arcColor);
    } else if (id === 'hanging_leg_raise') {
      this.drawSideHangingLegRaise(ctx, cx, cy, angle, phase, boneColor, activeJointColor, arcColor);
    } else {
      // General Fallback
      if (view === 'side') {
        this.drawGenericSideMovement(ctx, cx, cy, angle, phase, boneColor, activeJointColor, arcColor);
      } else {
        this.drawFrontCurl(ctx, cx, cy, angle, phase, boneColor, activeJointColor, arcColor);
      }
    }
  }

  // --- PROCEDURAL EXERCISE MODELS ---

  // 1. Front View Bicep Curls (Hammer Curl / Dumbbell Curl)
  drawFrontCurl(ctx, cx, cy, angle, phase, boneColor, activeJointColor, arcColor) {
    const headY = cy - 65;
    const neckY = cy - 48;
    const torsoY = cy + 10;
    const hipY = cy + 18;
    const kneeY = cy + 55;
    const ankleY = cy + 85;

    // Head & Spine
    this.drawHead(ctx, cx, headY, 11);
    this.drawSegment(ctx, cx, neckY, cx, torsoY, 7, boneColor);

    // Legs
    this.drawSegment(ctx, cx - 12, hipY, cx - 14, kneeY, 4, boneColor);
    this.drawSegment(ctx, cx - 14, kneeY, cx - 14, ankleY, 3.5, boneColor);
    this.drawSegment(ctx, cx + 12, hipY, cx + 14, kneeY, 4, boneColor);
    this.drawSegment(ctx, cx + 14, kneeY, cx + 14, ankleY, 3.5, boneColor);

    // Shoulders
    const shoulderL = { x: cx - 26, y: neckY + 4 };
    const shoulderR = { x: cx + 26, y: neckY + 4 };
    this.drawSegment(ctx, shoulderL.x, shoulderL.y, shoulderR.x, shoulderR.y, 4, boneColor);

    // Elbows (fixed close to torso)
    const elbowL = { x: cx - 27, y: neckY + 36 };
    const elbowR = { x: cx + 27, y: neckY + 36 };
    this.drawSegment(ctx, shoulderL.x, shoulderL.y, elbowL.x, elbowL.y, 4, boneColor);
    this.drawSegment(ctx, shoulderR.x, shoulderR.y, elbowR.x, elbowR.y, 4, boneColor);

    // Forearms rotate based on angle (150 deg down -> 60 deg up)
    const rad = ((180 - angle) * Math.PI) / 180;
    const forearmLen = 32;
    const wristL = { x: elbowL.x + Math.sin(rad) * 6, y: elbowL.y + Math.cos(rad) * forearmLen };
    const wristR = { x: elbowR.x - Math.sin(rad) * 6, y: elbowR.y + Math.cos(rad) * forearmLen };

    this.drawSegment(ctx, elbowL.x, elbowL.y, wristL.x, wristL.y, 4, activeJointColor);
    this.drawSegment(ctx, elbowR.x, elbowR.y, wristR.x, wristR.y, 4, activeJointColor);

    // Dumbbells in hands
    this.drawDumbbell(ctx, wristL.x, wristL.y, 8, true);
    this.drawDumbbell(ctx, wristR.x, wristR.y, 8, true);

    // Highlight active joints
    this.drawJoint(ctx, shoulderR.x, shoulderR.y, 4, activeJointColor);
    this.drawJoint(ctx, elbowR.x, elbowR.y, 5, activeJointColor, true);
    this.drawJoint(ctx, wristR.x, wristR.y, 4, activeJointColor);

    // Joint Angle Arc
    this.drawAngleArc(ctx, elbowR.x, elbowR.y, 16, Math.PI / 2, Math.PI / 2 - rad, `${angle}°`);
  }

  // 2. Side View Squat
  drawSideSquat(ctx, cx, cy, angle, phase, boneColor, activeJointColor, arcColor) {
    // Phase 0 = standing tall, Phase 1 = deep squat
    const drop = phase * 42;
    const hipX = cx - 12 - phase * 18;
    const hipY = cy - 5 + drop;

    const shoulderX = hipX + 10 + phase * 12;
    const shoulderY = hipY - 48;
    const headX = shoulderX + 4;
    const headY = shoulderY - 16;

    const kneeX = cx + 18 + phase * 8;
    const kneeY = cy + 42 + drop * 0.25;

    const ankleX = cx + 10;
    const ankleY = cy + 85;

    // Floor contact / Foot
    this.drawSegment(ctx, ankleX - 6, ankleY, ankleX + 18, ankleY, 3, boneColor);

    // Lower Leg (Shank)
    this.drawSegment(ctx, ankleX, ankleY, kneeX, kneeY, 4, activeJointColor);
    // Thigh (Femur)
    this.drawSegment(ctx, kneeX, kneeY, hipX, hipY, 4.5, activeJointColor);
    // Torso / Spine
    this.drawSegment(ctx, hipX, hipY, shoulderX, shoulderY, 6, boneColor);
    // Head
    this.drawHead(ctx, headX, headY, 11);

    // Arms holding counterbalance in front
    const elbowX = shoulderX + 22;
    const elbowY = shoulderY + 18;
    const wristX = elbowX + 16;
    const wristY = elbowY - 6;
    this.drawSegment(ctx, shoulderX, shoulderY, elbowX, elbowY, 3, boneColor);
    this.drawSegment(ctx, elbowX, elbowY, wristX, wristY, 2.5, boneColor);

    // Highlight active joints: Hip, Knee, Ankle
    this.drawJoint(ctx, hipX, hipY, 4.5, activeJointColor);
    this.drawJoint(ctx, kneeX, kneeY, 5.5, activeJointColor, true);
    this.drawJoint(ctx, ankleX, ankleY, 4.5, activeJointColor);

    // Angle Arc at Knee
    this.drawAngleArc(ctx, kneeX, kneeY, 18, -Math.PI * 0.7, -Math.PI * 0.7 + (angle * Math.PI) / 180, `${angle}°`);
  }

  // 3. Side View Pushup
  drawSidePushup(ctx, cx, cy, angle, phase, boneColor, activeJointColor, arcColor) {
    const drop = phase * 26;
    const floorY = cy + 50;

    const ankleX = cx - 75;
    const ankleY = floorY - 8;

    const shoulderX = cx + 38;
    const shoulderY = floorY - 48 + drop;

    const hipX = cx - 20;
    const hipY = floorY - 32 + drop * 0.75;

    const headX = shoulderX + 18;
    const headY = shoulderY - 6;

    const wristX = cx + 36;
    const wristY = floorY;

    // Elbow bends back as chest drops
    const elbowX = shoulderX - 16 - phase * 8;
    const elbowY = shoulderY + (wristY - shoulderY) * 0.5;

    // Body rigid plank line
    this.drawSegment(ctx, ankleX, ankleY, hipX, hipY, 4.5, boneColor);
    this.drawSegment(ctx, hipX, hipY, shoulderX, shoulderY, 5.5, boneColor);
    this.drawHead(ctx, headX, headY, 10);

    // Arm (Upper arm + Forearm)
    this.drawSegment(ctx, shoulderX, shoulderY, elbowX, elbowY, 4, activeJointColor);
    this.drawSegment(ctx, elbowX, elbowY, wristX, wristY, 4, activeJointColor);

    // Floor hand & toe
    this.drawSegment(ctx, wristX - 8, wristY, wristX + 8, wristY, 3, boneColor);
    this.drawSegment(ctx, ankleX - 4, floorY, ankleX + 8, floorY, 3, boneColor);

    // Joints: Shoulder, Elbow, Wrist
    this.drawJoint(ctx, shoulderX, shoulderY, 4, activeJointColor);
    this.drawJoint(ctx, elbowX, elbowY, 5, activeJointColor, true);
    this.drawJoint(ctx, wristX, wristY, 4, activeJointColor);

    this.drawAngleArc(ctx, elbowX, elbowY, 14, 0, (angle * Math.PI) / 180, `${angle}°`);
  }

  // 4. Side View Forearm Plank
  drawSidePlank(ctx, cx, cy, angle, phase, boneColor, activeJointColor) {
    const floorY = cy + 45;
    const breath = Math.sin(Date.now() * 0.003) * 2;

    const toeX = cx - 70;
    const toeY = floorY;

    const shoulderX = cx + 35;
    const shoulderY = floorY - 32 + breath;

    const hipX = cx - 18;
    const hipY = floorY - 26 + breath * 0.8;

    const headX = shoulderX + 16;
    const headY = shoulderY - 4;

    const elbowX = shoulderX;
    const elbowY = floorY;
    const wristX = elbowX + 22;
    const wristY = floorY;

    // Forearm on floor
    this.drawSegment(ctx, elbowX, elbowY, wristX, wristY, 3.5, activeJointColor);
    // Upper arm vertical
    this.drawSegment(ctx, shoulderX, shoulderY, elbowX, elbowY, 4, activeJointColor);

    // Straight Body Line
    this.drawSegment(ctx, toeX, toeY - 4, hipX, hipY, 4.5, activeJointColor);
    this.drawSegment(ctx, hipX, hipY, shoulderX, shoulderY, 5.5, activeJointColor);
    this.drawHead(ctx, headX, headY, 10);

    // Core Tension Ring indicator
    ctx.beginPath();
    ctx.arc(hipX + 5, hipY + 2, 12 + Math.abs(breath), 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 245, 155, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Joints: Shoulder, Hip, Ankle
    this.drawJoint(ctx, shoulderX, shoulderY, 4.5, activeJointColor);
    this.drawJoint(ctx, hipX, hipY, 5.5, '#00f59b', true);
    this.drawJoint(ctx, toeX, toeY - 4, 4.5, activeJointColor);
  }

  // 5. Front View Shoulder Press
  drawFrontShoulderPress(ctx, cx, cy, angle, phase, boneColor, activeJointColor, arcColor) {
    const headY = cy - 58;
    const neckY = cy - 40;
    const torsoY = cy + 18;
    const ankleY = cy + 85;

    this.drawHead(ctx, cx, headY, 11);
    this.drawSegment(ctx, cx, neckY, cx, torsoY, 7, boneColor);
    this.drawSegment(ctx, cx - 12, torsoY, cx - 14, ankleY, 4, boneColor);
    this.drawSegment(ctx, cx + 12, torsoY, cx + 14, ankleY, 4, boneColor);

    const shoulderL = { x: cx - 26, y: neckY + 4 };
    const shoulderR = { x: cx + 26, y: neckY + 4 };
    this.drawSegment(ctx, shoulderL.x, shoulderL.y, shoulderR.x, shoulderR.y, 4, boneColor);

    // Press upwards from shoulder level to lockout
    const pressProgress = phase; // 0 = at shoulder (80 deg), 1 = overhead lockout (160 deg)
    const elbowL = { x: cx - 28 + pressProgress * 12, y: neckY + 18 - pressProgress * 26 };
    const elbowR = { x: cx + 28 - pressProgress * 12, y: neckY + 18 - pressProgress * 26 };

    const wristL = { x: elbowL.x + pressProgress * 6, y: elbowL.y - 28 };
    const wristR = { x: elbowR.x - pressProgress * 6, y: elbowR.y - 28 };

    this.drawSegment(ctx, shoulderL.x, shoulderL.y, elbowL.x, elbowL.y, 4, activeJointColor);
    this.drawSegment(ctx, elbowL.x, elbowL.y, wristL.x, wristL.y, 4, activeJointColor);
    this.drawSegment(ctx, shoulderR.x, shoulderR.y, elbowR.x, elbowR.y, 4, activeJointColor);
    this.drawSegment(ctx, elbowR.x, elbowR.y, wristR.x, wristR.y, 4, activeJointColor);

    this.drawDumbbell(ctx, wristL.x, wristL.y, 8, false);
    this.drawDumbbell(ctx, wristR.x, wristR.y, 8, false);

    this.drawJoint(ctx, shoulderR.x, shoulderR.y, 4, activeJointColor);
    this.drawJoint(ctx, elbowR.x, elbowR.y, 5, activeJointColor, true);
    this.drawJoint(ctx, wristR.x, wristR.y, 4, activeJointColor);

    this.drawAngleArc(ctx, elbowR.x, elbowR.y, 16, -Math.PI / 2, -Math.PI / 2 + (angle * Math.PI) / 180, `${angle}°`);
  }

  // 6. Side View Overhead Triceps Extension
  drawSideOverheadExtension(ctx, cx, cy, angle, phase, boneColor, activeJointColor, arcColor) {
    const headY = cy - 40;
    const shoulderX = cx;
    const shoulderY = cy - 22;
    const hipX = cx - 2;
    const hipY = cy + 24;
    const ankleX = cx;
    const ankleY = cy + 85;

    this.drawHead(ctx, cx, headY, 11);
    this.drawSegment(ctx, shoulderX, shoulderY, hipX, hipY, 6, boneColor);
    this.drawSegment(ctx, hipX, hipY, ankleX, ankleY, 4, boneColor);

    // Upper arm vertical overhead
    const elbowX = shoulderX + 4;
    const elbowY = shoulderY - 36;
    this.drawSegment(ctx, shoulderX, shoulderY, elbowX, elbowY, 4, boneColor);

    // Forearm bends behind head (60 deg) up to lockout (160 deg)
    const rad = (angle * Math.PI) / 180;
    const forearmLen = 30;
    const wristX = elbowX - Math.cos(rad) * forearmLen;
    const wristY = elbowY - Math.sin(rad) * forearmLen;

    this.drawSegment(ctx, elbowX, elbowY, wristX, wristY, 4, activeJointColor);
    this.drawDumbbell(ctx, wristX, wristY, 7, false);

    this.drawJoint(ctx, shoulderX, shoulderY, 4, activeJointColor);
    this.drawJoint(ctx, elbowX, elbowY, 5.5, activeJointColor, true);
    this.drawJoint(ctx, wristX, wristY, 4, activeJointColor);

    this.drawAngleArc(ctx, elbowX, elbowY, 16, Math.PI, Math.PI - rad, `${angle}°`);
  }

  // 7. Side View Triceps Pushdown
  drawSidePushdown(ctx, cx, cy, angle, phase, boneColor, activeJointColor, arcColor) {
    const shoulderX = cx - 12;
    const shoulderY = cy - 28;
    const hipX = cx - 18;
    const hipY = cy + 18;
    const ankleX = cx - 10;
    const ankleY = cy + 85;

    this.drawHead(ctx, shoulderX + 8, shoulderY - 18, 11);
    this.drawSegment(ctx, shoulderX, shoulderY, hipX, hipY, 6, boneColor);
    this.drawSegment(ctx, hipX, hipY, ankleX, ankleY, 4, boneColor);

    // Cable line in front
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.moveTo(cx + 25, cy - 80);
    ctx.lineTo(cx + 25, cy);
    ctx.stroke();

    // Upper arm pinned to side
    const elbowX = shoulderX + 4;
    const elbowY = shoulderY + 28;
    this.drawSegment(ctx, shoulderX, shoulderY, elbowX, elbowY, 4, boneColor);

    // Forearm rotates from 90 deg down to 160 deg
    const rad = ((angle - 90) * Math.PI) / 180;
    const wristX = elbowX + 30 * Math.cos(rad);
    const wristY = elbowY + 30 * Math.sin(rad);

    this.drawSegment(ctx, elbowX, elbowY, wristX, wristY, 4, activeJointColor);

    this.drawJoint(ctx, shoulderX, shoulderY, 4, activeJointColor);
    this.drawJoint(ctx, elbowX, elbowY, 5, activeJointColor, true);
    this.drawJoint(ctx, wristX, wristY, 4, activeJointColor);

    this.drawAngleArc(ctx, elbowX, elbowY, 15, 0, rad, `${angle}°`);
  }

  // 8. Side View Bench Dip
  drawSideBenchDip(ctx, cx, cy, angle, phase, boneColor, activeJointColor, arcColor) {
    const drop = phase * 26;
    const benchX = cx - 35;
    const benchY = cy + 22;

    // Bench
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(benchX - 25, benchY, 30, cy + 85 - benchY);

    const wristX = benchX;
    const wristY = benchY;

    const shoulderX = cx - 10;
    const shoulderY = cy - 14 + drop;
    const hipX = cx - 14;
    const hipY = cy + 22 + drop;
    const ankleX = cx + 45;
    const ankleY = cy + 85;

    const elbowX = cx - 25;
    const elbowY = shoulderY + 18;

    this.drawHead(ctx, shoulderX + 4, shoulderY - 18, 11);
    this.drawSegment(ctx, shoulderX, shoulderY, hipX, hipY, 5.5, boneColor);
    this.drawSegment(ctx, hipX, hipY, ankleX, ankleY, 4, boneColor);

    this.drawSegment(ctx, shoulderX, shoulderY, elbowX, elbowY, 4, activeJointColor);
    this.drawSegment(ctx, elbowX, elbowY, wristX, wristY, 4, activeJointColor);

    this.drawJoint(ctx, shoulderX, shoulderY, 4, activeJointColor);
    this.drawJoint(ctx, elbowX, elbowY, 5, activeJointColor, true);
    this.drawJoint(ctx, wristX, wristY, 4, activeJointColor);

    this.drawAngleArc(ctx, elbowX, elbowY, 15, Math.PI / 2, Math.PI / 2 - (angle * Math.PI) / 180, `${angle}°`);
  }

  // 9. Side View Dumbbell Bench Press
  drawSideDumbbellPress(ctx, cx, cy, angle, phase, boneColor, activeJointColor, arcColor) {
    const benchY = cy + 25;
    // Flat bench
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(cx - 70, benchY, 130, 8);

    const headX = cx - 55;
    const shoulderX = cx - 25;
    const hipX = cx + 25;
    const kneeX = cx + 45;
    const ankleX = cx + 45;

    this.drawHead(ctx, headX, benchY - 12, 10);
    this.drawSegment(ctx, shoulderX, benchY - 6, hipX, benchY - 6, 6, boneColor);
    this.drawSegment(ctx, hipX, benchY - 6, kneeX, benchY + 15, 4, boneColor);
    this.drawSegment(ctx, kneeX, benchY + 15, ankleX, cy + 70, 3.5, boneColor);

    // Arm pressing upwards
    const pressH = 15 + phase * 35;
    const elbowX = shoulderX + 4;
    const elbowY = benchY - 6 - pressH * 0.55;
    const wristX = shoulderX + 4;
    const wristY = benchY - 6 - pressH;

    this.drawSegment(ctx, shoulderX, benchY - 6, elbowX, elbowY, 4, activeJointColor);
    this.drawSegment(ctx, elbowX, elbowY, wristX, wristY, 4, activeJointColor);
    this.drawDumbbell(ctx, wristX, wristY, 8, false);

    this.drawJoint(ctx, shoulderX, benchY - 6, 4, activeJointColor);
    this.drawJoint(ctx, elbowX, elbowY, 5, activeJointColor, true);
    this.drawJoint(ctx, wristX, wristY, 4, activeJointColor);

    this.drawAngleArc(ctx, elbowX, elbowY, 14, 0, (angle * Math.PI) / 180, `${angle}°`);
  }

  // 10. Front View Lateral Raise
  drawFrontLateralRaise(ctx, cx, cy, angle, phase, boneColor, activeJointColor, arcColor) {
    const headY = cy - 58;
    const neckY = cy - 42;
    const hipY = cy + 18;
    const ankleY = cy + 85;

    this.drawHead(ctx, cx, headY, 11);
    this.drawSegment(ctx, cx, neckY, cx, hipY, 6.5, boneColor);
    this.drawSegment(ctx, cx - 12, hipY, cx - 14, ankleY, 4, boneColor);
    this.drawSegment(ctx, cx + 12, hipY, cx + 14, ankleY, 4, boneColor);

    const shoulderL = { x: cx - 25, y: neckY + 4 };
    const shoulderR = { x: cx + 25, y: neckY + 4 };

    // Raise arms out laterally (20 deg to 80 deg)
    const rad = (angle * Math.PI) / 180;
    const armLen = 52;

    const wristL = { x: shoulderL.x - Math.sin(rad) * armLen, y: shoulderL.y + Math.cos(rad) * armLen };
    const wristR = { x: shoulderR.x + Math.sin(rad) * armLen, y: shoulderR.y + Math.cos(rad) * armLen };
    const elbowR = { x: (shoulderR.x + wristR.x) / 2, y: (shoulderR.y + wristR.y) / 2 };

    this.drawSegment(ctx, shoulderL.x, shoulderL.y, wristL.x, wristL.y, 4, boneColor);
    this.drawSegment(ctx, shoulderR.x, shoulderR.y, wristR.x, wristR.y, 4, activeJointColor);

    this.drawDumbbell(ctx, wristL.x, wristL.y, 6, true);
    this.drawDumbbell(ctx, wristR.x, wristR.y, 6, true);

    this.drawJoint(ctx, cx, hipY, 4, activeJointColor);
    this.drawJoint(ctx, shoulderR.x, shoulderR.y, 5.5, activeJointColor, true);
    this.drawJoint(ctx, elbowR.x, elbowR.y, 4, activeJointColor);

    this.drawAngleArc(ctx, shoulderR.x, shoulderR.y, 22, Math.PI / 2, Math.PI / 2 - rad, `${angle}°`);
  }

  // 11. Side View Front Raise
  drawSideFrontRaise(ctx, cx, cy, angle, phase, boneColor, activeJointColor, arcColor) {
    const headY = cy - 50;
    const shoulderX = cx - 6;
    const shoulderY = cy - 32;
    const hipX = cx - 6;
    const hipY = cy + 20;
    const ankleX = cx - 6;
    const ankleY = cy + 85;

    this.drawHead(ctx, cx - 6, headY, 11);
    this.drawSegment(ctx, shoulderX, shoulderY, hipX, hipY, 6, boneColor);
    this.drawSegment(ctx, hipX, hipY, ankleX, ankleY, 4, boneColor);

    // Arm raises forward from hip (20 deg) to shoulder height (80 deg)
    const rad = (angle * Math.PI) / 180;
    const armLen = 52;
    const wristX = shoulderX + Math.sin(rad) * armLen;
    const wristY = shoulderY + Math.cos(rad) * armLen;
    const elbowX = (shoulderX + wristX) / 2;
    const elbowY = (shoulderY + wristY) / 2;

    this.drawSegment(ctx, shoulderX, shoulderY, wristX, wristY, 4, activeJointColor);
    this.drawDumbbell(ctx, wristX, wristY, 7, false);

    this.drawJoint(ctx, hipX, hipY, 4, activeJointColor);
    this.drawJoint(ctx, shoulderX, shoulderY, 5.5, activeJointColor, true);
    this.drawJoint(ctx, elbowX, elbowY, 4, activeJointColor);

    this.drawAngleArc(ctx, shoulderX, shoulderY, 20, Math.PI / 2, Math.PI / 2 - rad, `${angle}°`);
  }

  // 12. Front View Pull-up
  drawFrontPullup(ctx, cx, cy, angle, phase, boneColor, activeJointColor, arcColor) {
    // Pullup Bar
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 3;
    ctx.moveTo(cx - 70, cy - 68);
    ctx.lineTo(cx + 70, cy - 68);
    ctx.stroke();

    const pullUp = phase * 32;
    const barY = cy - 68;

    const headY = cy - 45 - pullUp;
    const neckY = headY + 16;
    const torsoY = neckY + 45;
    const ankleY = torsoY + 55;

    this.drawHead(ctx, cx, headY, 11);
    this.drawSegment(ctx, cx, neckY, cx, torsoY, 6, boneColor);
    this.drawSegment(ctx, cx - 10, torsoY, cx - 10, ankleY, 3.5, boneColor);
    this.drawSegment(ctx, cx + 10, torsoY, cx + 10, ankleY, 3.5, boneColor);

    const handL = { x: cx - 44, y: barY };
    const handR = { x: cx + 44, y: barY };

    const elbowL = { x: cx - 35, y: neckY + 15 };
    const elbowR = { x: cx + 35, y: neckY + 15 };

    this.drawSegment(ctx, cx - 22, neckY, elbowL.x, elbowL.y, 4, activeJointColor);
    this.drawSegment(ctx, elbowL.x, elbowL.y, handL.x, handL.y, 4, activeJointColor);

    this.drawSegment(ctx, cx + 22, neckY, elbowR.x, elbowR.y, 4, activeJointColor);
    this.drawSegment(ctx, elbowR.x, elbowR.y, handR.x, handR.y, 4, activeJointColor);

    this.drawJoint(ctx, cx + 22, neckY, 4, activeJointColor);
    this.drawJoint(ctx, elbowR.x, elbowR.y, 5, activeJointColor, true);
    this.drawJoint(ctx, handR.x, handR.y, 4, activeJointColor);

    this.drawAngleArc(ctx, elbowR.x, elbowR.y, 14, 0, (angle * Math.PI) / 180, `${angle}°`);
  }

  // 13. Front View Lat Pulldown
  drawFrontLatPulldown(ctx, cx, cy, angle, phase, boneColor, activeJointColor, arcColor) {
    const seatY = cy + 25;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(cx - 25, seatY, 50, cy + 85 - seatY);

    const pull = phase * 34;
    const barY = cy - 65 + pull;

    // Lat Pulldown Bar
    ctx.beginPath();
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 3;
    ctx.moveTo(cx - 60, barY - 4);
    ctx.lineTo(cx - 45, barY);
    ctx.lineTo(cx + 45, barY);
    ctx.lineTo(cx + 60, barY - 4);
    ctx.stroke();

    const headY = cy - 35;
    const neckY = headY + 16;

    this.drawHead(ctx, cx, headY, 11);
    this.drawSegment(ctx, cx, neckY, cx, seatY, 6.5, boneColor);

    const handL = { x: cx - 45, y: barY };
    const handR = { x: cx + 45, y: barY };
    const elbowL = { x: cx - 35, y: neckY + 14 + pull * 0.4 };
    const elbowR = { x: cx + 35, y: neckY + 14 + pull * 0.4 };

    this.drawSegment(ctx, cx - 22, neckY, elbowL.x, elbowL.y, 4, activeJointColor);
    this.drawSegment(ctx, elbowL.x, elbowL.y, handL.x, handL.y, 4, activeJointColor);

    this.drawSegment(ctx, cx + 22, neckY, elbowR.x, elbowR.y, 4, activeJointColor);
    this.drawSegment(ctx, elbowR.x, elbowR.y, handR.x, handR.y, 4, activeJointColor);

    this.drawJoint(ctx, cx + 22, neckY, 4, activeJointColor);
    this.drawJoint(ctx, elbowR.x, elbowR.y, 5, activeJointColor, true);
    this.drawJoint(ctx, handR.x, handR.y, 4, activeJointColor);

    this.drawAngleArc(ctx, elbowR.x, elbowR.y, 14, 0, (angle * Math.PI) / 180, `${angle}°`);
  }

  // 14. Side View Deadlift
  drawSideDeadlift(ctx, cx, cy, angle, phase, boneColor, activeJointColor, arcColor) {
    // 0 = bottom barbell at shins, 1 = standing upright lockout
    const hinge = 1 - phase; // 0 = standing, 1 = hinged
    const hipX = cx - 18 - hinge * 16;
    const hipY = cy - 2 + hinge * 14;

    const shoulderX = cx + 8 - hinge * 14;
    const shoulderY = cy - 50 + hinge * 32;

    const kneeX = cx + 8;
    const kneeY = cy + 45;
    const ankleX = cx + 5;
    const ankleY = cy + 85;

    this.drawHead(ctx, shoulderX + 8, shoulderY - 14, 11);
    this.drawSegment(ctx, shoulderX, shoulderY, hipX, hipY, 6, activeJointColor);
    this.drawSegment(ctx, hipX, hipY, kneeX, kneeY, 4.5, activeJointColor);
    this.drawSegment(ctx, kneeX, kneeY, ankleX, ankleY, 4, boneColor);

    // Arms hanging down holding barbell
    const barbellX = kneeX + 4;
    const barbellY = shoulderY + 54;
    this.drawSegment(ctx, shoulderX, shoulderY, barbellX, barbellY, 3.5, boneColor);

    // Barbell plate
    ctx.beginPath();
    ctx.arc(barbellX, barbellY, 12, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    this.drawJoint(ctx, shoulderX, shoulderY, 4, activeJointColor);
    this.drawJoint(ctx, hipX, hipY, 5.5, activeJointColor, true);
    this.drawJoint(ctx, kneeX, kneeY, 4, activeJointColor);

    this.drawAngleArc(ctx, hipX, hipY, 18, 0, (angle * Math.PI) / 180, `${angle}°`);
  }

  // 15. Side View Single Arm Row
  drawSideSingleArmRow(ctx, cx, cy, angle, phase, boneColor, activeJointColor, arcColor) {
    const benchY = cy + 30;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(cx - 50, benchY, 100, 8);

    const shoulderX = cx + 18;
    const shoulderY = cy - 2;
    const hipX = cx - 35;
    const hipY = cy + 6;

    this.drawHead(ctx, shoulderX + 14, shoulderY - 12, 10);
    this.drawSegment(ctx, shoulderX, shoulderY, hipX, hipY, 5.5, activeJointColor);

    // Support arm on bench
    this.drawSegment(ctx, shoulderX - 10, shoulderY, cx + 8, benchY, 3, boneColor);

    // Rowing Arm
    const rowProgress = phase; // 0 = hanging (160 deg), 1 = rowed up (80 deg)
    const elbowX = shoulderX - 12 - rowProgress * 8;
    const elbowY = shoulderY + 36 - rowProgress * 26;
    const wristX = shoulderX - 2;
    const wristY = elbowY + 12;

    this.drawSegment(ctx, shoulderX, shoulderY, elbowX, elbowY, 4, activeJointColor);
    this.drawSegment(ctx, elbowX, elbowY, wristX, wristY, 4, activeJointColor);
    this.drawDumbbell(ctx, wristX, wristY, 7, false);

    this.drawJoint(ctx, shoulderX, shoulderY, 4, activeJointColor);
    this.drawJoint(ctx, elbowX, elbowY, 5, activeJointColor, true);
    this.drawJoint(ctx, wristX, wristY, 4, activeJointColor);

    this.drawAngleArc(ctx, elbowX, elbowY, 14, Math.PI / 2, Math.PI / 2 - (angle * Math.PI) / 180, `${angle}°`);
  }

  // 16. Side View Lunge
  drawSideLunge(ctx, cx, cy, angle, phase, boneColor, activeJointColor, arcColor) {
    const drop = phase * 28;
    const hipX = cx;
    const hipY = cy + 12 + drop;
    const shoulderX = cx;
    const shoulderY = hipY - 48;

    this.drawHead(ctx, cx, shoulderY - 16, 11);
    this.drawSegment(ctx, shoulderX, shoulderY, hipX, hipY, 6, boneColor);

    // Front Leg
    const frontKneeX = cx + 28;
    const frontKneeY = cy + 50 + drop * 0.3;
    const frontAnkleX = cx + 28;
    const frontAnkleY = cy + 85;

    this.drawSegment(ctx, hipX, hipY, frontKneeX, frontKneeY, 4.5, activeJointColor);
    this.drawSegment(ctx, frontKneeX, frontKneeY, frontAnkleX, frontAnkleY, 4, activeJointColor);

    // Back Leg dropping towards floor
    const backKneeX = cx - 24;
    const backKneeY = cy + 60 + drop * 0.8;
    const backAnkleX = cx - 45;
    const backAnkleY = cy + 85;

    this.drawSegment(ctx, hipX, hipY, backKneeX, backKneeY, 3.5, boneColor);
    this.drawSegment(ctx, backKneeX, backKneeY, backAnkleX, backAnkleY, 3, boneColor);

    this.drawJoint(ctx, hipX, hipY, 4, activeJointColor);
    this.drawJoint(ctx, frontKneeX, frontKneeY, 5.5, activeJointColor, true);
    this.drawJoint(ctx, frontAnkleX, frontAnkleY, 4, activeJointColor);

    this.drawAngleArc(ctx, frontKneeX, frontKneeY, 16, 0, (angle * Math.PI) / 180, `${angle}°`);
  }

  // 17. Side View Leg Extension
  drawSideLegExtension(ctx, cx, cy, angle, phase, boneColor, activeJointColor, arcColor) {
    const seatY = cy + 30;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(cx - 35, seatY, 50, cy + 85 - seatY);

    const hipX = cx - 20;
    const hipY = seatY - 5;
    const shoulderX = cx - 22;
    const shoulderY = hipY - 48;

    this.drawHead(ctx, shoulderX + 2, shoulderY - 16, 11);
    this.drawSegment(ctx, shoulderX, shoulderY, hipX, hipY, 6, boneColor);

    const kneeX = cx + 18;
    const kneeY = seatY - 4;
    this.drawSegment(ctx, hipX, hipY, kneeX, kneeY, 4.5, activeJointColor);

    // Shank extends from 90 deg (down) to 165 deg (horizontal)
    const rad = ((180 - angle) * Math.PI) / 180;
    const shankLen = 42;
    const ankleX = kneeX + Math.sin(rad) * shankLen;
    const ankleY = kneeY + Math.cos(rad) * shankLen;

    this.drawSegment(ctx, kneeX, kneeY, ankleX, ankleY, 4, activeJointColor);

    // Machine pad at ankle
    ctx.beginPath();
    ctx.arc(ankleX, ankleY, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#00f0ff';
    ctx.fill();

    this.drawJoint(ctx, hipX, hipY, 4, activeJointColor);
    this.drawJoint(ctx, kneeX, kneeY, 5.5, activeJointColor, true);
    this.drawJoint(ctx, ankleX, ankleY, 4, activeJointColor);

    this.drawAngleArc(ctx, kneeX, kneeY, 18, Math.PI / 2, Math.PI / 2 - rad, `${angle}°`);
  }

  // 18. Side View Glute Bridge
  drawSideGluteBridge(ctx, cx, cy, angle, phase, boneColor, activeJointColor, arcColor) {
    const floorY = cy + 50;

    const shoulderX = cx - 45;
    const shoulderY = floorY - 6;

    const bridgeHeight = phase * 32;
    const hipX = cx - 6;
    const hipY = floorY - 6 - bridgeHeight;

    const kneeX = cx + 28;
    const kneeY = floorY - 26;

    const ankleX = cx + 28;
    const ankleY = floorY;

    this.drawHead(ctx, shoulderX - 16, floorY - 6, 10);
    this.drawSegment(ctx, shoulderX, shoulderY, hipX, hipY, 6, activeJointColor);
    this.drawSegment(ctx, hipX, hipY, kneeX, kneeY, 4.5, activeJointColor);
    this.drawSegment(ctx, kneeX, kneeY, ankleX, ankleY, 4, boneColor);

    this.drawJoint(ctx, shoulderX, shoulderY, 4, activeJointColor);
    this.drawJoint(ctx, hipX, hipY, 5.5, activeJointColor, true);
    this.drawJoint(ctx, kneeX, kneeY, 4, activeJointColor);

    this.drawAngleArc(ctx, hipX, hipY, 18, 0, (angle * Math.PI) / 180, `${angle}°`);
  }

  // 19. Side View Sit-up
  drawSideSitup(ctx, cx, cy, angle, phase, boneColor, activeJointColor, arcColor) {
    const floorY = cy + 45;
    const hipX = cx - 10;
    const hipY = floorY - 6;

    const kneeX = cx + 25;
    const kneeY = floorY - 28;
    const ankleX = cx + 45;
    const ankleY = floorY;

    this.drawSegment(ctx, hipX, hipY, kneeX, kneeY, 4.5, activeJointColor);
    this.drawSegment(ctx, kneeX, kneeY, ankleX, ankleY, 4, boneColor);

    // Torso crunches up
    const rad = (angle * Math.PI) / 180;
    const torsoLen = 48;
    const shoulderX = hipX - Math.sin(rad) * torsoLen;
    const shoulderY = hipY - Math.cos(rad) * torsoLen;
    const headX = shoulderX - 10;
    const headY = shoulderY - 8;

    this.drawSegment(ctx, hipX, hipY, shoulderX, shoulderY, 6, activeJointColor);
    this.drawHead(ctx, headX, headY, 10);

    this.drawJoint(ctx, shoulderX, shoulderY, 4, activeJointColor);
    this.drawJoint(ctx, hipX, hipY, 5.5, activeJointColor, true);
    this.drawJoint(ctx, kneeX, kneeY, 4, activeJointColor);

    this.drawAngleArc(ctx, hipX, hipY, 18, -Math.PI / 2, -Math.PI / 2 + rad, `${angle}°`);
  }

  // 20. Side View Hanging Leg Raise
  drawSideHangingLegRaise(ctx, cx, cy, angle, phase, boneColor, activeJointColor, arcColor) {
    // Bar overhead
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 3;
    ctx.moveTo(cx - 30, cy - 70);
    ctx.lineTo(cx + 30, cy - 70);
    ctx.stroke();

    const handX = cx;
    const handY = cy - 70;
    const shoulderX = cx;
    const shoulderY = cy - 40;
    const hipX = cx - 2;
    const hipY = cy + 8;

    this.drawHead(ctx, cx - 4, shoulderY - 14, 10);
    this.drawSegment(ctx, handX, handY, shoulderX, shoulderY, 3.5, boneColor);
    this.drawSegment(ctx, shoulderX, shoulderY, hipX, hipY, 6, activeJointColor);

    // Legs raise up towards 90 deg
    const rad = (angle * Math.PI) / 180;
    const legLen = 58;
    const ankleX = hipX + Math.sin(Math.PI - rad) * legLen;
    const ankleY = hipY + Math.cos(Math.PI - rad) * legLen;
    const kneeX = (hipX + ankleX) / 2;
    const kneeY = (hipY + ankleY) / 2;

    this.drawSegment(ctx, hipX, hipY, ankleX, ankleY, 4, activeJointColor);

    this.drawJoint(ctx, shoulderX, shoulderY, 4, activeJointColor);
    this.drawJoint(ctx, hipX, hipY, 5.5, activeJointColor, true);
    this.drawJoint(ctx, kneeX, kneeY, 4, activeJointColor);

    this.drawAngleArc(ctx, hipX, hipY, 18, Math.PI / 2, Math.PI / 2 - rad, `${angle}°`);
  }

  // Generic Side View
  drawGenericSideMovement(ctx, cx, cy, angle, phase, boneColor, activeJointColor, arcColor) {
    this.drawSideSquat(ctx, cx, cy, angle, phase, boneColor, activeJointColor, arcColor);
  }

  // --- PRIMITIVE HELPERS ---

  drawHead(ctx, x, y, radius) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#0a0d14';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Aesthetic visor line
    ctx.beginPath();
    ctx.arc(x, y, radius - 3, -0.4, 0.4);
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }

  drawSegment(ctx, x1, y1, x2, y2, width, color) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  drawJoint(ctx, x, y, radius, color, glow = false) {
    if (glow) {
      ctx.beginPath();
      ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 240, 255, 0.25)';
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  drawDumbbell(ctx, x, y, size, vertical = true) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillStyle = '#00f0ff';
    ctx.lineWidth = 2;

    if (vertical) {
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(0, size);
      ctx.stroke();
      ctx.fillRect(-size * 0.4, -size, size * 0.8, 3);
      ctx.fillRect(-size * 0.4, size - 3, size * 0.8, 3);
    } else {
      ctx.beginPath();
      ctx.moveTo(-size, 0);
      ctx.lineTo(size, 0);
      ctx.stroke();
      ctx.fillRect(-size, -size * 0.4, 3, size * 0.8);
      ctx.fillRect(size - 3, -size * 0.4, 3, size * 0.8);
    }
    ctx.restore();
  }

  drawAngleArc(ctx, cx, cy, r, startAngle, endAngle, label) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, endAngle, startAngle > endAngle);
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 2]);
    ctx.stroke();

    // Draw Angle Number Label
    ctx.setLineDash([]);
    ctx.font = '700 10px Space Grotesk, monospace';
    ctx.fillStyle = '#00f0ff';
    ctx.textAlign = 'center';
    ctx.fillText(label, cx + r + 12, cy - 4);
    ctx.restore();
  }

  drawTelemetryOverlay(ctx, w, h, ex, angle, phase) {
    // Top Left: Camera Sightline Badge
    const viewText = (ex.view || 'front').toUpperCase() + ' VIEW';
    ctx.font = '700 9px Outfit, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'left';
    ctx.fillText(viewText, 14, 18);

    // Top Right: Range of motion badge
    ctx.textAlign = 'right';
    ctx.fillStyle = '#00f59b';
    ctx.fillText(`${ex.start}° ➔ ${ex.end}°`, w - 14, 18);

    // Bottom Center: Phase text
    ctx.textAlign = 'center';
    ctx.font = '700 10px Space Grotesk, monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText(this.phaseText, w / 2, h - 10);
  }
}

// Global export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ExerciseAnimator };
} else {
  window.ExerciseAnimator = ExerciseAnimator;
}

