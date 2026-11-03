// exercises.js - Exercise configuration library for RepVision

const LANDMARK_INDICES = {
  shoulder: { left: 11, right: 12 },
  elbow:    { left: 13, right: 14 },
  wrist:    { left: 15, right: 16 },
  hip:      { left: 23, right: 24 },
  knee:     { left: 25, right: 26 },
  ankle:    { left: 27, right: 28 }
};

const MUSCLE_GROUPS = [
  { id: 'all',       name: 'All',       icon: '🔥' },
  { id: 'biceps',    name: 'Biceps',    icon: '💪' },
  { id: 'triceps',   name: 'Triceps',   icon: '🦾' },
  { id: 'chest',     name: 'Chest',     icon: '🛡️' },
  { id: 'shoulders', name: 'Shoulders', icon: '🎯' },
  { id: 'back',      name: 'Back',      icon: '⚡' },
  { id: 'legs',      name: 'Legs',      icon: '🦵' },
  { id: 'core',      name: 'Core',      icon: '🧘' },
  { id: 'manual',    name: 'Manual',    icon: '🖐️' }
];

const EXERCISES = [
  // Biceps
  {
    id: 'hammer_curl',
    name: 'Hammer Curl',
    muscle: 'biceps',
    icon: '🔨',
    view: 'front',
    mode: 'angle',
    joints: ['shoulder', 'elbow', 'wrist'],
    start: 150,
    end: 60,
    sides: 'both',
    minRepMs: 800,
    minRange: 45,
    tip: 'Place phone at chest height in front of you.'
  },
  {
    id: 'dumbbell_curl',
    name: 'Dumbbell Curl',
    muscle: 'biceps',
    icon: '💪',
    view: 'front',
    mode: 'angle',
    joints: ['shoulder', 'elbow', 'wrist'],
    start: 150,
    end: 60,
    sides: 'both',
    minRepMs: 800,
    minRange: 45,
    tip: 'Place phone at chest height in front of you.'
  },

  // Triceps
  {
    id: 'overhead_extension',
    name: 'Overhead Extension',
    muscle: 'triceps',
    icon: '⚡',
    view: 'side',
    mode: 'angle',
    joints: ['shoulder', 'elbow', 'wrist'],
    start: 60,
    end: 160,
    sides: 'best',
    minRepMs: 800,
    minRange: 45,
    tip: 'Place phone at chest height, stand sideways to the camera.'
  },
  {
    id: 'pushdown',
    name: 'Tricep Pushdown',
    muscle: 'triceps',
    icon: '⬇️',
    view: 'side',
    mode: 'angle',
    joints: ['shoulder', 'elbow', 'wrist'],
    start: 90,
    end: 160,
    sides: 'best',
    minRepMs: 800,
    minRange: 45,
    tip: 'Place phone to your side at waist height.'
  },
  {
    id: 'bench_dip',
    name: 'Bench Dip',
    muscle: 'triceps',
    icon: '🪑',
    view: 'side',
    mode: 'angle',
    joints: ['shoulder', 'elbow', 'wrist'],
    start: 160,
    end: 90,
    sides: 'best',
    minRepMs: 800,
    minRange: 45,
    tip: 'Place phone to your side showing bench and arms.'
  },

  // Chest
  {
    id: 'pushup',
    name: 'Pushup',
    muscle: 'chest',
    icon: '🛑',
    view: 'side',
    mode: 'angle',
    joints: ['shoulder', 'elbow', 'wrist'],
    start: 160,
    end: 90,
    sides: 'best',
    minRepMs: 800,
    minRange: 45,
    tip: 'Place phone on the floor to your side.'
  },
  {
    id: 'dumbbell_press',
    name: 'Dumbbell Press',
    muscle: 'chest',
    icon: '🏋️',
    view: 'side',
    mode: 'angle',
    joints: ['shoulder', 'elbow', 'wrist'],
    start: 160,
    end: 80,
    sides: 'best',
    minRepMs: 800,
    minRange: 45,
    tip: 'Place phone to your side at bench height.'
  },

  // Shoulders
  {
    id: 'shoulder_press',
    name: 'Shoulder Press',
    muscle: 'shoulders',
    icon: '⬆️',
    view: 'front',
    mode: 'angle',
    joints: ['shoulder', 'elbow', 'wrist'],
    start: 80,
    end: 160,
    sides: 'both',
    minRepMs: 800,
    minRange: 45,
    tip: 'Place phone in front showing full upper body overhead.'
  },
  {
    id: 'lateral_raise',
    name: 'Lateral Raise',
    muscle: 'shoulders',
    icon: '↔️',
    view: 'front',
    mode: 'angle',
    joints: ['hip', 'shoulder', 'elbow'],
    start: 20,
    end: 80,
    sides: 'both',
    minRepMs: 800,
    minRange: 35,
    tip: 'Place phone in front at chest height.'
  },
  {
    id: 'front_raise',
    name: 'Front Raise',
    muscle: 'shoulders',
    icon: '↗️',
    view: 'side',
    mode: 'angle',
    joints: ['hip', 'shoulder', 'elbow'],
    start: 20,
    end: 80,
    sides: 'best',
    minRepMs: 800,
    minRange: 35,
    tip: 'Place phone to your side at chest height.'
  },

  // Back
  {
    id: 'pullup',
    name: 'Pull-up',
    muscle: 'back',
    icon: '🧗',
    view: 'front',
    mode: 'angle',
    joints: ['shoulder', 'elbow', 'wrist'],
    start: 160,
    end: 70,
    sides: 'both',
    minRepMs: 900,
    minRange: 50,
    tip: 'Place phone in front showing pullup bar and arms.'
  },
  {
    id: 'lat_pulldown',
    name: 'Lat Pulldown',
    muscle: 'back',
    icon: '🔻',
    view: 'front',
    mode: 'angle',
    joints: ['shoulder', 'elbow', 'wrist'],
    start: 160,
    end: 70,
    sides: 'both',
    minRepMs: 900,
    minRange: 50,
    tip: 'Place phone in front showing bar and torso.'
  },
  {
    id: 'single_arm_row',
    name: 'Single Arm Row',
    muscle: 'back',
    icon: '🚣',
    view: 'side',
    mode: 'angle',
    joints: ['shoulder', 'elbow', 'wrist'],
    start: 160,
    end: 80,
    sides: 'best',
    minRepMs: 800,
    minRange: 45,
    tip: 'Place phone to your side showing pulling arm.'
  },
  {
    id: 'deadlift',
    name: 'Deadlift',
    muscle: 'back',
    icon: '🧱',
    view: 'side',
    mode: 'angle',
    joints: ['shoulder', 'hip', 'knee'],
    start: 100,
    end: 165,
    sides: 'best',
    minRepMs: 1000,
    minRange: 40,
    tip: 'Place phone to your side showing full body.'
  },

  // Legs
  {
    id: 'squat',
    name: 'Squat',
    muscle: 'legs',
    icon: '🦵',
    view: 'side',
    mode: 'angle',
    joints: ['hip', 'knee', 'ankle'],
    start: 165,
    end: 90,
    sides: 'best',
    minRepMs: 1000,
    minRange: 45,
    tip: 'Place phone to your side at knee-to-waist height.'
  },
  {
    id: 'lunge',
    name: 'Lunge',
    muscle: 'legs',
    icon: '🚶',
    view: 'side',
    mode: 'angle',
    joints: ['hip', 'knee', 'ankle'],
    start: 160,
    end: 95,
    sides: 'best',
    minRepMs: 1000,
    minRange: 40,
    tip: 'Place phone to your side showing full stride.'
  },
  {
    id: 'leg_extension',
    name: 'Leg Extension',
    muscle: 'legs',
    icon: '🦶',
    view: 'side',
    mode: 'angle',
    joints: ['hip', 'knee', 'ankle'],
    start: 90,
    end: 165,
    sides: 'best',
    minRepMs: 800,
    minRange: 45,
    tip: 'Place phone to your side showing leg machine.'
  },
  {
    id: 'glute_bridge',
    name: 'Glute Bridge',
    muscle: 'legs',
    icon: '🌉',
    view: 'side',
    mode: 'angle',
    joints: ['shoulder', 'hip', 'knee'],
    start: 110,
    end: 165,
    sides: 'best',
    minRepMs: 900,
    minRange: 35,
    tip: 'Place phone on the floor to your side.'
  },

  // Core
  {
    id: 'situp',
    name: 'Sit-up',
    muscle: 'core',
    icon: '🔄',
    view: 'side',
    mode: 'angle',
    joints: ['shoulder', 'hip', 'knee'],
    start: 130,
    end: 80,
    sides: 'best',
    minRepMs: 900,
    minRange: 35,
    tip: 'Place phone on the floor to your side.'
  },
  {
    id: 'hanging_leg_raise',
    name: 'Hanging Leg Raise',
    muscle: 'core',
    icon: '🪜',
    view: 'side',
    mode: 'angle',
    joints: ['shoulder', 'hip', 'knee'],
    start: 170,
    end: 90,
    sides: 'best',
    minRepMs: 900,
    minRange: 45,
    tip: 'Place phone to your side showing full hang.'
  },
  {
    id: 'plank',
    name: 'Plank',
    muscle: 'core',
    icon: '⏱️',
    view: 'side',
    mode: 'timer',
    joints: ['shoulder', 'hip', 'ankle'],
    start: 160,
    end: 195,
    sides: 'best',
    minRepMs: 0,
    minRange: 0,
    tip: 'Place phone on the floor to your side showing straight body line.'
  },

  // Manual exercises
  {
    id: 'back_extension',
    name: 'Back Extension',
    muscle: 'manual',
    icon: '🔙',
    view: 'front',
    mode: 'manual',
    tip: 'Log reps manually using the +1 button.'
  },
  {
    id: 'face_pull',
    name: 'Face Pull',
    muscle: 'manual',
    icon: '🎯',
    view: 'front',
    mode: 'manual',
    tip: 'Log reps manually using the +1 button.'
  },
  {
    id: 'cable_row',
    name: 'Cable Row',
    muscle: 'manual',
    icon: '🚣',
    view: 'front',
    mode: 'manual',
    tip: 'Log reps manually using the +1 button.'
  },
  {
    id: 'machine_chest_press',
    name: 'Machine Chest Press',
    muscle: 'manual',
    icon: '⚙️',
    view: 'front',
    mode: 'manual',
    tip: 'Log reps manually using the +1 button.'
  },
  {
    id: 'leg_press',
    name: 'Leg Press',
    muscle: 'manual',
    icon: '🦵',
    view: 'front',
    mode: 'manual',
    tip: 'Log reps manually using the +1 button.'
  }
];

function getExerciseById(id) {
  return EXERCISES.find(e => e.id === id) || EXERCISES[0];
}

// Export for Node.js unit tests and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    LANDMARK_INDICES,
    MUSCLE_GROUPS,
    EXERCISES,
    getExerciseById
  };
} else {
  window.LANDMARK_INDICES = LANDMARK_INDICES;
  window.MUSCLE_GROUPS = MUSCLE_GROUPS;
  window.EXERCISES = EXERCISES;
  window.getExerciseById = getExerciseById;
}
