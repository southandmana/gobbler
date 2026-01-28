export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const rand = (a, b) => Math.random() * (b - a) + a;
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeInOut = (t) => t * t * (3 - 2 * t);

export const dist = (ax, ay, bx, by) => {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.hypot(dx, dy);
};

export const lerpAngle = (a, b, t) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};
