// Central DOM element lookups, queried once and shared across game modules.
export const dom = {
  board: document.querySelector("#game-board"),
  canvas: document.querySelector("#game-canvas"),
  mobileLaunchButton: document.querySelector("[data-mobile-launch]"),
  drawLimitProgress: document.getElementById("draw-limit-progress"),
  drawLimitProgressTrackCanvas: document.getElementById("draw-limit-progress-track-canvas"),
  drawLimitProgressFillCanvas: document.getElementById("draw-limit-progress-fill-canvas"),
  selectionPage: document.querySelector(".page-selection"),
  playPage: document.querySelector(".page-play"),
  startPage: document.querySelector(".page-start"),
  stageButtons: Array.from(document.querySelectorAll(".stage-card")),
  stagePageButtons: Array.from(document.querySelectorAll("[data-stage-page]")),
  backHomeButton: document.querySelector("[data-back-home-button]"),
  helpToggle: document.querySelector("[data-selection-help-toggle]"),
  helpPanel: document.getElementById("selection-help-panel"),
  body: document.body,
};

export const stagePageSize = 6;
export const totalStageCount = 18;
export const totalStagePages = Math.ceil(totalStageCount / stagePageSize);
