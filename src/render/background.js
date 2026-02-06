import { clamp } from '../utils/math.js';

const roundRectPath = (c, x, y, w, h, r) => {
  const rr = Math.max(0, Math.min(r, w * 0.5, h * 0.5));
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

const groundTileCache = {
  canvas: document.createElement('canvas'),
  w: 0,
  h: 0,
  dpr: 1,
  pattern: null,
};

const drawGroundPlateTile = (c, tileW, tileH) => {
  const pad = Math.max(1, tileH * 0.12);
  const plateW = tileW - pad * 2;
  const plateH = tileH - pad * 2;
  const x = pad;
  const y = pad;
  const r = plateH * 0.22;

  c.save();
  c.clearRect(0, 0, tileW, tileH);

  c.fillStyle = '#45b66c';
  roundRectPath(c, x, y, plateW, plateH, r);
  c.fill();

  c.save();
  roundRectPath(c, x, y, plateW, plateH, r);
  c.clip();

  const topH = plateH * 0.22;
  c.fillStyle = 'rgba(255,255,255,0.3)';
  c.fillRect(x, y, plateW, topH);

  const bottomH = plateH * 0.2;
  c.fillStyle = 'rgba(0, 0, 0, 0.2)';
  c.beginPath();
  c.moveTo(x + plateW * 0.1, y + plateH - bottomH);
  c.lineTo(x + plateW * 0.9, y + plateH - bottomH);
  c.lineTo(x + plateW, y + plateH);
  c.lineTo(x, y + plateH);
  c.closePath();
  c.fill();

  c.restore();
  c.restore();
};

const ensureGroundTilePattern = (ctx, tileW, tileH) => {
  const dpr = Math.max(1, ctx.getTransform().a || 1);
  if (groundTileCache.w === tileW && groundTileCache.h === tileH && groundTileCache.dpr === dpr && groundTileCache.pattern) return;
  groundTileCache.w = tileW;
  groundTileCache.h = tileH;
  groundTileCache.dpr = dpr;
  const c = groundTileCache.canvas;
  c.width = Math.max(1, Math.ceil(tileW * dpr));
  c.height = Math.max(1, Math.ceil(tileH * dpr));
  let cctx = null;
  try {
    cctx = c.getContext('2d');
  } catch (err) {
    console.warn('[background] Failed to create ground tile context', err);
  }
  if (!cctx) {
    groundTileCache.pattern = null;
    return;
  }
  cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawGroundPlateTile(cctx, tileW, tileH);
  try {
    groundTileCache.pattern = ctx.createPattern(c, 'repeat');
  } catch (err) {
    console.warn('[background] Failed to create ground tile pattern', err);
    groundTileCache.pattern = null;
  }
  if (groundTileCache.pattern && typeof groundTileCache.pattern.setTransform === 'function') {
    const m = new DOMMatrix();
    m.a = 1 / dpr;
    m.d = 1 / dpr;
    groundTileCache.pattern.setTransform(m);
  }
};

export const makeStars = (n, rand) => {
  const s = [];
  for (let i = 0; i < n; i++) s.push({ x: Math.random(), y: Math.random(), r: rand(0.7, 1.8) });
  return s;
};

export const createBackgroundCache = () => ({
  sky: { canvas: document.createElement('canvas'), w: 0, h: 0 },
  stars: { canvas: document.createElement('canvas'), w: 0, h: 0, groundY: 0, starsRef: null },
});

export const drawStars = (ctx, stars, mul, scrollX, groundY, width) => {
  const off = (scrollX * mul) % width;
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = '#ffffff';
  for (const s of stars) {
    const x = (s.x * width - off + width) % width;
    const y = s.y * (groundY - 30);
    ctx.beginPath();
    ctx.arc(x, y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};

export const drawSky = (ctx, width, height) => {
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, '#cfe0f6');
  g.addColorStop(0.55, '#ded9f2');
  g.addColorStop(1, '#f3ecf6');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
};

const ensureSkyCache = (cache, width, height) => {
  if (cache.sky.w === width && cache.sky.h === height) return;
  const c = cache.sky.canvas;
  cache.sky.w = width;
  cache.sky.h = height;
  c.width = width;
  c.height = height;
  let cctx = null;
  try {
    cctx = c.getContext('2d');
  } catch (err) {
    console.warn('[background] Failed to create sky cache context', err);
  }
  if (!cctx) return;
  drawSky(cctx, width, height);
};

const ensureStarsCache = (cache, width, groundY, stars) => {
  if (cache.stars.w === width && cache.stars.groundY === groundY && cache.stars.starsRef === stars) return;
  const c = cache.stars.canvas;
  cache.stars.w = width;
  cache.stars.h = Math.max(1, Math.ceil(groundY));
  cache.stars.groundY = groundY;
  cache.stars.starsRef = stars;
  c.width = cache.stars.w;
  c.height = cache.stars.h;
  let cctx = null;
  try {
    cctx = c.getContext('2d');
  } catch (err) {
    console.warn('[background] Failed to create stars cache context', err);
  }
  if (!cctx) return;
  cctx.clearRect(0, 0, c.width, c.height);
  cctx.save();
  cctx.globalAlpha = 0.6;
  cctx.fillStyle = '#ffffff';
  for (const s of stars) {
    const x = s.x * width;
    const y = s.y * (groundY - 30);
    cctx.beginPath();
    cctx.arc(x, y, s.r, 0, Math.PI * 2);
    cctx.fill();
  }
  cctx.restore();
};

const drawStarsCached = (ctx, cache, mul, scrollX, groundY, width, stars) => {
  ensureStarsCache(cache, width, groundY, stars);
  const off = (scrollX * mul) % width;
  const x = -off;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.drawImage(cache.stars.canvas, x, 0);
  if (x < 0) ctx.drawImage(cache.stars.canvas, x + width, 0);
  ctx.restore();
};

export const drawHills = (ctx, width, groundY, scrollX) => {
  const layers = [
    { base: groundY - 210, amp: 16, wavelength: 680, speed: 0.05, alpha: 0.55, color: '#d7c9e7' },
    { base: groundY - 165, amp: 20, wavelength: 560, speed: 0.08, alpha: 0.65, color: '#e6c5d7' },
    { base: groundY - 125, amp: 24, wavelength: 460, speed: 0.12, alpha: 0.75, color: '#f0dcc6' },
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
  ctx.fillStyle = '#473d55';
  ctx.fillRect(0, groundY, width, groundH);

  const tileH = Math.max(14, Math.min(26, groundH * 0.32));
  const tileW = Math.max(52, Math.round(tileH * 3.2));
  ensureGroundTilePattern(ctx, tileW, tileH);
  if (groundTileCache.canvas) {
    const off = ((scrollX % tileW) + tileW) % tileW;
    const overlayY = groundY;
    ctx.save();
    for (let x = -off - tileW; x <= width + tileW; x += tileW) {
      ctx.drawImage(groundTileCache.canvas, x, overlayY, tileW, tileH);
    }
    ctx.restore();
  }

  const fillTileH = Math.max(20, Math.min(34, tileH * 1.35));
  const fillTileW = Math.max(72, Math.round(fillTileH * 3.6));
  const fillGapY = Math.max(2, Math.round(fillTileH * 0.12));
  const fillGapX = Math.max(3, Math.round(fillTileH * 0.18));
  const fillR = fillTileH * 0.22;
  const fillTop = groundY + tileH + fillGapY;
  const fillBottom = groundY + groundH - 1;
  const fillOff = ((scrollX % (fillTileW + fillGapX)) + (fillTileW + fillGapX)) % (fillTileW + fillGapX);

  ctx.save();
  ctx.fillStyle = '#574c6a';
  let rowIndex = 0;
  let lastRowY = null;
  for (let y = fillTop; y + fillTileH <= fillBottom; y += fillTileH + fillGapY) {
    const rowOffset = (rowIndex % 2) ? ((fillTileW + fillGapX) * 0.5) : 0;
    for (let x = -fillOff - (fillTileW + fillGapX); x <= width + fillTileW + fillGapX; x += fillTileW + fillGapX) {
      roundRectPath(ctx, x + rowOffset, y, fillTileW, fillTileH, fillR);
      ctx.fill();
    }
    lastRowY = y;
    rowIndex += 1;
  }
  if (lastRowY !== null && lastRowY + fillTileH < fillBottom - 1) {
    const bottomRowOffset = Math.round(fillTileH * 0.7);
    const y = fillBottom - fillTileH + bottomRowOffset;
    const rowOffset = (rowIndex % 2) ? ((fillTileW + fillGapX) * 0.5) : 0;
    for (let x = -fillOff - (fillTileW + fillGapX); x <= width + fillTileW + fillGapX; x += fillTileW + fillGapX) {
      roundRectPath(ctx, x + rowOffset, y, fillTileW, fillTileH, fillR);
      ctx.fill();
    }
  }
  ctx.restore();

  // no horizon line
};

const DEFAULT_STORY_BG_GRADE = {
  blur: 0,
  saturate: 1,
  contrast: 1,
  brightness: 1,
  hazeTop: 'rgba(255, 255, 255, 0)',
  hazeBottom: 'rgba(255, 255, 255, 0)',
};

const drawStoryBackdrop = (ctx, width, groundY, image, grade = DEFAULT_STORY_BG_GRADE) => {
  const imgW = image?.naturalWidth || image?.width || 0;
  const imgH = image?.naturalHeight || image?.height || 0;
  if (!imgW || !imgH) return false;

  const targetH = Math.max(1, groundY);
  const scale = Math.max(width / imgW, targetH / imgH);
  const drawW = imgW * scale;
  const drawH = imgH * scale;
  const x = (width - drawW) * 0.5;
  const y = groundY - drawH;
  const blur = Math.max(0, grade.blur || 0);
  const filter = `blur(${blur}px) saturate(${grade.saturate}) contrast(${grade.contrast}) brightness(${grade.brightness})`;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, groundY);
  ctx.clip();
  ctx.filter = filter;
  try {
    ctx.drawImage(image, x, y, drawW, drawH);
  } catch (err) {
    console.warn('[background] Failed to draw story backdrop', err);
    ctx.restore();
    return false;
  }
  ctx.filter = 'none';

  const haze = ctx.createLinearGradient(0, 0, 0, groundY);
  haze.addColorStop(0, grade.hazeTop);
  haze.addColorStop(1, grade.hazeBottom);
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, width, groundY);
  ctx.restore();
  return true;
};

export const drawBackdrop = (
  ctx,
  width,
  height,
  groundY,
  scrollX,
  menuScrollX,
  gameStateValue,
  bossBlackBackdrop,
  stars,
  cache = null,
  storyBgImage = null,
  storyBgReady = false,
  useStoryBg = false,
) => {
  const useBlackBackdrop = bossBlackBackdrop || gameStateValue === 'stageclear' || gameStateValue === 'gameoverFinal';
  const bgScrollX = (gameStateValue === 'start' || gameStateValue === 'startTransition')
    ? menuScrollX
    : scrollX + menuScrollX;

  if (useBlackBackdrop) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
  } else {
    const didDrawStory = useStoryBg && storyBgReady && storyBgImage
      ? drawStoryBackdrop(ctx, width, groundY, storyBgImage)
      : false;
    if (!didDrawStory) {
      if (cache) {
        ensureSkyCache(cache, width, height);
        ctx.drawImage(cache.sky.canvas, 0, 0);
        drawStarsCached(ctx, cache, 0.05, bgScrollX, groundY, width, stars);
      } else {
        drawSky(ctx, width, height);
        drawStars(ctx, stars, 0.05, bgScrollX, groundY, width);
      }
      drawHills(ctx, width, groundY, bgScrollX);
    }
  }

  return bgScrollX;
};

export const drawScreenText = (ctx, width, height, title, subtitle, extra, alpha) => {
  ctx.save();
  const a = clamp(alpha, 0, 1);
  ctx.globalAlpha = 1;
  ctx.fillStyle = `rgba(242, 244, 247, ${a})`;
  ctx.strokeStyle = `rgba(0, 0, 0, ${0.55 * a})`;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.shadowColor = `rgba(0, 0, 0, ${0.5 * a})`;
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const cx = width / 2;
  const cy = height / 2;

  ctx.font = '800 54px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  ctx.lineWidth = 6;
  ctx.strokeText(title, cx, cy - 34);
  ctx.fillText(title, cx, cy - 34);

  if (extra) {
    ctx.font = '800 38px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.lineWidth = 5;
    ctx.strokeText(extra, cx, cy + 18);
    ctx.fillText(extra, cx, cy + 18);
  }

  ctx.font = '600 20px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  ctx.lineWidth = 4;
  ctx.strokeText(subtitle, cx, cy + (extra ? 62 : 34));
  ctx.fillText(subtitle, cx, cy + (extra ? 62 : 34));
  ctx.restore();
};
