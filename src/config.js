import { clamp } from './utils/math.js';

export const PHYS = { gravity: 1650, flapVy: -560, maxFall: 900 };
export const SQUASH = { y: 0.50, tapMs: 170 };
export const STAND = { vy: -180 };

// Difficulty: ONLY speed ramps
export const WORLD = { baseSpeed: 320, maxSpeed: 520, speed: 320, groundH: 80 };

// Eat rule: need a margin so it feels fair/readable
export const EAT = { margin: 0.10, capturePad: 10, swallowDur: 0.16, intentDist: 180 };
export const HAZARD = { deflectSpeed: 1650, deflectMinVxRatio: 0.82 };

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

const CONFIG_DEFAULTS = {
  PHYS: { ...PHYS },
  SQUASH: { ...SQUASH },
  STAND: { ...STAND },
  WORLD: { ...WORLD },
  EAT: { ...EAT },
  HAZARD: { ...HAZARD },
  SCORE: { ...SCORE },
  GROW: { ...GROW },
  SPAWN: { ...SPAWN },
  GAP: { ...GAP },
  MOUTH: { ...MOUTH },
  BALANCE: { ...BALANCE },
  TRAIL: { ...TRAIL },
  WAVE: { ...WAVE },
  DDA: {
    decay: DDA.decay,
    bumpOnMiss: DDA.bumpOnMiss,
    threshold: DDA.threshold,
    speedScale: DDA.speedScale,
    gapScale: 1,
  },
  EYES: { ...EYES },
};

const validateConfig = () => {
  const warn = (msg) => console.warn(`[config] ${msg}`);
  const finite = (v) => Number.isFinite(v);
  const inRange = (v, min, max) => finite(v) && v >= min && v <= max;

  if (!finite(PHYS.gravity) || PHYS.gravity <= 0) {
    warn(`PHYS.gravity invalid (${PHYS.gravity}); using ${CONFIG_DEFAULTS.PHYS.gravity}`);
    PHYS.gravity = CONFIG_DEFAULTS.PHYS.gravity;
  }
  if (!finite(PHYS.flapVy) || PHYS.flapVy >= 0) {
    warn(`PHYS.flapVy invalid (${PHYS.flapVy}); using ${CONFIG_DEFAULTS.PHYS.flapVy}`);
    PHYS.flapVy = CONFIG_DEFAULTS.PHYS.flapVy;
  }
  if (!finite(PHYS.maxFall) || PHYS.maxFall <= 0) {
    warn(`PHYS.maxFall invalid (${PHYS.maxFall}); using ${CONFIG_DEFAULTS.PHYS.maxFall}`);
    PHYS.maxFall = CONFIG_DEFAULTS.PHYS.maxFall;
  }

  if (!finite(SQUASH.y) || SQUASH.y <= 0 || SQUASH.y > 1) {
    warn(`SQUASH.y invalid (${SQUASH.y}); using ${CONFIG_DEFAULTS.SQUASH.y}`);
    SQUASH.y = CONFIG_DEFAULTS.SQUASH.y;
  }
  if (!finite(SQUASH.tapMs) || SQUASH.tapMs <= 0) {
    warn(`SQUASH.tapMs invalid (${SQUASH.tapMs}); using ${CONFIG_DEFAULTS.SQUASH.tapMs}`);
    SQUASH.tapMs = CONFIG_DEFAULTS.SQUASH.tapMs;
  }

  if (!finite(STAND.vy) || STAND.vy >= 0) {
    warn(`STAND.vy invalid (${STAND.vy}); using ${CONFIG_DEFAULTS.STAND.vy}`);
    STAND.vy = CONFIG_DEFAULTS.STAND.vy;
  }

  if (!finite(WORLD.baseSpeed) || WORLD.baseSpeed <= 0) {
    warn(`WORLD.baseSpeed invalid (${WORLD.baseSpeed}); using ${CONFIG_DEFAULTS.WORLD.baseSpeed}`);
    WORLD.baseSpeed = CONFIG_DEFAULTS.WORLD.baseSpeed;
  }
  if (!finite(WORLD.maxSpeed) || WORLD.maxSpeed < WORLD.baseSpeed) {
    warn(`WORLD.maxSpeed invalid (${WORLD.maxSpeed}); using ${CONFIG_DEFAULTS.WORLD.maxSpeed}`);
    WORLD.maxSpeed = CONFIG_DEFAULTS.WORLD.maxSpeed;
  }
  if (!finite(WORLD.groundH) || WORLD.groundH <= 0) {
    warn(`WORLD.groundH invalid (${WORLD.groundH}); using ${CONFIG_DEFAULTS.WORLD.groundH}`);
    WORLD.groundH = CONFIG_DEFAULTS.WORLD.groundH;
  }
  if (!finite(WORLD.speed) || WORLD.speed < 0 || WORLD.speed > WORLD.maxSpeed) {
    warn(`WORLD.speed invalid (${WORLD.speed}); using ${CONFIG_DEFAULTS.WORLD.speed}`);
    WORLD.speed = CONFIG_DEFAULTS.WORLD.speed;
  }

  if (!inRange(EAT.margin, 0, 1)) {
    warn(`EAT.margin invalid (${EAT.margin}); using ${CONFIG_DEFAULTS.EAT.margin}`);
    EAT.margin = CONFIG_DEFAULTS.EAT.margin;
  }
  if (!finite(EAT.capturePad) || EAT.capturePad < 0) {
    warn(`EAT.capturePad invalid (${EAT.capturePad}); using ${CONFIG_DEFAULTS.EAT.capturePad}`);
    EAT.capturePad = CONFIG_DEFAULTS.EAT.capturePad;
  }
  if (!finite(EAT.swallowDur) || EAT.swallowDur <= 0) {
    warn(`EAT.swallowDur invalid (${EAT.swallowDur}); using ${CONFIG_DEFAULTS.EAT.swallowDur}`);
    EAT.swallowDur = CONFIG_DEFAULTS.EAT.swallowDur;
  }
  if (!finite(EAT.intentDist) || EAT.intentDist <= 0) {
    warn(`EAT.intentDist invalid (${EAT.intentDist}); using ${CONFIG_DEFAULTS.EAT.intentDist}`);
    EAT.intentDist = CONFIG_DEFAULTS.EAT.intentDist;
  }

  if (!finite(HAZARD.deflectSpeed) || HAZARD.deflectSpeed <= 0) {
    warn(`HAZARD.deflectSpeed invalid (${HAZARD.deflectSpeed}); using ${CONFIG_DEFAULTS.HAZARD.deflectSpeed}`);
    HAZARD.deflectSpeed = CONFIG_DEFAULTS.HAZARD.deflectSpeed;
  }
  if (!inRange(HAZARD.deflectMinVxRatio, 0, 1)) {
    warn(
      `HAZARD.deflectMinVxRatio invalid (${HAZARD.deflectMinVxRatio}); using ${CONFIG_DEFAULTS.HAZARD.deflectMinVxRatio}`,
    );
    HAZARD.deflectMinVxRatio = CONFIG_DEFAULTS.HAZARD.deflectMinVxRatio;
  }

  if (!finite(SCORE.min) || !finite(SCORE.max) || SCORE.min <= 0 || SCORE.max < SCORE.min) {
    warn(`SCORE min/max invalid (${SCORE.min}, ${SCORE.max}); using defaults`);
    SCORE.min = CONFIG_DEFAULTS.SCORE.min;
    SCORE.max = CONFIG_DEFAULTS.SCORE.max;
  }
  if (typeof SCORE.fromRadius !== 'function') {
    warn(`SCORE.fromRadius invalid (${SCORE.fromRadius}); using default`);
    SCORE.fromRadius = CONFIG_DEFAULTS.SCORE.fromRadius;
  }

  if (!finite(GROW.baseStep) || GROW.baseStep <= 0) {
    warn(`GROW.baseStep invalid (${GROW.baseStep}); using ${CONFIG_DEFAULTS.GROW.baseStep}`);
    GROW.baseStep = CONFIG_DEFAULTS.GROW.baseStep;
  }
  if (typeof GROW.fromRadius !== 'function') {
    warn(`GROW.fromRadius invalid (${GROW.fromRadius}); using default`);
    GROW.fromRadius = CONFIG_DEFAULTS.GROW.fromRadius;
  }

  const spawnPairs = [
    ['npcMin', 'npcMax'],
    ['redMin', 'redMax'],
    ['blueMin', 'blueMax'],
  ];
  for (const [minKey, maxKey] of spawnPairs) {
    const minVal = SPAWN[minKey];
    const maxVal = SPAWN[maxKey];
    if (!finite(minVal) || !finite(maxVal) || minVal <= 0 || maxVal <= 0 || minVal >= maxVal) {
      warn(`SPAWN.${minKey}/${maxKey} invalid (${minVal}, ${maxVal}); using defaults`);
      SPAWN[minKey] = CONFIG_DEFAULTS.SPAWN[minKey];
      SPAWN[maxKey] = CONFIG_DEFAULTS.SPAWN[maxKey];
    }
  }

  if (
    !finite(GAP.timeEasy) ||
    !finite(GAP.timeHard) ||
    GAP.timeEasy <= 0 ||
    GAP.timeHard <= 0 ||
    GAP.timeEasy < GAP.timeHard
  ) {
    warn(`GAP.timeEasy/timeHard invalid (${GAP.timeEasy}, ${GAP.timeHard}); using defaults`);
    GAP.timeEasy = CONFIG_DEFAULTS.GAP.timeEasy;
    GAP.timeHard = CONFIG_DEFAULTS.GAP.timeHard;
  }
  if (!finite(GAP.minPx) || !finite(GAP.maxPx) || GAP.minPx <= 0 || GAP.maxPx <= 0 || GAP.minPx >= GAP.maxPx) {
    warn(`GAP.minPx/maxPx invalid (${GAP.minPx}, ${GAP.maxPx}); using defaults`);
    GAP.minPx = CONFIG_DEFAULTS.GAP.minPx;
    GAP.maxPx = CONFIG_DEFAULTS.GAP.maxPx;
  }

  if (!finite(MOUTH.pulseDur) || MOUTH.pulseDur <= 0) {
    warn(`MOUTH.pulseDur invalid (${MOUTH.pulseDur}); using ${CONFIG_DEFAULTS.MOUTH.pulseDur}`);
    MOUTH.pulseDur = CONFIG_DEFAULTS.MOUTH.pulseDur;
  }
  if (!finite(MOUTH.minCooldown) || MOUTH.minCooldown <= 0) {
    warn(`MOUTH.minCooldown invalid (${MOUTH.minCooldown}); using ${CONFIG_DEFAULTS.MOUTH.minCooldown}`);
    MOUTH.minCooldown = CONFIG_DEFAULTS.MOUTH.minCooldown;
  }

  const probKeys = ['edibleProb', 'dangerProb', 'neutralProb'];
  let probValid = true;
  for (const key of probKeys) {
    if (!inRange(BALANCE[key], 0, 1)) probValid = false;
  }
  const probSum = probKeys.reduce((acc, key) => acc + (finite(BALANCE[key]) ? BALANCE[key] : 0), 0);
  if (!probValid || Math.abs(probSum - 1) > 0.01) {
    warn(`BALANCE probabilities invalid (sum ${probSum}); using defaults`);
    for (const key of probKeys) BALANCE[key] = CONFIG_DEFAULTS.BALANCE[key];
  }

  const trailProbKeys = ['probEasy', 'probMid', 'probHard', 'probRedEasy', 'probRedMid', 'probRedHard'];
  for (const key of trailProbKeys) {
    if (!inRange(TRAIL[key], 0, 1)) {
      warn(`TRAIL.${key} invalid (${TRAIL[key]}); using ${CONFIG_DEFAULTS.TRAIL[key]}`);
      TRAIL[key] = CONFIG_DEFAULTS.TRAIL[key];
    }
  }
  const trailPairs = [
    ['lenMin', 'lenMax'],
    ['dtMin', 'dtMax'],
    ['scaleMin', 'scaleMax'],
  ];
  for (const [minKey, maxKey] of trailPairs) {
    const minVal = TRAIL[minKey];
    const maxVal = TRAIL[maxKey];
    if (!finite(minVal) || !finite(maxVal) || minVal >= maxVal) {
      warn(`TRAIL.${minKey}/${maxKey} invalid (${minVal}, ${maxVal}); using defaults`);
      TRAIL[minKey] = CONFIG_DEFAULTS.TRAIL[minKey];
      TRAIL[maxKey] = CONFIG_DEFAULTS.TRAIL[maxKey];
    }
  }

  if (!finite(WAVE.period) || WAVE.period <= 0) {
    warn(`WAVE.period invalid (${WAVE.period}); using ${CONFIG_DEFAULTS.WAVE.period}`);
    WAVE.period = CONFIG_DEFAULTS.WAVE.period;
  }
  if (!finite(WAVE.relief) || WAVE.relief < 0) {
    warn(`WAVE.relief invalid (${WAVE.relief}); using ${CONFIG_DEFAULTS.WAVE.relief}`);
    WAVE.relief = CONFIG_DEFAULTS.WAVE.relief;
  }
  if (!finite(WAVE.speedScale) || WAVE.speedScale <= 0 || WAVE.speedScale > 1) {
    warn(`WAVE.speedScale invalid (${WAVE.speedScale}); using ${CONFIG_DEFAULTS.WAVE.speedScale}`);
    WAVE.speedScale = CONFIG_DEFAULTS.WAVE.speedScale;
  }
  if (!finite(WAVE.trailBoost) || WAVE.trailBoost < 0) {
    warn(`WAVE.trailBoost invalid (${WAVE.trailBoost}); using ${CONFIG_DEFAULTS.WAVE.trailBoost}`);
    WAVE.trailBoost = CONFIG_DEFAULTS.WAVE.trailBoost;
  }

  const ddaScaleKeys = ['decay', 'bumpOnMiss', 'speedScale', 'gapScale'];
  for (const key of ddaScaleKeys) {
    if (!finite(DDA[key]) || DDA[key] <= 0 || DDA[key] > 1) {
      warn(`DDA.${key} invalid (${DDA[key]}); using ${CONFIG_DEFAULTS.DDA[key]}`);
      DDA[key] = CONFIG_DEFAULTS.DDA[key];
    }
  }
  if (!finite(DDA.threshold) || DDA.threshold < 0) {
    warn(`DDA.threshold invalid (${DDA.threshold}); using ${CONFIG_DEFAULTS.DDA.threshold}`);
    DDA.threshold = CONFIG_DEFAULTS.DDA.threshold;
  }

  if (!inRange(EYES.yOff, -1, 1)) {
    warn(`EYES.yOff invalid (${EYES.yOff}); using ${CONFIG_DEFAULTS.EYES.yOff}`);
    EYES.yOff = CONFIG_DEFAULTS.EYES.yOff;
  }
  if (!inRange(EYES.xSep, 0, 1)) {
    warn(`EYES.xSep invalid (${EYES.xSep}); using ${CONFIG_DEFAULTS.EYES.xSep}`);
    EYES.xSep = CONFIG_DEFAULTS.EYES.xSep;
  }
  if (!finite(EYES.r) || EYES.r <= 0 || EYES.r > 1) {
    warn(`EYES.r invalid (${EYES.r}); using ${CONFIG_DEFAULTS.EYES.r}`);
    EYES.r = CONFIG_DEFAULTS.EYES.r;
  }
  if (!inRange(EYES.pupilShift, 0, 1)) {
    warn(`EYES.pupilShift invalid (${EYES.pupilShift}); using ${CONFIG_DEFAULTS.EYES.pupilShift}`);
    EYES.pupilShift = CONFIG_DEFAULTS.EYES.pupilShift;
  }
};

validateConfig();
