import rough from "roughjs";
import paperTexture from "../../img/paper-texture.webp";
import { createActionIconCanvas, createRoughStarCanvas } from "./uiIcons.js";
import { getStageStarRating } from "../stageScoring.js";
import {
  saveStageScore,
  renderStageSelectionButtons,
  renderStageScoreBadge,
} from "./stageProgress.js";

export function createStageClearOverlay({
  board,
  stageClearOverlayRef,
  stageClearMessageRef,
  gameState,
  onExit,
  onRetry,
  onNext,
}) {
  if (!board) return null;
  if (stageClearOverlayRef.current) return stageClearOverlayRef.current;

  const overlay = document.createElement("div");
  overlay.className = "stage-clear-overlay";
  overlay.setAttribute("aria-hidden", "true");
  overlay.style.display = "grid";

  const message = document.createElement("div");
  message.className = "stage-clear-box";
  message.innerHTML = `
    <p class="stage-clear-title" style="font-weight: 800; letter-spacing: 0.04em; text-shadow: 0 1px 0 rgba(255,255,255,0.4);">Stage Cleared!</p>
    <div class="stage-clear-score" aria-label="Stage score"></div>
    <div class="stage-clear-actions">
      <button class="stage-clear-btn stage-clear-exit"></button>
      <button class="stage-clear-btn stage-clear-retry"></button>
      <button class="stage-clear-btn stage-clear-next"></button>
    </div>
  `;

  message.style.backgroundImage = `url(${paperTexture})`;
  message.style.backgroundSize = "cover";
  message.style.backgroundPosition = "center";
  message.style.backgroundRepeat = "no-repeat";
  message.style.position = "relative";
  message.style.zIndex = "1";

  const frameCanvas = document.createElement("canvas");
  frameCanvas.className = "stage-clear-frame";
  frameCanvas.width = 420;
  frameCanvas.height = 420;
  frameCanvas.style.position = "absolute";
  frameCanvas.style.inset = "0";
  frameCanvas.style.width = "100%";
  frameCanvas.style.height = "100%";
  frameCanvas.style.pointerEvents = "none";
  frameCanvas.style.zIndex = "0";

  const rc = rough.canvas(frameCanvas);
  rc.rectangle(12, 12, frameCanvas.width - 24, frameCanvas.height - 24, {
    stroke: "#4f3b24",
    strokeWidth: 3.2,
    roughness: 1.7,
    bowing: 1.6,
    fill: "transparent",
  });

  overlay.appendChild(frameCanvas);
  overlay.appendChild(message);
  board.appendChild(overlay);

  const drawIcon = (btn, type) => {
    if (!btn) return;
    const iconWrap = document.createElement("span");
    iconWrap.className = "stage-clear-icon";
    iconWrap.appendChild(createActionIconCanvas(type));
    btn.insertBefore(iconWrap, btn.firstChild);
  };

  const decorate = (btn) => {
    if (!btn) return;
    btn.style.position = "relative";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 100 40");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.style.position = "absolute";
    svg.style.inset = "0";
    svg.style.pointerEvents = "none";
    svg.style.width = "100%";
    svg.style.height = "100%";
    const rcBtn = rough.svg(svg);
    rcBtn.rectangle(4, 4, 92, 32, {
      stroke: "#4f3b24",
      strokeWidth: 1.8,
      roughness: 1.5,
      bowing: 1.2,
      fill: "transparent",
    });
    btn.appendChild(svg);
  };

  const exitBtn = message.querySelector(".stage-clear-exit");
  const retryBtn = message.querySelector(".stage-clear-retry");
  const nextBtn = message.querySelector(".stage-clear-next");

  [exitBtn, retryBtn, nextBtn].forEach((btn) => {
    decorate(btn);
    if (btn) {
      if (btn.classList.contains("stage-clear-exit")) drawIcon(btn, "exit");
      if (btn.classList.contains("stage-clear-retry")) drawIcon(btn, "retry");
      if (btn.classList.contains("stage-clear-next")) drawIcon(btn, "next");
    }
  });

  exitBtn?.addEventListener("click", async () => {
    overlay.classList.remove("is-visible");
    overlay.setAttribute("aria-hidden", "true");
    overlay.style.opacity = "0";
    overlay.style.visibility = "hidden";
    if (typeof onExit === "function") await onExit();
  });

  retryBtn?.addEventListener("click", async () => {
    overlay.classList.remove("is-visible");
    overlay.setAttribute("aria-hidden", "true");
    overlay.style.opacity = "0";
    overlay.style.visibility = "hidden";
    if (typeof onRetry === "function") await onRetry();
  });

  nextBtn?.addEventListener("click", async () => {
    overlay.classList.remove("is-visible");
    overlay.setAttribute("aria-hidden", "true");
    overlay.style.opacity = "0";
    overlay.style.visibility = "hidden";
    if (typeof onNext === "function") await onNext();
  });

  stageClearOverlayRef.current = overlay;
  stageClearMessageRef.current = message;
  return overlay;
}

export function showStageClearOverlay({
  overlay,
  message,
  stageClearState,
  stageButtons,
  canvas,
  stageNumber,
  stageScores,
  stageProgress,
  onAfterSave,
}) {
  if (!overlay || !message) return;

  const stars = getStageStarRating(stageClearState.stageMinEvents, stageClearState.stageEventCount);
  message.querySelector(".stage-clear-title").textContent = "Stage Cleared!";
  renderStageScoreStars({ message, stars });

  if (stageNumber) {
    saveStageScore(stageNumber, stars);
    renderStageSelectionButtons(stageButtons);
    const stageButton = stageButtons.find((button) => Number(button.dataset.stage) === stageNumber);
    if (stageButton) {
      renderStageScoreBadge(stageButton, stageNumber);
    }
  }

  overlay.classList.add("is-visible");
  overlay.setAttribute("aria-hidden", "false");
  overlay.style.display = "grid";
  overlay.style.opacity = "1";
  overlay.style.visibility = "visible";
  canvas?.style.setProperty("pointer-events", "none");

  if (typeof onAfterSave === "function") {
    onAfterSave(stars);
  }
}

export function hideStageClearOverlay(overlay, canvas) {
  if (!overlay) return;
  overlay.classList.remove("is-visible");
  overlay.setAttribute("aria-hidden", "true");
  overlay.style.opacity = "0";
  overlay.style.visibility = "hidden";
  canvas?.style.setProperty("pointer-events", "auto");
}

export function renderStageScoreStars({ message, stars = 0 }) {
  if (!message) return;

  const scoreContainer = message.querySelector(".stage-clear-score");
  if (!scoreContainer) return;

  scoreContainer.innerHTML = "";
  const safeStars = Math.max(0, Math.min(3, Number.isFinite(stars) ? Math.round(stars) : 0));
  if (!safeStars) {
    scoreContainer.style.display = "none";
    return;
  }

  scoreContainer.style.display = "flex";
  scoreContainer.style.justifyContent = "center";
  scoreContainer.style.alignItems = "center";
  scoreContainer.style.gap = "0.45rem";
  scoreContainer.style.marginTop = "0.7rem";
  scoreContainer.style.fontFamily = "MyeongjoFont, serif";
  scoreContainer.style.fontSize = "1.05rem";
  scoreContainer.style.color = "#4f3b24";
  scoreContainer.style.fontWeight = "800";
  scoreContainer.style.letterSpacing = "0.04em";
  scoreContainer.style.textShadow = "0 1px 0 rgba(255,255,255,0.4)";

  const label = document.createElement("span");
  label.textContent = "Score:";
  scoreContainer.appendChild(label);
  scoreContainer.appendChild(createRoughStarCanvas(safeStars, { size: 24, gap: 6 }));
}

export function createGameButton({ board, className, label, iconType, position, onClick }) {
  const button = document.createElement("button");
  button.className = className;
  button.setAttribute("type", "button");
  button.setAttribute("aria-label", label);
  button.style.position = "absolute";
  button.style.top = position.top;
  button.style.left = position.left;
  button.style.right = position.right;
  button.style.zIndex = "100";
  button.style.background = "transparent";
  button.style.border = "none";
  button.style.cursor = "pointer";
  button.style.padding = "0.5rem";
  button.style.display = "flex";
  button.style.alignItems = "center";
  button.style.justifyContent = "center";

  button.appendChild(createActionIconCanvas(iconType, { w: 60, h: 48, strokeWidth: 2.5 }));
  button.addEventListener("click", onClick);
  board.appendChild(button);
  return button;
}
