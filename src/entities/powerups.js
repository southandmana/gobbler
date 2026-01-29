export const makeBlue = (x, y, r) => ({ x, y, r, state: 'fly', t: 0, x0: 0, y0: 0, r0: 0 });

export const driftBlues = (blues, move) => {
  for (let i = blues.length - 1; i >= 0; i--) {
    blues[i].x -= move;
    if (blues[i].x < -140) blues.splice(i, 1);
  }
};

export const updateBlues = (blues, player, dt, move, deps) => {
  const { EAT, clamp, easeInOut, lerp, triggerChomp, popText } = deps;
  for (let i = blues.length - 1; i >= 0; i--) {
    const o = blues[i];

    if (o.state === 'fly') {
      o.x -= move;
      if (o.x < -140) { blues.splice(i, 1); continue; }
      if (!player.alive || player._beingEaten) continue;

      const prC = player.r * (0.5 * (1 + player.squashY));
      const capture = prC + o.r + EAT.capturePad;
      const d = deps.dist(player.x, player.y, o.x, o.y);
      if (d <= capture && o.x >= player.x - 10) {
        o.state = 'eaten';
        o.t = 0;
        o.x0 = o.x; o.y0 = o.y; o.r0 = o.r;
        if (deps.onBite) deps.onBite(o.x, o.y);
        triggerChomp(player.mouth, deps.MOUTH);
      }
    } else {
      o.t = clamp(o.t + dt / EAT.swallowDur, 0, 1);
      const tt = easeInOut(o.t);

      o.x = lerp(o.x0, player.x, tt);
      o.y = lerp(o.y0, player.y, tt);
      o.r = lerp(o.r0, 0, tt);

      if (o.t >= 1) {
        blues.splice(i, 1);
        const before = player.r;
        player.r = player.baseR;
        if (player.y > deps.groundY() - (player.r * player.squashY)) player.y = deps.groundY() - (player.r * player.squashY);
        if (player.y + (player.r * player.squashY) < 0) {
          player.y = player.r * player.squashY;
          player.vy = Math.max(0, player.vy);
        }
        if (before !== player.r) {
          popText('SMALL!', player.x, player.y - player.r - 12);
        }
      }
    }
  }
};

export const drawStar = (ctx, x, y, r) => {
  const rr = Math.max(0, r);
  if (rr <= 0) return;

  ctx.save();
  ctx.translate(x, y);

  const spikes = 5;
  const outer = rr * 1.10;
  const inner = rr * 0.70;

  const drawStarPath = (o, i) => {
    ctx.beginPath();
    let rot = -Math.PI / 2;
    const step = Math.PI / spikes;
    ctx.moveTo(Math.cos(rot) * o, Math.sin(rot) * o);
    for (let k = 0; k < spikes; k++) {
      ctx.lineTo(Math.cos(rot + step) * i, Math.sin(rot + step) * i);
      rot += step;
      ctx.lineTo(Math.cos(rot + step) * o, Math.sin(rot + step) * o);
      rot += step;
    }
    ctx.closePath();
  };

  // Dark outline drawn slightly larger so it sits outside the fill.
  drawStarPath(outer * 1.05, inner * 1.05);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(2, rr * 0.18);
  ctx.strokeStyle = '#c9932e';
  ctx.stroke();

  // Fill on top to eliminate the inner dark stroke.
  drawStarPath(outer, inner);
  ctx.fill();

  // Soft highlight stroke.
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1, rr * 0.08);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.stroke();

  ctx.restore();
};
