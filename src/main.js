import { PHYS, SQUASH, WORLD, EAT, SCORE, GROW, SPAWN, GAP, MOUTH, BALANCE, TRAIL, WAVE, DDA } from './config.js';
import { clamp, rand, lerp, easeInOut, dist, lerpAngle } from './utils/math.js';
import { makeStars, drawStars, drawGround, drawScreenText } from './render/background.js';
import { createBurst, startBurst, updateBurst, drawBurst, createFloaters, popText, updateFloaters, drawFloaters } from './render/effects.js';
import { createPlayer, drawPlayer2 } from './entities/player.js';
import { updateMouth, triggerChomp } from './entities/mouth.js';
import { makeNPC, updateNPCs, driftNPCs, drawCharacter } from './entities/npc.js';
import { makeRed, updateReds, driftReds, drawDynamiteBomb } from './entities/hazards.js';
import { makeBlue, updateBlues, driftBlues, drawStar } from './entities/powerups.js';

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');

const gameState = { value: 'start' }; // start | startTransition | playing | paused | dying | gameover | restartTransition

const burst = createBurst();
const floaters = createFloaters();

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
const setScore = (n) => { score = n; scoreEl.textContent = String(n); };
const showScore = (show) => { scoreEl.style.display = show ? 'block' : 'none'; };
let waveT = 0;
let reliefActive = false;
let stress = 0;
let stressEase = 0;
let debugHUD = false;
const hudTrack = { init: {}, changed: {}, maxed: {} };
const resetHudTrack = () => {
  hudTrack.init = {};
  hudTrack.changed = {};
  hudTrack.maxed = {};
};
let missLog = [];
let missCount = 0;
let missPoints = 0;
const logMiss = (pts, x, y) => {
  missLog.unshift({ pts, x, y, t: 0 });
  if (missLog.length > 6) missLog.pop();
  missCount += 1;
  missPoints += pts;
};

const pointsForRadius = (r) => clamp(SCORE.fromRadius(r), SCORE.min, SCORE.max);

const addScore = (pts, x, y) => {
  if (!pts) return;
  setScore(score + pts);
  popText(floaters, `+${pts}`, x, y);
};

const deductScore = (pts, x, y) => {
  if (!pts) return;
  setScore(score - pts);
  popText(floaters, `-${pts}`, x, y);
  stress = clamp(stress + DDA.bumpOnMiss, 0, 1);
  if (debugHUD) logMiss(pts, x, y);
};

const difficulty01 = () => clamp(score / 120, 0, 1);
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
const starsNear = makeStars(50, rand);
let scrollX = 0;

const screenAnim = { active: false, t: 0, dur: 0.45 };

const startBurstAt = (x, y, dur = 0.55) => startBurst(burst, x, y, rand, dur);

const resetGameVars = () => {
  npcs.length = 0;
  reds.length = 0;
  blues.length = 0;
  npcT = 0;
  redT = 0;
  blueT = 0;
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
  player.squashY = 1;
  player.squashTarget = 1;

  player.mouth.open = 0;
  player.mouth.dir = 0;
  player.mouth.pulseT = 1;
  player.mouth.pulseDur = MOUTH.pulseDur;
  player.mouth.cooldown = 0;

  burst.active = false;
  burst.t = 0;
  burst.particles.length = 0;

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
};

const beginStartScreen = () => {
  gameState.value = 'start';
  showScore(false);
  screenAnim.active = false;
  burst.active = false;
};

const beginGame = () => {
  resetGameVars();
  showScore(true);
  gameState.value = 'playing';
  updateDifficulty();
  startBurstAt(player.x, player.y, 0.45);
};

const beginGameOver = () => {
  gameState.value = 'gameover';
  showScore(false);
  screenAnim.active = true;
  screenAnim.t = 0;
  screenAnim.dur = 0.45;
  startBurstAt(innerWidth / 2, innerHeight / 2, 0.55);
};

const startStartTransition = () => {
  screenAnim.active = true;
  screenAnim.t = 0;
  screenAnim.dur = 0.45;
  startBurstAt(innerWidth / 2, innerHeight / 2, 0.55);
  gameState.value = 'startTransition';
};

const startRestartTransition = () => {
  screenAnim.active = true;
  screenAnim.t = 0;
  screenAnim.dur = 0.45;
  startBurstAt(innerWidth / 2, innerHeight / 2, 0.55);
  gameState.value = 'restartTransition';
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

const getScreenAlpha = () => {
  if (gameState.value === 'startTransition' || gameState.value === 'restartTransition') {
    const t = screenAnim.t;
    return 1 - easeInOut(t);
  }
  return 1;
};

const flap = () => {
  if (gameState.value !== 'playing' || !player.alive || player._beingEaten) return;
  player.vy = PHYS.flapVy;
};

let inputHeld = false;
let inputHeldAt = 0;

const inputPress = () => {
  if (gameState.value !== 'playing' || !player.alive || player._beingEaten) return;
  if (inputHeld) return;
  inputHeld = true;
  inputHeldAt = performance.now();
};

const inputRelease = () => {
  if (!inputHeld) return;

  const heldMs = performance.now() - inputHeldAt;
  inputHeld = false;
  player.squashTarget = 1;

  if (gameState.value === 'playing' && heldMs <= SQUASH.tapMs) {
    flap();
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
  if (e.key === 'r' || e.key === 'R') {
    resetGameVars(); beginStartScreen(); return;
  }
  if (e.code === 'Space') {
    e.preventDefault();
    if (gameState.value === 'start') startStartTransition();
    else if (gameState.value === 'gameover') startRestartTransition();
    else inputPress();
  }
}, { passive: false });

addEventListener('keyup', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    if (gameState.value === 'playing') inputRelease();
  }
}, { passive: false });

const toCanvasXY = (ev) => {
  const rect = canvas.getBoundingClientRect();
  return { x: (ev.clientX - rect.left), y: (ev.clientY - rect.top) };
};

addEventListener('pointerdown', (ev) => {
  toCanvasXY(ev);
  if (gameState.value === 'start') { startStartTransition(); return; }
  if (gameState.value === 'gameover') { startRestartTransition(); return; }
  if (gameState.value === 'startTransition' || gameState.value === 'restartTransition' || gameState.value === 'dying') return;
  inputPress();
});

addEventListener('pointerup', () => {
  if (gameState.value === 'playing') inputRelease();
});
addEventListener('pointercancel', () => {
  if (gameState.value === 'playing') inputRelease();
});
addEventListener('blur', () => { inputRelease(); });

let last = performance.now();
beginStartScreen();

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

  updateDifficulty();
  scrollX += WORLD.speed * dt;

  updateBurst(burst, dt, clamp);
  updateFloaters(floaters, dt);

  if (screenAnim.active) {
    screenAnim.t = clamp(screenAnim.t + dt / screenAnim.dur, 0, 1);
    if (screenAnim.t >= 1) {
      if (gameState.value === 'startTransition') { screenAnim.active = false; beginGame(); }
      else if (gameState.value === 'restartTransition') { screenAnim.active = false; beginGame(); }
      else screenAnim.active = false;
    }
  }

  if (gameState.value === 'playing') {
    if (inputHeld) {
      const heldMs = performance.now() - inputHeldAt;
      player.squashTarget = (heldMs > SQUASH.tapMs) ? SQUASH.y : 1;
    }

    updateTrail(dt);

    npcT -= dt;
    if (npcT <= 0) {
      if (canSpawnNow()) {
        if (!maybeStartTrail()) spawnNPC();
        npcT = nextInterval('npc');
      } else {
        npcT = 0.05;
      }
    }

    redT -= dt;
    if (redT <= 0) {
      if (canSpawnNow()) { spawnRed(); redT = nextInterval('red'); }
      else redT = 0.08;
    }

    blueT -= dt;
    if (blueT <= 0) {
      if (canSpawnNow()) { spawnBlue(); blueT = nextInterval('blue'); }
      else blueT = 0.10;
    }

    if (!player._beingEaten) {
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

      if (player.y + (player.r * player.squashY) < 0) {
        player.alive = false;
        startBurstAt(player.x, 0, 0.55);
        gameState.value = 'dying';
        showScore(false);
      }
    }

    const move = WORLD.speed * dt;
    updateNPCs(npcs, player, dt, move, {
      groundY,
      EAT,
      GROW,
      MOUTH,
      canEat,
      addScore,
      deductScore,
      popText: (txt, x, y) => popText(floaters, txt, x, y),
      triggerChomp,
      updateMouth,
      clamp,
      lerp,
      easeInOut,
      lerpAngle,
      dist,
    });

    updateReds(reds, player, dt, move, {
      EAT,
      MOUTH,
      triggerChomp,
      clamp,
      easeInOut,
      lerp,
      dist,
      startBurst: startBurstAt,
      state: gameState,
      showScore,
    });

    updateBlues(blues, player, dt, move, {
      EAT,
      MOUTH,
      triggerChomp,
      clamp,
      easeInOut,
      lerp,
      dist,
      popText: (txt, x, y) => popText(floaters, txt, x, y),
      groundY,
    });

    updateMouth(player.mouth, dt, MOUTH, clamp);

    if (player._beingEaten) {
      player._beingEaten.t = clamp(player._beingEaten.t + dt / EAT.swallowDur, 0, 1);
      const tt = easeInOut(player._beingEaten.t);
      player.x = lerp(player._beingEaten.x0, player._beingEaten.tx, tt);
      player.y = lerp(player._beingEaten.y0, player._beingEaten.ty, tt);
      player.r = lerp(player._beingEaten.r0, 0, tt);
      if (player._beingEaten.t >= 1) {
        player.alive = false;
        startBurstAt(player._beingEaten.tx, player._beingEaten.ty, 0.55);
        gameState.value = 'dying';
        showScore(false);
        player._beingEaten = null;
      }
    }

    let best = null, bestD = Infinity;
    for (const n of npcs) {
      if (n.state !== 'fly') continue;
      if (n.x < player.x - 10) continue;
      const d = dist(player.x, player.y, n.x, n.y);
      if (d < bestD) { bestD = d; best = n; }
    }
    const targetAngle = best ? Math.atan2(best.y - player.y, best.x - player.x) : 0;
    player.mouth.dir = lerpAngle(player.mouth.dir, targetAngle, 1 - Math.pow(0.001, dt));
  } else {
    const move = WORLD.speed * dt;
    driftNPCs(npcs, move);
    driftReds(reds, move);
    driftBlues(blues, move);
  }

  if (gameState.value === 'dying') {
    if (!burst.active) beginGameOver();
  }

  draw();
  requestAnimationFrame(tick);
};

const draw = () => {
  const w = innerWidth;
  const h = innerHeight;
  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);

  drawStars(ctx, starsFar, 0.20, scrollX, groundY(), w);
  drawStars(ctx, starsNear, 0.45, scrollX, groundY(), w);

  drawGround(ctx, groundY(), w, scrollX);

  for (const o of reds) {
    drawDynamiteBomb(ctx, o.x, o.y, Math.max(0, o.r));
  }

  ctx.fillStyle = '#2b6cff';
  for (const o of blues) {
    drawStar(ctx, o.x, o.y, Math.max(0, o.r));
  }

  for (const n of npcs) {
    drawCharacter(ctx, n.x, n.y, n.r, n.mouth.dir, n.mouth.open, n.emotion, 1, clamp, lerp);
  }

  if (gameState.value === 'playing' && player.r > 0.3) {
    drawPlayer2(ctx, player.x, player.y, player.r, player.mouth.dir, player.mouth.open, player.squashY);
  }

  drawFloaters(ctx, floaters, clamp);

  if (burst.active) drawBurst(ctx, burst, lerp);

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
      ctx.fillStyle = '#fff';
      ctx.fillText(labelText, boxX + 8, lineY);

      if (line.key === 'relief') {
        ctx.fillStyle = '#fff';
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

      let color = '#fff';
      if (hudTrack.maxed[line.key]) color = '#ffd24a';
      else if (hudTrack.changed[line.key]) color = '#6bc7ff';

      const valueText = `${line.fmt(cur)} / ${line.fmt(max)}`;
      ctx.fillStyle = color;
      ctx.fillText(valueText, boxX + 8 + ctx.measureText(labelText).width, lineY);
    }
    ctx.restore();

    if (missLog.length) {
      ctx.save();
      ctx.fillStyle = '#fff';
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
    drawScreenText(ctx, w, h, 'GOBBLER', 'TAP TO START', '', getScreenAlpha());
  } else if (gameState.value === 'gameover' || gameState.value === 'restartTransition') {
    drawScreenText(ctx, w, h, 'YOU DIED', 'TAP TO RESTART', String(score), getScreenAlpha());
  } else if (gameState.value === 'paused') {
    drawScreenText(ctx, w, h, 'PAUSE', 'PRESS P TO RESUME', '', 1);
  }
};

requestAnimationFrame(tick);
