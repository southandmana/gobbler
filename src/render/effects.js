export const createBurst = () => ({ active: false, t: 0, dur: 0.55, x: 0, y: 0, particles: [] });

export const startBurst = (burst, x, y, rand, dur = 0.55) => {
  burst.active = true;
  burst.t = 0;
  burst.dur = dur;
  burst.x = x;
  burst.y = y;
  burst.particles.length = 0;

  const n = 14;
  for (let i = 0; i < n; i++) {
    burst.particles.push({
      a: (i / n) * Math.PI * 2 + rand(-0.12, 0.12),
      spd: rand(220, 520),
      r0: rand(2, 4),
    });
  }
};

export const updateBurst = (burst, dt, clamp) => {
  if (!burst.active) return;
  burst.t = clamp(burst.t + dt / burst.dur, 0, 1);
  if (burst.t >= 1) burst.active = false;
};

export const drawBurst = (ctx, burst, lerp) => {
  const t = burst.t;
  const x = burst.x;
  const y = burst.y;

  const ringR = lerp(0, 90, t);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#fff';
  ctx.globalAlpha = 1 - t;
  ctx.beginPath();
  ctx.arc(x, y, ringR, 0, Math.PI * 2);
  ctx.stroke();

  for (const p of burst.particles) {
    const d = p.spd * t;
    const px = x + Math.cos(p.a) * d;
    const py = y + Math.sin(p.a) * d;
    const pr = lerp(p.r0, 0, t);
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }
  ctx.globalAlpha = 1;
};

export const createFloaters = () => [];

export const popText = (floaters, txt, x, y) => {
  floaters.push({ x, y, txt, t: 0 });
};

export const updateFloaters = (floaters, dt) => {
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    f.t += dt;
    f.y -= 28 * dt;
    if (f.t > 0.75) floaters.splice(i, 1);
  }
};

export const drawFloaters = (ctx, floaters, clamp) => {
  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 16px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  for (const f of floaters) {
    const a = clamp(1 - f.t / 0.75, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillText(f.txt, f.x, f.y);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
};
