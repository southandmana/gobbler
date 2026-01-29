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

export const drawSky = (ctx, width, height) => {
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, '#bcd4ff');
  g.addColorStop(0.55, '#e2dbff');
  g.addColorStop(1, '#ffe9f3');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
};

export const drawHills = (ctx, width, groundY, scrollX) => {
  const layers = [
    { base: groundY - 175, amp: 18, wavelength: 520, speed: 0.08, alpha: 0.55 },
    { base: groundY - 135, amp: 22, wavelength: 440, speed: 0.12, alpha: 0.65 },
    { base: groundY - 100, amp: 26, wavelength: 360, speed: 0.18, alpha: 0.75 },
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
    ctx.clip();

    const bands = ['#f7a2b6', '#f9c593', '#f9e5a9', '#bfe8c9', '#b6e6f4', '#c5c7ff'];
    const hillH = Math.max(40, (groundY - baseY) + layer.amp * 1.3);
    const bandH = hillH / bands.length;

    const addSmoothCurve = (pts, offset, forward) => {
      if (forward) {
        for (let i = 0; i < pts.length - 1; i++) {
          const p = pts[i];
          const n = pts[i + 1];
          const mx = (p.x + n.x) * 0.5;
          const my = (p.y + n.y) * 0.5 + offset;
          ctx.quadraticCurveTo(p.x, p.y + offset, mx, my);
        }
        const end = pts[pts.length - 1];
        ctx.lineTo(end.x, end.y + offset);
      } else {
        for (let i = pts.length - 1; i > 0; i--) {
          const p = pts[i];
          const n = pts[i - 1];
          const mx = (p.x + n.x) * 0.5;
          const my = (p.y + n.y) * 0.5 + offset;
          ctx.quadraticCurveTo(p.x, p.y + offset, mx, my);
        }
        const end = pts[0];
        ctx.lineTo(end.x, end.y + offset);
      }
    };

    ctx.globalAlpha = layer.alpha;
    for (let i = 0; i < bands.length; i++) {
      const offsetTop = i * bandH;
      const offsetBottom = (i + 1) * bandH;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y + offsetTop);
      addSmoothCurve(points, offsetTop, true);
      ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y + offsetBottom);
      addSmoothCurve(points, offsetBottom, false);
      ctx.closePath();
      ctx.fillStyle = bands[i];
      ctx.fill();
    }
    ctx.restore();
  }
};

export const drawGround = (ctx, groundY, width, height, scrollX) => {
  const groundH = Math.max(20, height - groundY);
  const colors = ['#f2545b', '#ff9e3d', '#ffe66b', '#7be36f', '#55dfd2', '#4b7bff', '#7a5bf5'];
  const rows = colors.length;
  const rowH = groundH / rows;
  const brickW = Math.max(46, Math.min(96, width * 0.11));
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

  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillRect(0, groundY, width, 2);
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
