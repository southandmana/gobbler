export const makeRed = (x, y, r) => ({ x, y, r, state: 'fly', t: 0, x0: 0, y0: 0, r0: 0 });

export const driftReds = (reds, move) => {
  for (let i = reds.length - 1; i >= 0; i--) {
    reds[i].x -= move;
    if (reds[i].x < -140) reds.splice(i, 1);
  }
};

export const updateReds = (reds, player, dt, move, deps) => {
  const { EAT, triggerChomp, clamp, easeInOut, lerp, startBurst } = deps;
  for (let i = reds.length - 1; i >= 0; i--) {
    const o = reds[i];

    if (o.state === 'fly') {
      o.x -= move;
      if (o.x < -140) { reds.splice(i, 1); continue; }
      if (!player.alive || player._beingEaten) continue;

      const prC = player.r * (0.5 * (1 + player.squashY));
      const capture = prC + o.r + EAT.capturePad;
      const d = deps.dist(player.x, player.y, o.x, o.y);
      if (d <= capture && o.x >= player.x - 10) {
        o.state = 'eaten';
        o.t = 0;
        o.x0 = o.x; o.y0 = o.y; o.r0 = o.r;
        triggerChomp(player.mouth, deps.MOUTH);
      }
    } else {
      o.t = clamp(o.t + dt / EAT.swallowDur, 0, 1);
      const tt = easeInOut(o.t);

      o.x = lerp(o.x0, player.x, tt);
      o.y = lerp(o.y0, player.y, tt);
      o.r = lerp(o.r0, 0, tt);

      if (o.t >= 1) {
        reds.splice(i, 1);
        player.alive = false;
        startBurst(player.x, player.y, 0.55);
        deps.state.value = 'dying';
        deps.showScore(false);
      }
    }
  }
};

export const drawDynamiteBomb = (ctx, x, y, r) => {
  const rr = Math.max(0, r);
  if (rr <= 0) return;

  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = '#ff2b2b';
  ctx.beginPath();
  ctx.ellipse(0, 0, rr * 1.02, rr * 0.92, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  const bx = -rr * 0.95, by = -rr * 0.18, bw = rr * 1.9, bh = rr * 0.36, br = rr * 0.16;
  ctx.beginPath();
  ctx.moveTo(bx + br, by);
  ctx.lineTo(bx + bw - br, by);
  ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + br);
  ctx.lineTo(bx + bw, by + bh - br);
  ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - br, by + bh);
  ctx.lineTo(bx + br, by + bh);
  ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - br);
  ctx.lineTo(bx, by + br);
  ctx.quadraticCurveTo(bx, by, bx + br, by);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(-rr * 0.28, -rr * 0.30, rr * 0.40, rr * 0.25, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  const fx = rr * 0.35, fy = -rr * 0.58;
  ctx.strokeStyle = '#caa34a';
  ctx.lineWidth = Math.max(2, rr * 0.12);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(fx, fy);
  ctx.quadraticCurveTo(rr * 0.95, -rr * 1.10, rr * 0.68, -rr * 1.38);
  ctx.stroke();

  const sx = rr * 0.68, sy = -rr * 1.38;
  const sparkR = Math.max(2, rr * 0.12);

  ctx.globalAlpha = 0.55;
  ctx.fillStyle = '#ffd24a';
  ctx.beginPath(); ctx.arc(sx, sy, sparkR * 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = '#ffd24a';
  ctx.beginPath(); ctx.arc(sx, sy, sparkR, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = '#ffd24a';
  ctx.lineWidth = Math.max(1.5, rr * 0.06);
  for (let i = 0; i < 6; i++) {
    const a = i * (Math.PI * 2 / 6);
    const r1 = sparkR * 1.4;
    const r2 = sparkR * 2.8;
    ctx.beginPath();
    ctx.moveTo(sx + Math.cos(a) * r1, sy + Math.sin(a) * r1);
    ctx.lineTo(sx + Math.cos(a) * r2, sy + Math.sin(a) * r2);
    ctx.stroke();
  }

  ctx.restore();
};
