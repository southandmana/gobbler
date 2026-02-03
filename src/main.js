import { PHYS, SQUASH, STAND, WORLD, EAT, HAZARD, SCORE, GROW, SPAWN, GAP, MOUTH, BALANCE, TRAIL, WAVE, DDA } from './config.js';
import { clamp, rand, lerp, easeInOut, dist, lerpAngle } from './utils/math.js';
import { makeStars, createBackgroundCache, drawBackdrop, drawGround, drawScreenText } from './render/background.js';
import { drawWorldEntities } from './render/world.js';
import { drawUI } from './render/ui.js';
import { createBurst, startBurst, updateBurst, drawBurst, createShatter, startHeadShatter, updateShatter, drawShatter, createLineBurst, startLineBurst, updateLineBurst, drawLineBurst, createFloaters, popText, updateFloaters, drawFloaters, createSparkles, startSparkles, updateSparkles, drawSparkles, createDustPuffs, startDustPuff, updateDustPuffs, drawDustPuffs } from './render/effects.js';
import { createPlayer, drawPlayer2, DEFAULT_PALETTE } from './entities/player.js';
import { updateMouth, triggerChomp } from './entities/mouth.js';
import { makeNPC, updateNPCs, driftNPCs, drawCharacter, NPC_PALETTE } from './entities/npc.js';
import { makeRed, updateReds, driftReds, drawDynamiteBomb } from './entities/hazards.js';
import { makeBlue, updateBlues, driftBlues, drawStar, drawStarSpecks } from './entities/powerups.js';

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

const highScoreEl = document.createElement('div');
highScoreEl.className = 'highscore';
const trophyEl = document.createElement('span');
trophyEl.className = 'trophy-icon';
trophyEl.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10v2h3v4c0 3-2.2 5.3-5.2 5.9a6 6 0 0 1-2.8 2.2V20h3v2H9v-2h3v-1.9a6 6 0 0 1-2.8-2.2C6.2 15.3 4 13 4 10V6h3V4zm0 4H6v2c0 2 1.5 3.7 3.4 4.1-.3-.8-.4-1.7-.4-2.6V8zm10 0v3.5c0 .9-.1 1.8-.4 2.6C18.5 13.7 20 12 20 10V8h-1z"/></svg>';
const highScoreValueEl = document.createElement('span');
highScoreValueEl.className = 'highscore-value';
highScoreEl.appendChild(trophyEl);
highScoreEl.appendChild(highScoreValueEl);
document.body.appendChild(highScoreEl);

const rickRollEl = document.createElement('img');
rickRollEl.src = 'assets/rick_roll.gif';
rickRollEl.alt = '';
rickRollEl.setAttribute('aria-hidden', 'true');
rickRollEl.style.position = 'fixed';
rickRollEl.style.left = '0';
rickRollEl.style.bottom = '0';
rickRollEl.style.width = '64px';
rickRollEl.style.height = '64px';
rickRollEl.style.display = 'none';
rickRollEl.style.pointerEvents = 'none';
rickRollEl.style.zIndex = '5';
document.body.appendChild(rickRollEl);

let highScoreStory = 0;
let highScoreArcade = 0;
try {
  const storedArcade = Number.parseInt(localStorage.getItem('gobblerHighScoreArcade') || '0', 10);
  const storedStory = Number.parseInt(localStorage.getItem('gobblerHighScoreStory') || '0', 10);
  highScoreArcade = Number.isFinite(storedArcade) ? storedArcade : 0;
  highScoreStory = Number.isFinite(storedStory) ? storedStory : 0;
  if (!localStorage.getItem('gobblerHighScoreArcade')) {
    const legacy = Number.parseInt(localStorage.getItem('gobblerHighScore') || '0', 10);
    if (Number.isFinite(legacy) && legacy > 0) {
      highScoreArcade = legacy;
      localStorage.setItem('gobblerHighScoreArcade', String(legacy));
    }
  }
} catch {
  highScoreArcade = 0;
  highScoreStory = 0;
}
highScoreValueEl.textContent = `${highScoreArcade} pts`;

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
let startMode = 'story';
const isArcade = () => startMode === 'arcade';
const SPLASH_COMPANY_DUR = 2.5;
const SPLASH_LOADING_DUR = 3.5;
const SPLASH_FADE_DUR = 0.35;
const SPLASH_BLACK_HOLD = 0.2;
const splash = { phase: 'company', t: 0, fading: false, hold: false };
const splashFadeOverlay = { active: false, t: 0 };
let startViewSettled = false;
let startScrollOnly = false;
let startScrollPending = false;
let startScrollDelay = 0;
let startTitleHidden = false;
let startTitleFade = 1;
const START_TITLE_FADE_DUR = 0.35;
let startGamePending = false;
let startGameDelay = 0;
let startMenuPressedId = null;
let startMenuHidden = false;
let startMenuKeepId = null;
const START_MENU_NPC_SPEED = 360;
const START_MENU_NPC_BOUNCES = 3;
const START_MENU_NPC_BOUNCE_VY = -340;
const START_MENU_NPC_GRAVITY = 900;
const START_MENU_NPC_BITE_SNAP = 0.12;
const START_MENU_BOMB_POP_DUR = 0.12;
const START_MENU_NPC_JUMP_VX = -260;
const START_MENU_NPC_JUMP_VY = -420;
const START_MENU_SHAKE_DUR = 0.25;
const START_MENU_SHAKE_AMP = 3;
const START_MENU_BOMB_SCALE = 0.6;
let startMenuBoom = 0;
const startMenuBomb = { active: false, state: 'idle', x: 0, y: 0, r: 0, x0: 0, y0: 0, r0: 0, t: 0 };
const startMenuBombPop = { active: false, t: 0 };
const startMenuNpc = {
  active: false,
  state: 'idle',
  x: 0,
  y: 0,
  r: 0,
  vx: 0,
  vy: 0,
  t: 0,
  baseY: 0,
  bounceLeft: 0,
  jumpReady: false,
  biteT: 0,
  biteDir: Math.PI,
  prevX: 0,
  prevY: 0,
  mouth: { open: 0, dir: 0, pulseT: 1, pulseDur: MOUTH.pulseDur, cooldown: 0 },
};
const dialogueSpeed = 38;
const dialogueMouth = { t: 0, min: 0.18, max: 0.48, speed: 30 };
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
const playHomeStartSfx = createSfxPool('assets/sfx/home_start.wav', 1, 0.75);
const playBombLeavesSfx = createSfxPool('assets/sfx/bomb_leaves_bg.wav', 3, 0.7);
const playBombHitsGroundSfx = createSfxPool('assets/sfx/bomb_hits_ground.wav', 3, 0.7);
const playEatStarSfx = createSfxPool('assets/sfx/eat_star.wav', 3, 0.7);
const playEatBombSfx = createSfxPool('assets/sfx/eat_bomb.wav', 3, 0.8);
const playHitBombSfx = createSfxPool('assets/sfx/hit_bomb.wav', 3, 0.75);
const playDuckYeahSfx = createSfxPool('assets/sfx/duck_yeah.wav', 2, 0.8);
const playGameOver2Sfx = createSfxPool('assets/sfx/gameover_2.mp3', 1, 0.8);
const playEnterAutoModeSfx = createSfxPool('assets/sfx/enter_auto_mode.wav', 2, 0.75);
const playTextTapSfx = createSfxPool('assets/sfx/text_message_tap.wav', 4, 0.7);
const playBossExplosionSfx = createSfxPool('assets/sfx/bomb_hits_ground.wav', 5, 0.75);
const playBossPopSfx = createSfxPool('assets/sfx/eat_bomb.wav', 4, 0.7);
const playBossBonusSfx = createSfxPool('assets/sfx/boss_bonus.wav', 2, 0.8);
const playStageClearedSfx = createSfxPool('assets/sfx/stage_cleared.mp3', 1, 0.8);

const playDied100Sequence = (() => {
  const first = new Audio('assets/sfx/died_100_times_1.wav');
  const second = new Audio('assets/sfx/died_100_times_2.mp3');
  first.preload = 'auto';
  second.preload = 'auto';
  second.loop = true;
  first.volume = 0.8;
  second.volume = 0.8;
  let playing = false;
  return () => {
    try {
      first.onended = null;
      if (playing) {
        first.pause();
        second.pause();
      }
      playing = true;
      try {
        arcadeMusic.audio.pause();
        arcadeMusic.pending = false;
        arcadeMusic.fading = false;
      } catch {
        // ignore
      }
      first.currentTime = 0;
      second.currentTime = 0;
      first.onended = () => {
        playing = false;
        death100ToastActive = true;
        try {
          second.currentTime = 0;
          second.play();
        } catch {
          // ignore autoplay restrictions
        }
      };
      first.play();
    } catch {
      // ignore autoplay restrictions
    }
  };
})();

const titleImage = new Image();
let titleImageReady = false;
titleImage.onload = () => { titleImageReady = true; };
titleImage.src = 'assets/game_title_1.png';
const continueImage = new Image();
let continueImageReady = false;
continueImage.onload = () => { continueImageReady = true; };
continueImage.src = 'assets/contine.png';

const companyImage = new Image();
let companyImageReady = false;
companyImage.onload = () => { companyImageReady = true; };
companyImage.src = 'assets/company_screen.png';

const loadingImage = new Image();
let loadingImageReady = false;
loadingImage.onload = () => { loadingImageReady = true; };
loadingImage.src = 'assets/loading_screen.png';

const levelMusic = (() => {
  const audio = new Audio('assets/sfx/level1_part1_music.mp3');
  audio.preload = 'auto';
  audio.loop = true;
  const baseVol = 0.6;
  audio.volume = baseVol;
  return { audio, baseVol, pending: false, delay: 0, fade: 0, fadeDur: 0.8, fading: false };
})();

const arcadeMusic = (() => {
  const audio = new Audio('assets/sfx/arcade_music.mp3');
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
const startMenuBurst = createBurst();
const headShatter = createShatter();
const npcShatter = createShatter();
const startMenuNpcShatter = createShatter();
const lineBurst = createLineBurst();
const startMenuLineBurst = createLineBurst();
const bossExplosions = [];
const floaters = createFloaters();
const sparkles = createSparkles();
const dustPuffs = createDustPuffs();

const isProbablyMobile = () => {
  if (navigator.userAgentData && typeof navigator.userAgentData.mobile === 'boolean') {
    return navigator.userAgentData.mobile;
  }
  const ua = navigator.userAgent || '';
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobi/i.test(ua);
};

const quality = { dprCap: 2 };
let currentDpr = 1;
const START_MENU_BUTTON_SHADING = 'solid'; // 'solid' | 'hard' | 'smooth'
const startMenuButtonCache = new Map();
const startMenuTextCache = new Map();
const startMenuTextMeasureCtx = document.createElement('canvas').getContext('2d') || ctx;
const clearStartMenuCaches = () => {
  startMenuButtonCache.clear();
  startMenuTextCache.clear();
};
const updateQuality = () => {
  quality.dprCap = isProbablyMobile() ? 1.5 : 2;
};

const resize = () => {
  updateQuality();
  const dpr = Math.max(1, Math.min(quality.dprCap, window.devicePixelRatio || 1));
  currentDpr = dpr;
  canvas.width = Math.floor(innerWidth * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  canvas.style.width = innerWidth + 'px';
  canvas.style.height = innerHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  clearStartMenuCaches();
};
addEventListener('resize', resize);
resize();

const START_VIEW_OFFSET_RATIO = 1.0;
const getStartViewOffset = () => {
  if (gameState.value === 'start') return startViewSettled ? 0 : (innerHeight * START_VIEW_OFFSET_RATIO);
  if (gameState.value === 'startTransition') {
    if (!startScrollOnly) return 0;
    const t = easeInOut(clamp(screenAnim.t, 0, 1));
    return innerHeight * START_VIEW_OFFSET_RATIO * (1 - t);
  }
  return 0;
};

const groundY = () => innerHeight - WORLD.groundH;

let score = 0;
const setScore = (n) => {
  const next = Math.max(0, Math.round(n));
  score = next;
  scoreValueEl.textContent = `${next} pts`;
  if (isArcade() && next > highScoreArcade) {
    highScoreArcade = next;
    highScoreValueEl.textContent = `${highScoreArcade} pts`;
    try { localStorage.setItem('gobblerHighScoreArcade', String(highScoreArcade)); } catch {}
  } else if (!isArcade() && next > highScoreStory) {
    highScoreStory = next;
    try { localStorage.setItem('gobblerHighScoreStory', String(highScoreStory)); } catch {}
  }
};
const showScore = (show) => {
  const display = show ? 'flex' : 'none';
  scoreEl.style.display = display;
  highScoreEl.style.display = (show && isArcade()) ? 'flex' : 'none';
};
const setScoreOpacity = (v) => {
  scoreEl.style.opacity = v;
  highScoreEl.style.opacity = v;
};
const setRickRollVisible = (show) => {
  rickRollEl.style.display = show ? 'block' : 'none';
};

const applyHudMode = () => {
  document.body.classList.toggle('hud-arcade', isArcade());
  if (scoreEl.style.display !== 'none') {
    highScoreEl.style.display = isArcade() ? 'flex' : 'none';
  }
  if (isArcade()) highScoreValueEl.textContent = `${highScoreArcade} pts`;
};
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
let death100ToastActive = false;
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
  if (isArcade() && deathCount >= 100) death100ToastActive = true;
  if (isArcade() && deathCount === 100) {
    playDied100Sequence();
  }
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
const bgCache = createBackgroundCache();
let scrollX = 0;

const screenAnim = { active: false, t: 0, dur: 0.45 };
const cutsceneFade = { active: false, phase: 'out', t: 0, dur: 0.7 };
const gameOverFinal = { active: false, t: 0, dur: 1.4 };
const COINS_MAX = 5;
let coins = COINS_MAX;
const coinFlash = { active: false, t: 0, dur: 1.5 };
let insertMode = false;
const resumeDelay = { active: false, t: 0, dur: 1.5 };
const GAMEOVER_NO_BLACK_HOLD = 0.2;
const GAMEOVER_NO_FADE_IN = 0.35;
const GAMEOVER_NO_SHOW = 3.0;
const GAMEOVER_NO_FADE_OUT = 0.35;
const gameOverNoSeq = { active: false, phase: 'cut', t: 0 };

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
const startMenuNpcShatterAt = (x, y, r) => startHeadShatter(
  startMenuNpcShatter,
  x,
  y,
  r,
  rand,
  NPC_PALETTE,
  groundY() + getStartViewOffset(),
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
  const keepDeathCount = isArcade() ? deathCount : 0;
  const keepDeathToast = isArcade() ? death100ToastActive : false;
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
  deathCount = keepDeathCount;
  death100ToastActive = keepDeathToast;
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
  applyHudMode();
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
  arcadeMusic.pending = false;
  arcadeMusic.delay = 0;
  arcadeMusic.fade = 0;
  arcadeMusic.fading = false;
  try {
    arcadeMusic.audio.pause();
    arcadeMusic.audio.currentTime = 0;
    arcadeMusic.audio.volume = arcadeMusic.baseVol;
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
  if (!isArcade()) deathCount = 0;
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
  startViewSettled = false;
  startScrollOnly = false;
  startScrollPending = false;
  startScrollDelay = 0;
  startTitleHidden = false;
  startTitleFade = 1;
  startGamePending = false;
  startGameDelay = 0;
  startMenuPressedId = null;
  startMenuHidden = false;
  startMenuKeepId = null;
  startMenuBoom = 0;
  startMenuBomb.active = false;
  startMenuBomb.state = 'idle';
  startMenuBomb.t = 0;
  startMenuBombPop.active = false;
  startMenuBombPop.t = 0;
  startMenuNpc.active = false;
  startMenuNpc.state = 'idle';
  startMenuNpc.bounceLeft = 0;
  startMenuNpc.jumpReady = false;
  startMenuNpc.biteT = 0;
  startMenuBurst.active = false;
  startMenuBurst.t = 0;
  startMenuBurst.particles.length = 0;
  startMenuLineBurst.active = false;
  startMenuLineBurst.t = 0;
  startMenuLineBurst.puffs.length = 0;
  startMenuNpcShatter.active = false;
  startMenuNpcShatter.pieces.length = 0;
  death100ToastActive = false;
  gameOverNoSeq.active = false;
  gameOverNoSeq.phase = 'cut';
  gameOverNoSeq.t = 0;
};

const beginSplashScreens = () => {
  splash.phase = 'company';
  splash.t = 0;
  splash.fading = false;
  splash.hold = false;
  splashFadeOverlay.active = false;
  splashFadeOverlay.t = 0;
  gameState.value = 'splashCompany';
};

const advanceSplash = () => {
  if (splash.phase === 'company') {
    splash.phase = 'loading';
    splash.t = 0;
    splash.fading = false;
    splash.hold = false;
    gameState.value = 'splashLoading';
  } else {
    splash.fading = true;
    splash.hold = false;
    splash.t = 0;
  }
};

const beginGame = () => {
  resetGameVars();
  spawnDustDelay = 0.3;
  spawnDustPending = true;
  applyHudMode();
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
  gameOverFinal.active = false;
  gameOverFinal.t = 0;
  gameOverNoSeq.active = true;
  gameOverNoSeq.phase = 'cut';
  gameOverNoSeq.t = 0;
  try {
    levelMusic.audio.pause();
    levelMusic.audio.currentTime = 0;
  } catch {}
  try {
    arcadeMusic.audio.pause();
    arcadeMusic.audio.currentTime = 0;
  } catch {}
  try {
    dialogueMusic.audio.pause();
    dialogueMusic.audio.currentTime = 0;
  } catch {}
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
  playStageClearedSfx();
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
  if (isArcade()) {
    beginGame();
    return;
  }
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

const startStartTransition = (scrollOnly = false) => {
  startScrollOnly = scrollOnly;
  if (!scrollOnly) {
    if (isArcade()) {
      levelMusic.pending = false;
      levelMusic.delay = 0;
      levelMusic.fade = 0;
      levelMusic.fading = false;
      try { levelMusic.audio.pause(); } catch {}
      arcadeMusic.pending = true;
      arcadeMusic.delay = 1.5;
      arcadeMusic.fade = 0;
      arcadeMusic.fading = false;
      try {
        arcadeMusic.audio.currentTime = 0;
        arcadeMusic.audio.volume = arcadeMusic.baseVol;
      } catch {
        // ignore
      }
    } else {
      arcadeMusic.pending = false;
      arcadeMusic.delay = 0;
      arcadeMusic.fade = 0;
      arcadeMusic.fading = false;
      try { arcadeMusic.audio.pause(); } catch {}
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
    }
  }
  if (scrollOnly) {
    playBombLeavesSfx();
    startTitleHidden = true;
    startTitleFade = 1;
    startScrollPending = true;
    startScrollDelay = 0;
  } else {
    screenAnim.active = true;
    screenAnim.t = 0;
    screenAnim.dur = 0.45;
    gameState.value = 'startTransition';
  }
};

const getStartMenuNpcEatTarget = () => {
  const dir = startMenuNpc.mouth?.dir ?? Math.PI;
  const flipX = Math.cos(dir) < 0;
  const angle = flipX ? (Math.PI - dir) : dir;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const offX = (flipX ? -1 : 1) * startMenuNpc.r * 0.4;
  const offY = startMenuNpc.r * 0.1;
  return {
    x: startMenuNpc.x + offX * cos - offY * sin,
    y: startMenuNpc.y + offX * sin + offY * cos,
  };
};

const distToSegment = (ax, ay, bx, by, px, py) => {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const abLen2 = (abx * abx) + (aby * aby);
  if (abLen2 <= 0.000001) return Math.hypot(apx, apy);
  const t = clamp((apx * abx + apy * aby) / abLen2, 0, 1);
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  return Math.hypot(px - cx, py - cy);
};

const startStoryBombSequence = (button) => {
  startMenuHidden = true;
  startMenuKeepId = 'story';
  startMenuPressedId = null;
  startGamePending = false;
  startGameDelay = 0;
  startMenuBoom = 0;
  startMenuBomb.active = true;
  startMenuBomb.state = 'idle';
  startMenuBomb.t = 0;
  startMenuBombPop.active = true;
  startMenuBombPop.t = 0;
  startMenuBomb.x = button.x + button.w * 0.5;
  startMenuBomb.y = button.y + button.h * 0.5;
  startMenuBomb.r = Math.max(18, button.h * START_MENU_BOMB_SCALE);
  startMenuBomb.x0 = startMenuBomb.x;
  startMenuBomb.y0 = startMenuBomb.y;
  startMenuBomb.r0 = startMenuBomb.r;
  startMenuBurst.active = false;
  startMenuBurst.t = 0;
  startMenuBurst.particles.length = 0;
  startMenuLineBurst.active = false;
  startMenuLineBurst.t = 0;
  startMenuLineBurst.puffs.length = 0;
  startMenuNpc.active = true;
  startMenuNpc.state = 'enter';
  startMenuNpc.r = Math.max(16, button.h * 0.55);
  startMenuNpc.x = innerWidth + startMenuNpc.r + 40;
  startMenuNpc.baseY = startMenuBomb.y + startMenuNpc.r * 0.15;
  startMenuNpc.y = startMenuNpc.baseY;
  startMenuNpc.vx = -Math.max(START_MENU_NPC_SPEED, innerWidth * 0.45);
  startMenuNpc.vy = 0;
  startMenuNpc.t = 0;
  startMenuNpc.bounceLeft = START_MENU_NPC_BOUNCES;
  startMenuNpc.jumpReady = true;
  startMenuNpc.biteT = 0;
  startMenuNpc.biteDir = Math.PI;
  startMenuNpc.mouth.open = 0;
  startMenuNpc.mouth.dir = Math.PI;
  startMenuNpc.mouth.pulseT = 1;
  startMenuNpc.mouth.cooldown = 0;
};

const triggerStartMenuExplosion = () => {
  if (!startMenuBomb.active) return;
  const x = startMenuBomb.x;
  const y = startMenuBomb.y;
  const r = startMenuBomb.r0 || startMenuBomb.r;
  startMenuBomb.active = false;
  startMenuKeepId = null;
  if (startMenuNpc.active) {
    startMenuNpcShatterAt(startMenuNpc.x, startMenuNpc.y, startMenuNpc.r);
    startMenuNpc.active = false;
    startMenuNpc.state = 'idle';
  }
  startMenuBoom = START_MENU_SHAKE_DUR;
  startLineBurst(startMenuLineBurst, x, y, rand, Math.max(0.7, r / 18), 0.2);
  startBurst(startMenuBurst, x, y, rand, 0.45);
  playEatBombSfx();
  playBossExplosionSfx();
  startGamePending = true;
  startGameDelay = 1.0;
};

const startRestartTransition = () => {
  beginGame();
};

const updateCheckpointProgress = () => {
  if (isArcade()) return;
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
      playBossBonusSfx();
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
    if (isArcade()) return;
    triggerBossOutroSkip();
    return;
  }
  if (e.key === 'k' || e.key === 'K') {
    if (isArcade()) return;
    if (gameState.value === 'playing' || gameState.value === 'cutscene') {
      livesHalf = 0;
      beginGameOver();
    }
    return;
  }
  if (e.key === 'c' || e.key === 'C') {
    if (isArcade() && (gameState.value === 'playing' || gameState.value === 'cutscene')) {
      highScoreArcade = 0;
      highScoreValueEl.textContent = `${highScoreArcade} pts`;
      try { localStorage.setItem('gobblerHighScoreArcade', String(highScoreArcade)); } catch {}
      return;
    }
  }
  if (e.key === 't' || e.key === 'T') {
    if (isArcade() && (gameState.value === 'playing' || gameState.value === 'cutscene')) {
      deathCount = 100;
      playDied100Sequence();
      return;
    }
  }
  if (e.key === 'r' || e.key === 'R') {
    if (isArcade()) return;
    resetGameVars(); beginStartScreen(); return;
  }
  if (isDialogueActive()) { advanceDialogue(); return; }
  if (cutscenePending) return;
  if (e.code === 'Space') {
    e.preventDefault();
    if (gameState.value === 'start') {
      if (!screenAnim.active && !startViewSettled) startStartTransition(true);
    }
    else if (gameState.value === 'stageclear') beginStartScreen();
    else if (!finishExit) inputPress();
  }
  if (e.code === 'Enter') {
    if (isArcade()) return;
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
  if (gameState.value === 'splashCompany' || gameState.value === 'splashLoading') {
    if (gameState.value === 'splashCompany' && !splash.fading) advanceSplash();
    return;
  }
  if (gameState.value === 'start') {
    if (startMenuHidden || startGamePending || startMenuNpc.active) return;
    if (!screenAnim.active && startViewSettled) {
      const buttons = getStartMenuButtons(innerWidth, innerHeight);
      const yAdjusted = y - getStartViewOffset();
      for (const b of buttons) {
        if (x >= b.x && x <= b.x + b.w && yAdjusted >= b.y && yAdjusted <= b.y + b.h) {
          startMenuPressedId = b.id;
          if (b.id === 'story') {
            startMode = 'story';
            applyHudMode();
            startStoryBombSequence(b);
          } else if (b.id === 'arcade') {
            startMode = 'arcade';
            applyHudMode();
            startStartTransition(false);
          }
          return;
        }
      }
    }
    startMenuPressedId = null;
    if (!screenAnim.active && !startViewSettled) startStartTransition(true);
    return;
  }
  if (gameState.value === 'stageclear') { beginStartScreen(); return; }
  if (gameState.value === 'gameover') {
    if (resumeDelay.active) return;
    const buttons = getGameOverButtons(innerWidth, innerHeight);
    for (const b of buttons) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        if (b.id === 'yes') {
          playDuckYeahSfx();
          continueFromGameOver();
        }
        else {
          playGameOver2Sfx();
          startGameOverFinal();
        }
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

addEventListener('pointerup', (ev) => {
  if (gameState.value === 'start') {
    startMenuPressedId = null;
  }
  if (gameState.value === 'playing' || (gameState.value === 'cutscene' && showHealthBar)) inputRelease();
});
addEventListener('pointercancel', () => {
  if (gameState.value === 'start') startMenuPressedId = null;
  if (gameState.value === 'playing' || (gameState.value === 'cutscene' && showHealthBar)) inputRelease();
});
addEventListener('blur', () => { inputRelease(); });

let last = performance.now();
beginSplashScreens();

const tick = (now) => {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  if (gameState.value === 'splashCompany' || gameState.value === 'splashLoading') {
    splash.t += dt;
    if (gameState.value === 'splashLoading' && splash.fading) {
      if (!splash.hold) {
        splash.hold = true;
        splash.t = 0;
      } else if (splash.hold && splash.t >= SPLASH_BLACK_HOLD) {
        beginStartScreen();
        playHomeStartSfx();
        splashFadeOverlay.active = true;
        splashFadeOverlay.t = 0;
      }
    } else {
      const dur = (gameState.value === 'splashCompany') ? SPLASH_COMPANY_DUR : SPLASH_LOADING_DUR;
      if (splash.t >= dur) advanceSplash();
    }
    draw();
    requestAnimationFrame(tick);
    return;
  }

  if (splashFadeOverlay.active) {
    splashFadeOverlay.t = Math.min(1, splashFadeOverlay.t + dt / SPLASH_FADE_DUR);
    if (splashFadeOverlay.t >= 1) splashFadeOverlay.active = false;
  }

  if (startScrollPending && gameState.value === 'start') {
    startScrollDelay = Math.max(0, startScrollDelay - dt);
    if (startScrollDelay <= 0) {
      startScrollPending = false;
      screenAnim.active = true;
      screenAnim.t = 0;
      screenAnim.dur = 0.45;
      gameState.value = 'startTransition';
    }
  }
  if (startGamePending && gameState.value === 'start' && !screenAnim.active) {
    startGameDelay = Math.max(0, startGameDelay - dt);
    if (startGameDelay <= 0) {
      startGamePending = false;
      startStartTransition(false);
    }
  }
  if (startTitleHidden && startTitleFade > 0) {
    startTitleFade = Math.max(0, startTitleFade - (dt / START_TITLE_FADE_DUR));
  }
  if (startMenuBoom > 0) {
    startMenuBoom = Math.max(0, startMenuBoom - dt);
  }
  if (startMenuBombPop.active) {
    startMenuBombPop.t = Math.min(1, startMenuBombPop.t + dt / START_MENU_BOMB_POP_DUR);
    if (startMenuBombPop.t >= 1) startMenuBombPop.active = false;
  }
  if (startMenuBurst.active) updateBurst(startMenuBurst, dt, clamp);
  if (startMenuLineBurst.active) updateLineBurst(startMenuLineBurst, dt, clamp);
  if (startMenuNpcShatter.active) updateShatter(startMenuNpcShatter, dt);
  if (startMenuNpc.active && (gameState.value === 'start' || gameState.value === 'startTransition')) {
    const targetAngle = startMenuBomb.active
      ? Math.atan2(startMenuBomb.y - startMenuNpc.y, startMenuBomb.x - startMenuNpc.x)
      : Math.PI;
    if (startMenuNpc.biteT > 0) {
      startMenuNpc.biteT = Math.max(0, startMenuNpc.biteT - dt);
      startMenuNpc.mouth.dir = lerpAngle(startMenuNpc.mouth.dir, startMenuNpc.biteDir, 1 - Math.pow(0.000001, dt));
    } else {
      startMenuNpc.mouth.dir = lerpAngle(startMenuNpc.mouth.dir, targetAngle, 1 - Math.pow(0.001, dt));
    }
    updateMouth(startMenuNpc.mouth, dt, MOUTH, clamp);
    if (startMenuNpc.state === 'enter') {
      startMenuNpc.prevX = startMenuNpc.x;
      startMenuNpc.prevY = startMenuNpc.y;
      startMenuNpc.x += startMenuNpc.vx * dt;
      startMenuNpc.t += dt;
      if (startMenuNpc.jumpReady && startMenuNpc.bounceLeft > 0 && startMenuBomb.active) {
        const capture = startMenuNpc.r + startMenuBomb.r + EAT.capturePad;
        const d = dist(startMenuNpc.x, startMenuNpc.y, startMenuBomb.x, startMenuBomb.y);
        if (d > capture * 1.4) {
          startMenuNpc.vy = START_MENU_NPC_BOUNCE_VY;
          startMenuNpc.jumpReady = false;
          startMenuNpc.bounceLeft -= 1;
          playJumpSfx();
        }
      }
      startMenuNpc.y += startMenuNpc.vy * dt;
      startMenuNpc.vy += START_MENU_NPC_GRAVITY * dt;
      if (startMenuNpc.y >= startMenuNpc.baseY) {
        startMenuNpc.y = startMenuNpc.baseY;
        startMenuNpc.vy = 0;
        startMenuNpc.jumpReady = true;
      }
      const capture = startMenuNpc.r + startMenuBomb.r + EAT.capturePad;
      const d = distToSegment(startMenuNpc.prevX, startMenuNpc.prevY, startMenuNpc.x, startMenuNpc.y, startMenuBomb.x, startMenuBomb.y);
      if (startMenuBomb.active && startMenuBomb.state === 'idle' && d <= capture) {
        startMenuNpc.state = 'bite';
        startMenuNpc.t = 0;
        startMenuNpc.biteDir = targetAngle;
        startMenuNpc.biteT = START_MENU_NPC_BITE_SNAP;
        triggerChomp(startMenuNpc.mouth, MOUTH);
        startMenuBomb.state = 'eaten';
        startMenuBomb.t = 0;
        startMenuBomb.x0 = startMenuBomb.x;
        startMenuBomb.y0 = startMenuBomb.y;
        startMenuBomb.r0 = startMenuBomb.r;
      }
    } else if (startMenuNpc.state === 'bite') {
      startMenuNpc.t += dt;
      startMenuNpc.x += startMenuNpc.vx * dt;
      startMenuNpc.y += startMenuNpc.vy * dt;
      startMenuNpc.vy += START_MENU_NPC_GRAVITY * dt;
      if (startMenuNpc.y >= startMenuNpc.baseY) {
        startMenuNpc.y = startMenuNpc.baseY;
        startMenuNpc.vy = 0;
      }
    } else if (startMenuNpc.state === 'exit') {
      startMenuNpc.x += startMenuNpc.vx * dt;
      startMenuNpc.y += startMenuNpc.vy * dt;
      startMenuNpc.vy += 900 * dt;
      if (startMenuNpc.x < -startMenuNpc.r - 80 || startMenuNpc.y > innerHeight + startMenuNpc.r) {
        startMenuNpc.active = false;
      }
    }
  }
  if (startMenuBomb.active && startMenuBomb.state === 'eaten') {
    const target = getStartMenuNpcEatTarget();
    startMenuBomb.t = clamp(startMenuBomb.t + dt / EAT.swallowDur, 0, 1);
    const tt = easeInOut(startMenuBomb.t);
    startMenuBomb.x = lerp(startMenuBomb.x0, target.x, tt);
    startMenuBomb.y = lerp(startMenuBomb.y0, target.y, tt);
    startMenuBomb.r = lerp(startMenuBomb.r0, 0, tt);
    if (startMenuBomb.t >= 1) {
      startMenuBomb.state = 'gone';
      triggerStartMenuExplosion();
    }
  }

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
  if (arcadeMusic.pending) {
    arcadeMusic.delay = Math.max(0, arcadeMusic.delay - dt);
    if (arcadeMusic.delay <= 0) {
      arcadeMusic.pending = false;
      try {
        arcadeMusic.audio.volume = arcadeMusic.baseVol;
        arcadeMusic.audio.play();
      } catch {
        // ignore autoplay restrictions
      }
    }
  }
  if (arcadeMusic.fading) {
    arcadeMusic.fade = Math.max(0, arcadeMusic.fade - dt);
    const t = (arcadeMusic.fadeDur > 0) ? (arcadeMusic.fade / arcadeMusic.fadeDur) : 0;
    arcadeMusic.audio.volume = arcadeMusic.baseVol * t;
    if (arcadeMusic.fade <= 0) {
      arcadeMusic.fading = false;
      try { arcadeMusic.audio.pause(); } catch {}
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
      if (gameState.value === 'startTransition') {
        screenAnim.active = false;
        if (startScrollOnly) {
          startViewSettled = true;
          startScrollOnly = false;
          gameState.value = 'start';
        } else {
          beginGame();
        }
      }
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
    const maxScroll = (gameState.value === 'cutscene' || isArcade()) ? Infinity : finishStopX;
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

    if (!isArcade() && gameState.value === 'playing' && !finishExit && scrollX >= finishStopX - 1) {
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

    if (isDialogueActive()) {
      const entry = dialogueScript[dialogueIndex];
      if (entry) {
        dialogueMouth.t += dt * dialogueMouth.speed;
        const tt = (Math.sin(dialogueMouth.t) + 1) * 0.5;
        const talkOpen = lerp(dialogueMouth.min, dialogueMouth.max, tt);
        if (entry.speaker === 'FURY') {
          player.mouth.open = talkOpen;
          boss.mouth = 0;
        } else if (entry.speaker === 'RED') {
          boss.mouth = talkOpen;
          player.mouth.open = 0;
        }
      }
    } else {
      dialogueMouth.t = 0;
      boss.mouth = 0;
    }

    if (gameState.value === 'cutscene') {
      if (!player._beingEaten) boss.r = player.r;

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
      if (player._beingEaten.eater) {
        const eater = player._beingEaten.eater;
        const dir = eater.mouth?.dir ?? 0;
        const flipX = Math.cos(dir) < 0;
        const angle = flipX ? (Math.PI - dir) : dir;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const inset = player._beingEaten.inset || 0;
        const offX = (flipX ? -1 : 1) * (player._beingEaten.offX + inset);
        const offY = player._beingEaten.offY;
        const tx = eater.x + offX * cos - offY * sin;
        const ty = eater.y + offX * sin + offY * cos;
        player.x = lerp(player._beingEaten.x0, tx, tt);
        player.y = lerp(player._beingEaten.y0, ty, tt);
      } else {
        player.x = lerp(player._beingEaten.x0, player._beingEaten.tx, tt);
        player.y = lerp(player._beingEaten.y0, player._beingEaten.ty, tt);
      }
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
  } else if (gameState.value === 'gameoverFinal') {
    if (gameOverNoSeq.active) {
      gameOverNoSeq.t += dt;
      if (gameOverNoSeq.phase === 'cut' && gameOverNoSeq.t >= GAMEOVER_NO_BLACK_HOLD) {
        gameOverNoSeq.phase = 'fadeIn';
        gameOverNoSeq.t = 0;
      } else if (gameOverNoSeq.phase === 'fadeIn' && gameOverNoSeq.t >= GAMEOVER_NO_FADE_IN) {
        gameOverNoSeq.phase = 'show';
        gameOverNoSeq.t = 0;
      } else if (gameOverNoSeq.phase === 'show' && gameOverNoSeq.t >= GAMEOVER_NO_SHOW) {
        gameOverNoSeq.phase = 'fadeOut';
        gameOverNoSeq.t = 0;
      } else if (gameOverNoSeq.phase === 'fadeOut' && gameOverNoSeq.t >= GAMEOVER_NO_FADE_OUT) {
        gameOverNoSeq.active = false;
        beginStartScreen();
      }
    } else if (gameOverFinal.active) {
      gameOverFinal.t = Math.min(gameOverFinal.dur, gameOverFinal.t + dt);
      if (gameOverFinal.t >= gameOverFinal.dur) {
        gameOverFinal.active = false;
        beginStartScreen();
      }
    }
  }

  draw();
  requestAnimationFrame(tick);
};

const draw = () => {
  const w = innerWidth;
  const h = innerHeight;
  ctx.clearRect(0, 0, w, h);

  if (gameState.value === 'splashCompany' || gameState.value === 'splashLoading') {
    ctx.fillStyle = (gameState.value === 'splashCompany') ? '#fff' : '#000';
    ctx.fillRect(0, 0, w, h);
    const img = (gameState.value === 'splashCompany') ? companyImage : loadingImage;
    const ready = (gameState.value === 'splashCompany') ? companyImageReady : loadingImageReady;
    if (ready) {
      const imgW = img.naturalWidth || 0;
      const imgH = img.naturalHeight || 0;
      if (imgW > 0 && imgH > 0) {
        const scale = Math.min(w / imgW, h / imgH);
        const drawW = imgW * scale;
        const drawH = imgH * scale;
        const x = (w - drawW) * 0.5;
        const y = (h - drawH) * 0.5;
        ctx.drawImage(img, x, y, drawW, drawH);
      }
    }
    if (gameState.value === 'splashLoading') {
      if (splash.fading) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);
        return;
      }
      const progress = clamp(splash.t / SPLASH_LOADING_DUR, 0, 1);
      const barW = Math.min(420, w * 0.6);
      const barH = 8;
      const bx = (w - barW) * 0.5;
      const by = h * 0.82;
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(bx, by, barW, barH);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(bx, by, barW * progress, barH);
    }
    return;
  }

  const startOffset = getStartViewOffset();
  const renderGroundY = groundY() + startOffset;
  const bgScrollX = drawBackdrop(ctx, w, h, renderGroundY, scrollX, menuScrollX, gameState.value, bossOutro.blackBackdrop, starsFar, bgCache);

  const bossShake = (bossOutro.active && (bossOutro.phase === 'boom' || bossOutro.phase === 'explode')) ? 6 : 0;
  const menuShake = (startMenuBoom > 0) ? (START_MENU_SHAKE_AMP * (startMenuBoom / START_MENU_SHAKE_DUR)) : 0;
  const shakeAmp = Math.max(bossShake, menuShake);
  if (shakeAmp > 0) {
    ctx.save();
    ctx.translate(rand(-shakeAmp, shakeAmp), rand(-shakeAmp, shakeAmp));
  }

  if (gameState.value !== 'stageclear' && gameState.value !== 'gameoverFinal') {
    drawGround(ctx, renderGroundY, w, h, bgScrollX);
  }

  drawWorldEntities(ctx, w, h, renderState, worldRenderDeps);

  if (shakeAmp > 0) ctx.restore();

  drawUI(ctx, w, h, renderState, uiRenderDeps);
  setRickRollVisible(isArcade() && death100ToastActive && deathCount >= 100);

  if (splashFadeOverlay.active) {
    const a = 1 - splashFadeOverlay.t;
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
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
    const baseA = (gameState.value === 'startTransition' && startScrollOnly) ? 1 : getScreenAlpha();
    const titleA = baseA * (startTitleHidden ? startTitleFade : 1);
    if (!startViewSettled) {
      const titleSlide = (gameState.value === 'startTransition' && startScrollOnly)
        ? (easeInOut(clamp(screenAnim.t, 0, 1)) * (h * 0.45))
        : 0;
      const tapFontSize = 20;
      const gapPx = (h * 0.04) + 95;
      if (titleImageReady) {
        const imgW = titleImage.naturalWidth || 0;
        const imgH = titleImage.naturalHeight || 0;
        if (imgW > 0 && imgH > 0) {
          const scale = 0.5;
          const drawW = imgW * scale;
          const drawH = imgH * scale;
          const x = (w - drawW) * 0.5;
          const groupTop = (h * 0.5) - ((drawH + gapPx + tapFontSize) * 0.5);
          const y = groupTop + (drawH * 0.5) - titleSlide;
          ctx.save();
          ctx.globalAlpha = titleA;
          ctx.drawImage(titleImage, x, y, drawW, drawH);
          ctx.restore();
        }
      } else {
        const groupTop = (h * 0.5) - ((54 + gapPx + tapFontSize) * 0.5);
        ctx.save();
        ctx.translate(0, -titleSlide + (groupTop - (h * 0.5)));
        drawScreenText(ctx, w, h, "FOR DUCK'S SAKE", '', '', titleA);
        ctx.restore();
      }

      ctx.save();
      const tapScale = 1 + Math.sin(waveT * 4.8) * 0.08;
      const tapA = startTitleHidden ? 0 : baseA;
      ctx.globalAlpha = tapA;
      ctx.fillStyle = 'rgba(242, 244, 247, 1)';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `600 ${tapFontSize}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
      ctx.lineWidth = 4;
      const subY = (h * 0.5) + ((gapPx + tapFontSize) * 0.5) - titleSlide;
      ctx.save();
      ctx.translate(w * 0.5, subY);
      ctx.scale(tapScale, tapScale);
      ctx.translate(-w * 0.5, -subY);
      ctx.strokeText('TAP TO START', w * 0.5, subY);
      ctx.fillText('TAP TO START', w * 0.5, subY);
      ctx.restore();
      ctx.restore();
    }
    ctx.save();
    ctx.translate(0, getStartViewOffset());
    drawStartMenuChoice(ctx, w, h, baseA);
    ctx.restore();
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

  if (gameOverNoSeq.active) {
    let a = 0;
    if (gameOverNoSeq.phase === 'cut') a = 1;
    else if (gameOverNoSeq.phase === 'fadeIn') a = 1 - easeInOut(clamp(gameOverNoSeq.t / GAMEOVER_NO_FADE_IN, 0, 1));
    else if (gameOverNoSeq.phase === 'fadeOut') a = easeInOut(clamp(gameOverNoSeq.t / GAMEOVER_NO_FADE_OUT, 0, 1));
    if (a > 0) {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
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
    'P: pause/resume',
  ];
  if (!isArcade()) {
    lines.push('B: boss outro');
    lines.push('R: reset to start');
    lines.push('K: game over (test)');
    lines.push('ENTER: warp near finish');
  } else {
    lines.push('C: reset high score');
    lines.push('T: test 100 deaths');
  }
  lines.push('SPACE: tap / flap');
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
  const btnH = 32;
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
  const titleY = h * 0.4;
  if (continueImageReady) {
    const imgW = continueImage.naturalWidth || 0;
    const imgH = continueImage.naturalHeight || 0;
    if (imgW > 0 && imgH > 0) {
      const maxW = Math.min(w * 0.8, 520);
      const maxH = Math.min(h * 0.18, 120);
      const scale = Math.min(maxW / imgW, maxH / imgH);
      const drawW = imgW * scale;
      const drawH = imgH * scale;
      ctx.drawImage(continueImage, cx - drawW * 0.5, titleY - drawH * 0.5, drawW, drawH);
    }
  } else {
    ctx.fillStyle = '#f2f4f7';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.lineWidth = 6;
    ctx.font = '800 52px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.strokeText('CONTINUE?', cx, titleY);
    ctx.fillText('CONTINUE?', cx, titleY);
  }

  ctx.lineWidth = 3;
  const buttons = getGameOverButtons(w, h);
  const yesLabel = insertMode ? `INSERT COINS (${COINS_MAX})` : 'DUCK YEAH!';
  for (const b of buttons) {
    const label = (b.id === 'yes') ? yesLabel : b.label;
    drawStartMenuNeonButton(ctx, b, label, false);
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

const renderState = {
  gameState,
  get startMode() { return startMode; },
  bossOutro,
  boss,
  player,
  npcs,
  reds,
  blues,
  burst,
  headShatter,
  npcShatter,
  lineBurst,
  bossExplosions,
  floaters,
  sparkles,
  dustPuffs,
  finishFadeEntities,
  scoreFade,
  get waveT() { return waveT; },
  get showHealthBar() { return showHealthBar; },
  get cinematicUiHidden() { return cinematicUiHidden; },
  get checkpointToastT() { return checkpointToastT; },
  get death100ToastActive() { return death100ToastActive; },
  get deathCount() { return deathCount; },
  get dialogueIndex() { return dialogueIndex; },
  get dialogueScriptLength() { return dialogueScript.length; },
};

const worldRenderDeps = {
  drawCheckpointFlags,
  drawDynamiteBomb,
  drawStar,
  drawStarSpecks,
  drawCharacter,
  drawPlayer2,
  DEFAULT_PALETTE,
  BOSS_PALETTE,
  drawDustPuffs,
  drawFloaters,
  drawBurst,
  drawShatter,
  drawSparkles,
  drawLineBurst,
  lerp,
  clamp,
  easeInOut,
  rand,
};

const uiRenderDeps = {
  groundY,
  setBossTimerVisible,
  drawProgressBar,
  drawHealthBar,
  drawLivesHud,
  drawDialogueBox,
  isDialogueActive,
  clamp,
  easeInOut,
};

const roundRectPath = (c, x, y, w, h, r) => {
  const rr = Math.max(0, Math.min(r, w * 0.5, h * 0.5));
  c.beginPath();
  c.moveTo(x + rr, y);
  c.lineTo(x + w - rr, y);
  c.arcTo(x + w, y, x + w, y + rr, rr);
  c.lineTo(x + w, y + h - rr);
  c.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  c.lineTo(x + rr, y + h);
  c.arcTo(x, y + h, x, y + h - rr, rr);
  c.lineTo(x, y + rr);
  c.arcTo(x, y, x + rr, y, rr);
  c.closePath();
};

const drawStartMenuButtonSheen = (c, x, y, w, h, r, innerInset) => {
  const clipX = x + innerInset;
  const clipY = y + innerInset;
  const clipW = w - innerInset * 2;
  const clipH = h - innerInset * 2;
  const clipR = r - innerInset;
  const topBandH = h * 0.12;
  const bottomBandH = h * 0.1;
  const topBandY = y + innerInset * 1.1;
  const bottomBandY = y + h - innerInset * 1.1 - bottomBandH;
  c.save();
  roundRectPath(c, clipX, clipY, clipW, clipH, clipR);
  c.clip();

  if (START_MENU_BUTTON_SHADING === 'solid') {
    c.fillStyle = 'rgba(255,255,255,0.45)';
    roundRectPath(
      c,
      x + innerInset * 1.4,
      topBandY,
      w - innerInset * 2.8,
      topBandH,
      r - innerInset * 1.1
    );
    c.fill();

    c.fillStyle = 'rgba(0,0,0,0.22)';
    roundRectPath(
      c,
      x + innerInset * 1.2,
      bottomBandY,
      w - innerInset * 2.4,
      bottomBandH,
      r - innerInset * 1.2
    );
    c.fill();
    c.restore();
    return;
  }

  const highlightGrad = c.createLinearGradient(0, y, 0, y + h);
  const topStop = Math.max(0.15, Math.min(0.45, (topBandY - y + topBandH) / h));
  const bottomStop = Math.max(0.55, Math.min(0.9, (bottomBandY - y) / h));
  if (START_MENU_BUTTON_SHADING === 'hard') {
    highlightGrad.addColorStop(0, 'rgba(255,255,255,0.55)');
    highlightGrad.addColorStop(topStop, 'rgba(255,255,255,0.55)');
    highlightGrad.addColorStop(Math.min(0.999, topStop + 0.001), 'rgba(255,255,255,0)');
    highlightGrad.addColorStop(1, 'rgba(255,255,255,0)');
  } else {
    highlightGrad.addColorStop(0, 'rgba(255,255,255,0.6)');
    highlightGrad.addColorStop(Math.min(0.9, topStop + 0.35), 'rgba(255,255,255,0)');
  }
  c.save();
  c.fillStyle = highlightGrad;
  roundRectPath(
    c,
    x + innerInset * 1.4,
    y + innerInset * 1.1,
    w - innerInset * 2.8,
    h - innerInset * 2.2,
    r - innerInset * 1.1
  );
  c.fill();
  c.restore();

  const shadeGrad = c.createLinearGradient(0, y, 0, y + h);
  if (START_MENU_BUTTON_SHADING === 'hard') {
    shadeGrad.addColorStop(0, 'rgba(0,0,0,0)');
    shadeGrad.addColorStop(bottomStop, 'rgba(0,0,0,0)');
    shadeGrad.addColorStop(Math.min(0.999, bottomStop + 0.001), 'rgba(0,0,0,0.25)');
    shadeGrad.addColorStop(1, 'rgba(0,0,0,0.25)');
  } else {
    shadeGrad.addColorStop(0, 'rgba(0,0,0,0)');
    shadeGrad.addColorStop(1, 'rgba(0,0,0,0.25)');
  }
  c.save();
  c.fillStyle = shadeGrad;
  roundRectPath(
    c,
    x + innerInset * 1.2,
    y + innerInset * 1.2,
    w - innerInset * 2.4,
    h - innerInset * 2.4,
    r - innerInset * 1.2
  );
  c.fill();
  c.restore();
  c.restore();
};

const buildStartMenuButtonTexture = (w, h) => {
  const glowPad = Math.ceil(Math.max(10, h * 0.32));
  const texW = w + glowPad * 2;
  const texH = h + glowPad * 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(texW * currentDpr);
  canvas.height = Math.ceil(texH * currentDpr);
  const c = canvas.getContext('2d');
  c.setTransform(currentDpr, 0, 0, currentDpr, 0, 0);
  c.clearRect(0, 0, texW, texH);

  const x = glowPad;
  const y = glowPad;
  const r = h * 0.5;
  const outerLine = Math.max(3, h * 0.12);
  const innerInset = Math.max(2, h * 0.08);
  const glowBlur = h * 0.3;

  c.save();
  c.shadowColor = 'rgba(63, 215, 255, 0.85)';
  c.shadowBlur = glowBlur;
  c.lineWidth = outerLine;
  c.strokeStyle = '#44dbff';
  roundRectPath(c, x, y, w, h, r);
  c.stroke();
  c.restore();

  c.save();
  c.lineWidth = Math.max(2, h * 0.08);
  c.strokeStyle = '#6fe9ff';
  roundRectPath(c, x, y, w, h, r);
  c.stroke();
  c.restore();

  const fillGrad = c.createLinearGradient(0, y, 0, y + h);
  fillGrad.addColorStop(0, '#ffc95a');
  fillGrad.addColorStop(0.52, '#ff9f1f');
  fillGrad.addColorStop(1, '#f57f00');
  c.fillStyle = fillGrad;
  roundRectPath(c, x + innerInset, y + innerInset, w - innerInset * 2, h - innerInset * 2, r - innerInset);
  c.fill();

  drawStartMenuButtonSheen(c, x, y, w, h, r, innerInset);

  return { canvas, pad: glowPad };
};

const getStartMenuButtonTexture = (w, h) => {
  const key = `${w}|${h}|${currentDpr}`;
  const cached = startMenuButtonCache.get(key);
  if (cached) return cached;
  const texture = buildStartMenuButtonTexture(w, h);
  startMenuButtonCache.set(key, texture);
  return texture;
};

const getStartMenuTextStyle = (label, maxTextW, height) => {
  const key = `${label}|${Math.round(maxTextW)}|${Math.round(height)}`;
  const cached = startMenuTextCache.get(key);
  if (cached) return cached;
  const fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  const minFontSize = Math.max(12, Math.round(height * 0.3));
  let fontSize = Math.round(height * 0.52);
  let font = `800 ${fontSize}px ${fontFamily}`;
  startMenuTextMeasureCtx.font = font;
  while (startMenuTextMeasureCtx.measureText(label).width > maxTextW && fontSize > minFontSize) {
    fontSize -= 1;
    font = `800 ${fontSize}px ${fontFamily}`;
    startMenuTextMeasureCtx.font = font;
  }
  const style = {
    font,
    strokeWidth: Math.max(2, Math.round(fontSize * 0.14)),
  };
  startMenuTextCache.set(key, style);
  return style;
};

const drawStartMenuNeonButton = (ctx, button, label, pressed) => {
  const { canvas, pad } = getStartMenuButtonTexture(button.w, button.h);
  const pressOffset = pressed ? Math.max(1, Math.round(button.h * 0.06)) : 0;
  ctx.drawImage(
    canvas,
    button.x - pad + pressOffset,
    button.y - pad + pressOffset,
    button.w + pad * 2,
    button.h + pad * 2
  );

  const maxTextW = button.w - Math.max(24, button.h * 0.7);
  const textStyle = getStartMenuTextStyle(label, maxTextW, button.h);
  const textX = button.x + button.w * 0.5 + pressOffset;
  const textY = button.y + button.h * 0.5 + pressOffset;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = textStyle.font;
  ctx.lineWidth = textStyle.strokeWidth;
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.strokeStyle = '#d84a00';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
  ctx.shadowBlur = Math.max(2, Math.round(button.h * 0.12));
  ctx.shadowOffsetY = Math.max(1, Math.round(button.h * 0.05));
  ctx.strokeText(label, textX, textY);
  ctx.fillText(label, textX, textY);
  ctx.restore();
};

const getStartMenuButtons = (w, h) => {
  const btnW = Math.min(520, w * 0.72);
  const btnH = 44;
  const gapY = 45;
  const totalH = btnH * 4 + gapY * 3;
  const x0 = (w - btnW) * 0.5;
  const y0 = (h - totalH) * 0.5;
  return [
    { id: 'story', label: 'STORY', x: x0, y: y0, w: btnW, h: btnH },
    { id: 'arcade', label: 'ARCADE', x: x0, y: y0 + (btnH + gapY), w: btnW, h: btnH },
    { id: 'vs', label: 'VS', x: x0, y: y0 + (btnH + gapY) * 2, w: btnW, h: btnH },
    { id: 'leaderboards', label: 'LEADERBOARDS', x: x0, y: y0 + (btnH + gapY) * 3, w: btnW, h: btnH },
  ];
};

const drawStartMenuChoice = (ctx, w, h, alpha = 1) => {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const buttons = getStartMenuButtons(w, h);
  const hideAllButtons = startMenuHidden && !startMenuKeepId;
  if (!hideAllButtons) {
    for (const b of buttons) {
      if (startMenuHidden && startMenuKeepId && b.id !== startMenuKeepId) continue;
      if (startMenuHidden && startMenuKeepId === 'story' && b.id === 'story' && !startMenuBomb.active) continue;
      const buttonAlpha = (b.id === 'vs' || b.id === 'leaderboards') ? 0.4 : 1;
      ctx.save();
      ctx.globalAlpha = alpha * buttonAlpha;
      const showBomb = (b.id === 'story' && startMenuBomb.active);
      if (showBomb) {
        let popScale = 1;
        if (startMenuBombPop.active) {
          const t = startMenuBombPop.t;
          popScale = 1 + Math.sin(Math.PI * t) * 0.14;
        }
        ctx.save();
        ctx.translate(startMenuBomb.x, startMenuBomb.y);
        ctx.scale(popScale, popScale);
        ctx.translate(-startMenuBomb.x, -startMenuBomb.y);
        drawDynamiteBomb(ctx, startMenuBomb.x, startMenuBomb.y, startMenuBomb.r);
        ctx.save();
        const baseR = startMenuBomb.r0 || startMenuBomb.r;
        const bombScale = baseR > 0 ? (startMenuBomb.r / baseR) : 1;
        ctx.translate(startMenuBomb.x, startMenuBomb.y);
        ctx.scale(bombScale, bombScale);
        ctx.translate(-startMenuBomb.x, -startMenuBomb.y);
        ctx.fillStyle = '#f2f4f7';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.lineWidth = 3;
        let fontSize = 14;
        ctx.font = `700 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
        const maxTextW = startMenuBomb.r * 1.6;
        while (ctx.measureText(b.label).width > maxTextW && fontSize > 10) {
          fontSize -= 1;
          ctx.font = `700 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
        }
        const textY = startMenuBomb.y + (fontSize * 0.05);
        ctx.strokeText(b.label, startMenuBomb.x, textY);
        ctx.fillText(b.label, startMenuBomb.x, textY);
        ctx.restore();
        ctx.restore();
        ctx.restore();
        continue;
      }
      drawStartMenuNeonButton(ctx, b, b.label, startMenuPressedId === b.id);
      ctx.restore();
    }
  }
  if (startMenuNpc.active) {
    drawCharacter(ctx, startMenuNpc.x, startMenuNpc.y, startMenuNpc.r, startMenuNpc.mouth.dir, startMenuNpc.mouth.open, 'neutral', 1);
  }
  if (startMenuNpcShatter.active) drawShatter(ctx, startMenuNpcShatter);
  if (startMenuLineBurst.active) drawLineBurst(ctx, startMenuLineBurst, lerp);
  if (startMenuBurst.active) drawBurst(ctx, startMenuBurst, lerp);
  ctx.restore();
};

requestAnimationFrame(tick);
