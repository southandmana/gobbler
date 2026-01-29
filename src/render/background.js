import { clamp } from '../utils/math.js';

export const makeStars = (n, rand) => {
  const s = [];
  for (let i = 0; i < n; i++) s.push({ x: Math.random(), y: Math.random(), r: rand(0.7, 1.8) });
  return s;
};

export const drawStars = (ctx, stars, mul, scrollX, groundY, width) => {
  const off = (scrollX * mul) % width;
  ctx.fillStyle = '#d5d9e8';
  for (const s of stars) {
    const x = (s.x * width - off + width) % width;
    const y = s.y * (groundY - 30);
    ctx.beginPath();
    ctx.arc(x, y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
};

export const drawSky = (ctx, width, height) => {
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, '#1c2230');
  g.addColorStop(0.55, '#2a303b');
  g.addColorStop(1, '#3a3943');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
};

export const drawHills = (ctx, width, groundY, scrollX) => {
  const layers = [
    { base: groundY - 210, amp: 16, wavelength: 680, speed: 0.05, alpha: 1.0, color: '#2b3336' },
    { base: groundY - 165, amp: 20, wavelength: 560, speed: 0.08, alpha: 1.0, color: '#30393c' },
    { base: groundY - 125, amp: 24, wavelength: 460, speed: 0.12, alpha: 1.0, color: '#364042' },
  ];

  const step = 12;
  for (const layer of layers) {
    const k1 = (Math.PI * 2) / layer.wavelength;
    const k2 = (Math.PI * 2) / (layer.wavelength * 0.58);
    const phase = scrollX * layer.speed;
    const baseY = Math.max(20, layer.base);

    const points = [];
    for (let x = 0; x <= width + step; x += step) {
      const xx = x + phase;
      const y = baseY + Math.sin(xx * k1) * layer.amp + Math.sin(xx * k2) * layer.amp * 0.22;
      points.push({ x, y });
    }

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(points[0].x, points[0].y);
    for (let i = 0; i < points.length - 1; i++) {
      const p = points[i];
      const n = points[i + 1];
      const mx = (p.x + n.x) * 0.5;
      const my = (p.y + n.y) * 0.5;
      ctx.quadraticCurveTo(p.x, p.y, mx, my);
    }
    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.lineTo(width, groundY);
    ctx.closePath();
    ctx.globalAlpha = layer.alpha;
    ctx.fillStyle = layer.color;
    ctx.fill();
    ctx.restore();
  }
};

export const drawGround = (ctx, groundY, width, height, scrollX) => {
  const groundH = Math.max(20, height - groundY);
  const colors = ['#2d2827', '#332d2b', '#393230', '#3f3734', '#453c38'];
  const rows = colors.length;
  const rowH = groundH / rows;
  const brickW = Math.max(72, Math.min(140, width * 0.16));
  const hash2 = (x, y) => {
    const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return v - Math.floor(v);
  };

  for (let i = 0; i < rows; i++) {
    const y = groundY + i * rowH;
    const rowBottom = (i === rows - 1) ? (groundY + groundH) : (groundY + (i + 1) * rowH);
    const brickH = Math.max(4, rowBottom - y);
    const rowOffset = (i % 2) * brickW * 0.5;
    const colStart = Math.floor((scrollX - rowOffset - brickW) / brickW);
    const colEnd = Math.floor((scrollX - rowOffset + width + brickW) / brickW);
    for (let col = colStart; col <= colEnd; col += 1) {
      const x = col * brickW + rowOffset - scrollX;
      const colorIndex = Math.floor(hash2(col, i) * colors.length);
      ctx.fillStyle = colors[colorIndex];
      ctx.fillRect(x, y, brickW, brickH);
    }
  }

  // no horizon line
};

export const drawScreenText = (ctx, width, height, title, subtitle, extra, alpha) => {
  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);
  ctx.fillStyle = '#f2f4f7';
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
