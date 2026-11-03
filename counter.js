// counter.js - Generic exercise rep and hold-time counter for RepVision

class RepCounter {
  constructor(config = {}, onRep = null) {
    this.setConfig(config);
    this.onRep = onRep;
    this.reset();
  }

  setConfig(config) {
    this.config = {
      id: config.id || 'custom',
      name: config.name || 'Exercise',
      mode: config.mode || 'angle', // 'angle' | 'timer' | 'manual'
      start: typeof config.start === 'number' ? config.start : 150,
      end: typeof config.end === 'number' ? config.end : 60,
      minRepMs: typeof config.minRepMs === 'number' ? config.minRepMs : 800,
      minRange: typeof config.minRange === 'number' ? config.minRange : 40,
      ...config
    };

    this.isCurlLike = this.config.start > this.config.end; // true: high -> low (e.g. 150 -> 60)
    this.hysteresis = 6; // degrees hysteresis to debounce near thresholds
    this._virtualTime = 0;
  }

  reset() {
    this.reps = 0;
    this.stage = 'idle'; // 'idle' | 'down' | 'up' | 'holding' | 'paused'
    this.armed = false;
    this.startTimestamp = null;
    this.extremeAngle = null; // peak start angle
    this.turnaroundAngle = null; // deepest inflection angle reached
    this.lastRepTimestamp = 0;
    this.currentAngle = null;
    this.progress = 0; // 0 to 1

    // Timer mode specifics
    this.timerActive = false;
    this.timerAccumulatedMs = 0;
    this.timerLastTimestamp = null;
    this.timerLastSecondDispatched = 0;
  }

  // Handle manual counting
  addRep() {
    this.reps += 1;
    this.stage = 'up';
    if (typeof this.onRep === 'function') {
      this.onRep(this.reps, this);
    }
    return this.reps;
  }

  undoRep() {
    if (this.reps > 0) {
      this.reps -= 1;
    }
    return this.reps;
  }

  get statusText() {
    if (this.config.mode === 'manual') {
      return this.reps > 0 ? 'Logged' : 'Ready';
    }
    if (this.config.mode === 'timer') {
      if (this.stage === 'holding') return 'Holding';
      if (this.stage === 'paused') return 'Paused';
      return 'Ready';
    }

    // Angle mode
    if (this.stage === 'up') {
      return this.isCurlLike ? 'Curl!' : 'Up!';
    }
    if (this.stage === 'down') {
      return this.isCurlLike ? 'Down' : 'Down';
    }
    return 'Ready';
  }

  // Update loop called every frame with smoothed angle
  update(angle, timestamp) {
    if (angle === null || angle === undefined || isNaN(angle)) {
      if (this.config.mode === 'timer' && this.stage === 'holding') {
        this.stage = 'paused';
        this.timerLastTimestamp = null;
      }
      return this.reps;
    }

    // Determine current timestamp
    let now;
    if (typeof timestamp === 'number') {
      now = timestamp;
    } else if (typeof performance !== 'undefined' && performance.now) {
      now = performance.now();
    } else if (typeof Date !== 'undefined') {
      now = Date.now();
    } else {
      this._virtualTime += 300;
      now = this._virtualTime;
    }

    this.currentAngle = angle;

    if (this.config.mode === 'manual') {
      return this.reps;
    }

    if (this.config.mode === 'timer') {
      return this._updateTimer(angle, now);
    }

    return this._updateAngle(angle, now);
  }

  // Progress computation (0.0 to 1.0) from start angle toward end angle
  calculateProgress(angle) {
    if (angle === null || angle === undefined) return 0;
    const { start, end } = this.config;
    const span = Math.abs(start - end);
    if (span < 1e-4) return 0;

    let p;
    if (this.isCurlLike) {
      // start is high (e.g. 150), end is low (e.g. 60)
      p = (start - angle) / span;
    } else {
      // start is low (e.g. 80), end is high (e.g. 160)
      p = (angle - start) / span;
    }
    return Math.max(0, Math.min(1, p));
  }

  _updateAngle(angle, now) {
    const { start, end, minRepMs, minRange } = this.config;
    const H = this.hysteresis;

    this.progress = this.calculateProgress(angle);

    if (this.isCurlLike) {
      // e.g. Hammer curl: start = 150, end = 60
      // Arm extended: angle >= start - H (e.g. >= 144)
      if (angle >= start - H) {
        if (!this.armed || this.stage !== 'down') {
          this.stage = 'down';
          this.armed = true;
          this.startTimestamp = now;
          this.extremeAngle = angle;
          this.turnaroundAngle = angle;
        } else {
          this.extremeAngle = Math.max(this.extremeAngle || angle, angle);
        }
      }

      if (this.armed) {
        this.turnaroundAngle = Math.min(this.turnaroundAngle || angle, angle);

        // Contracted position reached: angle <= end + H (e.g. <= 66)
        // With threshold validation: must reach <= end
        if (angle <= end) {
          const duration = this.startTimestamp !== null ? (now - this.startTimestamp) : minRepMs;
          const range = (this.extremeAngle || start) - angle;

          if (duration >= minRepMs && range >= minRange) {
            this.stage = 'up';
            this.reps += 1;
            this.armed = false; // Disarm until returning to start position
            this.lastRepTimestamp = now;

            if (typeof this.onRep === 'function') {
              this.onRep(this.reps, this);
            }
          }
        }
      }
    } else {
      // Press-like: start = 80, end = 160
      // Lowered / starting position: angle <= start + H (e.g. <= 86)
      if (angle <= start + H) {
        if (!this.armed || this.stage !== 'down') {
          this.stage = 'down';
          this.armed = true;
          this.startTimestamp = now;
          this.extremeAngle = angle;
          this.turnaroundAngle = angle;
        } else {
          this.extremeAngle = Math.min(this.extremeAngle || angle, angle);
        }
      }

      if (this.armed) {
        this.turnaroundAngle = Math.max(this.turnaroundAngle || angle, angle);

        // Pressed / extended position reached: angle >= end
        if (angle >= end) {
          const duration = this.startTimestamp !== null ? (now - this.startTimestamp) : minRepMs;
          const range = angle - (this.extremeAngle || start);

          if (duration >= minRepMs && range >= minRange) {
            this.stage = 'up';
            this.reps += 1;
            this.armed = false; // Disarm until returning to start position
            this.lastRepTimestamp = now;

            if (typeof this.onRep === 'function') {
              this.onRep(this.reps, this);
            }
          }
        }
      }
    }

    return this.reps;
  }

  _updateTimer(angle, now) {
    const { start, end } = this.config; // e.g. Plank: 160 to 195
    const inRange = (angle >= start && angle <= end);

    if (inRange) {
      if (this.stage !== 'holding') {
        this.stage = 'holding';
        this.timerLastTimestamp = now;
      } else if (this.timerLastTimestamp !== null) {
        const delta = Math.max(0, now - this.timerLastTimestamp);
        this.timerAccumulatedMs += delta;
        this.timerLastTimestamp = now;

        const currentSeconds = Math.floor(this.timerAccumulatedMs / 1000);
        if (currentSeconds > this.reps) {
          this.reps = currentSeconds;
          if (typeof this.onRep === 'function') {
            this.onRep(this.reps, this);
          }
        }
      } else {
        this.timerLastTimestamp = now;
      }
    } else {
      if (this.stage === 'holding') {
        this.stage = 'paused';
      }
      this.timerLastTimestamp = null;
    }

    return this.reps;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RepCounter };
} else {
  window.RepCounter = RepCounter;
}
