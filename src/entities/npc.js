import { drawPlayer2 } from './player.js';

export const NPC_PALETTE = {
  body: '#8bff4a',
  bodyAccent: '#7bea39',
  lips: '#ff8f92',
  eye: null,
  outline: '#6fdb2f',
};

const resolveFacing = (dirRad) => {
  if (Math.cos(dirRad) >= 0) return { angle: dirRad, flipX: false };
  return { angle: Math.PI - dirRad, flipX: true };
};

const clampEntityToBounds = (entity, clamp, groundY) => {
  if (!entity) return;
  const r = Math.max(0, entity.r || 0);
  const minX = r;
  const maxX = Math.max(minX, innerWidth - r);
  const minY = r;
  const maxY = Math.max(minY, groundY() - r);
  entity.x = clamp(entity.x, minX, maxX);
  entity.y = clamp(entity.y, minY, maxY);
};

const clampPlayerToBounds = (player, clamp, groundY) => {
  if (!player) return;
  const r = Math.max(0, player.r || 0);
  const squashY = player.squashY ?? 1;
  const ry = Math.max(0, r * squashY);
  const minX = r;
  const maxX = Math.max(minX, innerWidth - r);
  const minY = ry;
  const maxY = Math.max(minY, groundY() - ry);
  player.x = clamp(player.x, minX, maxX);
  const clampedY = clamp(player.y, minY, maxY);
  if (clampedY !== player.y && clampedY === minY) {
    player.vy = Math.max(0, player.vy || 0);
  }
  player.y = clampedY;
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
    playEatNpcSfx,
    triggerChomp,
    updateMouth,
    clamp,
    lerp,
    easeInOut,
    lerpAngle,
    dist,
  } = deps;
  const playerInvulnerable = !!deps.playerInvulnerable;

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
      const npcCanEat = playerInvulnerable ? false : canEat(n.r, player.r);

      if (playerCanEat && d < capture + EAT.intentDist) {
        n.emotion = 'fear';
      } else if (npcCanEat && d < capture + EAT.intentDist) {
        n.emotion = 'hungry';
        nearestDangerDist = Math.min(nearestDangerDist, d);
      } else {
        n.emotion = 'neutral';
        if (npcCanEat) nearestDangerDist = Math.min(nearestDangerDist, d);
      }

      if (d <= capture) {
        if (n.x >= player.x - 10) {
          if (playerCanEat) {
            n.state = 'beingEaten';
            n.t = 0;
            n.x0 = n.x; n.y0 = n.y; n.r0 = n.r;
            n.emotion = 'fear';
            triggerChomp(player.mouth, deps.MOUTH);
            if (deps.onBite) deps.onBite(n.x, n.y);
            clampEntityToBounds(n, clamp, groundY);
            n.x0 = n.x; n.y0 = n.y;
          } else if (npcCanEat) {
            n.state = 'eatingPlayer';
            n.t = 0;
            n.emotion = 'hungry';
            triggerChomp(n.mouth, deps.MOUTH);
            const { angle, flipX } = resolveFacing(n.mouth.dir);
            const mouthX = (flipX ? -1 : 1) * n.r * 0.40;
            const mouthY = n.r * 0.10;
            player._beingEaten = {
              t: 0,
              x0: player.x,
              y0: player.y,
              r0: player.r,
              eater: n,
              offX: mouthX,
              offY: mouthY,
              inset: Math.min(player.r * 0.35, n.r * 0.45),
            };
            clampEntityToBounds(n, clamp, groundY);
            clampPlayerToBounds(player, clamp, groundY);
            if (player._beingEaten) {
              player._beingEaten.x0 = player.x;
              player._beingEaten.y0 = player.y;
            }
          }
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
        if (playEatNpcSfx) playEatNpcSfx();
        if (deps.onNpcEaten) deps.onNpcEaten(n);
        addScore(n.pts, player.x, player.y - player.r - 10);
        const grow = GROW.baseStep + GROW.fromRadius(n.r0);
        player.r = clamp(player.r + grow, player.baseR, player.maxR);
        clampPlayerToBounds(player, clamp, groundY);
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
  drawPlayer2(ctx, x, y, r, angle, open01, squashY, NPC_PALETTE, flipX, true, null);
};
