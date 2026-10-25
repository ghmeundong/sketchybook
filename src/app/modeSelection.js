import rough from "roughjs";
import { attachRoughFrame } from "../game/ui/roughFrame.js";
import { setActivePage } from "../game/engine/core/gameController.js";
import { dom } from "../game/engine/core/domRefs.js";
import { GOLD, INK, INK_SOFT } from "../theme.js";

const singleButton = document.querySelector("[data-select-single]");
const multiplayerButton = document.querySelector("[data-select-multiplayer]");
const modeBackButton = document.querySelector("[data-mode-back]");
const modeStatus = document.querySelector("[data-mode-status]");

function drawModeArtwork(canvas, mode) {
  if (!canvas) return;

  const width = 220;
  const height = 128;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = width * pixelRatio;
  canvas.height = height * pixelRatio;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  const roughCanvas = rough.canvas(canvas);
  const lineStyle = { stroke: INK, strokeWidth: 2.4, roughness: 1.8, bowing: 1.4 };

  if (mode === "single") {
    roughCanvas.line(28, 94, 194, 94, { ...lineStyle, strokeWidth: 3 });
    roughCanvas.line(44, 91, 82, 54, lineStyle);
    roughCanvas.line(82, 54, 126, 82, lineStyle);
    roughCanvas.circle(150, 72, 25, {
      ...lineStyle,
      fill: GOLD,
      fillStyle: "hachure",
      hachureGap: 5,
    });
    roughCanvas.line(160, 42, 177, 31, { ...lineStyle, stroke: INK_SOFT });
    roughCanvas.line(168, 51, 190, 48, { ...lineStyle, stroke: INK_SOFT });
  } else {
    roughCanvas.circle(72, 56, 35, {
      ...lineStyle,
      fill: "#dce8d5",
      fillStyle: "hachure",
      hachureGap: 6,
    });
    roughCanvas.circle(148, 56, 35, {
      ...lineStyle,
      fill: "#f0d8c6",
      fillStyle: "hachure",
      hachureGap: 6,
    });
    roughCanvas.arc(72, 111, 48, 46, Math.PI, Math.PI * 2, false, lineStyle);
    roughCanvas.arc(148, 111, 48, 46, Math.PI, Math.PI * 2, false, lineStyle);
    roughCanvas.line(98, 36, 122, 36, { ...lineStyle, stroke: GOLD, strokeWidth: 3 });
    roughCanvas.line(104, 28, 116, 28, { ...lineStyle, stroke: GOLD, strokeWidth: 2 });
  }
}

function initializeArtwork() {
  document.querySelectorAll("[data-mode-art]").forEach((canvas) => {
    drawModeArtwork(canvas, canvas.dataset.modeArt);
  });
}

function initializeModeSelection() {
  if (!singleButton || !multiplayerButton || !dom.modePage || !dom.startPage) return;

  attachRoughFrame(singleButton, { inset: 0, outside: 7, strokeWidth: 2.2, roughness: 1.8 });
  attachRoughFrame(multiplayerButton, { inset: 0, outside: 7, strokeWidth: 2.2, roughness: 1.8 });
  attachRoughFrame(modeBackButton, { inset: 1, outside: 3, strokeWidth: 1.4, roughness: 1.6 });
  initializeArtwork();

  singleButton.addEventListener("click", () => {
    multiplayerButton.setAttribute("aria-pressed", "false");
    if (modeStatus) modeStatus.textContent = "";
    setActivePage(dom.startPage);
  });

  multiplayerButton.addEventListener("click", () => {
    multiplayerButton.setAttribute("aria-pressed", "true");
    if (modeStatus) {
      modeStatus.textContent = "Room creation and code entry are coming in the next step.";
    }
  });

  modeBackButton?.addEventListener("click", () => {
    setActivePage(dom.modePage);
  });
}

export { initializeModeSelection };
