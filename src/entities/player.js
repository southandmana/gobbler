import { clamp, lerp } from '../utils/math.js';

const player2Canvas = document.createElement('canvas');
const player2Ctx = player2Canvas.getContext('2d');

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

export const drawPlayer2 = (ctx, x, y, r, dirRad, open01, squashY = 1) => {
  const o = clamp(open01, 0, 1);

  const pad = r * 0.35;
  const size = Math.ceil(r * 2 + pad * 2);
  if (player2Canvas.width !== size) {
    player2Canvas.width = size;
    player2Canvas.height = size;
  }

  const pctx = player2Ctx;
  pctx.setTransform(1, 0, 0, 1, 0, 0);
  pctx.clearRect(0, 0, size, size);
  pctx.translate(size * 0.5, size * 0.5);

  // Body
  pctx.fillStyle = '#57dbe2';
  pctx.beginPath();
  pctx.arc(0, 0, r, 0, Math.PI * 2);
  pctx.fill();

  // Left cheek bump (capsule)
  pctx.fillStyle = '#52cfd6';
  const bumpW = r * 0.36;
  const bumpH = r * 1.20;
  roundRect(pctx, -r * 1.02, -bumpH * 0.45, bumpW, bumpH, bumpW * 0.5);
  pctx.fill();

  // Mouth geometry (simple bars)
  const mouthW = r * 1.30;
  const mouthY = r * 0.10;
  const mouthX = r * 0.40;
  const barH = Math.max(r * 0.18, 6);
  const gap = lerp(r * 0.08, r * 0.88, o);
  const mouthRect = { x: mouthX - mouthW * 0.5, y: mouthY - gap * 0.5, w: mouthW, h: gap, r: barH * 0.45 };

  // Cutout cavity (hole through the body)
  pctx.save();
  pctx.globalCompositeOperation = 'destination-out';
  roundRect(pctx, mouthRect.x, mouthRect.y, mouthRect.w, mouthRect.h, mouthRect.r);
  pctx.fill();
  pctx.restore();

  // Lips (pink bars)
  pctx.fillStyle = '#ff8f92';
  roundRect(pctx, mouthX - mouthW * 0.5, mouthY - gap * 0.5 - barH, mouthW, barH, barH * 0.45);
  pctx.fill();
  roundRect(pctx, mouthX - mouthW * 0.5, mouthY + gap * 0.5, mouthW, barH, barH * 0.45);
  pctx.fill();

  // Teeth (simple blocks)
  pctx.fillStyle = '#fff';
  const topTeethY = mouthY - gap * 0.5 - barH + barH * 0.12;
  const botTeethY = mouthY + gap * 0.5 + barH * 0.05;
  const teethH = Math.max(r * 0.14, 5);
  const topCount = o < 0.08 ? 0 : 4;
  const botCount = o < 0.12 ? 0 : 4;
  if (topCount > 0) drawTeethRow(pctx, mouthX - mouthW * 0.34, topTeethY, mouthW * 0.68, teethH, topCount);
  if (botCount > 0) drawTeethRow(pctx, mouthX - mouthW * 0.34, botTeethY, mouthW * 0.68, teethH, botCount);

  // Eye (single), clamped above the mouth at small sizes
  pctx.fillStyle = '#2f3c14';
  const eyeR = Math.max(r * 0.10, 2.5);
  const mouthTop = mouthY - gap * 0.5 - barH;
  const eyeY = Math.min(-r * 0.20, mouthTop - eyeR * 1.2);
  pctx.beginPath();
  pctx.arc(r * 0.42, eyeY, eyeR, 0, Math.PI * 2);
  pctx.fill();

  // Idle line (closed mouth seam)
  if (o < 0.08) {
    pctx.strokeStyle = '#000';
    pctx.lineWidth = clamp(r * 0.05, 2, 6);
    pctx.lineCap = 'round';
    pctx.beginPath();
    pctx.moveTo(mouthX - mouthW * 0.42, mouthY);
    pctx.lineTo(mouthX + mouthW * 0.42, mouthY);
    pctx.stroke();
  }

  ctx.save();
  ctx.translate(x, y);
  if (squashY !== 1) ctx.scale(1, squashY);
  ctx.rotate(dirRad);
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
