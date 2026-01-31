import { PHYS, SQUASH, STAND, WORLD, EAT, HAZARD, SCORE, GROW, SPAWN, GAP, MOUTH, BALANCE, TRAIL, WAVE, DDA } from './config.js';
import { clamp, rand, lerp, easeInOut, dist, lerpAngle } from './utils/math.js';
import { makeStars, drawStars, drawSky, drawHills, drawGround, drawScreenText } from './render/background.js';
import { createBurst, startBurst, updateBurst, drawBurst, createShatter, startHeadShatter, updateShatter, drawShatter, createLineBurst, startLineBurst, updateLineBurst, drawLineBurst, createFloaters, popText, updateFloaters, drawFloaters, createSparkles, startSparkles, updateSparkles, drawSparkles, createDustPuffs, startDustPuff, updateDustPuffs, drawDustPuffs } from './render/effects.js';
import { createPlayer, drawPlayer2, DEFAULT_PALETTE } from './entities/player.js';
import { updateMouth, triggerChomp } from './entities/mouth.js';
import { makeNPC, updateNPCs, driftNPCs, drawCharacter, NPC_PALETTE } from './entities/npc.js';
import { makeRed, updateReds, driftReds, drawDynamiteBomb } from './entities/hazards.js';
import { makeBlue, updateBlues, driftBlues, drawStar } from './entities/powerups.js';

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const scoreValueEl = document.createElement('span');
scoreValueEl.className = 'score-value';
scoreEl.textContent = '';
scoreEl.appendChild(scoreValueEl);
const scoreLockEl = document.createElement('span');
scoreLockEl.className = 'score-lock';
scoreLockEl.setAttribute('aria-hidden', 'true');
scoreEl.appendChild(scoreLockEl);

const gameState = { value: 'start' }; // start | startTransition | playing | paused | dying | gameover | gameoverFinal | restartTransition | cutscene | stageclear

const BOSS_PALETTE = {
  body: '#d35a5a',
  bodyAccent: '#c44b4b',
  lips: '#7c2a2a',
  eye: '#2b1616',
  outline: '#b04444',
  wing: '#c44b4b',
};
const boss = { x: 0, y: 0, r: 0, wingT: 0, mouth: 0, vy: 0, squashY: 1, duckT: 0, reactT: 0, actionCd: 0, intent: null, hp: 4, hpMax: 4 };

const DIALOGUE_INTRO = [
  { speaker: 'RED', text: 'You really thought you could just glide past me?' },
  { speaker: 'FURY', text: 'Move, brother. I am done playing nice.' },
  { speaker: 'RED', text: 'Always the golden child. Still hiding behind speed?' },
  { speaker: 'FURY', text: 'Still hiding behind a big mouth?' },
  { speaker: 'RED', text: 'Then prove it. Step up.' },
];
const DIALOGUE_OUTRO = [
  { speaker: 'RED', text: 'Heh. Not bad for a featherweight.' },
  { speaker: 'FURY', text: 'This ends now.' },
];
let dialogueScript = DIALOGUE_INTRO;
let dialogueMode = 'intro';
let dialogueIndex = 0;
let dialogueChar = 0;
const dialogueSpeed = 38;
const scoreFade = { active: false, t: 0, dur: 0.6 };
let showHealthBar = false;
let bossCheckpointScore = 0;
let bossCheckpointSize = 0;
let bossCheckpointX = 0;
let bossCheckpointHp = 0;
let bossCheckpointTimer = 0;
let diedInBoss = false;
let bossScoreLocked = false;
let bossTimer = 0;
let bossTimerActive = false;
let bossBonusAwarded = false;
let bossDifficulty = 0;
let bossDifficultyActive = false;
let deathCount = 0;
let enemiesKilled = 0;
const MAX_LIVES_HALF = 8;
const MAX_LIVES = MAX_LIVES_HALF / 2;
let livesHalf = MAX_LIVES_HALF;
const bossOutro = {
  active: false,
  phase: 'idle',
  t: 0,
  whiteIn: 0.35,
  whiteHold: 2.0,
  whiteOut: 0.4,
  boomDur: 2.1,
  boomSpawn: 0,
  boomSfx: 0,
  finaleDur: 0.7,
  bonusHold: 1.5,
  bonusPop: 0.9,
  fadeOut: 0.9,
  whiteAlpha: 0,
  blackAlpha: 0,
  blackBackdrop: false,
  bossGone: false,
  anchorPlayerX: 0,
  anchorPlayerY: 0,
  anchorBossX: 0,
  anchorBossY: 0,
  anchorScrollX: 0,
};

const createSfxPool = (src, count = 4, volume = 0.6) => {
  const pool = Array.from({ length: count }, () => {
    const a = new Audio(src);
    a.preload = 'auto';
    a.volume = volume;
    return a;
  });
  let i = 0;
  return () => {
    const a = pool[i];
    i = (i + 1) % pool.length;
    try {
      a.currentTime = 0;
      a.play();
    } catch {
      // Ignore autoplay/gesture restrictions.
    }
  };
};

const playJumpSfx = createSfxPool('assets/sfx/jump.wav', 4, 0.65);
const playEatNpcSfx = createSfxPool('assets/sfx/eat_smaller_npc.wav', 3, 0.9);
const playNpcEatsPlayerSfx = createSfxPool('assets/sfx/npc_eats_player.wav', 3, 0.7);
const playPlayerSpawnsSfx = createSfxPool('assets/sfx/player_spawns.wav', 3, 0.75);
const playPlayerOutsideSfx = createSfxPool('assets/sfx/player_jumps_outside_bg.wav', 2, 0.75);
const playStartFromHomeSfx = createSfxPool('assets/sfx/start_from_home.wav', 2, 0.75);
const playHomeStartSfx = createSfxPool('assets/sfx/home_start.wav', 1, 0.75);
const playBombLeavesSfx = createSfxPool('assets/sfx/bomb_leaves_bg.wav', 3, 0.7);
const playBombHitsGroundSfx = createSfxPool('assets/sfx/bomb_hits_ground.wav', 3, 0.7);
const playEatStarSfx = createSfxPool('assets/sfx/eat_star.wav', 3, 0.7);
const playEatBombSfx = createSfxPool('assets/sfx/eat_bomb.wav', 3, 0.8);
const playHitBombSfx = createSfxPool('assets/sfx/hit_bomb.wav', 3, 0.75);
const playEnterAutoModeSfx = createSfxPool('assets/sfx/enter_auto_mode.wav', 2, 0.75);
const playTextTapSfx = createSfxPool('assets/sfx/text_message_tap.wav', 4, 0.7);
const playBossExplosionSfx = createSfxPool('assets/sfx/bomb_hits_ground.wav', 5, 0.75);
const playBossPopSfx = createSfxPool('assets/sfx/eat_bomb.wav', 4, 0.7);

const levelMusic = (() => {
  const audio = new Audio('assets/sfx/level1_part1_music.mp3');
  audio.preload = 'auto';
  audio.loop = true;
  const baseVol = 0.6;
  audio.volume = baseVol;
  return { audio, baseVol, pending: false, delay: 0, fade: 0, fadeDur: 0.8, fading: false };
})();

const dialogueMusic = (() => {
  const audio = new Audio('assets/sfx/level1_part2_music.mp3');
  audio.preload = 'auto';
  audio.loop = true;
  const baseVol = 0.5;
  audio.volume = baseVol;
  return { audio, baseVol, pending: false, delay: 0, fade: 0, fadeDur: 0.8, fading: false };
})();

const burst = createBurst();
const headShatter = createShatter();
const npcShatter = createShatter();
const lineBurst = createLineBurst();
const bossExplosions = [];
const floaters = createFloaters();
const sparkles = createSparkles();
const dustPuffs = createDustPuffs();

const resize = () => {
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  canvas.width = Math.floor(innerWidth * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  canvas.style.width = innerWidth + 'px';
  canvas.style.height = innerHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
};
addEventListener('resize', resize);
resize();

const groundY = () => innerHeight - WORLD.groundH;

let score = 0;
const setScore = (n) => {
  const next = Math.max(0, Math.round(n));
  score = next;
  scoreValueEl.textContent = `${next} pts`;
};
const showScore = (show) => { scoreEl.style.display = show ? 'flex' : 'none'; };
const setScoreOpacity = (v) => { scoreEl.style.opacity = v; };
let waveT = 0;
let reliefActive = false;
let stress = 0;
let stressEase = 0;
let deathDelay = 0;
let debugHUD = false;
let biteDir = 0;
let biteT = 0;
let dustTrailAcc = 0;
let dustTrailGap = 22;
let wasGrounded = false;
let spawnDustDelay = 0;
let spawnDustPending = false;
let checkpointToastT = 0;
const checkpointToastDur = 2.0;
const hudTrack = { init: {}, changed: {}, maxed: {} };
let menuScrollX = 0;
const resetHudTrack = () => {
  hudTrack.init = {};
  hudTrack.changed = {};
  hudTrack.maxed = {};
};
let missLog = [];
let missCount = 0;
let missPoints = 0;
const logMiss = (pts, x, y, record = true) => {
  if (record) {
    missLog.unshift({ pts, x, y, t: 0 });
    if (missLog.length > 6) missLog.pop();
  }
  missCount += 1;
  missPoints += pts;
};

const pointsForRadius = (r) => clamp(SCORE.fromRadius(r), SCORE.min, SCORE.max);

const addScore = (pts, x, y) => {
  if (!pts) return;
  if (bossScoreLocked) return;
  setScore(score + pts);
  popText(floaters, `+${pts}`, x, y);
};

const deductScore = (pts, x, y) => {
  if (!pts) return;
  if (bossScoreLocked) return;
  setScore(score - pts);
  popText(floaters, `-${pts}`, x, y);
  stress = clamp(stress + DDA.bumpOnMiss, 0, 1);
  logMiss(pts, x, y, debugHUD);
};

const registerDeath = () => {
  if (gameState.value === 'dying' || gameState.value === 'gameover') return;
  deathCount += 1;
  livesHalf = Math.max(0, livesHalf - 1);
};

const scoreDifficulty01 = () => clamp(score / 120, 0, 1);
const difficulty01 = () => (bossDifficultyActive ? bossDifficulty : scoreDifficulty01());
const updateDifficulty = () => {
  const d = difficulty01();
  const smooth = d * d * (3 - 2 * d);
  const s = Math.pow(smooth, 0.65);
  const baseSpeed = lerp(WORLD.baseSpeed, WORLD.maxSpeed, s);
  const waveScale = reliefActive ? WAVE.speedScale : 1;
  const ddaScale = lerp(1, DDA.speedScale, stressEase);
  WORLD.speed = baseSpeed * waveScale * ddaScale;
};
const minGapPx = () => {
  const d = difficulty01();
  const gapTime = lerp(GAP.timeEasy, GAP.timeHard, d);
  const base = clamp(gapTime * WORLD.speed, GAP.minPx, GAP.maxPx);
  const scaled = base * lerp(1, DDA.gapScale, stressEase);
  return clamp(scaled, GAP.minPx, GAP.maxPx * DDA.gapScale);
};
const trailProb = () => {
  const d = difficulty01();
  const base = (d < 0.35) ? TRAIL.probEasy : (d < 0.75) ? TRAIL.probMid : TRAIL.probHard;
  return clamp(base + (reliefActive ? WAVE.trailBoost : 0), 0, 0.95);
};
const nextInterval = (kind) => {
  if (kind === 'npc') return rand(SPAWN.npcMin, SPAWN.npcMax);
  if (kind === 'red') return rand(SPAWN.redMin, SPAWN.redMax);
  return rand(SPAWN.blueMin, SPAWN.blueMax);
};
const canEat = (rA, rB) => rA >= rB * (1 + EAT.margin);

const player = createPlayer(18);
player.mouth.pulseDur = MOUTH.pulseDur;

const npcs = [];
const reds = [];
const blues = [];
let npcT = 0, redT = 0, blueT = 0;
let trail = null;
let lastSpawnWorldX = -1e9;
let spawnsSinceEdible = 0;

const SPAWN_GAP = 6;
const circlesOverlap = (x1, y1, r1, x2, y2, r2) => {
  const dx = x1 - x2, dy = y1 - y2;
  const rr = r1 + r2 + SPAWN_GAP;
  return (dx * dx + dy * dy) < rr * rr;
};

const overlapsExisting = (x, y, r) => {
  for (const o of npcs) {
    if (Math.abs(x - o.x) > r + o.r + SPAWN_GAP) continue;
    if (circlesOverlap(x, y, r, o.x, o.y, o.r)) return true;
  }
  for (const o of reds) {
    if (Math.abs(x - o.x) > r + o.r + SPAWN_GAP) continue;
    if (circlesOverlap(x, y, r, o.x, o.y, o.r)) return true;
  }
  for (const o of blues) {
    if (Math.abs(x - o.x) > r + o.r + SPAWN_GAP) continue;
    if (circlesOverlap(x, y, r, o.x, o.y, o.r)) return true;
  }
  return false;
};

const pickSpawnY = (x, r) => {
  const yMin = 60;
  const yMax = groundY() - 40;
  let y = rand(yMin, yMax);
  for (let i = 0; i < 30; i++) {
    const cand = rand(yMin, yMax);
    if (!overlapsExisting(x, cand, r)) return cand;
    y = cand;
  }
  return y;
};

const resolveSpawnX = (x, y, r) => {
  let xx = x;
  for (let i = 0; i < 60; i++) {
    if (!overlapsExisting(xx, y, r)) return xx;
    xx += 4;
  }
  return xx;
};

const encounterQueue = [];
let forceEdibleNext = false;

const starsFar = makeStars(70, rand);
let scrollX = 0;

const screenAnim = { active: false, t: 0, dur: 0.45 };
const cutsceneFade = { active: false, phase: 'out', t: 0, dur: 0.7 };
const gameOverFinal = { active: false, t: 0, dur: 1.4 };
const COINS_MAX = 5;
let coins = COINS_MAX;
const coinFlash = { active: false, t: 0, dur: 1.5 };
let insertMode = false;
const resumeDelay = { active: false, t: 0, dur: 1.5 };

const LEVEL = { length: 20000, checkpoints: [0, 0.25, 0.5, 0.75, 1] };
const checkpointXs = LEVEL.checkpoints.map((f) => f * LEVEL.length);
let checkpointIndex = 0;
const checkpointScores = [];
const checkpointSizes = [];
const finishStopX = Math.max(0, LEVEL.length - innerWidth + 120);
let finishExit = false;
const finishFadeEntities = { active: false, t: 0, dur: 0.7 };
let cinematicUiHidden = false;
let cutscenePending = false;

const startBurstAt = (x, y, dur = 0.55) => startBurst(burst, x, y, rand, dur);
const startLineBurstAt = (x, y, scale = 1, dur = 0.16) => startLineBurst(lineBurst, x, y, rand, scale, dur);
const startHeadShatterAt = (x, y, r) => startHeadShatter(
  headShatter,
  x,
  y,
  r,
  rand,
  DEFAULT_PALETTE,
  groundY(),
  1,
  clamp,
  { sizeMin: 0.05, sizeMax: 0.10, maxPieceR: 10 }
);
const startNpcShatterAt = (x, y, r) => startHeadShatter(
  npcShatter,
  x,
  y,
  r,
  rand,
  NPC_PALETTE,
  groundY(),
  1,
  clamp,
  { countScale: 0.6, countMin: 4, countMax: 8, sizeMin: 0.05, sizeMax: 0.09, fadeDur: 0.22, velScale: 1 }
);
const startBossShatterAt = (x, y, r) => startHeadShatter(
  headShatter,
  x,
  y,
  r,
  rand,
  BOSS_PALETTE,
  groundY(),
  1.15,
  clamp,
  { countScale: 1.1, countMin: 10, countMax: 18, sizeMin: 0.06, sizeMax: 0.12, fadeDur: 0.8, velScale: 1.1 }
);
const spawnBossExplosion = (scale = 1) => {
  const burst = createLineBurst();
  const jitterX = rand(-1, 1) * Math.max(6, boss.r * 0.45);
  const jitterY = rand(-1, 1) * Math.max(6, boss.r * 0.35);
  const dur = rand(0.14, 0.22);
  startLineBurst(burst, boss.x + jitterX, boss.y + jitterY, rand, scale, dur);
  bossExplosions.push(burst);
};

const resetGameVars = () => {
  npcs.length = 0;
  reds.length = 0;
  blues.length = 0;
  npcT = 0;
  redT = 0;
  blueT = 0;
  scrollX = 0;
  setScore(0);
  spawnsSinceEdible = 0;
  encounterQueue.length = 0;
  forceEdibleNext = false;
  trail = null;
  floaters.length = 0;

  player.alive = true;
  player.r = player.baseR;
  player.vy = 0;
  player.y = groundY() - player.r;
  player.x = 160;
  player.emotion = 'neutral';
  player._beingEaten = null;

  inputHeld = false;
  inputHeldAt = 0;
  didDuckThisHold = false;
  player.squashY = 1;
  player.squashTarget = 1;

  player.mouth.open = 0;
  player.mouth.dir = 0;
  player.mouth.pulseT = 1;
  player.mouth.pulseDur = MOUTH.pulseDur;
  player.mouth.cooldown = 0;
  player.wingT = 0;

  burst.active = false;
  burst.t = 0;
  burst.particles.length = 0;
  headShatter.active = false;
  headShatter.pieces.length = 0;
  npcShatter.active = false;
  npcShatter.pieces.length = 0;
  lineBurst.active = false;
  lineBurst.t = 0;
  lineBurst.puffs.length = 0;
  sparkles.particles.length = 0;
  dustPuffs.puffs.length = 0;
  dustTrailAcc = 0;
  dustTrailGap = 22;
  wasGrounded = false;
  spawnDustDelay = 0;
  spawnDustPending = false;

  WORLD.speed = WORLD.baseSpeed;
  lastSpawnWorldX = -1e9;
  waveT = 0;
  reliefActive = false;
  stress = 0;
  stressEase = 0;
  deathDelay = 0;
  checkpointToastT = 0;
  resetHudTrack();
  missLog = [];
  missCount = 0;
  missPoints = 0;

  checkpointIndex = 0;
  checkpointScores.length = 0;
  checkpointSizes.length = 0;
  checkpointScores[0] = score;
  checkpointSizes[0] = player.baseR;
  bossCheckpointScore = score;
  bossCheckpointSize = player.baseR;
  bossCheckpointX = 0;
  bossCheckpointHp = boss.hpMax;
  bossCheckpointTimer = 0;
  diedInBoss = false;
  bossScoreLocked = false;
  bossTimer = 0;
  bossTimerActive = false;
  bossBonusAwarded = false;
  bossDifficulty = 0;
  bossDifficultyActive = false;
  deathCount = 0;
  enemiesKilled = 0;
  livesHalf = MAX_LIVES_HALF;
  finishExit = false;
  finishFadeEntities.active = false;
  finishFadeEntities.t = 0;
  cinematicUiHidden = false;
  dialogueIndex = 0;
  dialogueChar = 0;
  showHealthBar = false;
  scoreFade.active = false;
  scoreFade.t = 0;
  boss.wingT = 0;
  deathDelay = 0;
  checkpointToastT = 0;
  setScoreOpacity(1);
  cutscenePending = false;
  cutsceneFade.active = false;
  cutsceneFade.t = 0;
  cutsceneFade.phase = 'out';
  bossOutro.active = false;
  bossOutro.phase = 'idle';
  bossOutro.t = 0;
  bossOutro.whiteAlpha = 0;
  bossOutro.blackAlpha = 0;
  bossOutro.blackBackdrop = false;
  bossOutro.bossGone = false;
  bossExplosions.length = 0;
  dialogueScript = DIALOGUE_INTRO;
  dialogueMode = 'intro';
};

const beginStartScreen = () => {
  gameState.value = 'start';
  menuScrollX = scrollX;
  showScore(false);
  gameOverFinal.active = false;
  gameOverFinal.t = 0;
  insertMode = false;
  levelMusic.pending = false;
  levelMusic.delay = 0;
  levelMusic.fade = 0;
  levelMusic.fading = false;
  try {
    levelMusic.audio.pause();
    levelMusic.audio.currentTime = 0;
    levelMusic.audio.volume = levelMusic.baseVol;
  } catch {
    // ignore
  }
  dialogueMusic.pending = false;
  dialogueMusic.delay = 0;
  dialogueMusic.fade = 0;
  dialogueMusic.fading = false;
  try {
    dialogueMusic.audio.pause();
    dialogueMusic.audio.currentTime = 0;
    dialogueMusic.audio.volume = dialogueMusic.baseVol;
  } catch {
    // ignore
  }
  screenAnim.active = false;
  burst.active = false;
  sparkles.particles.length = 0;
  dustPuffs.puffs.length = 0;
  dustTrailAcc = 0;
  wasGrounded = false;
  spawnDustDelay = 0;
  spawnDustPending = false;
  finishExit = false;
  finishFadeEntities.active = false;
  finishFadeEntities.t = 0;
  cinematicUiHidden = false;
  dialogueIndex = 0;
  dialogueChar = 0;
  showHealthBar = false;
  scoreFade.active = false;
  scoreFade.t = 0;
  boss.wingT = 0;
  bossCheckpointScore = score;
  bossCheckpointSize = player.baseR;
  bossCheckpointX = 0;
  bossCheckpointHp = boss.hpMax;
  bossCheckpointTimer = 0;
  diedInBoss = false;
  setScoreOpacity(1);
  cutscenePending = false;
  cutsceneFade.active = false;
  cutsceneFade.t = 0;
  cutsceneFade.phase = 'out';
  bossScoreLocked = false;
  bossTimer = 0;
  bossTimerActive = false;
  bossBonusAwarded = false;
  bossDifficulty = 0;
  bossDifficultyActive = false;
  deathCount = 0;
  enemiesKilled = 0;
  livesHalf = MAX_LIVES_HALF;
  bossOutro.active = false;
  bossOutro.phase = 'idle';
  bossOutro.t = 0;
  bossOutro.whiteAlpha = 0;
  bossOutro.blackAlpha = 0;
  bossOutro.blackBackdrop = false;
  bossOutro.bossGone = false;
  bossExplosions.length = 0;
  dialogueScript = DIALOGUE_INTRO;
  dialogueMode = 'intro';
};

const beginGame = () => {
  resetGameVars();
  spawnDustDelay = 0.3;
  spawnDustPending = true;
  showScore(true);
  gameState.value = 'playing';
  updateDifficulty();
  startBurstAt(player.x, player.y, 0.45);
  playPlayerSpawnsSfx();
};

const beginGameOver = () => {
  gameState.value = 'gameover';
  showScore(false);
  screenAnim.active = true;
  screenAnim.t = 0;
  screenAnim.dur = 0.45;
  gameOverFinal.active = false;
  gameOverFinal.t = 0;
  coinFlash.active = false;
  coinFlash.t = 0;
  resumeDelay.active = false;
  resumeDelay.t = 0;
  insertMode = coins <= 0;
};

const startGameOverFinal = () => {
  gameState.value = 'gameoverFinal';
  gameOverFinal.active = true;
  gameOverFinal.t = 0;
};

const finishContinueFromGameOver = () => {
  livesHalf = MAX_LIVES_HALF;
  screenAnim.active = false;
  gameOverFinal.active = false;
  coinFlash.active = false;
  resumeDelay.active = false;
  respawnAtCheckpoint();
};

const continueFromGameOver = () => {
  if (resumeDelay.active) return;
  if (insertMode) {
    coins = COINS_MAX;
    insertMode = false;
    return;
  }
  coins = Math.max(0, coins - 1);
  coinFlash.active = true;
  coinFlash.t = 0;
  resumeDelay.active = true;
  resumeDelay.t = 0;
};

const beginStageClear = () => {
  gameState.value = 'stageclear';
  showScore(false);
  cinematicUiHidden = true;
  showHealthBar = false;
  bossDifficultyActive = false;
};

const awardBossBonus = () => {
  if (bossBonusAwarded) return;
  bossBonusAwarded = true;
  const bonus = getBossBonusForTime(bossTimer);
  if (bonus > 0) setScore(score + bonus);
};

const getBossBonusForTime = (t) => {
  if (t <= 120) return 1000;
  if (t <= 240) return 500;
  if (t <= 360) return 250;
  return 0;
};

const beginBossOutro = () => {
  if (bossOutro.active) return;
  bossScoreLocked = true;
  if (!bossDifficultyActive) {
    bossDifficulty = 1;
    bossDifficultyActive = true;
  }
  gameState.value = 'cutscene';
  cutscenePending = false;
  cutsceneFade.active = false;
  cutsceneFade.t = 0;
  cutsceneFade.phase = 'out';
  finishExit = false;
  finishFadeEntities.active = false;
  finishFadeEntities.t = 0;
  showHealthBar = true;
  startBossOutro();
};

const lockBossOutroScene = () => {
  player.r = player.baseR;
  player.vy = 0;
  player.squashTarget = 1;
  player.squashY = 1;
  player.y = groundY() - player.r;
  player.mouth.dir = Math.atan2(boss.y - player.y, boss.x - player.x);

  boss.r = player.baseR;
  boss.x = innerWidth - Math.max(60, boss.r * 1.2);
  boss.vy = 0;
  boss.duckT = 0;
  boss.squashY = 1;
  boss.y = groundY() - boss.r;
  boss.wingT = 0;

  bossOutro.anchorPlayerX = player.x;
  bossOutro.anchorPlayerY = player.y;
  bossOutro.anchorBossX = boss.x;
  bossOutro.anchorBossY = boss.y;
  bossOutro.anchorScrollX = scrollX;

  showHealthBar = false;
  cinematicUiHidden = true;
  showScore(false);
};

const clearBossOutroWorld = () => {
  trail = null;
  npcs.length = 0;
  reds.length = 0;
  blues.length = 0;
  npcT = 999;
  redT = 999;
  blueT = 999;
  floaters.length = 0;
  burst.active = false;
  lineBurst.active = false;
  lineBurst.puffs.length = 0;
  sparkles.particles.length = 0;
  dustPuffs.puffs.length = 0;
};

const startBossOutro = () => {
  if (bossOutro.active) return;
  bossOutro.active = true;
  bossOutro.phase = 'white_in';
  bossOutro.t = 0;
  bossOutro.whiteAlpha = 0;
  bossOutro.blackAlpha = 0;
  bossOutro.blackBackdrop = false;
  bossOutro.bossGone = false;
  bossOutro.boomSpawn = 0;
  bossOutro.boomSfx = 0;
  bossOutro.bonusHold = bossOutro.bonusHold || 1.5;
  bossOutro.bonusPop = bossOutro.bonusPop || 0.9;

  bossTimerActive = false;
  awardBossBonus();

  bossExplosions.length = 0;

  dialogueScript = DIALOGUE_OUTRO;
  dialogueMode = 'outro';
  dialogueIndex = 0;
  dialogueChar = 0;
  showHealthBar = false;
  cinematicUiHidden = true;
  showScore(false);
  cutscenePending = false;
  cutsceneFade.active = false;
  cutsceneFade.t = 0;
  cutsceneFade.phase = 'out';
  finishFadeEntities.active = false;
  finishFadeEntities.t = 0;
  inputHeld = false;
  inputHeldAt = 0;
  didDuckThisHold = false;

  try {
    dialogueMusic.fade = dialogueMusic.fadeDur;
    dialogueMusic.fading = true;
  } catch {
    // ignore
  }
  try {
    levelMusic.pending = false;
    levelMusic.delay = 0;
    levelMusic.fade = levelMusic.fadeDur;
    levelMusic.fading = true;
  } catch {
    // ignore
  }
  playBossPopSfx();
};

const startBossFinale = () => {
  bossOutro.phase = 'explode';
  bossOutro.t = 0;
  bossOutro.bossGone = true;
  bossOutro.blackBackdrop = true;
  bossExplosions.length = 0;
  playBossExplosionSfx();
  startBossShatterAt(boss.x, boss.y, boss.r);
  startBurstAt(boss.x, boss.y, 0.6);
  spawnBossExplosion(Math.max(1, boss.r / 22));
};

const triggerBossOutroSkip = () => {
  if (bossOutro.active) return;
  boss.hp = 0;
  beginBossOutro();
};

const respawnAtCheckpoint = () => {
  if (diedInBoss) {
    diedInBoss = false;
    const cpScore = (bossCheckpointScore != null) ? bossCheckpointScore : score;
    const cpSize = bossCheckpointSize || player.baseR;
    const cpX = bossCheckpointX || (finishStopX + innerWidth + 40);

    scrollX = cpX;
    setScore(cpScore);

    npcs.length = 0;
    reds.length = 0;
    blues.length = 0;
    npcT = 0;
    redT = 0;
    blueT = 0;
    spawnsSinceEdible = 0;
    encounterQueue.length = 0;
    forceEdibleNext = false;
    trail = null;
    floaters.length = 0;

    player.alive = true;
    player.r = cpSize;
    player.vy = 0;
    player.y = groundY() - player.r;
    player.x = 160;
    player.emotion = 'neutral';
    player._beingEaten = null;
    inputHeld = false;
    inputHeldAt = 0;
    didDuckThisHold = false;
    player.squashY = 1;
    player.squashTarget = 1;
    player.mouth.open = 0;
    player.mouth.dir = 0;
    player.mouth.pulseT = 1;
    player.mouth.pulseDur = MOUTH.pulseDur;
    player.mouth.cooldown = 0;
    player.wingT = 0;

    boss.vy = 0;
    boss.duckT = 0;
    boss.squashY = 1;
    boss.intent = null;
    boss.reactT = 0;
    boss.actionCd = 0;
    boss.wingT = 0;
    boss.hp = (bossCheckpointHp != null) ? bossCheckpointHp : boss.hpMax;
    bossScoreLocked = true;
    // Keep the boss timer running across deaths.
    bossTimerActive = true;
    bossBonusAwarded = false;

    burst.active = false;
    burst.t = 0;
    burst.particles.length = 0;
    headShatter.active = false;
    headShatter.pieces.length = 0;
    npcShatter.active = false;
    npcShatter.pieces.length = 0;
    lineBurst.active = false;
    lineBurst.t = 0;
    lineBurst.puffs.length = 0;
    sparkles.particles.length = 0;
    dustPuffs.puffs.length = 0;
    dustTrailAcc = 0;
    dustTrailGap = 22;
    wasGrounded = false;
    spawnDustDelay = 0.3;
    spawnDustPending = true;

    WORLD.speed = WORLD.baseSpeed;
    lastSpawnWorldX = -1e9;
    waveT = 0;
    reliefActive = false;
    stress = 0;
    stressEase = 0;
    resetHudTrack();
    missLog = [];
    missCount = 0;
    missPoints = 0;

    finishExit = false;
    finishFadeEntities.active = false;
    finishFadeEntities.t = 0;
    cinematicUiHidden = false;
    dialogueScript = DIALOGUE_INTRO;
    dialogueMode = 'intro';
    dialogueIndex = dialogueScript.length;
    dialogueChar = 0;
    showHealthBar = true;
    scoreFade.active = false;
    scoreFade.t = 0;
    cutscenePending = false;
    cutsceneFade.active = false;
    cutsceneFade.t = 0;
    cutsceneFade.phase = 'out';
    bossScoreLocked = true;
    bossTimerActive = true;
    bossBonusAwarded = false;
    bossOutro.active = false;
    bossOutro.phase = 'idle';
    bossOutro.t = 0;
    bossOutro.whiteAlpha = 0;
    bossOutro.blackAlpha = 0;
    bossOutro.blackBackdrop = false;
    bossOutro.bossGone = false;
    bossExplosions.length = 0;
    setScoreOpacity(1);
    showScore(true);
    gameState.value = 'cutscene';
    updateDifficulty();
    startBurstAt(player.x, player.y, 0.45);
    playPlayerSpawnsSfx();
    return;
  }

  const cpX = checkpointXs[checkpointIndex] || 0;
  const cpScore = (checkpointScores[checkpointIndex] != null) ? checkpointScores[checkpointIndex] : score;
  const cpSize = player.baseR;

  scrollX = cpX;
  setScore(cpScore);

  npcs.length = 0;
  reds.length = 0;
  blues.length = 0;
  npcT = 0;
  redT = 0;
  blueT = 0;
  spawnsSinceEdible = 0;
  encounterQueue.length = 0;
  forceEdibleNext = false;
  trail = null;
  floaters.length = 0;

  player.alive = true;
  player.r = cpSize;
  player.vy = 0;
  player.y = groundY() - player.r;
  player.x = 160;
  player.emotion = 'neutral';
  player._beingEaten = null;
  inputHeld = false;
  inputHeldAt = 0;
  didDuckThisHold = false;
  player.squashY = 1;
  player.squashTarget = 1;
  player.mouth.open = 0;
  player.mouth.dir = 0;
  player.mouth.pulseT = 1;
  player.mouth.pulseDur = MOUTH.pulseDur;
  player.mouth.cooldown = 0;
  player.wingT = 0;

  burst.active = false;
  burst.t = 0;
  burst.particles.length = 0;
  headShatter.active = false;
  headShatter.pieces.length = 0;
  npcShatter.active = false;
  npcShatter.pieces.length = 0;
  lineBurst.active = false;
  lineBurst.t = 0;
  lineBurst.puffs.length = 0;
  sparkles.particles.length = 0;
  dustPuffs.puffs.length = 0;
  dustTrailAcc = 0;
  dustTrailGap = 22;
  wasGrounded = false;
  spawnDustDelay = 0.3;
  spawnDustPending = true;

  WORLD.speed = WORLD.baseSpeed;
  lastSpawnWorldX = -1e9;
  waveT = 0;
  reliefActive = false;
  stress = 0;
  stressEase = 0;
  deathDelay = 0;
  checkpointToastT = 0;
  resetHudTrack();
  missLog = [];
  missCount = 0;
  missPoints = 0;

  showScore(true);
  gameState.value = 'playing';
  updateDifficulty();
  startBurstAt(player.x, player.y, 0.45);
  playPlayerSpawnsSfx();
};

const startStartTransition = () => {
  playStartFromHomeSfx();
  levelMusic.pending = true;
  levelMusic.delay = 1.5;
  levelMusic.fade = 0;
  levelMusic.fading = false;
  try {
    levelMusic.audio.currentTime = 0;
    levelMusic.audio.volume = levelMusic.baseVol;
  } catch {
    // ignore
  }
  screenAnim.active = true;
  screenAnim.t = 0;
  screenAnim.dur = 0.45;
  gameState.value = 'startTransition';
};

const startRestartTransition = () => {
  beginGame();
};

const updateCheckpointProgress = () => {
  const nextIdx = checkpointIndex + 1;
  if (nextIdx >= checkpointXs.length) return;
  if (scrollX >= checkpointXs[nextIdx]) {
    checkpointIndex = nextIdx;
    checkpointScores[checkpointIndex] = score;
    checkpointSizes[checkpointIndex] = player.baseR;
    checkpointToastT = checkpointToastDur;
  }
};

const syncCheckpointToScroll = () => {
  let idx = 0;
  for (let i = 1; i < checkpointXs.length; i++) {
    if (gameState.value === 'cutscene' && i === checkpointXs.length - 1) continue;
    if (scrollX >= checkpointXs[i]) idx = i;
    else break;
  }
  checkpointIndex = idx;
  if (checkpointScores[idx] == null) checkpointScores[idx] = score;
  if (checkpointSizes[idx] == null) checkpointSizes[idx] = player.baseR;
};

const warpNearFinish = () => {
  scrollX = Math.max(0, LEVEL.length - innerWidth - 40);
  syncCheckpointToScroll();
  finishExit = false;
};

const advanceDialogue = () => {
  if (dialogueIndex >= dialogueScript.length) return;
  const entry = dialogueScript[dialogueIndex];
  if (!entry) return;
  playTextTapSfx();
  if (dialogueChar < entry.text.length) {
    dialogueChar = entry.text.length;
    return;
  }
  if (dialogueIndex < dialogueScript.length - 1) {
    dialogueIndex += 1;
    dialogueChar = 0;
    return;
  }
  dialogueIndex = dialogueScript.length;
  dialogueChar = 0;

  if (dialogueMode === 'outro') {
    startBossFinale();
    return;
  }

  cinematicUiHidden = false;
  scoreFade.active = true;
  scoreFade.t = 0;
  showHealthBar = true;
  bossScoreLocked = true;
  bossTimer = 0;
  bossCheckpointTimer = 0;
  bossTimerActive = true;
  bossBonusAwarded = false;
  bossDifficulty = 1;
  bossDifficultyActive = true;
  boss.hp = boss.hpMax;
  boss.vy = 0;
  boss.duckT = 0;
  boss.reactT = 0;
  boss.actionCd = 0;
  boss.intent = null;
  boss.squashY = 1;
  npcT = 0.05;
  redT = 0.08;
  blueT = 0.1;
  bossCheckpointScore = score;
  bossCheckpointSize = player.baseR;
  bossCheckpointX = scrollX;
  bossCheckpointHp = boss.hpMax;
  dustTrailAcc = 0;
  spawnDustDelay = 0.3;
  spawnDustPending = true;
  startBurstAt(player.x, player.y, 0.45);
  playPlayerSpawnsSfx();
};

const isDialogueActive = () => {
  if (bossOutro.active) return bossOutro.phase === 'dialogue';
  return (gameState.value === 'cutscene' && !showHealthBar);
};

const updateBossOutro = (dt) => {
  if (!bossOutro.active) return;

  bossOutro.t += dt;

  if (bossOutro.phase === 'white_in') {
    const tt = clamp(bossOutro.t / Math.max(0.001, bossOutro.whiteIn), 0, 1);
    bossOutro.whiteAlpha = easeInOut(tt);
    if (bossOutro.t >= bossOutro.whiteIn) {
      bossOutro.phase = 'white_hold';
      bossOutro.t = 0;
      bossOutro.whiteAlpha = 1;
    }
  } else if (bossOutro.phase === 'white_hold') {
    bossOutro.whiteAlpha = 1;
    if (bossOutro.t >= bossOutro.whiteHold) {
      bossOutro.phase = 'white_out';
      bossOutro.t = 0;
      bossOutro.blackBackdrop = true;
      lockBossOutroScene();
    }
  } else if (bossOutro.phase === 'white_out') {
    const tt = clamp(bossOutro.t / Math.max(0.001, bossOutro.whiteOut), 0, 1);
    bossOutro.whiteAlpha = 1 - easeInOut(tt);
    if (bossOutro.t >= bossOutro.whiteOut) {
      bossOutro.phase = 'boom';
      bossOutro.t = 0;
      bossOutro.whiteAlpha = 0;
      bossOutro.blackAlpha = 0;
      bossOutro.boomSpawn = 0;
      bossOutro.boomSfx = 0;
      clearBossOutroWorld();
    }
  } else if (bossOutro.phase === 'boom') {
    bossOutro.whiteAlpha = 0;
    bossOutro.blackBackdrop = true;
    bossOutro.blackAlpha = 0;

    bossOutro.boomSpawn = Math.max(0, bossOutro.boomSpawn - dt);
    if (bossOutro.boomSpawn <= 0) {
      spawnBossExplosion(Math.max(0.8, boss.r / 26));
      bossOutro.boomSpawn = rand(0.08, 0.16);
    }

    bossOutro.boomSfx = Math.max(0, bossOutro.boomSfx - dt);
    if (bossOutro.boomSfx <= 0) {
      (Math.random() < 0.5 ? playBossExplosionSfx : playBossPopSfx)();
      bossOutro.boomSfx = rand(0.12, 0.22);
    }

    if (bossOutro.t >= bossOutro.boomDur) {
      bossOutro.phase = 'dialogue';
      bossOutro.t = 0;
      bossOutro.boomSpawn = 0;
      bossOutro.boomSfx = 0;
      playTextTapSfx();
    }
  } else if (bossOutro.phase === 'dialogue') {
    bossOutro.whiteAlpha = 0;
    bossOutro.blackBackdrop = true;
    bossOutro.blackAlpha = 0;
  } else if (bossOutro.phase === 'explode') {
    bossOutro.blackBackdrop = true;
    bossOutro.whiteAlpha = 0;
    if (bossOutro.t >= bossOutro.finaleDur) {
      bossOutro.bossGone = true;
      bossOutro.phase = 'bonus_hold';
      bossOutro.t = 0;
    }
  } else if (bossOutro.phase === 'bonus_hold') {
    bossOutro.blackBackdrop = true;
    bossOutro.whiteAlpha = 0;
    bossOutro.blackAlpha = 0;
    if (bossOutro.t >= bossOutro.bonusHold) {
      bossOutro.phase = 'bonus_pop';
      bossOutro.t = 0;
      const bonus = getBossBonusForTime(bossTimer);
      popText(floaters, `+${bonus}`, player.x, player.y - player.r * 1.6);
    }
  } else if (bossOutro.phase === 'bonus_pop') {
    bossOutro.blackBackdrop = true;
    bossOutro.whiteAlpha = 0;
    bossOutro.blackAlpha = 0;
    if (bossOutro.t >= bossOutro.bonusPop) {
      bossOutro.phase = 'fade_out';
      bossOutro.t = 0;
      bossOutro.blackAlpha = 0;
    }
  } else if (bossOutro.phase === 'fade_out') {
    bossOutro.blackBackdrop = true;
    const tt = clamp(bossOutro.t / Math.max(0.001, bossOutro.fadeOut), 0, 1);
    bossOutro.blackAlpha = easeInOut(tt);
    if (bossOutro.t >= bossOutro.fadeOut) {
      bossOutro.active = false;
      bossOutro.phase = 'idle';
      bossOutro.whiteAlpha = 0;
      bossOutro.blackAlpha = 0;
      bossOutro.blackBackdrop = false;
      bossExplosions.length = 0;
      beginStageClear();
    }
  }

  for (let i = bossExplosions.length - 1; i >= 0; i--) {
    const b = bossExplosions[i];
    updateLineBurst(b, dt, clamp);
    if (!b.active) bossExplosions.splice(i, 1);
  }
};

const canSpawnNow = () => {
  const spawnWorldX = scrollX + innerWidth + 60;
  return (spawnWorldX - lastSpawnWorldX) >= minGapPx();
};
const markSpawn = () => { lastSpawnWorldX = scrollX + innerWidth + 60; };

const refillEncounterQueue = () => {
  const d = difficulty01();
  const easy = [
    ['edible', 'edible', 'danger'],
    ['edible', 'edible', 'edible', 'danger'],
    ['edible', 'neutral', 'edible', 'danger'],
    ['edible', 'edible', 'neutral'],
  ];

  const medium = [
    ['edible', 'danger', 'edible'],
    ['edible', 'neutral', 'danger', 'edible'],
    ['edible', 'edible', 'danger', 'neutral'],
    ['edible', 'danger', 'edible', 'neutral'],
  ];

  const hard = [
    ['edible', 'danger', 'edible', 'danger'],
    ['edible', 'neutral', 'danger', 'edible', 'danger'],
    ['edible', 'danger', 'neutral', 'edible', 'danger'],
  ];

  const pool = (d < 0.35) ? easy : (d < 0.75) ? medium : hard;
  const pat = pool[Math.floor(Math.random() * pool.length)];
  for (const k of pat) encounterQueue.push(k);
};

const dangerOnScreen = () => {
  let c = 0;
  for (const n of npcs) {
    if (n.state !== 'fly') continue;
    if (canEat(n.r, player.r)) c++;
  }
  return c;
};

const nextNPCBucket = () => {
  if (forceEdibleNext) {
    forceEdibleNext = false;
    trail = null;
    return 'edible';
  }

  if (encounterQueue.length === 0) refillEncounterQueue();
  let b = encounterQueue.shift() || 'edible';

  if (b === 'danger' && difficulty01() < 0.35 && dangerOnScreen() >= 1) {
    b = 'edible';
  }

  if (b === 'danger') forceEdibleNext = true;
  return b;
};

const maybeStartTrail = () => {
  if (trail) return false;
  const d = difficulty01();
  const pTrail = trailProb();
  const pRed = (d < 0.35) ? TRAIL.probRedEasy : (d < 0.75) ? TRAIL.probRedMid : TRAIL.probRedHard;

  const roll = Math.random();
  if (roll < pTrail) {
    const kind = (Math.random() < (pRed / Math.max(0.001, pTrail))) ? 'trail_red' : 'trail';
    const len = Math.floor(rand(TRAIL.lenMin, TRAIL.lenMax + 1));
    const dt = rand(TRAIL.dtMin, TRAIL.dtMax);

    const baseX = innerWidth + 180;
    const y = pickSpawnY(baseX, 56);

    trail = { kind, remaining: len, t: 0, dt, baseX, y, spawned: 0, redIndex: (kind === 'trail_red' ? Math.floor(len / 2) : -1) };
    return true;
  }
  return false;
};

const spawnTrailMember = () => {
  if (!trail || trail.remaining <= 0) return;

  const pr = player.r;
  const safeMax = pr / (1 + EAT.margin) * 0.96;
  const r = clamp(rand(TRAIL.scaleMin * pr, TRAIL.scaleMax * pr), 10, Math.min(68, safeMax));

  let beadX = trail.baseX + trail.spawned * (WORLD.speed * trail.dt * 0.92);
  beadX = resolveSpawnX(beadX, trail.y, r);

  if (trail.kind === 'trail_red' && trail.spawned === trail.redIndex) {
    const rr = rand(12, 20);
    const hx = resolveSpawnX(beadX, trail.y, rr);
    reds.push(makeRed(hx, trail.y, rr));
  } else {
    const pts = pointsForRadius(r);
    npcs.push(makeNPC(beadX, trail.y, r, pts, true, MOUTH));
  }

  trail.spawned++;
  trail.remaining--;
  markSpawn();
};

const updateTrail = (dt) => {
  if (!trail) return;
  trail.t -= dt;
  while (trail && trail.t <= 0) {
    spawnTrailMember();
    if (trail.remaining <= 0) {
      trail = null;
      break;
    }
    trail.t += trail.dt;
  }
};

const chooseNPCRadius = (bucket) => {
  const pr = player.r;

  const forceEdible = (spawnsSinceEdible >= BALANCE.edibleGuaranteeAfter);
  if (forceEdible) bucket = 'edible';

  const eatableMax = pr / (1 + EAT.margin) * 0.96;
  const eatableMin = Math.max(10, pr * 0.40);

  const dangerMin = pr * (1 + EAT.margin) * 1.06;
  const dangerMax = Math.min(68, pr * 1.85);

  const neutralMin = pr / (1 + EAT.margin) * 0.98;
  const neutralMax = pr * (1 + EAT.margin) * 1.02;

  const pickIn = (a, b, fa, fb) => (b <= a + 0.5) ? rand(fa, fb) : rand(a, b);

  let r;
  if (bucket === 'edible') {
    r = pickIn(eatableMin, Math.min(eatableMax, 62), 10, Math.min(24, pr));
    spawnsSinceEdible = 0;
  } else if (bucket === 'danger') {
    r = pickIn(Math.max(dangerMin, 14), dangerMax, Math.max(22, pr * 1.15), Math.max(30, pr * 1.55));
    spawnsSinceEdible++;
  } else {
    r = pickIn(Math.max(12, neutralMin), Math.min(62, neutralMax), Math.max(14, pr * 0.8), Math.max(18, pr * 1.05));
    spawnsSinceEdible++;
  }
  return clamp(r, 10, 68);
};

const spawnNPC = () => {
  const bucket = nextNPCBucket();
  const r = chooseNPCRadius(bucket);

  const lead = (bucket === 'danger') ? 160 : (bucket === 'neutral') ? 80 : 0;
  const x = innerWidth + 70 + lead;
  const y = pickSpawnY(x, r);

  const worth = (bucket !== 'danger');
  const pts = worth ? pointsForRadius(r) : 0;
  npcs.push(makeNPC(x, y, r, pts, worth, MOUTH));
  markSpawn();
};

const spawnRed = () => {
  const r = rand(12, 22);
  const x = innerWidth + 120;
  const y = pickSpawnY(x, r);

  reds.push(makeRed(x, y, r));
  markSpawn();
};

const spawnBlue = () => {
  const r = rand(14, 26);
  const x = innerWidth + 120;
  const y = pickSpawnY(x, r);

  blues.push(makeBlue(x, y, r));
  markSpawn();
};

const pickBossThreat = (boss, reds, scrollSpeed) => {
  let bestT = Infinity;
  let bestY = null;
  const g = 900;
  for (const o of reds) {
    if (o.state !== 'deflect') continue;
    const vx = o.vx - scrollSpeed;
    if (vx <= 60) continue;
    const dx = boss.x - o.x;
    if (dx <= 0) continue;
    const t = dx / vx;
    if (t < 0.05 || t > 1.1) continue;
    const y = o.y + o.vy * t + 0.5 * g * t * t;
    const bossTop = boss.y - boss.r * boss.squashY;
    const bossBottom = boss.y + boss.r * boss.squashY;
    const pad = o.r + boss.r * 0.25;
    if (y >= bossTop - pad && y <= bossBottom + pad) {
      if (t < bestT) {
        bestT = t;
        bestY = y;
      }
    }
  }
  if (bestY === null) return null;
  const mid = boss.y - boss.r * 0.45;
  return (bestY > mid) ? 'jump' : 'duck';
};

const getScreenAlpha = () => {
  if (gameState.value === 'startTransition') {
    const t = screenAnim.t;
    return 1 - easeInOut(t);
  }
  return 1;
};

const flap = () => {
  const canControl = (gameState.value === 'playing' || (gameState.value === 'cutscene' && showHealthBar)) && !finishExit;
  if (!canControl || !player.alive || player._beingEaten) return;
  player.vy = PHYS.flapVy;
};

let inputHeld = false;
let inputHeldAt = 0;
let didDuckThisHold = false;
let attackFlashT = 0;

const inputPress = () => {
  const canControl = (gameState.value === 'playing' || (gameState.value === 'cutscene' && showHealthBar)) && !finishExit;
  if (!canControl || !player.alive || player._beingEaten) return;
  if (inputHeld) return;
  inputHeld = true;
  inputHeldAt = performance.now();
  didDuckThisHold = false;
  playJumpSfx();
};

const inputRelease = () => {
  if (finishExit) { inputHeld = false; player.squashTarget = 1; return; }
  if (!inputHeld) return;

  const heldMs = performance.now() - inputHeldAt;
  inputHeld = false;
  player.squashTarget = 1;

  if (gameState.value === 'playing' || (gameState.value === 'cutscene' && showHealthBar)) {
    if (heldMs <= SQUASH.tapMs && !didDuckThisHold) {
      flap();
    } else if (didDuckThisHold) {
      player.vy = Math.min(player.vy, STAND.vy);
      attackFlashT = 0.18;
    }
  }
};

addEventListener('keydown', (e) => {
  if (e.key === 'h' || e.key === 'H') {
    debugHUD = !debugHUD;
  }
  if (e.key === 'p' || e.key === 'P') {
    if (gameState.value === 'playing') gameState.value = 'paused';
    else if (gameState.value === 'paused') gameState.value = 'playing';
    return;
  }
  if (e.key === 'b' || e.key === 'B') {
    triggerBossOutroSkip();
    return;
  }
  if (e.key === 'r' || e.key === 'R') {
    resetGameVars(); beginStartScreen(); return;
  }
  if (isDialogueActive()) { advanceDialogue(); return; }
  if (cutscenePending) return;
  if (e.code === 'Space') {
    e.preventDefault();
    if (gameState.value === 'start') startStartTransition();
    else if (gameState.value === 'stageclear') beginStartScreen();
    else if (!finishExit) inputPress();
  }
  if (e.code === 'Enter') {
    if (gameState.value === 'playing') warpNearFinish();
  }
}, { passive: false });

addEventListener('keyup', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    if (gameState.value === 'playing' || (gameState.value === 'cutscene' && showHealthBar)) inputRelease();
  }
}, { passive: false });

const toCanvasXY = (ev) => {
  const rect = canvas.getBoundingClientRect();
  return { x: (ev.clientX - rect.left), y: (ev.clientY - rect.top) };
};

addEventListener('pointerdown', (ev) => {
  const { x, y } = toCanvasXY(ev);
  if (gameState.value === 'start') { startStartTransition(); return; }
  if (gameState.value === 'stageclear') { beginStartScreen(); return; }
  if (gameState.value === 'gameover') {
    if (resumeDelay.active) return;
    const buttons = getGameOverButtons(innerWidth, innerHeight);
    for (const b of buttons) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        if (b.id === 'yes') continueFromGameOver();
        else startGameOverFinal();
        return;
      }
    }
    return;
  }
  if (gameState.value === 'gameoverFinal') return;
  if (isDialogueActive()) { advanceDialogue(); return; }
  if (gameState.value === 'startTransition' || gameState.value === 'restartTransition' || gameState.value === 'dying' || cutscenePending) return;
  inputPress();
});

addEventListener('pointerup', () => {
  if (gameState.value === 'playing' || (gameState.value === 'cutscene' && showHealthBar)) inputRelease();
});
addEventListener('pointercancel', () => {
  if (gameState.value === 'playing' || (gameState.value === 'cutscene' && showHealthBar)) inputRelease();
});
addEventListener('blur', () => { inputRelease(); });

let last = performance.now();
beginStartScreen();
playHomeStartSfx();

const tick = (now) => {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  if (gameState.value === 'paused') {
    draw();
    requestAnimationFrame(tick);
    return;
  }

  waveT += dt;
  reliefActive = (waveT % WAVE.period) > (WAVE.period - WAVE.relief);
  stress = Math.max(0, stress - dt * DDA.decay);
  stressEase = clamp((stress - DDA.threshold) / (1 - DDA.threshold), 0, 1);
  if (attackFlashT > 0) attackFlashT = Math.max(0, attackFlashT - dt);
  if (bossTimerActive && gameState.value === 'cutscene' && showHealthBar && !bossOutro.active) {
    bossTimer += dt;
  }
  if (spawnDustDelay > 0) spawnDustDelay = Math.max(0, spawnDustDelay - dt);
  if (checkpointToastT > 0) checkpointToastT = Math.max(0, checkpointToastT - dt);
  if (levelMusic.pending) {
    levelMusic.delay = Math.max(0, levelMusic.delay - dt);
    if (levelMusic.delay <= 0) {
      levelMusic.pending = false;
      try {
        levelMusic.audio.volume = levelMusic.baseVol;
        levelMusic.audio.play();
      } catch {
        // ignore autoplay restrictions
      }
    }
  }
  if (levelMusic.fading) {
    levelMusic.fade = Math.max(0, levelMusic.fade - dt);
    const t = (levelMusic.fadeDur > 0) ? (levelMusic.fade / levelMusic.fadeDur) : 0;
    levelMusic.audio.volume = levelMusic.baseVol * t;
    if (levelMusic.fade <= 0) {
      levelMusic.fading = false;
      try { levelMusic.audio.pause(); } catch {}
    }
  }

  if (dialogueMusic.pending) {
    dialogueMusic.delay = Math.max(0, dialogueMusic.delay - dt);
    if (dialogueMusic.delay <= 0) {
      dialogueMusic.pending = false;
      try {
        dialogueMusic.audio.volume = dialogueMusic.baseVol;
        dialogueMusic.audio.play();
      } catch {
        // ignore autoplay restrictions
      }
    }
  }
  if (dialogueMusic.fading) {
    dialogueMusic.fade = Math.max(0, dialogueMusic.fade - dt);
    const t = (dialogueMusic.fadeDur > 0) ? (dialogueMusic.fade / dialogueMusic.fadeDur) : 0;
    dialogueMusic.audio.volume = dialogueMusic.baseVol * t;
    if (dialogueMusic.fade <= 0) {
      dialogueMusic.fading = false;
      try { dialogueMusic.audio.pause(); } catch {}
    }
  }

  updateDifficulty();

  updateBurst(burst, dt, clamp);
  updateShatter(headShatter, dt);
  updateShatter(npcShatter, dt);
  updateLineBurst(lineBurst, dt, clamp);
  updateFloaters(floaters, dt);
  updateSparkles(sparkles, dt);
  updateDustPuffs(dustPuffs, dt);
  updateBossOutro(dt);

  if (screenAnim.active) {
    screenAnim.t = clamp(screenAnim.t + dt / screenAnim.dur, 0, 1);
    if (screenAnim.t >= 1) {
      if (gameState.value === 'startTransition') { screenAnim.active = false; beginGame(); }
      else if (gameState.value === 'restartTransition') { screenAnim.active = false; beginGame(); }
      else screenAnim.active = false;
    }
  }

  if (cutsceneFade.active) {
    cutsceneFade.t = clamp(cutsceneFade.t + dt / cutsceneFade.dur, 0, 1);
    if (cutsceneFade.t >= 1) {
      if (cutsceneFade.phase === 'out') {
        if (cutscenePending) {
          gameState.value = 'cutscene';
          cutscenePending = false;
          scrollX = finishStopX + innerWidth + 40;
          player.x = 160;
        }
        cutsceneFade.phase = 'in';
        cutsceneFade.t = 0;
      } else {
        cutsceneFade.active = false;
      }
    }
  }

  if (isDialogueActive() && !cutsceneFade.active) {
    const entry = dialogueScript[dialogueIndex];
    if (entry && dialogueChar < entry.text.length) {
      dialogueChar = Math.min(entry.text.length, dialogueChar + Math.ceil(dialogueSpeed * dt));
    }
  }

  if (finishFadeEntities.active) {
    finishFadeEntities.t = clamp(finishFadeEntities.t + dt / finishFadeEntities.dur, 0, 1);
    if (finishFadeEntities.t >= 1) {
      finishFadeEntities.active = false;
      npcs.length = 0;
      reds.length = 0;
      blues.length = 0;
      cinematicUiHidden = true;
    }
  }
  if (scoreFade.active) {
    scoreFade.t = clamp(scoreFade.t + dt / scoreFade.dur, 0, 1);
    if (scoreFade.t >= 1) scoreFade.active = false;
  }
  if (finishFadeEntities.active) {
    setScoreOpacity(1 - easeInOut(clamp(finishFadeEntities.t / finishFadeEntities.dur, 0, 1)));
  } else if (scoreFade.active) {
    setScoreOpacity(easeInOut(clamp(scoreFade.t / scoreFade.dur, 0, 1)));
  } else if (cinematicUiHidden) {
    setScoreOpacity(0);
  } else {
    setScoreOpacity(1);
  }
  const scoreLockedUi = bossScoreLocked && showHealthBar && !cinematicUiHidden;
  scoreEl.classList.toggle('score--locked', scoreLockedUi);

  const bossOutroActive = bossOutro.active;
  const bossOutroLocked = bossOutroActive && bossOutro.phase !== 'white_in' && bossOutro.phase !== 'white_hold' && bossOutro.phase !== 'white_out';
  const bossOutroPoseLocked = bossOutroActive && bossOutro.blackBackdrop;
  const bossOutroInvulnerable = bossOutroActive && !bossOutroLocked;
  const bossPhase = (gameState.value === 'cutscene' && showHealthBar && !bossOutroLocked);
  const activePlay = (gameState.value === 'playing' || bossPhase || bossOutroInvulnerable) && !bossOutroLocked;

  if (gameState.value === 'playing' || gameState.value === 'cutscene') {
    const maxScroll = (gameState.value === 'cutscene') ? Infinity : finishStopX;
    const baseMove = Math.max(0, Math.min(WORLD.speed * dt, maxScroll - scrollX));
    const move = bossOutroPoseLocked ? 0 : baseMove;
    if (bossOutroPoseLocked) scrollX = bossOutro.anchorScrollX;
    else scrollX += move;
    if (inputHeld) {
      const heldMs = performance.now() - inputHeldAt;
      player.squashTarget = (heldMs > SQUASH.tapMs) ? SQUASH.y : 1;
      if (heldMs > SQUASH.tapMs) didDuckThisHold = true;
    }

    if (!finishExit && !cutscenePending && activePlay) updateTrail(dt);
    updateCheckpointProgress();

    if (gameState.value === 'playing' && !finishExit && scrollX >= finishStopX - 1) {
      finishExit = true;
      inputHeld = false;
      player.squashTarget = 1;
      player.r = player.baseR;
      if (player.y > groundY() - (player.r * player.squashY)) player.y = groundY() - (player.r * player.squashY);
      startBurstAt(player.x, player.y, 0.45);
      playEnterAutoModeSfx();
      levelMusic.pending = false;
      levelMusic.delay = 0;
      levelMusic.fade = levelMusic.fadeDur;
      levelMusic.fading = true;
      npcT = 999;
      redT = 999;
      blueT = 999;
      trail = null;
      finishFadeEntities.active = true;
      finishFadeEntities.t = 0;
    }

    if (!finishExit && !cutscenePending && activePlay) npcT -= dt;
    if (npcT <= 0) {
      if (canSpawnNow()) {
        if (!maybeStartTrail()) spawnNPC();
        npcT = nextInterval('npc');
      } else {
        npcT = 0.05;
      }
    }

    if (!finishExit && !cutscenePending && activePlay) redT -= dt;
    if (redT <= 0) {
      if (canSpawnNow()) { spawnRed(); redT = nextInterval('red'); }
      else redT = 0.08;
    }

    if (!finishExit && !cutscenePending && activePlay) blueT -= dt;
    if (blueT <= 0) {
      if (canSpawnNow()) { spawnBlue(); blueT = nextInterval('blue'); }
      else blueT = 0.10;
    }

    if (bossOutroPoseLocked) {
      player.x = bossOutro.anchorPlayerX;
      player.y = bossOutro.anchorPlayerY;
      player.vy = 0;
      player.squashTarget = 1;
      player.squashY = 1;
    } else if (!player._beingEaten) {
      player.squashY = lerp(player.squashY, player.squashTarget, 1 - Math.pow(0.001, dt));
      player.vy += PHYS.gravity * dt;
      player.vy = clamp(player.vy, -2000, PHYS.maxFall);
      player.y += player.vy * dt;

      const gy = groundY();
      const prY = player.r * player.squashY;
      const floor = gy - prY;
      if (player.y > floor) {
        player.y = floor;
        player.vy = player.vy * -0.18;
        if (Math.abs(player.vy) < 60) player.vy = 0;
      }

      const grounded = (Math.abs(player.y - floor) < 0.5) && Math.abs(player.vy) < 1;
      const wingSpeed = grounded ? 4.6 : 6.2;
      player.wingT = (player.wingT + dt * wingSpeed) % 1;
      if (activePlay) {
        if (grounded) {
          let spawnDustNow = false;
          if (spawnDustPending) {
            if (spawnDustDelay <= 0) {
              spawnDustNow = true;
              spawnDustPending = false;
            }
          } else if (!wasGrounded) {
            spawnDustNow = true;
          }

          if (spawnDustNow) {
            const px = player.x + player.r * 0.15;
            const py = groundY() + 8;
            startDustPuff(dustPuffs, px, py, player.r * 1.8, rand);
            dustTrailAcc = 0;
          }

          if (move > 0 && !spawnDustPending) {
            dustTrailAcc += move;
            while (dustTrailAcc >= dustTrailGap) {
              const px = player.x + player.r * 0.15;
              const py = groundY() + 8;
              startDustPuff(dustPuffs, px, py, player.r * 1.8, rand);
              dustTrailAcc -= dustTrailGap;
              dustTrailGap = rand(18, 28);
            }
          } else if (move <= 0) {
            dustTrailAcc = 0;
          }
        } else {
          dustTrailAcc = 0;
        }
      } else {
        dustTrailAcc = 0;
        spawnDustPending = false;
      }
      wasGrounded = grounded;

      if (!bossOutroInvulnerable && player.y + (player.r * player.squashY) < 0) {
        player.alive = false;
        playPlayerOutsideSfx();
        startBurstAt(player.x, 0, 0.55);
        registerDeath();
        gameState.value = 'dying';
      }
    }

    const outroMuteSfx = bossOutroInvulnerable;
    if (!finishExit && !cutscenePending && activePlay) updateNPCs(npcs, player, dt, move, {
      groundY,
      EAT,
      GROW,
      MOUTH,
      canEat,
      addScore,
      deductScore,
      popText: (txt, x, y) => popText(floaters, txt, x, y),
      playEatNpcSfx: outroMuteSfx ? null : playEatNpcSfx,
      onNpcEaten: () => { enemiesKilled += 1; },
      triggerChomp,
      updateMouth,
      clamp,
      lerp,
      easeInOut,
      lerpAngle,
      dist,
      playerInvulnerable: bossOutroInvulnerable,
      onBite: (x, y) => {
        biteDir = Math.atan2(y - player.y, x - player.x);
        biteT = 0.12;
        player.mouth.dir = biteDir;
      },
    });

    if (!finishExit && !cutscenePending && activePlay) updateReds(reds, player, dt, move, {
      EAT,
      HAZARD,
      MOUTH,
      triggerChomp,
      clamp,
      easeInOut,
      lerp,
      dist,
      startBurst: startBurstAt,
      startLineBurst: startLineBurstAt,
      startHeadShatter: startHeadShatterAt,
      startNpcShatter: startNpcShatterAt,
      playBombLeavesSfx: outroMuteSfx ? null : playBombLeavesSfx,
      playBombHitsGroundSfx: outroMuteSfx ? null : playBombHitsGroundSfx,
      playEatBombSfx: outroMuteSfx ? null : playEatBombSfx,
      playHitBombSfx: outroMuteSfx ? null : playHitBombSfx,
      state: gameState,
      playerInvulnerable: bossOutroInvulnerable,
      showScore,
      groundY,
      npcs,
      boss,
      bossActive: bossPhase,
      onBossHit: (x, y, r) => {
        if (!bossPhase) return;
        checkpointToastT = checkpointToastDur;
        boss.hp = Math.max(0, boss.hp - 1);
        bossCheckpointScore = score;
        bossCheckpointSize = player.baseR;
        bossCheckpointX = scrollX;
        bossCheckpointHp = boss.hp;
        bossCheckpointTimer = bossTimer;
        const isFinalHit = boss.hp <= 0;
        if (!isFinalHit && playEatBombSfx) playEatBombSfx();
        startLineBurstAt(x, y, Math.max(0.7, r / 18));
        if (isFinalHit) beginBossOutro();
      },
      onPlayerDeath: () => {
        registerDeath();
        deathDelay = 0.45;
      },
      onNpcKilled: () => { enemiesKilled += 1; },
      attackActive: () => attackFlashT > 0,
      onBite: (x, y) => {
        biteDir = Math.atan2(y - player.y, x - player.x);
        biteT = 0.12;
        player.mouth.dir = biteDir;
      },
    });

    if (!finishExit && !cutscenePending && activePlay) updateBlues(blues, player, dt, move, {
      EAT,
      MOUTH,
      triggerChomp,
      clamp,
      easeInOut,
      lerp,
      dist,
      popText: (txt, x, y) => popText(floaters, txt, x, y),
      playEatStarSfx: outroMuteSfx ? null : playEatStarSfx,
      groundY,
      onShrink: (x, y, r) => startSparkles(sparkles, x, y, r, rand, 12),
      onBite: (x, y) => {
        biteDir = Math.atan2(y - player.y, x - player.x);
        biteT = 0.12;
        player.mouth.dir = biteDir;
      },
    });

    updateMouth(player.mouth, dt, MOUTH, clamp);

    if (gameState.value === 'cutscene') {
      boss.r = player.r;

      if (bossOutroPoseLocked) {
        boss.x = bossOutro.anchorBossX;
        boss.y = bossOutro.anchorBossY;
        boss.vy = 0;
        boss.duckT = 0;
        boss.squashY = 1;
        boss.wingT = 0;
      } else {
        boss.x = innerWidth - Math.max(60, boss.r * 1.2);
      }

      if (bossPhase) {
        const scrollSpeed = dt > 0 ? (move / dt) : 0;
        boss.actionCd = Math.max(0, boss.actionCd - dt);
        boss.reactT = Math.max(0, boss.reactT - dt);

        if (!boss.intent && boss.actionCd <= 0) {
          boss.intent = pickBossThreat(boss, reds, scrollSpeed);
          if (boss.intent) boss.reactT = rand(0.06, 0.14);
        }

        if (boss.intent && boss.reactT <= 0) {
          if (boss.intent === 'jump') {
            const floor = groundY() - boss.r * boss.squashY;
            const grounded = (Math.abs(boss.y - floor) < 0.5) && Math.abs(boss.vy) < 60;
            if (grounded) boss.vy = PHYS.flapVy * 0.9;
          } else if (boss.intent === 'duck') {
            boss.duckT = 0.36;
          }
          boss.intent = null;
          boss.actionCd = rand(0.18, 0.32);
        }

        if (boss.duckT > 0) boss.duckT = Math.max(0, boss.duckT - dt);
        const duckTarget = (boss.duckT > 0) ? 0.65 : 1;
        boss.squashY = lerp(boss.squashY, duckTarget, 1 - Math.pow(0.001, dt));

        boss.vy += PHYS.gravity * dt;
        boss.vy = clamp(boss.vy, -2000, PHYS.maxFall);
        boss.y += boss.vy * dt;

        const floor = groundY() - boss.r * boss.squashY;
        if (boss.y > floor) {
          boss.y = floor;
          boss.vy = boss.vy * -0.18;
          if (Math.abs(boss.vy) < 60) boss.vy = 0;
        }

        const grounded = (Math.abs(boss.y - floor) < 0.5) && Math.abs(boss.vy) < 1;
        const wingSpeed = grounded ? 4.6 : 6.2;
        boss.wingT = (boss.wingT + dt * wingSpeed) % 1;
      } else if (!bossOutroLocked) {
        boss.vy = 0;
        boss.duckT = 0;
        boss.squashY = lerp(boss.squashY, 1, 1 - Math.pow(0.001, dt));
        boss.y = groundY() - boss.r * boss.squashY;
        const wingSpeed = 4.6;
        boss.wingT = (boss.wingT + dt * wingSpeed) % 1;
      }
    }

    if (finishExit) {
      player.x += WORLD.speed * dt;
      if (player.x > innerWidth + player.r + 20 && gameState.value === 'playing') {
        finishExit = false;
        cutscenePending = false;
        gameState.value = 'cutscene';
        dialogueScript = DIALOGUE_INTRO;
        dialogueMode = 'intro';
        dialogueIndex = 0;
        dialogueChar = 0;
        playTextTapSfx();
        dialogueMusic.pending = false;
        dialogueMusic.delay = 0;
        dialogueMusic.fade = 0;
        dialogueMusic.fading = false;
        try {
          dialogueMusic.audio.currentTime = 0;
          dialogueMusic.audio.volume = dialogueMusic.baseVol;
          dialogueMusic.audio.play();
        } catch {
          // ignore
        }
        cutsceneFade.active = true;
        cutsceneFade.phase = 'in';
        cutsceneFade.t = 0;
        inputHeld = false;
        player.squashTarget = 1;
        bossCheckpointScore = score;
        bossCheckpointSize = player.baseR;
        bossCheckpointX = finishStopX + innerWidth + 40;
        bossCheckpointHp = boss.hpMax;
        scrollX = bossCheckpointX;
        player.x = 160;
      }
    } else {
      if (!cutscenePending) player.x = 160;
    }

    if (bossOutroInvulnerable && player._beingEaten) {
      player._beingEaten = null;
    }
    if (player._beingEaten) {
      player._beingEaten.t = clamp(player._beingEaten.t + dt / EAT.swallowDur, 0, 1);
      const tt = easeInOut(player._beingEaten.t);
      player.x = lerp(player._beingEaten.x0, player._beingEaten.tx, tt);
      player.y = lerp(player._beingEaten.y0, player._beingEaten.ty, tt);
      player.r = lerp(player._beingEaten.r0, 0, tt);
      if (player._beingEaten.t >= 1) {
        player.alive = false;
        playNpcEatsPlayerSfx();
        registerDeath();
        deathDelay = 0.45;
        gameState.value = 'dying';
        player._beingEaten = null;
      }
    }

    if (!bossOutroPoseLocked) {
      let best = null, bestD = Infinity;
      for (const n of npcs) {
        if (n.state !== 'fly') continue;
        if (n.x < player.x - 10) continue;
        const d = dist(player.x, player.y, n.x, n.y);
        if (d < bestD) { bestD = d; best = n; }
      }
      const targetAngle = best ? Math.atan2(best.y - player.y, best.x - player.x) : 0;
      if (biteT > 0) {
        biteT = Math.max(0, biteT - dt);
        player.mouth.dir = lerpAngle(player.mouth.dir, biteDir, 1 - Math.pow(0.000001, dt));
      } else {
        player.mouth.dir = lerpAngle(player.mouth.dir, targetAngle, 1 - Math.pow(0.001, dt));
      }
    }
  } else if (gameState.value === 'start' || gameState.value === 'startTransition') {
    menuScrollX += WORLD.speed * dt;
  } else if (gameState.value !== 'dying' && gameState.value !== 'gameover' && gameState.value !== 'gameoverFinal') {
    const move = WORLD.speed * dt;
    driftNPCs(npcs, move);
    driftReds(reds, move);
    driftBlues(blues, move);
  }

  if (gameState.value === 'dying') {
    if (bossPhase) diedInBoss = true;
    if (deathDelay > 0) deathDelay = Math.max(0, deathDelay - dt);
    if (!burst.active && deathDelay <= 0) {
      if (livesHalf <= 0) beginGameOver();
      else respawnAtCheckpoint();
    }
  }

  if (gameState.value === 'gameover') {
    if (coinFlash.active) {
      coinFlash.t = Math.min(coinFlash.dur, coinFlash.t + dt);
      if (coinFlash.t >= coinFlash.dur) coinFlash.active = false;
    }
    if (resumeDelay.active) {
      resumeDelay.t = Math.min(resumeDelay.dur, resumeDelay.t + dt);
      if (resumeDelay.t >= resumeDelay.dur) {
        resumeDelay.active = false;
        finishContinueFromGameOver();
      }
    }
  } else if (gameState.value === 'gameoverFinal' && gameOverFinal.active) {
    gameOverFinal.t = Math.min(gameOverFinal.dur, gameOverFinal.t + dt);
    if (gameOverFinal.t >= gameOverFinal.dur) {
      gameOverFinal.active = false;
      beginStartScreen();
    }
  }

  draw();
  requestAnimationFrame(tick);
};

const draw = () => {
  const w = innerWidth;
  const h = innerHeight;
  ctx.clearRect(0, 0, w, h);
  const bossOutroLocked = bossOutro.active
    && bossOutro.phase !== 'white_in'
    && bossOutro.phase !== 'white_hold'
    && bossOutro.phase !== 'white_out';
  const showWorldEntities = !bossOutro.blackBackdrop;
  const showPlayer = showWorldEntities || bossOutro.active;

  const useBlackBackdrop = bossOutro.blackBackdrop || gameState.value === 'stageclear' || gameState.value === 'gameoverFinal';
  const bgScrollX = (gameState.value === 'start' || gameState.value === 'startTransition')
    ? menuScrollX
    : scrollX + menuScrollX;

  if (useBlackBackdrop) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
  } else {
    drawSky(ctx, w, h);
    drawStars(ctx, starsFar, 0.05, bgScrollX, groundY(), w);
    drawHills(ctx, w, groundY(), bgScrollX);
  }

  const shakeAmp = (bossOutro.active && (bossOutro.phase === 'boom' || bossOutro.phase === 'explode')) ? 6 : 0;
  if (shakeAmp > 0) {
    ctx.save();
    ctx.translate(rand(-shakeAmp, shakeAmp), rand(-shakeAmp, shakeAmp));
  }

  if (gameState.value !== 'stageclear' && gameState.value !== 'gameoverFinal') {
    drawGround(ctx, groundY(), w, h, bgScrollX);
  }

  const showEntities = !(gameState.value === 'start' || gameState.value === 'startTransition' || gameState.value === 'stageclear' || gameState.value === 'gameoverFinal');
  if (showEntities) {
    const fadeEntitiesAlpha = finishFadeEntities.active
      ? (1 - easeInOut(clamp(finishFadeEntities.t / finishFadeEntities.dur, 0, 1)))
      : 1;

    if (!bossOutro.blackBackdrop) drawCheckpointFlags(ctx, w);

    if (showWorldEntities) {
      if (fadeEntitiesAlpha < 1) ctx.save(), ctx.globalAlpha = fadeEntitiesAlpha;
      for (const o of reds) {
        drawDynamiteBomb(ctx, o.x, o.y, Math.max(0, o.r));
      }
      if (fadeEntitiesAlpha < 1) ctx.restore();

      if (fadeEntitiesAlpha < 1) ctx.save(), ctx.globalAlpha = fadeEntitiesAlpha;
      for (const o of blues) {
        ctx.fillStyle = '#ffbf4a';
        drawStar(ctx, o.x, o.y, Math.max(0, o.r), o.specks, waveT);
      }
      if (fadeEntitiesAlpha < 1) ctx.restore();

      drawDustPuffs(ctx, dustPuffs, lerp);

      if (fadeEntitiesAlpha < 1) ctx.save(), ctx.globalAlpha = fadeEntitiesAlpha;
      for (const n of npcs) {
        drawCharacter(ctx, n.x, n.y, n.r, n.mouth.dir, n.mouth.open, n.emotion, 1, clamp, lerp);
      }
      if (fadeEntitiesAlpha < 1) ctx.restore();

    }

    if (showPlayer && (gameState.value === 'playing' || gameState.value === 'cutscene') && player.r > 0.3) {
      drawPlayer2(ctx, player.x, player.y, player.r, player.mouth.dir, player.mouth.open, player.squashY, DEFAULT_PALETTE, false, true, { t: player.wingT });
    }

    if (gameState.value === 'cutscene' && !(bossOutro.active && bossOutro.bossGone) && (showWorldEntities || bossOutro.active)) {
      const bossJitter = (bossOutro.active && (bossOutro.phase === 'boom' || bossOutro.phase === 'explode'))
        ? { x: rand(-2, 2), y: rand(-2, 2) }
        : { x: 0, y: 0 };
      const bossFlip = bossOutro.active
        && bossOutro.phase !== 'white_in'
        && bossOutro.phase !== 'white_hold';
      drawPlayer2(ctx, boss.x + bossJitter.x, boss.y + bossJitter.y, boss.r, 0, boss.mouth, boss.squashY, BOSS_PALETTE, bossFlip, true, { t: boss.wingT });
    }

    if (showWorldEntities || bossOutroLocked) {
      drawFloaters(ctx, floaters, clamp);

      if (burst.active) drawBurst(ctx, burst, lerp);
      if (headShatter.active) drawShatter(ctx, headShatter);
      if (npcShatter.active) drawShatter(ctx, npcShatter);
      drawSparkles(ctx, sparkles);
      if (lineBurst.active) drawLineBurst(ctx, lineBurst, lerp);
    }
    for (const b of bossExplosions) {
      if (b.active) drawLineBurst(ctx, b, lerp);
    }
  }

  if (shakeAmp > 0) ctx.restore();

  if (!cinematicUiHidden) {
    const uiFade = finishFadeEntities.active
      ? (1 - easeInOut(clamp(finishFadeEntities.t / finishFadeEntities.dur, 0, 1)))
      : (scoreFade.active ? easeInOut(clamp(scoreFade.t / scoreFade.dur, 0, 1)) : 1);
    const showBossUi = showHealthBar && (gameState.value === 'cutscene' || gameState.value === 'playing' || gameState.value === 'dying');
    if ((gameState.value === 'playing' || gameState.value === 'dying') && !showBossUi) {
      if (uiFade < 1) ctx.save(), ctx.globalAlpha = uiFade;
      drawProgressBar(ctx, w);
      if (uiFade < 1) ctx.restore();
    }
    if (showBossUi) {
      if (uiFade < 1) ctx.save(), ctx.globalAlpha = uiFade;
      drawHealthBar(ctx);
      setBossTimerVisible(false);
      if (uiFade < 1) ctx.restore();
    } else {
      setBossTimerVisible(false);
    }

    if (checkpointToastT > 0 && !(gameState.value === 'cutscene' && !showHealthBar)) {
      ctx.save();
      ctx.globalAlpha = uiFade;
      ctx.font = '15px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#e44c4c';
      const text = 'CHECKPOINT REACHED';
      const gy = groundY();
      const tx = w * 0.5;
      const ty = gy + (h - gy) * 0.5;
      ctx.fillText(text, tx, ty);
      ctx.restore();
    }

    const showHearts = (
      gameState.value === 'playing'
      || gameState.value === 'dying'
      || gameState.value === 'paused'
      || (gameState.value === 'cutscene' && showHealthBar)
    );
    if (showHearts) {
      if (uiFade < 1) ctx.save(), ctx.globalAlpha = uiFade;
      drawLivesHud(ctx, w);
      if (uiFade < 1) ctx.restore();
    }
  }
  if (cinematicUiHidden) setBossTimerVisible(false);

  if (isDialogueActive() && dialogueIndex < dialogueScript.length) {
    drawDialogueBox(ctx, w, h);
  }

  if (debugHUD) {
    const d = difficulty01();
    const gapMax = GAP.maxPx * DDA.gapScale;
    const speedVal = WORLD.speed;
    const gapVal = minGapPx();
    const trailVal = trailProb();
    const stressVal = stress;
    const stressEaseVal = stressEase;
    const reliefVal = reliefActive ? 'on' : 'off';
    const numericLines = [
      { key: 'd', label: 'd', value: d, max: 1.0, fmt: (v) => v.toFixed(2) },
      { key: 'speed', label: 'speed', value: speedVal, max: WORLD.maxSpeed, fmt: (v) => v.toFixed(1) },
      { key: 'gapPx', label: 'gapPx', value: gapVal, max: gapMax, fmt: (v) => v.toFixed(1) },
      { key: 'trailP', label: 'trailP', value: trailVal, max: 0.95, fmt: (v) => v.toFixed(2) },
      { key: 'stress', label: 'stress', value: stressVal, max: 1.0, fmt: (v) => v.toFixed(2) },
      { key: 'stressEase', label: 'stressEase', value: stressEaseVal, max: 1.0, fmt: (v) => v.toFixed(2) },
    ];
    const lines = [...numericLines, { label: 'relief', value: reliefVal, key: 'relief' }];

    const boxW = 210;
    const boxH = 14 * lines.length + 12;
    const boxX = w - boxW - 12;
    const boxY = 12;
    const EPS = 1e-3;

    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#000';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.globalAlpha = 1;
    ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

    for (let i = 0; i < lines.length; i++) {
      const lineY = boxY + 18 + i * 14;
      const line = lines[i];
      const labelText = `${line.label}: `;
      ctx.fillStyle = '#f2f4f7';
      ctx.fillText(labelText, boxX + 8, lineY);

      if (line.key === 'relief') {
        ctx.fillStyle = '#f2f4f7';
        ctx.fillText(line.value, boxX + 8 + ctx.measureText(labelText).width, lineY);
        continue;
      }

      const cur = line.value;
      const max = line.max;
      if (!(line.key in hudTrack.init)) {
        hudTrack.init[line.key] = cur;
        hudTrack.changed[line.key] = false;
        hudTrack.maxed[line.key] = false;
      }
      if (Math.abs(cur - hudTrack.init[line.key]) > EPS) {
        hudTrack.changed[line.key] = true;
      }
      if (cur >= max - EPS) {
        hudTrack.maxed[line.key] = true;
      }

      let color = '#f2f4f7';
      if (hudTrack.maxed[line.key]) color = '#ffd24a';
      else if (hudTrack.changed[line.key]) color = '#6bc7ff';

      const valueText = `${line.fmt(cur)} / ${line.fmt(max)}`;
      ctx.fillStyle = color;
      ctx.fillText(valueText, boxX + 8 + ctx.measureText(labelText).width, lineY);
    }
    ctx.restore();

    if (missLog.length) {
      ctx.save();
        ctx.fillStyle = '#f2f4f7';
      ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
      const startY = boxY + boxH + 16;
      const title = `missed NPCs (count ${missCount}, pts -${missPoints})`;
      ctx.fillText(title, boxX, startY);
      for (let i = 0; i < missLog.length; i++) {
        const m = missLog[i];
        ctx.fillText(`-${m.pts} @ (${Math.round(m.x)}, ${Math.round(m.y)})`, boxX, startY + 14 + i * 14);
      }
      ctx.restore();
    }
  }

  if (gameState.value === 'start' || gameState.value === 'startTransition') {
    drawScreenText(ctx, w, h, "DUCK'S SAKE", 'TAP TO START', '', getScreenAlpha());
  } else if (gameState.value === 'gameover') {
    drawGameOverChoice(ctx, w, h);
  } else if (gameState.value === 'gameoverFinal') {
    drawGameOverFinal(ctx, w, h);
  } else if (gameState.value === 'restartTransition') {
    drawScreenText(ctx, w, h, 'GAME OVER', '', `${score} pts`, getScreenAlpha());
  } else if (gameState.value === 'stageclear') {
    drawScreenText(ctx, w, h, 'STAGE COMPLETE', '', '', 1);
    drawStageCompleteStats(ctx, w, h);
  } else if (gameState.value === 'paused') {
    drawScreenText(ctx, w, h, 'PAUSE', 'PRESS P TO RESUME', '', 1);
    drawPauseDebugKeys(ctx, w, h);
  }

  if (bossOutro.blackAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = bossOutro.blackAlpha;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  if (bossOutro.whiteAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = bossOutro.whiteAlpha;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  if (cutsceneFade.active) {
    const tt = easeInOut(cutsceneFade.t);
    const a = (cutsceneFade.phase === 'out') ? tt : (1 - tt);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

};

const drawDialogueBox = (ctx, w, h) => {
  const entry = dialogueScript[dialogueIndex];
  if (!entry) return;

  const paddingX = 18;
  const paddingY = 14;
  const lineH = 20;
  const maxTextW = w - paddingX * 2;
  const boxW = w;
  ctx.save();
  ctx.font = '15px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  ctx.textAlign = 'left';

  const name = entry.speaker;
  const prefix = `${name}: `;
  const prefixW = ctx.measureText(prefix).width;
  const typed = entry.text.slice(0, dialogueChar);
  const words = typed.split(' ');
  const lines = [];
  let line = '';
  let limit = Math.max(40, maxTextW - prefixW);
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > limit && line) {
      lines.push(line);
      line = word;
      limit = maxTextW;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);

  const boxH = Math.max(90, paddingY * 2 + Math.max(1, lines.length) * lineH);
  const x = 0;
  const y = 0;

  ctx.fillStyle = '#000';
  ctx.globalAlpha = 0.85;
  ctx.fillRect(x, y, boxW, boxH);
  ctx.globalAlpha = 1;

  const nameColor = (name === 'FURY') ? DEFAULT_PALETTE.body : BOSS_PALETTE.body;
  let textY = y + paddingY + lineH * 0.9;

  const firstLine = lines[0] || '';
  const lineW = ctx.measureText(firstLine).width;
  const totalW = prefixW + lineW;
  const startX = (w - totalW) * 0.5;

  ctx.fillStyle = nameColor;
  ctx.fillText(prefix, startX, textY);
  ctx.fillStyle = '#f2f4f7';
  ctx.fillText(firstLine, startX + prefixW, textY);

  for (let i = 1; i < lines.length; i++) {
    textY += lineH;
    const lw = ctx.measureText(lines[i]).width;
    ctx.fillStyle = '#f2f4f7';
    ctx.fillText(lines[i], (w - lw) * 0.5, textY);
  }

  ctx.restore();
};

const drawPauseDebugKeys = (ctx, w, h) => {
  const lines = [
    'H: debug HUD',
    'B: boss outro',
    'R: reset to start',
    'ENTER: warp near finish',
  ];
  const lineH = 16;
  const startY = (h / 2) + 86;
  ctx.save();
  ctx.font = '13px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(242, 244, 247, 0.9)';
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.lineWidth = 3;
  for (let i = 0; i < lines.length; i++) {
    const y = startY + i * lineH;
    ctx.strokeText(lines[i], w / 2, y);
    ctx.fillText(lines[i], w / 2, y);
  }
  ctx.restore();
};

const drawStageCompleteStats = (ctx, w, h) => {
  const mins = Math.floor(bossTimer / 60);
  const secs = Math.floor(bossTimer % 60);
  const bossBonus = getBossBonusForTime(bossTimer);
  const timeText = `00:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  const lines = [
    { label: 'Total Score:', value: `${score} pts` },
    { label: 'Deaths:', value: `${deathCount}` },
    { label: 'Enemies Killed:', value: `${enemiesKilled}` },
    { label: 'Boss Kill Bonus:', value: `${bossBonus} pts` },
    { label: 'Boss Kill Duration:', value: timeText },
  ];
  const lineH = 22;
  const startY = (h / 2) + 70;
  const leftX = w * 0.28;
  const rightX = w * 0.78;
  ctx.save();
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(242, 244, 247, 0.95)';
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.lineWidth = 4;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 2;
  ctx.font = '600 20px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  for (let i = 0; i < lines.length; i++) {
    const y = startY + i * lineH;
    const line = lines[i];
    ctx.textAlign = 'left';
    ctx.strokeText(line.label, leftX, y);
    ctx.fillText(line.label, leftX, y);
    ctx.textAlign = 'right';
    ctx.strokeText(line.value, rightX, y);
    ctx.fillText(line.value, rightX, y);
  }
  ctx.restore();
};

const drawHeartPath = (ctx, x, y, size) => {
  const topCurve = size * 0.3;
  ctx.beginPath();
  ctx.moveTo(x, y + topCurve);
  ctx.bezierCurveTo(x, y, x + size * 0.5, y, x + size * 0.5, y + topCurve);
  ctx.bezierCurveTo(x + size * 0.5, y, x + size, y, x + size, y + topCurve);
  ctx.bezierCurveTo(x + size, y + (size + topCurve) * 0.5, x + size * 0.5, y + size, x + size * 0.5, y + size);
  ctx.bezierCurveTo(x + size * 0.5, y + size, x, y + (size + topCurve) * 0.5, x, y + topCurve);
  ctx.closePath();
};

const drawHeart = (ctx, x, y, size, fill) => {
  const emptyFill = '#6f3a3d';
  const fillColor = NPC_PALETTE.lips;
  const outline = '#b36366';
  const lineW = Math.max(1.2, size * 0.08);

  ctx.save();
  drawHeartPath(ctx, x, y, size);
  ctx.fillStyle = emptyFill;
  ctx.fill();

  if (fill > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, size * fill, size);
    ctx.clip();
    drawHeartPath(ctx, x, y, size);
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.restore();
  }

  ctx.strokeStyle = outline;
  ctx.lineWidth = lineW;
  ctx.stroke();
  ctx.restore();
};

const drawLivesHud = (ctx, w) => {
  const size = Math.max(14, Math.min(22, w * 0.018));
  const gap = Math.round(size * 0.3);
  const totalW = MAX_LIVES * size + Math.max(0, MAX_LIVES - 1) * gap;
  const x0 = Math.max(12, 16);
  const y = 12;

  for (let i = 0; i < MAX_LIVES; i++) {
    const remaining = livesHalf - i * 2;
    const fill = remaining >= 2 ? 1 : remaining === 1 ? 0.5 : 0;
    drawHeart(ctx, x0 + i * (size + gap), y, size, fill);
  }
};

const drawHealthBar = (ctx) => {
  const w = 260;
  const h = 16;
  const x = (innerWidth - w) * 0.5;
  const y = 14;
  const pad = 2;
  const labelW = 52;
  const segments = Math.max(1, boss.hpMax || 10);
  const gap = 3;
  const barW = w - labelW - 6;
  const segW = (barW - pad * 2 - gap * (segments - 1)) / segments;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#f2f4f7';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);

  const labelX = x + 2;
  ctx.fillStyle = '#0f0f0f';
  ctx.fillRect(labelX, y + 2, labelW - 4, h - 4);

  for (let i = 0; i < segments; i++) {
    const sx = x + labelW + pad + i * (segW + gap);
    const on = i < boss.hp;
    ctx.fillStyle = on ? '#f2f4f7' : 'rgba(242,244,247,0.25)';
    ctx.fillRect(sx, y + pad, segW, h - pad * 2);
  }

  ctx.font = '13px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f2f4f7';
  ctx.fillText('RED', x + labelW * 0.5, y + h * 0.55);
  ctx.restore();
};

const getGameOverButtons = (w, h) => {
  const btnW = Math.min(240, w * 0.36);
  const btnH = 44;
  const gap = Math.min(30, w * 0.06);
  const totalW = btnW * 2 + gap;
  const x0 = (w - totalW) * 0.5;
  const y = h * 0.58;
  return [
    { id: 'yes', label: 'DUCK YEAH!', x: x0, y, w: btnW, h: btnH },
    { id: 'no', label: 'DUCK NO!', x: x0 + btnW + gap, y, w: btnW, h: btnH },
  ];
};

const drawGameOverChoice = (ctx, w, h) => {
  const cx = w * 0.5;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f2f4f7';
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.lineWidth = 6;
  ctx.font = '800 52px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  ctx.strokeText('CONTINUE?', cx, h * 0.4);
  ctx.fillText('CONTINUE?', cx, h * 0.4);

  ctx.lineWidth = 3;
  const buttons = getGameOverButtons(w, h);
  const yesLabel = insertMode ? `INSERT COINS (${COINS_MAX})` : 'DUCK YEAH!';
  for (const b of buttons) {
    const isInsert = (b.id === 'yes' && insertMode);
    ctx.fillStyle = isInsert ? '#f2d36a' : '#000';
    ctx.strokeStyle = 'rgba(242, 244, 247, 0.9)';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = isInsert ? '#2f3c14' : '#f2f4f7';
    const label = (b.id === 'yes') ? yesLabel : b.label;
    let fontSize = 16;
    ctx.font = `700 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    while (ctx.measureText(label).width > b.w - 16 && fontSize > 11) {
      fontSize -= 1;
      ctx.font = `700 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    }
    ctx.fillText(label, b.x + b.w * 0.5, b.y + b.h * 0.56);
  }

  let coinsAlpha = 1;
  if (coinFlash.active) {
    const blinkRate = 0.08;
    const blinkOn = (Math.floor(coinFlash.t / blinkRate) % 2) === 0;
    coinsAlpha = blinkOn ? 1 : 0;
  }
  ctx.globalAlpha = coinsAlpha;
  const coinsEmpty = coins <= 0;
  ctx.fillStyle = coinsEmpty ? '#e44c4c' : '#f2d36a';
  ctx.strokeStyle = coinsEmpty ? '#8e2a2a' : '#b7892a';
  ctx.lineWidth = 3;
  ctx.font = '700 16px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  const coinsY = buttons[0].y + buttons[0].h + 26;
  const coinsText = `COINS: ${coins}`;
  ctx.strokeText(coinsText, cx, coinsY);
  ctx.fillText(coinsText, cx, coinsY);
  ctx.restore();
};

const drawGameOverFinal = (ctx, w, h) => {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#e44c4c';
  ctx.font = '800 54px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  ctx.fillText('GAME OVER', w * 0.5, h * 0.5);
  ctx.restore();
};

const getBossTimerEl = () => {
  let timerEl = document.getElementById('boss-timer');
  if (!timerEl) {
    timerEl = document.createElement('div');
    timerEl.id = 'boss-timer';
    timerEl.className = 'score';
    timerEl.style.left = 'auto';
    timerEl.style.right = '12px';
    timerEl.style.textAlign = 'right';
    timerEl.style.display = 'none';
    document.body.appendChild(timerEl);
  }
  return timerEl;
};

const setBossTimerVisible = (show) => {
  const timerEl = document.getElementById('boss-timer');
  if (!timerEl) return;
  timerEl.style.display = show ? 'block' : 'none';
  timerEl.style.opacity = show ? '0.9' : '0';
};

const drawBossTimer = () => {
  const total = Math.max(0, bossTimer);
  const mins = Math.floor(total / 60);
  const secs = Math.floor(total % 60);
  const timerEl = getBossTimerEl();
  timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
  timerEl.style.display = 'block';
  timerEl.style.opacity = '0.9';
};

const drawCheckpointFlags = (ctx, w) => {
  const gy = groundY();
  const poleH = 42;
  const poleW = 4;
  const flagW = 18;
  const flagH = 12;

  ctx.save();
  for (let i = 1; i < checkpointXs.length; i++) {
    const worldX = checkpointXs[i];
    const x = worldX - scrollX;
    if (x < -40 || x > w + 40) continue;

    const baseY = gy;
    ctx.strokeStyle = '#7a4b4b';
    ctx.lineWidth = poleW;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.lineTo(x, baseY - poleH);
    ctx.stroke();

    if (i === checkpointXs.length - 1) {
      const square = 6;
      const cols = 2;
      const rows = 2;
      const startX = x + 2;
      const startY = baseY - poleH;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const on = (r + c) % 2 === 0;
          ctx.fillStyle = on ? '#f2f4f7' : '#262626';
          ctx.fillRect(startX + c * square, startY + r * square, square, square);
        }
      }
    } else {
      ctx.fillStyle = '#e44c4c';
      ctx.beginPath();
      ctx.moveTo(x, baseY - poleH);
      ctx.lineTo(x + flagW, baseY - poleH + flagH * 0.4);
      ctx.lineTo(x, baseY - poleH + flagH);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
};

const drawProgressBar = (ctx, w) => {
  const barW = Math.min(460, w * 0.7);
  const barH = 6;
  const x = (w - barW) * 0.5;
  const y = 18;
  const progress = clamp(scrollX / LEVEL.length, 0, 1);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = barH;
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + barW, y);
  ctx.stroke();

  ctx.strokeStyle = '#f2f4f7';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + barW * progress, y);
  ctx.stroke();

  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  for (let i = 1; i <= 3; i++) {
    const lx = x + barW * (i / 4);
    ctx.beginPath();
    ctx.moveTo(lx, y - 8);
    ctx.lineTo(lx, y + 8);
    ctx.stroke();
  }

  const cx = x + barW * progress;
  ctx.fillStyle = '#f2f4f7';
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, y, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
};

requestAnimationFrame(tick);
