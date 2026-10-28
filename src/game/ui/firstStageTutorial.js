import rough from "roughjs";
import {
  readFirstStageTutorialStatus,
  readSecondStageTutorialStatus,
  readThirdStageTutorialStatus,
  shouldShowSecondStageTutorial,
  shouldShowFirstStageTutorial,
  getFacingPlatformCorners,
  advanceThirdStageTutorial,
  getSecondStageTutorialStatusAfterClear,
  getSecondStageTutorialStatusOnEntry,
  getThirdStageTutorialStatusAfterClear,
  getThirdStageTutorialStatusOnEntry,
  shouldShowThirdStageTutorial,
  shouldCompleteTutorialOnReset,
  getStageFiveTutorialStatusAfterClear,
  getStageFiveTutorialStatusOnEntry,
  advanceStageFiveTutorialAfterStroke,
  restartStageFiveTutorialAfterReset,
  readStageFiveTutorialStatus,
  shouldShowStageFiveRotorTutorial,
  readStageNineTutorialStatus,
  shouldShowStageNineTutorial,
  writeStageFiveTutorialStatus,
  writeStageNineTutorialStatus,
  writeFirstStageTutorialStatus,
  writeSecondStageTutorialStatus,
  writeThirdStageTutorialStatus,
} from "../../app/tutorialState.js";
import { translateText } from "../../app/localization.js";

let activeTutorial = null;

function createKeycapShape() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const roughSvg = rough.svg(svg);
  svg.classList.add("first-stage-tutorial-keycap-shape");
  svg.setAttribute("viewBox", "0 0 400 180");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");

  const paths = [
    [
      "first-stage-tutorial-keycap-side",
      "M72 12 L42 34 L12 132 Q8 148 28 150 H62 L58 104 Q52 100 56 88 Z",
      "#eee9df",
    ],
    [
      "first-stage-tutorial-keycap-side",
      "M328 12 L358 34 L388 132 Q392 148 372 150 H338 L342 104 Q348 100 344 88 Z",
      "#eee9df",
    ],
    ["first-stage-tutorial-keycap-front", "M58 98 H342 L372 150 H28 Z", "#e3ddd1"],
    [
      "first-stage-tutorial-keycap-top",
      "M82 8 H318 Q326 8 330 16 L348 86 Q352 98 336 98 H64 Q48 98 52 86 L70 16 Q74 8 82 8 Z",
      "#fffdf8",
    ],
    [
      "first-stage-tutorial-keycap-outline",
      "M82 8 H318 Q326 8 330 16 L358 34 L388 132 Q392 148 372 150 H28 Q8 148 12 132 L42 34 L70 16 Q74 8 82 8 Z",
      null,
    ],
  ];

  for (const [className, pathData, fill] of paths) {
    const shape = roughSvg.path(pathData, {
      stroke: "#25221e",
      strokeWidth: className === "first-stage-tutorial-keycap-outline" ? 2.2 : 1.8,
      roughness: 1.25,
      bowing: 0.8,
      ...(fill ? { fill, fillStyle: "solid" } : {}),
    });
    shape.classList.add(className);
    svg.append(shape);
  }

  return svg;
}

export function removeActiveTutorial() {
  if (!activeTutorial) return;
  window.removeEventListener("sketchybook:tutorial-ball-click", activeTutorial.onBallClick);
  window.removeEventListener("stageClear", activeTutorial.onStageClear);
  window.removeEventListener("sketchybook:tutorial-spacebar", activeTutorial.onSpacebar);
  window.removeEventListener("sketchybook:stage-retry", activeTutorial.onStageRetry);
  window.removeEventListener("sketchybook:stage-five-stroke", activeTutorial.onStageFiveStroke);
  window.removeEventListener("sketchybook:stage-nine-stroke", activeTutorial.onStageNineStroke);
  activeTutorial.resizeObserver?.disconnect();
  activeTutorial.overlay.remove();
  activeTutorial = null;
}

export function startFirstStageTutorial(board, canvas, ball, { force = false } = {}) {
  removeActiveTutorial();
  const status = readFirstStageTutorialStatus();
  if ((!force && !shouldShowFirstStageTutorial(status)) || !board || !canvas || !ball) {
    return false;
  }

  if (!force) writeFirstStageTutorialStatus("in_progress");
  const overlay = document.createElement("div");
  overlay.className = "first-stage-tutorial";
  overlay.setAttribute("role", "group");
  overlay.setAttribute("aria-label", "Tutorial");

  const target = document.createElement("span");
  target.className = "first-stage-tutorial-target";
  target.setAttribute("aria-hidden", "true");

  const cursor = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  cursor.classList.add("first-stage-tutorial-cursor");
  cursor.setAttribute("viewBox", "0 0 28 36");
  cursor.setAttribute("aria-hidden", "true");
  const cursorPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  cursorPath.setAttribute("d", "M3 2v25l7-7 5 12 5-2-5-12 10-1z");
  cursorPath.setAttribute("fill", "#fffdf5");
  cursorPath.setAttribute("stroke", "#3c2f1f");
  cursorPath.setAttribute("stroke-width", "2.5");
  cursorPath.setAttribute("stroke-linejoin", "round");
  cursor.append(cursorPath);

  overlay.append(target, cursor);
  board.append(overlay);

  const updateTargetPosition = () => {
    const boardRect = board.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const scaleX = canvasRect.width / (canvas.width || canvasRect.width || 1);
    const scaleY = canvasRect.height / (canvas.height || canvasRect.height || 1);
    const x =
      canvasRect.left - boardRect.left + ball.nx * (canvas.width || canvasRect.width) * scaleX;
    const y =
      canvasRect.top - boardRect.top + ball.ny * (canvas.height || canvasRect.height) * scaleY;
    overlay.style.setProperty("--tutorial-ball-x", `${x}px`);
    overlay.style.setProperty("--tutorial-ball-y", `${y}px`);
  };

  const finish = (nextStatus) => {
    if (!force) writeFirstStageTutorialStatus(nextStatus);
    removeActiveTutorial();
  };
  const onBallClick = () => finish("completed");
  const onStageClear = (event) => {
    if (event.detail?.stageNumber === 1) finish("completed");
  };
  window.addEventListener("sketchybook:tutorial-ball-click", onBallClick);
  window.addEventListener("stageClear", onStageClear);
  updateTargetPosition();

  activeTutorial = {
    overlay,
    onBallClick,
    onStageClear,
    resizeObserver:
      typeof ResizeObserver === "function" ? new ResizeObserver(updateTargetPosition) : null,
  };
  activeTutorial.resizeObserver?.observe(board);
  return true;
}

export function startSecondStageTutorial(board, canvas, platforms, { force = false } = {}) {
  removeActiveTutorial();
  const status = readSecondStageTutorialStatus();
  if (
    (!force && !shouldShowSecondStageTutorial(status)) ||
    !board ||
    !canvas ||
    !Array.isArray(platforms) ||
    platforms.length < 2
  ) {
    return false;
  }

  if (!force) writeSecondStageTutorialStatus(getSecondStageTutorialStatusOnEntry(status));
  const overlay = document.createElement("div");
  overlay.className = "first-stage-tutorial first-stage-tutorial-line";
  overlay.setAttribute("role", "group");
  overlay.setAttribute("aria-label", "Tutorial");

  const lineSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  lineSvg.classList.add("first-stage-tutorial-line-svg");
  lineSvg.setAttribute("aria-hidden", "true");
  const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
  line.classList.add("first-stage-tutorial-line-path");
  line.setAttribute("pathLength", "1");
  lineSvg.append(line);

  const startTarget = document.createElement("span");
  startTarget.className = "first-stage-tutorial-target first-stage-tutorial-line-target";
  startTarget.setAttribute("aria-hidden", "true");
  const endTarget = startTarget.cloneNode();

  const cursor = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  cursor.classList.add("first-stage-tutorial-cursor", "first-stage-tutorial-line-cursor");
  cursor.setAttribute("viewBox", "0 0 28 36");
  cursor.setAttribute("aria-hidden", "true");
  const cursorPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  cursorPath.setAttribute("d", "M3 2v25l7-7 5 12 5-2-5-12 10-1z");
  cursorPath.setAttribute("fill", "#fffdf5");
  cursorPath.setAttribute("stroke", "#3c2f1f");
  cursorPath.setAttribute("stroke-width", "2.5");
  cursorPath.setAttribute("stroke-linejoin", "round");
  cursor.append(cursorPath);

  overlay.append(lineSvg, startTarget, endTarget, cursor);
  board.append(overlay);

  let firstTarget;
  let secondTarget;
  const updateTargetPositions = () => {
    const boardRect = board.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const scaleX = canvasRect.width / (canvas.width || canvasRect.width || 1);
    const scaleY = canvasRect.height / (canvas.height || canvasRect.height || 1);
    [firstTarget, secondTarget] = getFacingPlatformCorners(
      platforms[0],
      platforms[1],
      { width: canvas.width, height: canvas.height },
      { x: scaleX, y: scaleY }
    );
    firstTarget.x += canvasRect.left - boardRect.left;
    firstTarget.y += canvasRect.top - boardRect.top;
    secondTarget.x += canvasRect.left - boardRect.left;
    secondTarget.y += canvasRect.top - boardRect.top;

    lineSvg.setAttribute("viewBox", `0 0 ${boardRect.width} ${boardRect.height}`);
    line.setAttribute(
      "d",
      `M ${firstTarget.x} ${firstTarget.y} L ${secondTarget.x} ${secondTarget.y}`
    );
    startTarget.style.left = `${firstTarget.x}px`;
    startTarget.style.top = `${firstTarget.y}px`;
    endTarget.style.left = `${secondTarget.x}px`;
    endTarget.style.top = `${secondTarget.y}px`;
    cursor.style.left = `${firstTarget.x}px`;
    cursor.style.top = `${firstTarget.y}px`;
    cursor.style.setProperty("--tutorial-line-dx", `${secondTarget.x - firstTarget.x}px`);
    cursor.style.setProperty("--tutorial-line-dy", `${secondTarget.y - firstTarget.y}px`);
  };

  const onStageClear = (event) => {
    if (force && event.detail?.stageNumber === 2) {
      removeActiveTutorial();
      return;
    }
    const nextStatus = getSecondStageTutorialStatusAfterClear(
      readSecondStageTutorialStatus(),
      event.detail?.stageNumber
    );
    if (!nextStatus) return;
    writeSecondStageTutorialStatus(nextStatus);
    removeActiveTutorial();
  };
  window.addEventListener("stageClear", onStageClear);
  updateTargetPositions();

  activeTutorial = {
    overlay,
    onStageClear,
    resizeObserver:
      typeof ResizeObserver === "function" ? new ResizeObserver(updateTargetPositions) : null,
  };
  activeTutorial.resizeObserver?.observe(board);
  return true;
}

export function startThirdStageTutorial(board, retryButton, { force = false } = {}) {
  removeActiveTutorial();
  const status = readThirdStageTutorialStatus();
  if ((!force && !shouldShowThirdStageTutorial(status)) || !board || !retryButton) return false;

  let tutorialStatus = force
    ? "in_progress_stage3_space"
    : getThirdStageTutorialStatusOnEntry(status);
  if (!tutorialStatus) return false;
  if (!force) writeThirdStageTutorialStatus(tutorialStatus);

  const overlay = document.createElement("div");
  overlay.className = "first-stage-tutorial first-stage-tutorial-keys";
  overlay.setAttribute("role", "group");
  overlay.setAttribute("aria-label", "Tutorial");

  const keycap = document.createElement("kbd");
  keycap.className = "first-stage-tutorial-keycap";
  keycap.setAttribute("aria-label", "Spacebar");
  const keycapShadow = document.createElement("span");
  keycapShadow.className = "first-stage-tutorial-keycap-shadow";
  keycapShadow.setAttribute("aria-hidden", "true");
  keycap.append(createKeycapShape());
  const spaceMark = document.createElement("span");
  spaceMark.className = "first-stage-tutorial-key-mark first-stage-tutorial-space-mark";
  spaceMark.textContent = "Space bar";
  keycap.append(spaceMark);

  const spotlight = document.createElement("span");
  spotlight.className = "first-stage-tutorial-reset-spotlight";
  spotlight.setAttribute("aria-hidden", "true");

  const resetKeycap = document.createElement("kbd");
  resetKeycap.className = "first-stage-tutorial-reset-keycap";
  resetKeycap.setAttribute("aria-label", "R key");
  const resetKeycapShadow = document.createElement("span");
  resetKeycapShadow.className = "first-stage-tutorial-reset-keycap-shadow";
  resetKeycapShadow.setAttribute("aria-hidden", "true");
  resetKeycap.append(createKeycapShape());
  const resetLabel = document.createElement("span");
  resetLabel.className = "first-stage-tutorial-key-mark first-stage-tutorial-reset-mark";
  resetLabel.textContent = "R";
  resetKeycap.append(resetLabel);

  overlay.append(keycapShadow, keycap, spotlight, resetKeycapShadow, resetKeycap);
  board.append(overlay);

  const updateResetSpotlight = () => {
    const boardRect = board.getBoundingClientRect();
    const buttonRect = retryButton.getBoundingClientRect();
    const left = buttonRect.left - boardRect.left;
    const top = buttonRect.top - boardRect.top;
    spotlight.style.left = `${left - 8}px`;
    spotlight.style.top = `${top - 8}px`;
    spotlight.style.width = `${buttonRect.width + 16}px`;
    spotlight.style.height = `${buttonRect.height + 16}px`;
    resetKeycap.style.left = `${left + buttonRect.width / 2}px`;
    resetKeycap.style.top = `${top + buttonRect.height + 18}px`;
    resetKeycapShadow.style.left = resetKeycap.style.left;
    resetKeycapShadow.style.top = resetKeycap.style.top;
  };

  const updatePhase = () => {
    const isResetPhase = tutorialStatus === "in_progress_stage3_reset";
    overlay.classList.toggle("is-reset-phase", isResetPhase);
    if (isResetPhase) updateResetSpotlight();
  };
  const onSpacebar = () => {
    const nextStatus = advanceThirdStageTutorial(tutorialStatus);
    if (nextStatus === "in_progress_stage3_reset") {
      tutorialStatus = nextStatus;
      if (!force) writeThirdStageTutorialStatus(nextStatus);
      updatePhase();
    }
  };
  const onStageRetry = (event) => {
    if (event.detail?.stageNumber !== 3) return;
    const currentStatus = tutorialStatus;
    if (currentStatus === "in_progress_stage3_space") {
      if (!force) event.preventDefault();
      return;
    }
    if (shouldCompleteTutorialOnReset(currentStatus, 3)) {
      if (!force) writeThirdStageTutorialStatus("completed");
      removeActiveTutorial();
    }
  };
  const onStageClear = (event) => {
    if (event.detail?.stageNumber !== 3) return;
    if (force) {
      removeActiveTutorial();
      return;
    }
    const nextStatus = getThirdStageTutorialStatusAfterClear(
      readThirdStageTutorialStatus(),
      event.detail.stageNumber
    );
    if (!nextStatus) return;
    writeThirdStageTutorialStatus(nextStatus);
    removeActiveTutorial();
  };

  window.addEventListener("sketchybook:tutorial-spacebar", onSpacebar);
  window.addEventListener("sketchybook:stage-retry", onStageRetry);
  window.addEventListener("stageClear", onStageClear);
  updatePhase();
  activeTutorial = {
    overlay,
    onSpacebar,
    onStageRetry,
    onStageClear,
    resizeObserver:
      typeof ResizeObserver === "function" ? new ResizeObserver(updateResetSpotlight) : null,
  };
  activeTutorial.resizeObserver?.observe(board);
  return true;
}

export function startStageFiveRotorTutorial(
  board,
  canvas,
  rotor,
  platform,
  star,
  { force = false } = {}
) {
  removeActiveTutorial();
  const status = readStageFiveTutorialStatus();
  if (
    (!force && !shouldShowStageFiveRotorTutorial(status)) ||
    !board ||
    !canvas ||
    !rotor ||
    !platform ||
    !star
  ) {
    return false;
  }

  let tutorialStatus = force ? "in_progress_first_line" : getStageFiveTutorialStatusOnEntry(status);
  const initialStatus = tutorialStatus;
  if (!initialStatus) return false;
  if (!force) writeStageFiveTutorialStatus(initialStatus);
  const overlay = document.createElement("div");
  overlay.className = "first-stage-tutorial first-stage-tutorial-line first-stage-five-tutorial";
  overlay.setAttribute("role", "group");
  overlay.setAttribute("aria-label", "Rotor tutorial");

  const lineSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  lineSvg.classList.add("first-stage-tutorial-line-svg");
  lineSvg.setAttribute("aria-hidden", "true");
  const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
  line.classList.add("first-stage-tutorial-line-path");
  line.setAttribute("pathLength", "1");
  lineSvg.append(line);

  const startTarget = document.createElement("span");
  startTarget.className = "first-stage-tutorial-target first-stage-tutorial-line-target";
  startTarget.setAttribute("aria-hidden", "true");

  const cursor = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  cursor.classList.add("first-stage-tutorial-cursor", "first-stage-tutorial-line-cursor");
  cursor.setAttribute("viewBox", "0 0 28 36");
  cursor.setAttribute("aria-hidden", "true");
  const cursorPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  cursorPath.setAttribute("d", "M3 2v25l7-7 5 12 5-2-5-12 10-1z");
  cursorPath.setAttribute("fill", "#fffdf5");
  cursorPath.setAttribute("stroke", "#3c2f1f");
  cursorPath.setAttribute("stroke-width", "2.5");
  cursorPath.setAttribute("stroke-linejoin", "round");
  cursor.append(cursorPath);

  overlay.append(lineSvg, startTarget, cursor);
  board.append(overlay);

  let firstLineStart;
  let firstLineEnd;
  let secondLineStart;
  let secondLineEnd;
  let boardRect;
  const updateLinePositions = () => {
    boardRect = board.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const scaleX = canvasRect.width / (canvas.width || canvasRect.width || 1);
    const scaleY = canvasRect.height / (canvas.height || canvasRect.height || 1);
    const rotorPoints = rotor.normalizedPoints || [];
    const bounds = rotorPoints.reduce(
      (result, point) => ({
        left: Math.min(result.left, point.x),
        right: Math.max(result.right, point.x),
        top: Math.min(result.top, point.y),
        bottom: Math.max(result.bottom, point.y),
      }),
      { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity }
    );
    const rotorStart = {
      x: (bounds.left + bounds.right) / 2,
      y: (bounds.top + bounds.bottom) / 2,
    };
    const rotorEnd = {
      x: bounds.left - (bounds.right - bounds.left) * 0.85,
      y: bounds.top - (bounds.bottom - bounds.top) * 0.85,
    };
    const toBoardPoint = (point) => ({
      x: canvasRect.left - boardRect.left + point.x * canvas.width * scaleX,
      y: canvasRect.top - boardRect.top + point.y * canvas.height * scaleY,
    });
    firstLineStart = toBoardPoint(rotorStart);
    const referenceEndPoint = toBoardPoint(rotorEnd);
    const lineLength = Math.hypot(
      referenceEndPoint.x - firstLineStart.x,
      referenceEndPoint.y - firstLineStart.y
    );
    const lineAngle = (67 * Math.PI) / 180;
    firstLineEnd = {
      x: firstLineStart.x - lineLength * Math.cos(lineAngle),
      y: firstLineStart.y - lineLength * Math.sin(lineAngle),
    };

    secondLineStart = toBoardPoint({ x: 0.5, y: (canvas.height - 24) / canvas.height });
    const starRadius =
      star.radius > 1 ? star.radius : star.radius * Math.min(canvas.width, canvas.height);
    secondLineEnd = toBoardPoint({
      x: star.nx,
      y: (star.ny * canvas.height + starRadius) / canvas.height,
    });

    renderLineForCurrentPhase();
  };

  const renderLineForCurrentPhase = () => {
    const isSecondLine = tutorialStatus === "in_progress_second_line";
    const startPoint = isSecondLine ? secondLineStart : firstLineStart;
    const endPoint = isSecondLine ? secondLineEnd : firstLineEnd;
    if (!startPoint || !endPoint) return;

    lineSvg.setAttribute("viewBox", `0 0 ${boardRect.width} ${boardRect.height}`);
    line.setAttribute("d", `M ${startPoint.x} ${startPoint.y} L ${endPoint.x} ${endPoint.y}`);
    startTarget.style.left = `${startPoint.x}px`;
    startTarget.style.top = `${startPoint.y}px`;
    cursor.style.left = `${startPoint.x}px`;
    cursor.style.top = `${startPoint.y}px`;
    cursor.style.setProperty("--tutorial-line-dx", `${endPoint.x - startPoint.x}px`);
    cursor.style.setProperty("--tutorial-line-dy", `${endPoint.y - startPoint.y}px`);
  };

  const onStageClear = (event) => {
    if (force && event.detail?.stageNumber === 5) {
      removeActiveTutorial();
      return;
    }
    const nextStatus = getStageFiveTutorialStatusAfterClear(
      readStageFiveTutorialStatus(),
      event.detail?.stageNumber
    );
    if (!nextStatus) return;
    writeStageFiveTutorialStatus(nextStatus);
    removeActiveTutorial();
  };
  const onStageFiveStroke = () => {
    const currentStatus = tutorialStatus;
    const nextStatus = advanceStageFiveTutorialAfterStroke(currentStatus);
    if (!nextStatus || nextStatus === currentStatus) return;
    tutorialStatus = nextStatus;
    if (!force) writeStageFiveTutorialStatus(nextStatus);
    overlay.classList.add("is-second-line");
    renderLineForCurrentPhase();
    line.style.animation = "none";
    cursor.style.animation = "none";
    void line.getBoundingClientRect();
    line.style.animation = "";
    cursor.style.animation = "";
  };
  const onStageRetry = (event) => {
    const currentStatus = tutorialStatus;
    const nextStatus = restartStageFiveTutorialAfterReset(currentStatus, event.detail?.stageNumber);
    if (!nextStatus) return;

    tutorialStatus = nextStatus;
    if (!force) writeStageFiveTutorialStatus(nextStatus);
    overlay.classList.remove("is-second-line");
    renderLineForCurrentPhase();
    line.style.animation = "none";
    cursor.style.animation = "none";
    void line.getBoundingClientRect();
    line.style.animation = "";
    cursor.style.animation = "";
  };
  window.addEventListener("sketchybook:stage-five-stroke", onStageFiveStroke);
  window.addEventListener("sketchybook:stage-retry", onStageRetry);
  window.addEventListener("stageClear", onStageClear);
  updateLinePositions();

  activeTutorial = {
    overlay,
    onStageClear,
    onStageFiveStroke,
    onStageRetry,
    resizeObserver:
      typeof ResizeObserver === "function" ? new ResizeObserver(updateLinePositions) : null,
  };
  activeTutorial.resizeObserver?.observe(board);
  return true;
}

export function startStageNineHatchedCircleTutorial(board, canvas, circle, { force = false } = {}) {
  removeActiveTutorial();
  if (
    (!force && !shouldShowStageNineTutorial(readStageNineTutorialStatus())) ||
    !board ||
    !canvas ||
    !circle
  ) {
    return false;
  }

  const overlay = document.createElement("div");
  overlay.className = "first-stage-tutorial stage-nine-hatched-tutorial";
  overlay.setAttribute("role", "group");
  const message = translateText("you cannot draw on striped area");
  overlay.setAttribute("aria-label", message);

  const lineSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  lineSvg.classList.add("first-stage-tutorial-line-svg");
  lineSvg.setAttribute("aria-hidden", "true");
  const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
  line.classList.add("stage-nine-tutorial-line");
  line.setAttribute("pathLength", "1");
  lineSvg.append(line);

  const cursor = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  cursor.classList.add("first-stage-tutorial-cursor", "stage-nine-tutorial-cursor");
  cursor.setAttribute("viewBox", "0 0 28 36");
  cursor.setAttribute("aria-hidden", "true");
  const cursorPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  cursorPath.setAttribute("d", "M3 2v25l7-7 5 12 5-2-5-12 10-1z");
  cursorPath.setAttribute("fill", "#fffdf5");
  cursorPath.setAttribute("stroke", "#3c2f1f");
  cursorPath.setAttribute("stroke-width", "2.5");
  cursorPath.setAttribute("stroke-linejoin", "round");
  cursor.append(cursorPath);

  const cross = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  cross.classList.add("stage-nine-tutorial-cross");
  cross.setAttribute("viewBox", "0 0 64 64");
  cross.setAttribute("aria-hidden", "true");
  for (const pathData of ["M12 12 52 52", "M52 12 12 52"]) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathData);
    path.setAttribute("pathLength", "1");
    cross.append(path);
  }

  overlay.append(lineSvg, cursor, cross);
  board.append(overlay);

  const updatePositions = () => {
    const boardRect = board.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const scaleX = canvasRect.width / (canvas.width || canvasRect.width || 1);
    const scaleY = canvasRect.height / (canvas.height || canvasRect.height || 1);
    const radius =
      circle.radius > 1 ? circle.radius : circle.radius * Math.min(canvas.width, canvas.height);
    const center = { x: circle.nx * canvas.width, y: circle.ny * canvas.height };
    const toBoardPoint = (point) => ({
      x: canvasRect.left - boardRect.left + point.x * scaleX,
      y: canvasRect.top - boardRect.top + point.y * scaleY,
    });
    const start = toBoardPoint({ x: center.x - radius * 2, y: center.y + radius * 1.5 });
    const end = toBoardPoint({ x: center.x + radius * 2, y: center.y - radius * 1.5 });
    const centerPoint = toBoardPoint(center);

    lineSvg.setAttribute("viewBox", `0 0 ${boardRect.width} ${boardRect.height}`);
    line.setAttribute("d", `M ${start.x} ${start.y} L ${end.x} ${end.y}`);
    cursor.style.left = `${start.x}px`;
    cursor.style.top = `${start.y}px`;
    cursor.style.setProperty("--tutorial-line-dx", `${end.x - start.x}px`);
    cursor.style.setProperty("--tutorial-line-dy", `${end.y - start.y}px`);
    cross.style.left = `${centerPoint.x}px`;
    cross.style.top = `${centerPoint.y}px`;
  };

  const onStageClear = (event) => {
    if (event.detail?.stageNumber === 9) removeActiveTutorial();
  };
  const onStageNineStroke = () => {
    if (!force) writeStageNineTutorialStatus("completed");
    removeActiveTutorial();
  };
  window.addEventListener("sketchybook:stage-nine-stroke", onStageNineStroke);
  window.addEventListener("stageClear", onStageClear);
  updatePositions();
  activeTutorial = {
    overlay,
    onStageClear,
    onStageNineStroke,
    resizeObserver:
      typeof ResizeObserver === "function" ? new ResizeObserver(updatePositions) : null,
  };
  activeTutorial.resizeObserver?.observe(board);
  return true;
}
