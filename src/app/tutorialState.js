export const FIRST_STAGE_TUTORIAL_KEY = "sketchybook.tutorial.first-stage.v1";
export const SECOND_STAGE_TUTORIAL_KEY = "sketchybook.tutorial.second-stage.v1";
export const THIRD_STAGE_TUTORIAL_KEY = "sketchybook.tutorial.third-stage.v1";
export const STAGE_FIVE_TUTORIAL_KEY = "sketchybook.tutorial.stage-five-rotor.v1";
export const STAGE_NINE_TUTORIAL_KEY = "sketchybook.tutorial.stage-nine-hatched-circle.v1";

function readTutorialStatus(key, storage = globalThis) {
  try {
    const target = typeof storage?.getItem === "function" ? storage : storage?.localStorage;
    return target?.getItem(key) || "not_started";
  } catch {
    return "not_started";
  }
}

function writeTutorialStatus(key, status, storage = globalThis) {
  try {
    const target = typeof storage?.setItem === "function" ? storage : storage?.localStorage;
    target?.setItem(key, status);
  } catch {
    // Keep the tutorial usable for this session if storage is unavailable.
  }
}

export function readSecondStageTutorialStatus(storage = globalThis) {
  return readTutorialStatus(SECOND_STAGE_TUTORIAL_KEY, storage);
}

export function writeSecondStageTutorialStatus(status, storage = globalThis) {
  writeTutorialStatus(SECOND_STAGE_TUTORIAL_KEY, status, storage);
}

export function readThirdStageTutorialStatus(storage = globalThis) {
  return readTutorialStatus(THIRD_STAGE_TUTORIAL_KEY, storage);
}

export function writeThirdStageTutorialStatus(status, storage = globalThis) {
  writeTutorialStatus(THIRD_STAGE_TUTORIAL_KEY, status, storage);
}

export function shouldShowStageNineTutorial(status) {
  return status !== "completed";
}

export function readStageNineTutorialStatus(storage = globalThis) {
  try {
    const target = typeof storage?.getItem === "function" ? storage : storage?.localStorage;
    return target?.getItem(STAGE_NINE_TUTORIAL_KEY) || "not_started";
  } catch {
    return "not_started";
  }
}

export function writeStageNineTutorialStatus(status, storage = globalThis) {
  try {
    const target = typeof storage?.setItem === "function" ? storage : storage?.localStorage;
    target?.setItem(STAGE_NINE_TUTORIAL_KEY, status);
  } catch {
    // Keep the tutorial usable for this session if storage is unavailable.
  }
}

export function shouldShowStageFiveRotorTutorial(status) {
  return status !== "completed";
}

export function getStageFiveTutorialStatusOnEntry(status) {
  return shouldShowStageFiveRotorTutorial(status) ? "in_progress_first_line" : null;
}

export function getStageFiveTutorialStatusAfterClear(status, stageNumber) {
  return status.startsWith("in_progress") && stageNumber === 5 ? "completed" : null;
}

export function advanceStageFiveTutorialAfterStroke(status) {
  return status === "in_progress_first_line" ? "in_progress_second_line" : status;
}

export function restartStageFiveTutorialAfterReset(status, stageNumber) {
  return stageNumber === 5 && status.startsWith("in_progress") ? "in_progress_first_line" : null;
}

export function readStageFiveTutorialStatus(storage = globalThis) {
  try {
    const target = typeof storage?.getItem === "function" ? storage : storage?.localStorage;
    return target?.getItem(STAGE_FIVE_TUTORIAL_KEY) || "not_started";
  } catch {
    return "not_started";
  }
}

export function writeStageFiveTutorialStatus(status, storage = globalThis) {
  try {
    const target = typeof storage?.setItem === "function" ? storage : storage?.localStorage;
    target?.setItem(STAGE_FIVE_TUTORIAL_KEY, status);
  } catch {
    // Keep the tutorial usable for this session if storage is unavailable.
  }
}

export function shouldShowFirstStageTutorial(status) {
  return status === "not_started" || status === "in_progress";
}

export function shouldShowSecondStageTutorial(status) {
  return status !== "completed";
}

export function getSecondStageTutorialStatusOnEntry(status) {
  return shouldShowSecondStageTutorial(status) ? "in_progress" : null;
}

export function getSecondStageTutorialStatusAfterClear(status, stageNumber) {
  return status === "in_progress" && stageNumber === 2 ? "completed" : null;
}

export function shouldShowThirdStageTutorial(status) {
  return status !== "completed";
}

export function getThirdStageTutorialStatusOnEntry(status) {
  if (!shouldShowThirdStageTutorial(status)) return null;
  return status === "in_progress_stage3_reset" ? status : "in_progress_stage3_space";
}

export function getThirdStageTutorialStatusAfterClear(status, stageNumber) {
  return isStageThreeTutorialStatus(status) && stageNumber === 3 ? "completed" : null;
}

export function isStageThreeTutorialStatus(status) {
  return status === "in_progress_stage3_space" || status === "in_progress_stage3_reset";
}

export function advanceThirdStageTutorial(status) {
  return status === "in_progress_stage3_space" ? "in_progress_stage3_reset" : status;
}

export function isThirdStageTutorialActive(status, stageNumber, isPlayground, isMultiplayer) {
  return isStageThreeTutorialStatus(status) && stageNumber === 3 && !isPlayground && !isMultiplayer;
}

export function shouldCompleteTutorialOnReset(status, stageNumber) {
  return status === "in_progress_stage3_reset" && stageNumber === 3;
}

export function isFirstStageClickTutorialActive(status, stageNumber, isPlayground, isMultiplayer) {
  return status === "in_progress" && stageNumber === 1 && !isPlayground && !isMultiplayer;
}

export function getFacingPlatformCorners(firstPlatform, secondPlatform, canvasSize, scale) {
  const deltaX = secondPlatform.nx - firstPlatform.nx;
  const horizontalDirection = Math.sign(deltaX) || 1;

  const getPlatformCorner = (platform, horizontalSign, verticalSign) => {
    const width = platform.width > 1 ? platform.width : platform.width * canvasSize.width;
    const height = platform.height > 1 ? platform.height : platform.height * canvasSize.height;
    return {
      x: platform.nx * canvasSize.width * scale.x + (horizontalSign * width * scale.x) / 2,
      y: platform.ny * canvasSize.height * scale.y + (verticalSign * height * scale.y) / 2,
      radius: 24,
    };
  };

  return [
    getPlatformCorner(firstPlatform, horizontalDirection, -1),
    getPlatformCorner(secondPlatform, -horizontalDirection, -1),
  ];
}

export function readFirstStageTutorialStatus(storage = globalThis) {
  try {
    const target = typeof storage?.getItem === "function" ? storage : storage?.localStorage;
    return target?.getItem(FIRST_STAGE_TUTORIAL_KEY) || "not_started";
  } catch {
    return "not_started";
  }
}

export function writeFirstStageTutorialStatus(status, storage = globalThis) {
  try {
    const target = typeof storage?.setItem === "function" ? storage : storage?.localStorage;
    target?.setItem(FIRST_STAGE_TUTORIAL_KEY, status);
  } catch {
    // Keep the tutorial usable for this session if storage is unavailable.
  }
}
