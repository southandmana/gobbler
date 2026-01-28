import { clamp } from '../utils/math.js';

export const makeStars = (n, rand) => {
  const s = [];
  for (let i = 0; i < n; i++) s.push({ x: Math.random(), y: Math.random(), r: rand(0.7, 1.8) });
  return s;
};

export const drawStars = (ctx, stars, mul, scrollX, groundY, width) => {
  const off = (scrollX * mul) % width;
  ctx.fillStyle = '#fff';
  for (const s of stars) {
    const x = (s.x * width - off + width) % width;
    const y = s.y * (groundY - 30);
    ctx.beginPath();
    ctx.arc(x, y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
};

export const drawGround = (ctx, groundY, width, scrollX) => {
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, groundY, width, 2);

  const gap = 50;
  const off = scrollX % gap;
  for (let x = -gap; x < width + gap; x += gap) {
    ctx.fillRect(x - off, groundY + 10, 10, 3);
  }
};

export const drawScreenText = (ctx, width, height, title, subtitle, extra, alpha) => {
  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const cx = width / 2;
  const cy = height / 2;

  ctx.font = '800 54px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  ctx.fillText(title, cx, cy - 34);

  if (extra) {
    ctx.font = '800 38px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.fillText(extra, cx, cy + 18);
  }

  ctx.font = '600 20px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  ctx.fillText(subtitle, cx, cy + (extra ? 62 : 34));
  ctx.restore();
};
