// test/counter.test.js - Unit tests for RepVision generic RepCounter

const assert = require('assert');
const { RepCounter } = require('../counter.js');
const { EXERCISES, getExerciseById } = require('../exercises.js');

let testsPassed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    process.exit(1);
  }
}

console.log('Running RepCounter Unit Tests...\n');

// 1. Normal Rep Test (Hammer Curl: 170 -> 100 -> 40 -> 100 -> 170 = 1 rep)
test('Normal rep (170, 100, 40, 100, 170) gives exactly 1 rep', () => {
  const hammerConfig = getExerciseById('hammer_curl');
  let repEvents = [];
  const counter = new RepCounter(hammerConfig, (count) => repEvents.push(count));

  // Time stepped by 300ms each sample (> minRepMs of 800ms between 170 and 40)
  counter.update(170, 0);
  counter.update(100, 300);
  counter.update(40, 900); // reaches <= 60 after 900ms and range 130 deg
  counter.update(100, 1200);
  counter.update(170, 1500);

  assert.strictEqual(counter.reps, 1, `Expected 1 rep, got ${counter.reps}`);
  assert.strictEqual(repEvents.length, 1);
  assert.strictEqual(repEvents[0], 1);
});

// 2. Wobble near thresholds gives 0 extra reps
test('Wobble near contracted and extended thresholds gives 0 extra reps', () => {
  const hammerConfig = getExerciseById('hammer_curl');
  const counter = new RepCounter(hammerConfig);

  // Arm extended with wobble
  counter.update(170, 0);
  counter.update(168, 100);
  counter.update(172, 200);
  counter.update(165, 300);
  assert.strictEqual(counter.reps, 0, 'Wobble at start should give 0 reps');

  // Curl up
  counter.update(100, 600);
  counter.update(40, 1000); // Rep 1 counted here
  assert.strictEqual(counter.reps, 1, 'Should count 1 rep at top');

  // Wobble near 40 at the top
  counter.update(42, 1100);
  counter.update(38, 1200);
  counter.update(45, 1300);
  counter.update(39, 1400);
  assert.strictEqual(counter.reps, 1, 'Wobble at top must not count extra reps');

  // Lower down
  counter.update(100, 1700);
  counter.update(170, 2000); // Disarmed state resets to armed
  assert.strictEqual(counter.reps, 1, 'Lowering to bottom should not add rep');

  // Wobble at bottom again
  counter.update(168, 2100);
  counter.update(173, 2200);
  assert.strictEqual(counter.reps, 1, 'Wobble at bottom must not count extra reps');
});

// 3. Half-rep test gives 0
test('Half-rep (170 -> 100 -> 170) gives 0 reps', () => {
  const hammerConfig = getExerciseById('hammer_curl');
  const counter = new RepCounter(hammerConfig);

  counter.update(170, 0);
  counter.update(130, 400);
  counter.update(100, 800);  // Did not reach end (60)
  counter.update(130, 1200);
  counter.update(170, 1600); // Returned back

  assert.strictEqual(counter.reps, 0, 'Half rep must not count');
});

// 4. Press-like exercise (start < end, e.g. Shoulder Press 80 -> 160)
test('Press-like exercise (start < end) works correctly', () => {
  const pressConfig = getExerciseById('shoulder_press');
  let repEvents = [];
  const counter = new RepCounter(pressConfig, (count) => repEvents.push(count));

  // Start down at shoulders
  counter.update(75, 0);   // <= 80 (start)
  counter.update(110, 400);
  counter.update(165, 900); // >= 160 (end) after 900ms and range 90 deg -> Rep 1!
  counter.update(110, 1300);
  counter.update(75, 1700); // Back down

  assert.strictEqual(counter.reps, 1, `Expected 1 rep for press, got ${counter.reps}`);
  assert.strictEqual(repEvents.length, 1);

  // Complete second rep
  counter.update(120, 2200);
  counter.update(162, 2700); // Rep 2!
  counter.update(75, 3200);

  assert.strictEqual(counter.reps, 2, 'Expected 2 reps after second press');
});

// 5. Timer mode (Plank: 160 to 195)
test('Timer mode counts seconds while in range and pauses when out of range', () => {
  const plankConfig = getExerciseById('plank');
  let secondsEvent = [];
  const counter = new RepCounter(plankConfig, (sec) => secondsEvent.push(sec));

  // In plank position (175 deg)
  counter.update(175, 0);
  assert.strictEqual(counter.stage, 'holding');

  // Hold for 3 seconds
  counter.update(175, 1000);
  counter.update(175, 2000);
  counter.update(175, 3050);

  assert.strictEqual(counter.reps, 3, `Expected 3 seconds accumulated, got ${counter.reps}`);

  // Drop hips out of range (140 deg) -> paused
  counter.update(140, 3500);
  assert.strictEqual(counter.stage, 'paused');

  // Wait 2 seconds while out of range
  counter.update(140, 5500);
  assert.strictEqual(counter.reps, 3, 'Seconds should not increase while paused');

  // Return to plank position (175 deg)
  counter.update(175, 6000);
  assert.strictEqual(counter.stage, 'holding');

  // Hold for 2 more seconds
  counter.update(175, 7050);
  counter.update(175, 8100);

  assert.strictEqual(counter.reps, 5, `Expected 5 seconds total, got ${counter.reps}`);
});

// 6. Minimum rep duration (rejecting impossibly fast noise)
test('Too-fast rep (< minRepMs) does not count', () => {
  const hammerConfig = getExerciseById('hammer_curl'); // minRepMs is 800
  const counter = new RepCounter(hammerConfig);

  counter.update(170, 0);
  counter.update(40, 200); // only 200ms elapsed (< 800ms)
  counter.update(170, 400);

  assert.strictEqual(counter.reps, 0, 'Instant noise spike should be ignored');
});

// 7. Manual mode operations
test('Manual mode addRep and undoRep', () => {
  const manualConfig = getExerciseById('cable_row');
  let events = [];
  const counter = new RepCounter(manualConfig, (c) => events.push(c));

  counter.addRep();
  counter.addRep();
  assert.strictEqual(counter.reps, 2);
  assert.strictEqual(events.length, 2);

  counter.undoRep();
  assert.strictEqual(counter.reps, 1);

  counter.reset();
  assert.strictEqual(counter.reps, 0);
});

console.log(`\nAll ${testsPassed} unit tests passed successfully!`);
