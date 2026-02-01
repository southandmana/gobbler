export const drawUI = (ctx, w, h, state, deps) => {
  const {
    gameState,
    finishFadeEntities,
    scoreFade,
    showHealthBar,
    cinematicUiHidden,
    checkpointToastT,
    startMode,
    dialogueIndex,
    dialogueScriptLength,
  } = state;
  const {
    groundY,
    setBossTimerVisible,
    drawProgressBar,
    drawHealthBar,
    drawLivesHud,
    drawDialogueBox,
    isDialogueActive,
    clamp,
    easeInOut,
  } = deps;
  const gameStateValue = gameState.value;
  if (!cinematicUiHidden) {
    const uiFade = finishFadeEntities.active
      ? (1 - easeInOut(clamp(finishFadeEntities.t / finishFadeEntities.dur, 0, 1)))
      : (scoreFade.active ? easeInOut(clamp(scoreFade.t / scoreFade.dur, 0, 1)) : 1);
    const showBossUi = showHealthBar && (gameStateValue === 'cutscene' || gameStateValue === 'playing' || gameStateValue === 'dying');
    const isArcade = startMode === 'arcade';
    if ((gameStateValue === 'playing' || gameStateValue === 'dying') && !showBossUi && !isArcade) {
      if (uiFade < 1) ctx.save(), ctx.globalAlpha = uiFade;
      drawProgressBar(ctx, w);
      if (uiFade < 1) ctx.restore();
    }
    if (showBossUi) {
      if (uiFade < 1) ctx.save(), ctx.globalAlpha = uiFade;
      drawHealthBar(ctx);
      setBossTimerVisible(false);
      if (uiFade < 1) ctx.restore();
    } else {
      setBossTimerVisible(false);
    }

    if (!isArcade && checkpointToastT > 0 && !(gameStateValue === 'cutscene' && !showHealthBar)) {
      ctx.save();
      ctx.globalAlpha = uiFade;
      ctx.font = '15px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#e44c4c';
      const text = 'CHECKPOINT REACHED';
      const metrics = ctx.measureText(text);
      const textW = metrics.width;
      const textH = 18;
      const padX = 0;
      const padY = 0;
      const margin = 0;
      const tx = w - margin - padX;
      const ty = h - margin - (textH * 0.5) - padY;
      ctx.fillStyle = '#000';
      ctx.fillRect(tx - textW - padX, ty - (textH * 0.5) - padY, textW + padX * 2, textH + padY * 2);
      ctx.fillStyle = '#fff';
      ctx.fillText(text, tx, ty);
      ctx.restore();
    }

    const showHearts = (
      gameStateValue === 'playing'
      || gameStateValue === 'dying'
      || gameStateValue === 'paused'
      || (gameStateValue === 'cutscene' && showHealthBar)
    );
    if (showHearts) {
      if (uiFade < 1) ctx.save(), ctx.globalAlpha = uiFade;
      drawLivesHud(ctx, w);
      if (uiFade < 1) ctx.restore();
    }
  }
  if (cinematicUiHidden) setBossTimerVisible(false);

  if (isDialogueActive() && dialogueIndex < dialogueScriptLength) {
    drawDialogueBox(ctx, w, h);
  }
};
