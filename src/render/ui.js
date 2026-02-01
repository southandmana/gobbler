export const drawUI = (ctx, w, h, state, deps) => {
  const {
    gameState,
    finishFadeEntities,
    scoreFade,
    showHealthBar,
    cinematicUiHidden,
    checkpointToastT,
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
    if ((gameStateValue === 'playing' || gameStateValue === 'dying') && !showBossUi) {
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

    if (checkpointToastT > 0 && !(gameStateValue === 'cutscene' && !showHealthBar)) {
      ctx.save();
      ctx.globalAlpha = uiFade;
      ctx.font = '15px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#e44c4c';
      const text = 'CHECKPOINT REACHED';
      const gy = groundY();
      const tx = w * 0.5;
      const ty = gy + (h - gy) * 0.5;
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
