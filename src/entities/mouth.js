export const triggerChomp = (mouth, MOUTH) => {
  if (mouth.cooldown > 0) return;
  mouth.pulseT = 0;
  mouth.pulseDur = MOUTH.pulseDur;
  mouth.cooldown = MOUTH.minCooldown;
};

export const updateMouth = (mouth, dt, MOUTH, clamp) => {
  if (mouth.cooldown > 0) mouth.cooldown -= dt;
  if (mouth.pulseT < 1) {
    mouth.pulseT = clamp(mouth.pulseT + dt / mouth.pulseDur, 0, 1);
    mouth.open = Math.sin(Math.PI * mouth.pulseT);
  } else {
    mouth.open = 0;
  }
};
