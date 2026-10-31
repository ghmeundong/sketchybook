// Central DOM element lookups, queried once and shared across game modules.
export const dom = {
  globalToolbar: document.querySelector("[data-global-app-toolbar]"),
  board: document.querySelector("#game-board"),
  canvas: document.querySelector("#game-canvas"),
  environmentCanvas: document.querySelector("#game-environment-canvas"),
  mobileLaunchButton: document.querySelector("[data-mobile-launch]"),
  drawLimitProgress: document.getElementById("draw-limit-progress"),
  drawLimitProgressTrackCanvas: document.getElementById("draw-limit-progress-track-canvas"),
  drawLimitProgressFillCanvas: document.getElementById("draw-limit-progress-fill-canvas"),
  modePage: document.querySelector(".page-mode"),
  selectionPage: document.querySelector(".page-selection"),
  playPage: document.querySelector(".page-play"),
  startPage: document.querySelector(".page-start"),
  stageButtons: Array.from(document.querySelectorAll(".stage-card")),
  stagePageButtons: Array.from(document.querySelectorAll("[data-stage-page]")),
  backHomeButton: document.querySelector("[data-back-home-button]"),
  helpToggle: document.querySelector("[data-help-toggle]"),
  helpPanel: document.getElementById("start-help-panel"),
  body: document.body,
  mapBoardPage: document.querySelector(".page-map-board"),
  mapEditorPage: document.querySelector(".page-map-editor"),
};

export const stagePageSize = 6;
export const totalStageCount = 18;
export const totalStagePages = Math.ceil(totalStageCount / stagePageSize);
