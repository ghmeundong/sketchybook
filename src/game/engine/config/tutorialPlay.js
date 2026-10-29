export const TUTORIAL_PLAY_STAGE_NUMBERS = Object.freeze([1, 2, 3, 5, 9]);

export function getNextTutorialPlayStage(stageNumber) {
  const currentIndex = TUTORIAL_PLAY_STAGE_NUMBERS.indexOf(stageNumber);
  return TUTORIAL_PLAY_STAGE_NUMBERS[(currentIndex + 1) % TUTORIAL_PLAY_STAGE_NUMBERS.length];
}

export function shouldClearTutorialStageThreeAfterReset({
  isTutorialPlay,
  stageNumber,
  spacebarUsed,
}) {
  return isTutorialPlay && stageNumber === 3 && spacebarUsed;
}

export function shouldBlockTutorialStageThreeClear({ isTutorialPlay, stageNumber, resetAccepted }) {
  return isTutorialPlay && stageNumber === 3 && !resetAccepted;
}
