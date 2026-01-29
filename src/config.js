import { clamp } from './utils/math.js';

export const PHYS = { gravity: 1650, flapVy: -560, maxFall: 900 };
export const SQUASH = { y: 0.50, tapMs: 170 };
export const STAND = { vy: -180 };

// Difficulty: ONLY speed ramps
export const WORLD = { baseSpeed: 320, maxSpeed: 520, speed: 320, groundH: 80 };

// Eat rule: need a margin so it feels fair/readable
export const EAT = { margin: 0.10, capturePad: 10, swallowDur: 0.16, intentDist: 180 };

// Score / growth scale with NPC size
export const SCORE = { min: 1, max: 25, fromRadius: (r) => Math.round(r / 6) };
export const GROW = { baseStep: 3, fromRadius: (r) => clamp(Math.round(r / 7), 1, 10) };

// Spawn timing (stable)
export const SPAWN = { npcMin: 0.85, npcMax: 1.45, redMin: 1.40, redMax: 2.35, blueMin: 3.10, blueMax: 5.20 };

// Fairness spacing
export const GAP = { timeEasy: 0.78, timeHard: 0.56, minPx: 220, maxPx: 280 };

// Mouth: event-driven single chomp
export const MOUTH = { pulseDur: 0.12, minCooldown: 0.07 };

// NPC size balancing: keep points available
export const BALANCE = {
  edibleProb: 0.68,
  dangerProb: 0.26,
  neutralProb: 0.06,
  edibleGuaranteeAfter: 3,
};

// Trail bundles (combo moments)
export const TRAIL = {
  // How often bundles happen (approx; scheduler also controls rhythm)
  probEasy: 0.14,
  probMid: 0.18,
  probHard: 0.14,

  probRedEasy: 0.04,
  probRedMid: 0.06,
  probRedHard: 0.08,

  lenMin: 4,
  lenMax: 7,

  // Spawn spacing in seconds (consistent feel across speed)
  dtMin: 0.18,
  dtMax: 0.26,

  // Size band relative to player for trail members (mostly edible)
  scaleMin: 0.55,
  scaleMax: 0.90,
};

// Pressure-release wave (subtle pacing)
export const WAVE = {
  period: 16,
  relief: 3,
  speedScale: 0.94,
  trailBoost: 0.05,
};

// Lightweight DDA based on recent misses
export const DDA = {
  decay: 0.25,
  bumpOnMiss: 0.35,
  threshold: 0.3,
  speedScale: 0.92,
  gapScale: 1.12,
};

// Eyes (minimal)
export const EYES = {
  yOff: -0.18,
  xSep: 0.28,
  r: 0.10,
  pupilShift: 0.14,
};
