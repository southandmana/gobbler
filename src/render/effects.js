export const createBurst = () => ({ active: false, t: 0, dur: 0.55, x: 0, y: 0, particles: [] });
export const createShatter = () => ({ active: false, pieces: [] });
export const createLineBurst = () => ({
  active: false,
  t: 0,
  dur: 0.16,
  x: 0,
  y: 0,
  scale: 1,
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

export const startLineBurst = (burst, x, y, rand, scale = 1, dur = 0.16) => {
  burst.active = true;
  burst.t = 0;
  burst.dur = dur;
  burst.x = x;
  burst.y = y;
  burst.scale = scale;
  burst.puffs.length = 0;

  const puffCount = 6;
  for (let i = 0; i < puffCount; i++) {
    burst.puffs.push({
      a: rand(0, Math.PI * 2),
      r: rand(8, 14),
      d: rand(16, 28),
    });
  }
};

export const startHeadShatter = (shatter, x, y, r, rand, palette, groundY, scale = 1, clamp, opts = null) => {
  shatter.active = true;
  shatter.pieces.length = 0;
  const colors = [
    palette.body,
    palette.bodyAccent || palette.body,
    palette.outline || palette.body,
  ];

  const countScale = (opts && opts.countScale) || 1;
  const countMin = (opts && opts.countMin) || 8;
  const countMax = (opts && opts.countMax) || 16;
  const sizeMin = (opts && opts.sizeMin) || 0.06;
  const sizeMax = (opts && opts.sizeMax) || 0.12;
  const maxPieceR = (opts && opts.maxPieceR) || Infinity;
  const fadeDur = (opts && opts.fadeDur) || 0.6;
  const velScale = (opts && opts.velScale) || 1;

  const countRaw = Math.round(r * 0.45 * countScale);
  const count = clamp
    ? clamp(countRaw, countMin, countMax)
    : Math.max(countMin, Math.min(countMax, countRaw));
  for (let i = 0; i < count; i++) {
    const a = rand(0, Math.PI * 2);
    const spd = rand(260, 520) * scale * velScale;
    shatter.pieces.push({
      x,
      y,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd - rand(40, 160),
      r: Math.min(maxPieceR, rand(sizeMin, sizeMax) * r * scale),
      color: colors[i % colors.length],
      outline: palette.outline || null,
      groundY,
      hit: false,
      fadeT: 0,
      fadeDur,
      alpha: 1,
    });
  }
};

export const updateBurst = (burst, dt, clamp) => {
  if (!burst.active) return;
  burst.t = clamp(burst.t + dt / burst.dur, 0, 1);
  if (burst.t >= 1) burst.active = false;
};

export const updateShatter = (shatter, dt) => {
  if (!shatter.active) return;
  const gravity = 900;
  for (let i = shatter.pieces.length - 1; i >= 0; i--) {
    const p = shatter.pieces[i];
    p.vy += gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    const floor = p.groundY - p.r;
    if (p.y > floor) {
      p.y = floor;
      if (!p.hit) p.hit = true;
      p.vy = -p.vy * 0.35;
      p.vx *= 0.65;
      if (Math.abs(p.vy) < 50) p.vy = 0;
    }

    if (p.hit) {
      p.fadeT += dt;
      p.alpha = Math.max(0, 1 - p.fadeT / (p.fadeDur || 0.6));
      if (p.alpha <= 0) {
        shatter.pieces.splice(i, 1);
      }
    }
  }
  if (shatter.pieces.length === 0) shatter.active = false;
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
  ctx.save();
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
  ctx.restore();
};

export const drawShatter = (ctx, shatter) => {
  if (!shatter.active) return;
  ctx.save();
  for (const p of shatter.pieces) {
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    if (p.outline) {
      ctx.strokeStyle = p.outline;
      ctx.lineWidth = Math.max(1, p.r * 0.3);
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0, p.r - ctx.lineWidth * 0.5), 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
};

export const drawLineBurst = (ctx, burst, lerp) => {
  const t = burst.t;
  const x = burst.x;
  const y = burst.y;
  const ease = 1 - Math.pow(1 - t, 3);
  const s = lerp(0.25, 1.2, ease) * (burst.scale || 1);
  const a = 1 - t;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.globalAlpha = a;

  // Soft puffs around the flash.
  ctx.fillStyle = 'rgba(255, 214, 186, 0.55)';
  for (const p of burst.puffs) {
    ctx.beginPath();
    ctx.arc(Math.cos(p.a) * p.d, Math.sin(p.a) * p.d, p.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Round flash body.
  const outerR = lerp(10, 28, ease);
  ctx.beginPath();
  ctx.arc(0, 0, outerR, 0, Math.PI * 2);
  ctx.fillStyle = '#ff6b4a';
  ctx.fill();
  ctx.strokeStyle = '#d81818';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Inner warm core.
  const innerR = lerp(6, 16, ease);
  ctx.beginPath();
  ctx.arc(0, 0, innerR, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd24a';
  ctx.fill();

  ctx.restore();
};

export const createFloaters = () => [];

export const createSparkles = () => ({ particles: [] });

export const startSparkles = (sparkles, x, y, r, rand, count = 10) => {
  const colors = ['#ffd24a', '#ffe2a1', '#f5a623'];
  for (let i = 0; i < count; i++) {
    const a = rand(0, Math.PI * 2);
    const spd = rand(40, 140);
    const life = rand(0.35, 0.6);
    sparkles.particles.push({
      x,
      y,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd - rand(20, 60),
      r0: rand(1.4, 2.8) * Math.max(0.6, r / 24),
      life,
      t: 0,
      color: colors[i % colors.length],
    });
  }
};

export const updateSparkles = (sparkles, dt) => {
  for (let i = sparkles.particles.length - 1; i >= 0; i--) {
    const p = sparkles.particles[i];
    p.t += dt;
    if (p.t >= p.life) {
      sparkles.particles.splice(i, 1);
      continue;
    }
    p.vy += 120 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
};

export const drawSparkles = (ctx, sparkles) => {
  if (!sparkles.particles.length) return;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (const p of sparkles.particles) {
    const tt = p.t / p.life;
    const a = 1 - tt;
    const r = p.r0 * (1 - tt * 0.4);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};

export const createDustPuffs = () => ({ puffs: [] });

export const startDustPuff = (dust, x, y, r, rand) => {
  const flip = rand(-1, 1) < 0 ? -1 : 1;
  const base = r * rand(0.75, 1.05);
  const stepSize = 14;
  const stepDrop = 0.12;
  const steps = Math.max(0, Math.floor((base - 30) / stepSize));
  const sizeAlpha = Math.max(0.2, 1 - steps * stepDrop);
  dust.puffs.push({
    x: x + rand(-4, 4),
    y: y + rand(-3, 3),
    r: base,
    t: 0,
    dur: rand(0.38, 0.5),
    flip,
    seed: rand(0, Math.PI * 2),
    sx: rand(1.45, 1.9),
    sy: rand(0.55, 0.85),
    sizeAlpha,
  });
};

export const updateDustPuffs = (dust, dt) => {
  for (let i = dust.puffs.length - 1; i >= 0; i--) {
    const p = dust.puffs[i];
    p.t += dt;
    if (p.t >= p.dur) dust.puffs.splice(i, 1);
  }
};

export const drawDustPuffs = (ctx, dust, lerp) => {
  if (!dust.puffs.length) return;
  const sizes = [0.2, 0.55, 0.95, 1.25, 1.4, 1.35];
  const alphas = [0.28, 0.45, 0.55, 0.48, 0.34, 0.18];
  ctx.save();
  for (const p of dust.puffs) {
    const t = p.t / p.dur;
    const frame = Math.min(sizes.length - 1, Math.floor(t * sizes.length));
    const a = alphas[frame] * (p.sizeAlpha ?? 1);
    const rise = lerp(0, -p.r * 0.45, t);
    const jitter = Math.sin(p.seed + t * 6) * (p.r * 0.04);
    const r = p.r * sizes[frame];

    const cx = p.x + jitter;
    const cy = p.y + rise;

    // Puffy cloud cluster (Angry Birds-ish).
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(p.sx, p.sy);

    ctx.globalAlpha = a;
    ctx.fillStyle = '#f2e8db';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.arc(p.flip * r * 0.55, r * 0.05, r * 0.7, 0, Math.PI * 2);
    ctx.arc(-p.flip * r * 0.55, r * 0.08, r * 0.68, 0, Math.PI * 2);
    ctx.arc(0, -r * 0.35, r * 0.62, 0, Math.PI * 2);
    ctx.fill();

    // Slight shadow base to add volume.
    ctx.globalAlpha = a * 0.55;
    ctx.fillStyle = '#d7c7b4';
    ctx.beginPath();
    ctx.arc(p.flip * r * 0.2, r * 0.25, r * 0.6, 0, Math.PI * 2);
    ctx.arc(-p.flip * r * 0.35, r * 0.22, r * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
};

export const popText = (floaters, txt, x, y, color = null) => {
  const c = color || (typeof txt === 'string' && txt[0] === '-' ? '#ff2b2b' : '#f2f4f7');
  floaters.push({ x, y, txt, t: 0, color: c });
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
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 16px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  ctx.lineWidth = 3;
  for (const f of floaters) {
    const a = clamp(1 - f.t / 0.75, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = f.color || '#f2f4f7';
    const isDeduct = f.color === '#ff2b2b';
    ctx.strokeStyle = isDeduct ? 'rgba(142,42,42,0.9)' : 'rgba(0,0,0,0.55)';
    ctx.strokeText(f.txt, f.x, f.y);
    ctx.fillText(f.txt, f.x, f.y);
  }
  ctx.restore();
};
