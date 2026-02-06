export const clamp = (v, a, b) => {
  const safeV = Number.isFinite(v) ? v : 0;
  let min = Number.isFinite(a) ? a : 0;
  let max = Number.isFinite(b) ? b : 0;
  if (min > max) {
    const tmp = min;
    min = max;
    max = tmp;
  }
  return Math.max(min, Math.min(max, safeV));
};
export const rand = (a, b) => Math.random() * (b - a) + a;
export const lerp = (a, b, t) => {
  const safeA = Number.isFinite(a) ? a : 0;
  const safeB = Number.isFinite(b) ? b : 0;
  const safeT = Number.isFinite(t) ? t : 0;
  const tt = Math.max(0, Math.min(1, safeT));
  const out = safeA + (safeB - safeA) * tt;
  return Number.isFinite(out) ? out : safeA;
};
export const easeInOut = (t) => t * t * (3 - 2 * t);

export const dist = (ax, ay, bx, by) => {
  if (!Number.isFinite(ax) || !Number.isFinite(ay) || !Number.isFinite(bx) || !Number.isFinite(by)) return 0;
  const dx = ax - bx;
  const dy = ay - by;
  const d = Math.hypot(dx, dy);
  return Number.isFinite(d) ? d : 0;
};

export const lerpAngle = (a, b, t) => {
  if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(t)) return a;
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  const out = a + d * t;
  return Number.isFinite(out) ? out : a;
};
