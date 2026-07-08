export function shouldAllowBallLaunch({
  isGameActive,
  challengeModeEnabled = false,
  challengeModeStrokeCount = 0,
  stageCleared = false,
  stageClearOverlayVisible = false,
}) {
  if (!isGameActive) return false;
  if (stageCleared) return false;
  if (stageClearOverlayVisible) return false;
  if (challengeModeEnabled) return false;
  if (challengeModeStrokeCount >= 1) return false;
  return true;
}

export function shouldHandleSpacebarAction({
  isGameActive,
  challengeModeEnabled = false,
  challengeModeStrokeCount = 0,
  stageCleared = false,
  stageClearOverlayVisible = false,
  eventRepeat = false,
}) {
  if (eventRepeat) return false;
  return shouldAllowBallLaunch({
    isGameActive,
    challengeModeEnabled,
    challengeModeStrokeCount,
    stageCleared,
    stageClearOverlayVisible,
  });
}

export function shouldAdvancePhysics({ isGameActive, isFullscreen, isPageVisible }) {
  return Boolean(isGameActive && isFullscreen && isPageVisible);
}

export function shouldRenderGuidanceMessage({ isGameActive, isFullscreen, isPageVisible }) {
  return Boolean(isGameActive && isPageVisible && !isFullscreen);
}
