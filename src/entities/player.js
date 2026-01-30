import { clamp, lerp } from '../utils/math.js';

const player2Canvas = document.createElement('canvas');
const player2Ctx = player2Canvas.getContext('2d');
export const DEFAULT_PALETTE = {
  body: '#f2d36a',
  bodyAccent: '#e9c85f',
  lips: '#f28b3c',
  eye: '#2f3c14',
  outline: '#e0b954',
};

export const createPlayer = (baseR) => ({
  x: 160,
  y: 0,
  vy: 0,
  r: baseR,
  baseR,
  maxR: Infinity,
  alive: true,
  emotion: 'neutral',
  mouth: { open: 0, dir: 0, pulseT: 1, pulseDur: 0.12, cooldown: 0 },
  _beingEaten: null,
  squashY: 1,
  squashTarget: 1,
});

export const drawPlayer2 = (ctx, x, y, r, dirRad, open01, squashY = 1, palette = DEFAULT_PALETTE, flipX = false, rotate = true) => {
  if (!(r > 0.01)) return;
  const o = clamp(open01, 0, 1);
  const { body, bodyAccent, lips, eye, outline } = palette;

  const pad = r * 0.35;
  const size = Math.ceil(r * 2 + pad * 2);
  if (size <= 0) return;
  if (player2Canvas.width !== size) {
    player2Canvas.width = size;
    player2Canvas.height = size;
  }

  const pctx = player2Ctx;
  pctx.setTransform(1, 0, 0, 1, 0, 0);
  pctx.clearRect(0, 0, size, size);
  pctx.translate(size * 0.5, size * 0.5);

  // Body
  pctx.fillStyle = body;
  pctx.beginPath();
  pctx.arc(0, 0, r, 0, Math.PI * 2);
  pctx.fill();
  if (outline) {
    pctx.strokeStyle = outline;
    pctx.lineWidth = clamp(r * 0.08, 0.5, 6);
    pctx.beginPath();
    pctx.arc(0, 0, Math.max(0, r - pctx.lineWidth * 0.5), 0, Math.PI * 2);
    pctx.stroke();
  }

  // Wing-like mark on the head (soft bean shape).
  const wingW = r * 0.95;
  const wingH = r * 0.6;
  const tx = -r * 0.75;
  const ty = r * 0.38;
  pctx.save();
  pctx.translate(tx, ty);
  pctx.rotate(-1.05);
  pctx.fillStyle = '#eac866';
  drawWing(pctx, 0, 0, wingW, wingH);
  pctx.fill();
  pctx.restore();


  // Mouth geometry (simple bars)
  const mouthW = r * 1.30;
  const mouthY = r * 0.10;
  const mouthX = r * 0.40;
  const barH = r * 0.18;
  const gap = lerp(r * 0.08, r * 0.88, o);
  const mouthRect = { x: mouthX - mouthW * 0.5, y: mouthY - gap * 0.5, w: mouthW, h: gap, r: barH * 0.45 };

  // Mouth cavity: cutout when open, solid black when closed
  if (o > 0.08) {
    pctx.save();
    pctx.globalCompositeOperation = 'destination-out';
    roundRect(pctx, mouthRect.x, mouthRect.y, mouthRect.w, mouthRect.h, mouthRect.r);
    pctx.fill();
    pctx.restore();
  } else {
    pctx.fillStyle = '#000';
    roundRect(pctx, mouthRect.x, mouthRect.y, mouthRect.w, mouthRect.h, mouthRect.r);
    pctx.fill();
  }

  // Teeth (simple blocks)
  pctx.fillStyle = '#f2f4f7';
  const topTeethY = mouthY - gap * 0.5 - barH + barH * 0.90;
  const botTeethY = mouthY + gap * 0.5 - barH * 0.73;
  const teethH = r * 0.14;
  const topCount = o < 0.08 ? 0 : 4;
  const botCount = o < 0.12 ? 0 : 4;
  if (topCount > 0) drawTeethRow(pctx, mouthX - mouthW * 0.34, topTeethY, mouthW * 0.68, teethH, topCount);
  if (botCount > 0) drawTeethRow(pctx, mouthX - mouthW * 0.34, botTeethY, mouthW * 0.68, teethH, botCount);

  // Lips (pink bars) drawn on top so teeth sit behind them
  pctx.fillStyle = lips;
  roundRect(pctx, mouthX - mouthW * 0.5, mouthY - gap * 0.5 - barH, mouthW, barH, barH * 0.45);
  pctx.fill();
  roundRect(pctx, mouthX - mouthW * 0.5, mouthY + gap * 0.5, mouthW, barH, barH * 0.45);
  pctx.fill();

  // Eye (single), clamped above the mouth at small sizes
  pctx.fillStyle = eye;
  const eyeR = r * 0.10;
  const mouthTop = mouthY - gap * 0.5 - barH;
  const eyeY = Math.min(-r * 0.20, mouthTop - eyeR * 1.2);
  pctx.beginPath();
  pctx.arc(r * 0.42, eyeY, eyeR, 0, Math.PI * 2);
  pctx.fill();

  // Idle line (closed mouth seam)
  if (o < 0.08) {
    pctx.strokeStyle = '#000';
    pctx.lineWidth = clamp(r * 0.05, 0.5, 6);
    pctx.lineCap = 'round';
    pctx.beginPath();
    pctx.moveTo(mouthX - mouthW * 0.42, mouthY);
    pctx.lineTo(mouthX + mouthW * 0.42, mouthY);
    pctx.stroke();
  }

  ctx.save();
  ctx.translate(x, y);
  if (squashY !== 1) ctx.scale(1, squashY);
  if (flipX) ctx.scale(-1, 1);
  if (rotate) ctx.rotate(dirRad);
  ctx.drawImage(player2Canvas, -size * 0.5, -size * 0.5, size, size);
  ctx.restore();
};

const drawTeethRow = (c, x, y, w, h, count) => {
  const gap = w * 0.04;
  const toothW = (w - gap * (count - 1)) / count;
  const r = Math.min(toothW, h) * 0.35;
  for (let i = 0; i < count; i++) {
    const tx = x + i * (toothW + gap);
    roundRect(c, tx, y, toothW, h, r);
    c.fill();
  }
};

const roundRect = (c, x, y, w, h, r) => {
  const rr = Math.min(r, w * 0.5, h * 0.5);
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

const roundedPolygon = (c, pts, r) => {
  const n = pts.length;
  c.beginPath();
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i + n - 1) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const v1x = p0.x - p1.x;
    const v1y = p0.y - p1.y;
    const v2x = p2.x - p1.x;
    const v2y = p2.y - p1.y;
    const d1 = Math.hypot(v1x, v1y) || 1;
    const d2 = Math.hypot(v2x, v2y) || 1;
    const rr = Math.min(r, d1 * 0.45, d2 * 0.45);
    const p1a = { x: p1.x + (v1x / d1) * rr, y: p1.y + (v1y / d1) * rr };
    const p1b = { x: p1.x + (v2x / d2) * rr, y: p1.y + (v2y / d2) * rr };
    if (i === 0) c.moveTo(p1a.x, p1a.y);
    else c.lineTo(p1a.x, p1a.y);
    c.quadraticCurveTo(p1.x, p1.y, p1b.x, p1b.y);
  }
  c.closePath();
};

const drawWing = (c, x, y, w, h) => {
  const rx = w * 0.5;
  const ry = h * 0.5;
  c.beginPath();
  c.ellipse(x + rx * 0.08, y, rx, ry, 0, 0, Math.PI * 2);
  c.closePath();
};
