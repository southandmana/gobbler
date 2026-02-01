export const drawWorldEntities = (ctx, w, h, state, deps) => {
  const {
    gameState,
    bossOutro,
    finishFadeEntities,
    reds,
    blues,
    npcs,
    player,
    boss,
    bossExplosions,
    dustPuffs,
    floaters,
    burst,
    headShatter,
    npcShatter,
    sparkles,
    lineBurst,
    waveT,
    showHealthBar,
  } = state;
  const {
    drawCheckpointFlags,
    drawDynamiteBomb,
    drawStar,
    drawStarSpecks,
    drawCharacter,
    drawPlayer2,
    DEFAULT_PALETTE,
    BOSS_PALETTE,
    drawDustPuffs,
    drawFloaters,
    drawBurst,
    drawShatter,
    drawSparkles,
    drawLineBurst,
    lerp,
    clamp,
    easeInOut,
    rand,
  } = deps;

  const gameStateValue = gameState.value;
  const showWorldEntities = !bossOutro.blackBackdrop;
  const showPlayer = showWorldEntities || bossOutro.active;
  const bossOutroLocked = bossOutro.active
    && bossOutro.phase !== 'white_in'
    && bossOutro.phase !== 'white_hold'
    && bossOutro.phase !== 'white_out';

  const showEntities = !(gameStateValue === 'start' || gameStateValue === 'startTransition' || gameStateValue === 'stageclear' || gameStateValue === 'gameoverFinal');
  if (!showEntities) return;

  const fadeEntitiesAlpha = finishFadeEntities.active
    ? (1 - easeInOut(clamp(finishFadeEntities.t / finishFadeEntities.dur, 0, 1)))
    : 1;

  if (showWorldEntities && state.startMode !== 'arcade') drawCheckpointFlags(ctx, w);

  if (showWorldEntities) {
    if (fadeEntitiesAlpha < 1) ctx.save(), ctx.globalAlpha = fadeEntitiesAlpha;
    for (const o of reds) {
      if (o.state === 'eaten') {
        drawDynamiteBomb(ctx, o.x, o.y, Math.max(0, o.r));
        continue;
      }
      if (!o._bombSprite || o._bombSpriteR !== o.r) {
        const size = Math.ceil(o.r * 4);
        const c = document.createElement('canvas');
        c.width = size;
        c.height = size;
        const cctx = c.getContext('2d');
        drawDynamiteBomb(cctx, size * 0.5, size * 0.5, o.r);
        o._bombSprite = c;
        o._bombSpriteR = o.r;
      }
      const size = o._bombSprite.width;
      ctx.drawImage(o._bombSprite, o.x - size * 0.5, o.y - size * 0.5);
    }
    if (fadeEntitiesAlpha < 1) ctx.restore();

    if (fadeEntitiesAlpha < 1) ctx.save(), ctx.globalAlpha = fadeEntitiesAlpha;
    for (const o of blues) {
      ctx.fillStyle = '#ffbf4a';
      if (o.state === 'eaten') {
        drawStar(ctx, o.x, o.y, Math.max(0, o.r), o.specks, waveT);
        continue;
      }
      if (o.specks && o.specks.length) {
        drawStarSpecks(ctx, o.x, o.y, Math.max(0, o.r), o.specks, waveT);
      }
      if (!o._starSprite || o._starSpriteR !== o.r) {
        const size = Math.ceil(o.r * 3);
        const c = document.createElement('canvas');
        c.width = size;
        c.height = size;
        const cctx = c.getContext('2d');
        cctx.fillStyle = '#ffbf4a';
        drawStar(cctx, size * 0.5, size * 0.5, Math.max(0, o.r), null, 0);
        o._starSprite = c;
        o._starSpriteR = o.r;
      }
      const size = o._starSprite.width;
      if (o.specks && o.specks.length) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.drawImage(o._starSprite, o.x - size * 0.5, o.y - size * 0.5);
        ctx.restore();
      } else {
        ctx.drawImage(o._starSprite, o.x - size * 0.5, o.y - size * 0.5);
      }
    }
    if (fadeEntitiesAlpha < 1) ctx.restore();

    drawDustPuffs(ctx, dustPuffs, lerp);

    if (showPlayer && (gameStateValue === 'playing' || gameStateValue === 'cutscene') && player.r > 0.3 && player._beingEaten) {
      drawPlayer2(ctx, player.x, player.y, player.r, player.mouth.dir, player.mouth.open, player.squashY, DEFAULT_PALETTE, false, true, { t: player.wingT });
    }

    if (fadeEntitiesAlpha < 1) ctx.save(), ctx.globalAlpha = fadeEntitiesAlpha;
    for (const n of npcs) {
      drawCharacter(ctx, n.x, n.y, n.r, n.mouth.dir, n.mouth.open, n.emotion, 1, clamp, lerp);
    }
    if (fadeEntitiesAlpha < 1) ctx.restore();
  }

  if (showPlayer && (gameStateValue === 'playing' || gameStateValue === 'cutscene') && player.r > 0.3 && !player._beingEaten) {
    drawPlayer2(ctx, player.x, player.y, player.r, player.mouth.dir, player.mouth.open, player.squashY, DEFAULT_PALETTE, false, true, { t: player.wingT });
  }

  const showBossNow = (gameStateValue === 'cutscene' || (gameStateValue === 'dying' && showHealthBar));
  if (showBossNow && !(bossOutro.active && bossOutro.bossGone) && (showWorldEntities || bossOutro.active)) {
    const bossJitter = (bossOutro.active && (bossOutro.phase === 'boom' || bossOutro.phase === 'explode'))
      ? { x: rand(-2, 2), y: rand(-2, 2) }
      : { x: 0, y: 0 };
    const bossFlip = bossOutro.active
      && bossOutro.phase !== 'white_in'
      && bossOutro.phase !== 'white_hold';
    drawPlayer2(ctx, boss.x + bossJitter.x, boss.y + bossJitter.y, boss.r, 0, boss.mouth, boss.squashY, BOSS_PALETTE, bossFlip, true, { t: boss.wingT });
  }

  if (showWorldEntities || bossOutroLocked) {
    drawFloaters(ctx, floaters, clamp);

    if (burst.active) drawBurst(ctx, burst, lerp);
    if (headShatter.active) drawShatter(ctx, headShatter);
    if (npcShatter.active) drawShatter(ctx, npcShatter);
    drawSparkles(ctx, sparkles);
    if (lineBurst.active) drawLineBurst(ctx, lineBurst, lerp);
  }
  for (const b of bossExplosions) {
    if (b.active) drawLineBurst(ctx, b, lerp);
  }
};
