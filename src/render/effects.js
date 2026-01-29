export const createBurst = () => ({ active: false, t: 0, dur: 0.55, x: 0, y: 0, particles: [] });
export const createLineBurst = () => ({
  active: false,
  t: 0,
  dur: 0.42,
  x: 0,
  y: 0,
  scale: 1,
  spikes: [],
  inner: [],
  puffs: [],
});

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

export const startLineBurst = (burst, x, y, rand, scale = 1, dur = 0.42) => {
  burst.active = true;
  burst.t = 0;
  burst.dur = dur;
  burst.x = x;
  burst.y = y;
  burst.scale = scale;
  burst.spikes.length = 0;
  burst.inner.length = 0;
  burst.puffs.length = 0;

  const spikeCount = 12;
  for (let i = 0; i < spikeCount; i++) {
    const a = (i / spikeCount) * Math.PI * 2 + rand(-0.12, 0.12);
    const r = rand(18, 30) * (i % 2 ? 1.0 : 1.25);
    burst.spikes.push({ a, r });
  }

  const innerCount = 10;
  for (let i = 0; i < innerCount; i++) {
    const a = (i / innerCount) * Math.PI * 2 + rand(-0.10, 0.10);
    const r = rand(10, 18);
    burst.inner.push({ a, r });
  }

  const puffCount = 4;
  for (let i = 0; i < puffCount; i++) {
    burst.puffs.push({
      a: rand(0, Math.PI * 2),
      r: rand(10, 16),
      d: rand(18, 32),
    });
  }
};

export const updateBurst = (burst, dt, clamp) => {
  if (!burst.active) return;
  burst.t = clamp(burst.t + dt / burst.dur, 0, 1);
  if (burst.t >= 1) burst.active = false;
};

export const updateLineBurst = (burst, dt, clamp) => {
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
  ctx.strokeStyle = '#f2f4f7';
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
    ctx.fillStyle = '#f2f4f7';
    ctx.fill();
  }
  ctx.globalAlpha = 1;
};

export const drawLineBurst = (ctx, burst, lerp) => {
  const t = burst.t;
  const x = burst.x;
  const y = burst.y;
  const ease = 1 - Math.pow(1 - t, 3);
  const s = lerp(0.25, 1.2, ease) * (burst.scale || 1);
  const a = 1 - t;

  const drawPoly = (pts) => {
    if (!pts.length) return;
    ctx.beginPath();
    const first = pts[0];
    ctx.moveTo(Math.cos(first.a) * first.r, Math.sin(first.a) * first.r);
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      ctx.lineTo(Math.cos(p.a) * p.r, Math.sin(p.a) * p.r);
    }
    ctx.closePath();
  };

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.globalAlpha = a;

  // Soft puffs behind the flash.
  ctx.fillStyle = 'rgba(255, 214, 186, 0.55)';
  for (const p of burst.puffs) {
    ctx.beginPath();
    ctx.arc(Math.cos(p.a) * p.d, Math.sin(p.a) * p.d, p.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Outer spiky flash.
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  drawPoly(burst.spikes);
  ctx.fillStyle = '#ff6b4a';
  ctx.fill();
  ctx.strokeStyle = '#d81818';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Inner warm core.
  drawPoly(burst.inner);
  ctx.fillStyle = '#ffd24a';
  ctx.fill();

  ctx.restore();
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
  ctx.fillStyle = '#f2f4f7';
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
