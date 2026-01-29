import { drawPlayer2 } from './player.js';

const NPC_PALETTE = {
  body: '#4fcfd8',
  bodyAccent: '#49c4cd',
  lips: '#ff8f92',
  eye: '#3f2b00',
};

const resolveFacing = (dirRad) => {
  if (Math.cos(dirRad) >= 0) return { angle: dirRad, flipX: false };
  return { angle: Math.PI - dirRad, flipX: true };
};

export const makeNPC = (x, y, r, pts, worth, MOUTH) => ({
  x,
  y,
  r,
  pts,
  worth,
  vy: (Math.random() * 24) - 12,
  emotion: 'neutral',
  mouth: { open: 0, dir: 0, pulseT: 1, pulseDur: MOUTH.pulseDur, cooldown: 0 },
  state: 'fly',
  t: 0,
  x0: 0,
  y0: 0,
  r0: 0,
});

export const driftNPCs = (npcs, move) => {
  for (let i = npcs.length - 1; i >= 0; i--) {
    npcs[i].x -= move;
    if (npcs[i].x < -220) npcs.splice(i, 1);
  }
};

export const updateNPCs = (npcs, player, dt, move, deps) => {
  const {
    groundY,
    EAT,
    GROW,
    canEat,
    addScore,
    deductScore,
    popText,
    triggerChomp,
    updateMouth,
    clamp,
    lerp,
    easeInOut,
    lerpAngle,
    dist,
  } = deps;

  let nearestDangerDist = Infinity;

  for (let i = npcs.length - 1; i >= 0; i--) {
    const n = npcs[i];

    const angToPlayer = Math.atan2(player.y - n.y, player.x - n.x);
    n.mouth.dir = lerpAngle(n.mouth.dir, angToPlayer, 1 - Math.pow(0.001, dt));
    updateMouth(n.mouth, dt, deps.MOUTH, clamp);

    if (n.state === 'fly') {
      n.x -= move;
      n.y += n.vy * dt;
      if (n.y < 60 || n.y > groundY() - 40) n.vy *= -1;

      if (n.x + n.r < 0) {
        deductScore(n.pts, 40, clamp(n.y, 40, groundY() - 40));
        npcs.splice(i, 1);
        continue;
      }
      if (!player.alive || player._beingEaten) continue;

      const d = dist(player.x, player.y, n.x, n.y);
      const prC = player.r * (0.5 * (1 + player.squashY));
      const capture = prC + n.r + EAT.capturePad;

      const playerCanEat = canEat(player.r, n.r);
      const npcCanEat = canEat(n.r, player.r);

      if (playerCanEat && d < capture + EAT.intentDist) {
        n.emotion = 'fear';
      } else if (npcCanEat && d < capture + EAT.intentDist) {
        n.emotion = 'hungry';
        nearestDangerDist = Math.min(nearestDangerDist, d);
      } else {
        n.emotion = 'neutral';
        if (npcCanEat) nearestDangerDist = Math.min(nearestDangerDist, d);
      }

        if (d <= capture && n.x >= player.x - 10) {
          if (playerCanEat) {
            n.state = 'beingEaten';
            n.t = 0;
            n.x0 = n.x; n.y0 = n.y; n.r0 = n.r;
            n.emotion = 'fear';
            triggerChomp(player.mouth, deps.MOUTH);
            if (deps.onBite) deps.onBite(n.x, n.y);
          } else if (npcCanEat) {
          n.state = 'eatingPlayer';
          n.t = 0;
          n.emotion = 'hungry';
          triggerChomp(n.mouth, deps.MOUTH);
          player._beingEaten = { t: 0, x0: player.x, y0: player.y, r0: player.r, tx: n.x, ty: n.y };
        }
      }
    } else if (n.state === 'beingEaten') {
      n.t = clamp(n.t + dt / EAT.swallowDur, 0, 1);
      const tt = easeInOut(n.t);
      n.x = lerp(n.x0, player.x, tt);
      n.y = lerp(n.y0, player.y, tt);
      n.r = lerp(n.r0, 0, tt);

      if (n.t >= 1) {
        npcs.splice(i, 1);
        addScore(n.pts, player.x, player.y - player.r - 10);
        const grow = GROW.baseStep + GROW.fromRadius(n.r0);
        player.r = clamp(player.r + grow, player.baseR, player.maxR);
        if (player.y > groundY() - (player.r * player.squashY)) player.y = groundY() - (player.r * player.squashY);
      }
    } else if (n.state === 'eatingPlayer') {
      n.x -= move;
      if (n.x < -220) { npcs.splice(i, 1); continue; }
    }
  }

  if (!player._beingEaten && player.alive) {
    player.emotion = (nearestDangerDist < 220) ? 'fear' : 'neutral';
  }
};

export const drawCharacter = (ctx, x, y, r, dirRad, open01, emotion, squashY = 1) => {
  const { angle, flipX } = resolveFacing(dirRad);
  drawPlayer2(ctx, x, y, r, angle, open01, squashY, NPC_PALETTE, flipX, true);
};
