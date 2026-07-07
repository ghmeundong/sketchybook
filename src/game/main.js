import planck from "planck";
import rough from "roughjs";
import "../style.css";
import "../styles/game.css";
import paperTexture from "../img/paper-texture.webp";
import { initializeOrientationPrompt } from "../orientationPrompt.js";
import { createCoordinateSystem } from "./coordinates.js";
import { loadStage } from "./stageLoader.js";
import { resolveCircleRadius, segmentIntersectsCircle, segmentIntersectsRect } from "./geometry.js";
import { getStagePageIndexForStage } from "./stagePages.js";
import { rescalePoint, rescalePoints } from "./resizeState.js";
import { shouldDeferResize } from "./layoutSync.js";
import { createActionIconCanvas } from "./ui/uiIcons.js";
import {
  createStageClearOverlay as createStageClearOverlayUI,
  showStageClearOverlay as showStageClearOverlayUI,
  hideStageClearOverlay as hideStageClearOverlayUI,
} from "./ui/gameUi.js";
import { getChallengeModePreference } from "./challengeMode.js";
import {
  getStoredStageProgress,
  renderStageSelectionButtons as renderStageSelectionButtonsUI,
  renderStageScoreBadge,
} from "./ui/stageProgress.js";
import {
  createStrokeBody,
  initializeStrokeBody,
  updateStrokeBody,
  stepPhysicsWorld,
  createCircleBody,
  createBoxBody,
  createEdgeBody,
  applyAngularImpulseToBody,
  applyImpulseAtLocalPoint,
  resetPhysicsWorld,
} from "./physics.js";
import {
  CircleObject,
  Ball,
  Star,
  Platform,
  Portal,
  StripedRectObject,
  Segment,
  ComplexObject,
  Rotor,
  TextLabel,
} from "./objects/index.js";

const board = document.querySelector("#game-board");
const canvas = document.querySelector("#game-canvas");
const selectionPage = document.querySelector(".page-selection");
const playPage = document.querySelector(".page-play");
const stageButtons = Array.from(document.querySelectorAll(".stage-card"));
const stagePageButtons = Array.from(document.querySelectorAll("[data-stage-page]"));
const backHomeButton = document.querySelector("[data-back-home-button]");
let stagePageIndex = 0;
const stagePageSize = 6;
const totalStageCount = 30;
const totalStagePages = Math.ceil(totalStageCount / stagePageSize);

let stageClearOverlay = null;
let stageClearMessage = null;
const stageClearOverlayRef = { current: null };
const stageClearMessageRef = { current: null };
let gameExitButton = null;
let gameRetryButton = null;
let challengeModeEnabled = false;
let challengeModeStrokeCount = 0;

const body = document.body;
body.style.backgroundImage = `url(${paperTexture})`;
body.style.backgroundSize = "cover";
body.style.backgroundPosition = "center";
body.style.backgroundRepeat = "no-repeat";
body.style.backgroundAttachment = "fixed";

function refreshStageSelectionButtons() {
  renderStageSelectionButtonsUI(stageButtons);
  updateStageSelectionPage();
}

function updateStageSelectionPage() {
  const unlockedStage = getStoredStageProgress();
  const startIndex = stagePageIndex * stagePageSize;
  const endIndex = startIndex + stagePageSize;

  stageButtons.forEach((button) => {
    const stageNumber = Number(button.dataset.stage);
    const isVisible = stageNumber > startIndex && stageNumber <= endIndex;
    const isUnlocked = stageNumber <= unlockedStage;
    const shouldDisable = !isVisible || !isUnlocked;

    button.classList.toggle("is-hidden", !isVisible);
    button.disabled = shouldDisable;
    button.classList.toggle("is-disabled", shouldDisable);
    button.setAttribute("aria-disabled", String(shouldDisable));
  });

  const firstPage = stagePageIndex === 0;
  const lastPage = stagePageIndex >= totalStagePages - 1;

  stagePageButtons.forEach((button) => {
    const isPrev = button.dataset.stagePage === "prev";
    const shouldDisable = isPrev ? firstPage : lastPage;
    button.disabled = shouldDisable;
    button.classList.toggle("is-disabled", shouldDisable);
  });
}

function drawRoughFrame(card) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.style.display = "block";
  svg.style.position = "absolute";
  svg.style.inset = "0";
  svg.style.pointerEvents = "none";
  svg.style.overflow = "visible";

  const rc = rough.svg(svg);
  const shape = rc.rectangle(8, 8, 84, 84, {
    stroke: "#4f3b24",
    strokeWidth: 1.3,
    roughness: 1.6,
    bowing: 1.2,
    fill: "transparent",
  });

  svg.appendChild(shape);
  card.appendChild(svg);
}

stageButtons.forEach((card) => {
  drawRoughFrame(card);
  const stageNumber = Number(card.dataset.stage);
  renderStageScoreBadge(card, stageNumber);
});

stagePageButtons.forEach((button) => {
  const type = button.dataset.stagePage === "prev" ? "prev" : "next";
  button.appendChild(createActionIconCanvas(type, { w: 48, h: 40, strokeWidth: 2.8 }));
});

if (backHomeButton) {
  backHomeButton.appendChild(createActionIconCanvas("exit", { w: 60, h: 48, strokeWidth: 2.5 }));
  backHomeButton.addEventListener("click", () => {
    window.location.href = "./index.html";
  });
}

refreshStageSelectionButtons();
initializeOrientationPrompt();

function resetStageState() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  challengeModeEnabled = getChallengeModePreference();
  resetPhysicsWorld();
  gameObjects = [];
  physicsStrokes = [];
  currentStroke = null;
  isDrawing = false;
  lastPoint = null;
  stageCleared = false;
  currentStage = null;
  stageHasSimulated = false;
  stageEventCount = 0;
  challengeModeStrokeCount = 0;
  stageMinEvents = 0;
  hideStageClearOverlay();
  hideGameRetryButton();
  hideGameExitButton();
}

function updateStageUrl(stageNumber = null) {
  const nextUrl = new URL(window.location.href);
  if (stageNumber) {
    nextUrl.searchParams.set("stage", String(stageNumber));
  } else {
    nextUrl.searchParams.delete("stage");
  }
  window.history.replaceState(null, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
}

function setActivePage(page) {
  [selectionPage, playPage].forEach((item) => {
    if (!item) return;
    item.classList.toggle("is-active", item === page);
  });
  if (page === selectionPage) {
    resetStageState();
    updateStageUrl();
    if (Number.isInteger(currentStageNumber)) {
      stagePageIndex = getStagePageIndexForStage(
        currentStageNumber,
        stagePageSize,
        totalStagePages
      );
      updateStageSelectionPage();
    }
  }
}

async function tryEnterFullscreen() {
  if (document.fullscreenElement) {
    return;
  }
  if (document.documentElement.requestFullscreen) {
    try {
      await document.documentElement.requestFullscreen();
    } catch (err) {
      console.warn("전체화면 전환 실패:", err);
    }
  }
}

function createStageClearOverlay() {
  if (!board || stageClearOverlayRef.current) return;
  createStageClearOverlayUI({
    board,
    stageClearOverlayRef,
    stageClearMessageRef,
  });
  stageClearOverlay = stageClearOverlayRef.current;
  stageClearMessage = stageClearMessageRef.current;

  if (!stageClearOverlay || !stageClearMessage) return;

  const exitBtn = stageClearMessage.querySelector(".stage-clear-exit");
  const retryBtn = stageClearMessage.querySelector(".stage-clear-retry");
  const nextBtn = stageClearMessage.querySelector(".stage-clear-next");

  if (exitBtn) {
    exitBtn.addEventListener("click", async () => {
      hideStageClearOverlay();
      setActivePage(selectionPage);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (document.fullscreenElement) {
        try {
          await document.exitFullscreen();
        } catch (err) {
          console.warn("전체화면 해제 실패:", err);
        }
      }
    });
  }
  if (retryBtn) {
    retryBtn.addEventListener("click", async () => {
      hideStageClearOverlay();
      await initializeStage(currentStageNumber);
      resizeCanvas();
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener("click", async () => {
      hideStageClearOverlay();
      const next = Math.min((currentStageNumber || 1) + 1, totalStageCount);
      await startStage(next);
    });
  }
}

function showStageClearOverlay(message = "Stage Cleared!") {
  if (!stageClearOverlay || !stageClearMessage) {
    createStageClearOverlay();
  }
  if (!stageClearOverlay || !stageClearMessage) return;

  stageClearMessage.querySelector(".stage-clear-title").textContent = message;
  showStageClearOverlayUI({
    overlay: stageClearOverlay,
    message: stageClearMessage,
    stageClearState: { stageMinEvents, stageEventCount },
    stageButtons,
    canvas,
    stageNumber: currentStageNumber,
    onAfterSave: () => {
      refreshStageSelectionButtons();
    },
  });
}

function hideStageClearOverlay() {
  hideStageClearOverlayUI(stageClearOverlay, canvas);
}

function createGameExitButton() {
  if (!board || gameExitButton) return;

  gameExitButton = document.createElement("button");
  gameExitButton.className = "game-exit-btn";
  gameExitButton.setAttribute("type", "button");
  gameExitButton.setAttribute("aria-label", "Exit to stage selection");
  gameExitButton.style.position = "absolute";
  gameExitButton.style.top = "1rem";
  gameExitButton.style.left = "1rem";
  gameExitButton.style.zIndex = "100";
  gameExitButton.style.background = "transparent";
  gameExitButton.style.border = "none";
  gameExitButton.style.cursor = "pointer";
  gameExitButton.style.padding = "0.5rem";
  gameExitButton.style.display = "flex";
  gameExitButton.style.alignItems = "center";
  gameExitButton.style.justifyContent = "center";

  gameExitButton.appendChild(createActionIconCanvas("exit", { w: 60, h: 48, strokeWidth: 2.5 }));
  gameExitButton.addEventListener("click", async () => {
    hideStageClearOverlay();
    setActivePage(selectionPage);
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    // exit fullscreen
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch (err) {
        console.warn("전체화면 해제 실패:", err);
      }
    }
  });

  board.appendChild(gameExitButton);
}

function createGameRetryButton() {
  if (!board || gameRetryButton) return;

  gameRetryButton = document.createElement("button");
  gameRetryButton.className = "game-retry-btn";
  gameRetryButton.setAttribute("type", "button");
  gameRetryButton.setAttribute("aria-label", "Retry current stage");
  gameRetryButton.style.position = "absolute";
  gameRetryButton.style.top = "1rem";
  gameRetryButton.style.right = "1rem";
  gameRetryButton.style.zIndex = "100";
  gameRetryButton.style.background = "transparent";
  gameRetryButton.style.border = "none";
  gameRetryButton.style.cursor = "pointer";
  gameRetryButton.style.padding = "0.5rem";
  gameRetryButton.style.display = "flex";
  gameRetryButton.style.alignItems = "center";
  gameRetryButton.style.justifyContent = "center";

  gameRetryButton.appendChild(createActionIconCanvas("retry", { w: 60, h: 48, strokeWidth: 2.5 }));
  gameRetryButton.addEventListener("click", async () => {
    hideStageClearOverlay();
    await initializeStage(currentStageNumber);
    resizeCanvas();
  });

  board.appendChild(gameRetryButton);
}

function hideGameExitButton() {
  if (gameExitButton) {
    gameExitButton.remove();
    gameExitButton = null;
  }
}

function hideGameRetryButton() {
  if (gameRetryButton) {
    gameRetryButton.remove();
    gameRetryButton = null;
  }
}

function getRequestedStageFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const value = Number(params.get("stage"));
  return Number.isInteger(value) && value >= 1 && value <= totalStageCount ? value : null;
}

async function startStage(stageNumber) {
  if (!stageNumber) {
    return;
  }
  currentStageNumber = stageNumber;
  await tryEnterFullscreen();
  setActivePage(playPage);
  updateStageUrl(stageNumber);
  await initializeStage(stageNumber);
  resizeCanvas();
}

async function initializePageFlow() {
  const requestedStage = getRequestedStageFromUrl();
  if (requestedStage) {
    currentStageNumber = requestedStage;
    setActivePage(playPage);
    updateStageUrl(requestedStage);
    await initializeStage(requestedStage);
    resizeCanvas();
  } else {
    stagePageIndex = getStagePageIndexForStage(currentStageNumber, stagePageSize, totalStagePages);
    setActivePage(selectionPage);
  }
}

let isDrawing = false;
let lastPoint = null;
let roughCanvas = null;
let ctx = null;
let coordinateSystem = null;
let currentStroke = null;
let physicsStrokes = [];
let currentStage = null;
let animationFrameId = null;
let lastPhysicsTime = 0;
let canvasWidth = 0;
let canvasHeight = 0;
// Preview cache for the stroke currently being drawn. We only re-create
// this offscreen texture when the stroke changes (point added), avoiding
// repeated rough rendering each frame which caused the jittery look.
let currentStrokePreviewDirty = false;
let currentStrokePreviewLastIndex = 0;
let previewCanvas = null;
let previewCtx = null;
const physicsFrameDuration = 1000 / 60;

let stageCleared = false;
let stageHasSimulated = false;
let stageEventCount = 0;
let stageMinEvents = 0;

// Game objects (balls, stars, etc.) that stages can declare.
let gameObjects = [];
let currentStageNumber = 1;

function resizeCanvas() {
  if (!board || !canvas) {
    return;
  }

  const measuredWidth = board.clientWidth;
  const measuredHeight = board.clientHeight;

  if (shouldDeferResize(measuredWidth, measuredHeight)) {
    return;
  }

  const previousCanvasWidth = canvasWidth;
  const previousCanvasHeight = canvasHeight;
  canvasWidth = measuredWidth;
  canvasHeight = measuredHeight;
  const dpr = window.devicePixelRatio || 1;

  canvas.width = canvasWidth * dpr;
  canvas.height = canvasHeight * dpr;
  canvas.style.width = `${canvasWidth}px`;
  canvas.style.height = `${canvasHeight}px`;

  ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  coordinateSystem = createCoordinateSystem({
    viewportWidth: canvasWidth,
    viewportHeight: canvasHeight,
  });
  roughCanvas = rough.canvas(canvas);
  roughCanvas.ctx.globalAlpha = 1;

  // Create or resize the preview overlay canvas. This canvas sits above
  // the main game canvas and is only updated when the stroke changes.
  if (!previewCanvas) {
    previewCanvas = document.createElement("canvas");
    previewCanvas.className = "game-preview-canvas";
    previewCanvas.style.position = "absolute";
    previewCanvas.style.inset = "0";
    previewCanvas.style.pointerEvents = "none";
    previewCanvas.style.zIndex = "50";
    if (board) board.appendChild(previewCanvas);
  }
  previewCanvas.width = Math.max(1, canvasWidth) * dpr;
  previewCanvas.height = Math.max(1, canvasHeight) * dpr;
  previewCanvas.style.width = `${Math.max(1, canvasWidth)}px`;
  previewCanvas.style.height = `${Math.max(1, canvasHeight)}px`;
  previewCtx = previewCanvas.getContext("2d");
  previewCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  previewCtx.clearRect(0, 0, canvasWidth, canvasHeight);

  const needsLayoutRemap =
    previousCanvasWidth > 0 &&
    previousCanvasHeight > 0 &&
    (previousCanvasWidth !== canvasWidth || previousCanvasHeight !== canvasHeight);

  if (needsLayoutRemap && gameObjects.length) {
    for (const obj of gameObjects) {
      if (obj instanceof Ball || obj instanceof CircleObject || obj instanceof Star) {
        const previousX = obj.screenX ?? (obj.nx != null ? obj.nx * previousCanvasWidth : null);
        const previousY = obj.screenY ?? (obj.ny != null ? obj.ny * previousCanvasHeight : null);
        if (previousX != null && previousY != null) {
          const remapped = rescalePoint(
            { x: previousX, y: previousY },
            previousCanvasWidth,
            previousCanvasHeight,
            canvasWidth,
            canvasHeight
          );
          obj.screenX = remapped.x;
          obj.screenY = remapped.y;
          obj.nx = remapped.x / canvasWidth;
          obj.ny = remapped.y / canvasHeight;
        }
      }

      if (obj instanceof Platform) {
        const previousX = obj.screenX ?? (obj.nx != null ? obj.nx * previousCanvasWidth : null);
        const previousY = obj.screenY ?? (obj.ny != null ? obj.ny * previousCanvasHeight : null);
        if (previousX != null && previousY != null) {
          const remapped = rescalePoint(
            { x: previousX, y: previousY },
            previousCanvasWidth,
            previousCanvasHeight,
            canvasWidth,
            canvasHeight
          );
          obj.screenX = remapped.x;
          obj.screenY = remapped.y;
          obj.nx = remapped.x / canvasWidth;
          obj.ny = remapped.y / canvasHeight;
        }
      }

      if (obj instanceof Segment) {
        const remappedPoints = rescalePoints(
          [
            { x: obj.x1 * previousCanvasWidth, y: obj.y1 * previousCanvasHeight },
            { x: obj.x2 * previousCanvasWidth, y: obj.y2 * previousCanvasHeight },
          ],
          previousCanvasWidth,
          previousCanvasHeight,
          canvasWidth,
          canvasHeight
        );
        obj.x1 = remappedPoints[0].x / canvasWidth;
        obj.y1 = remappedPoints[0].y / canvasHeight;
        obj.x2 = remappedPoints[1].x / canvasWidth;
        obj.y2 = remappedPoints[1].y / canvasHeight;
        obj.texture = null;
        obj.textureOffset = null;
        obj._lastCanvasSize = null;
      }

      if (obj instanceof ComplexObject) {
        if (Array.isArray(obj.normalizedPoints) && obj.normalizedPoints.length) {
          const remappedPoints = rescalePoints(
            obj.normalizedPoints.map((point) => ({
              x: point.x * previousCanvasWidth,
              y: point.y * previousCanvasHeight,
            })),
            previousCanvasWidth,
            previousCanvasHeight,
            canvasWidth,
            canvasHeight
          );
          obj.normalizedPoints = remappedPoints.map((point) => ({
            x: point.x / canvasWidth,
            y: point.y / canvasHeight,
          }));
        }
        obj.texture = null;
        obj.textureOffset = null;
        obj.textureAnchor = null;
        obj._lastCanvasSize = null;
      }

      if (obj instanceof Rotor) {
        if (obj.screenX != null && obj.screenY != null) {
          const remapped = rescalePoint(
            { x: obj.screenX, y: obj.screenY },
            previousCanvasWidth,
            previousCanvasHeight,
            canvasWidth,
            canvasHeight
          );
          obj.screenX = remapped.x;
          obj.screenY = remapped.y;
        }
        obj.cx = obj.screenX != null ? obj.screenX / canvasWidth : obj.cx;
        obj.cy = obj.screenY != null ? obj.screenY / canvasHeight : obj.cy;
        obj.axisX = obj.axisX != null ? obj.axisX : obj.cx;
        obj.axisY = obj.axisY != null ? obj.axisY : obj.cy;
        obj.texture = null;
        obj.textureOffset = null;
        obj._lastCanvasSize = null;
      }
    }
  }

  if (needsLayoutRemap && currentStroke?.length) {
    currentStroke = currentStroke.map((point) =>
      rescalePoint(point, previousCanvasWidth, previousCanvasHeight, canvasWidth, canvasHeight)
    );
    currentStrokePreviewLastIndex = 0;
    currentStrokePreviewDirty = false;
    if (previewCtx) previewCtx.clearRect(0, 0, canvasWidth, canvasHeight);
  }

  const shouldRebuildPhysics =
    needsLayoutRemap ||
    (currentStage &&
      !stageHasSimulated &&
      physicsStrokes.length === 0 &&
      gameObjects.some(
        (obj) => obj.physicsBody || (obj.physicsBodies && obj.physicsBodies.length)
      ));
  if (shouldRebuildPhysics) {
    resetPhysicsWorld();
    for (const obj of gameObjects) {
      if (obj.physicsBody) {
        obj.physicsBody = null;
      }
      if (obj.physicsBodies) {
        obj.physicsBodies = null;
      }
    }
    for (const stroke of physicsStrokes) {
      stroke.physicsBody = null;
      stroke.physicsSegments = [];
      stroke.grounded = false;
      stroke.angle = 0;
      stroke.angularVelocity = 0;
      stroke.texture = null;
      stroke.textureOffset = null;
    }
  }

  const floorYForPhysics = canvas?.clientHeight ? canvas.clientHeight - 24 : canvasHeight - 24;
  if (gameObjects && gameObjects.length) {
    for (const obj of gameObjects) {
      if ((obj instanceof CircleObject || obj instanceof Ball) && !obj.physicsBody) {
        const px = obj.nx * canvasWidth;
        const py = obj.ny * canvasHeight;
        const minDim = Math.min(canvasWidth, canvasHeight);
        const rPixels = resolveCircleRadius(obj.radius, minDim);
        const strokeWidth = 2;
        const rPhysics = Math.max(2, Math.round(rPixels + strokeWidth / 2));
        try {
          const body = createCircleBody(px, py, rPhysics, floorYForPhysics, {
            density: obj.isStatic ? 0 : 1,
            isStatic: obj.isStatic,
            skipGround: challengeModeEnabled,
          });
          obj.physicsBody = body;
          obj.physicalRadius = rPixels;
        } catch (e) {
          console.warn("createCircleBody failed:", e);
        }
      } else if (obj instanceof Platform && !obj.physicsBody) {
        const px = obj.nx * canvasWidth;
        const py = obj.ny * canvasHeight;
        const widthPx = obj.width > 1 ? obj.width : Math.max(4, obj.width * canvasWidth);
        const heightPx = obj.height > 1 ? obj.height : Math.max(4, obj.height * canvasHeight);
        try {
          const body = createBoxBody(px, py, widthPx, heightPx, floorYForPhysics, {
            type: "static",
            friction: 0.8,
            skipGround: challengeModeEnabled,
          });
          obj.physicsBody = body;
        } catch (e) {
          console.warn("createBoxBody failed:", e);
        }
      } else if (obj instanceof Segment && !obj.physicsBody) {
        const x1 = obj.x1 * canvasWidth;
        const y1 = obj.y1 * canvasHeight;
        const x2 = obj.x2 * canvasWidth;
        const y2 = obj.y2 * canvasHeight;
        try {
          const body = createEdgeBody(x1, y1, x2, y2, floorYForPhysics, {
            type: "static",
            friction: 0.8,
            skipGround: challengeModeEnabled,
          });
          obj.physicsBody = body;
        } catch (e) {
          console.warn("createEdgeBody failed:", e);
        }
      } else if (
        obj instanceof ComplexObject &&
        (!obj.physicsBodies || !obj.physicsBodies.length)
      ) {
        // ensure texture/pixel points available
        try {
          obj.createTexture(canvasWidth, canvasHeight);
          obj.createPhysics(floorYForPhysics, { skipGround: challengeModeEnabled });
        } catch (e) {
          console.warn("ComplexObject physics creation failed:", e);
        }
      } else if (obj instanceof Rotor && !obj.physicsBody) {
        try {
          obj.createTexture(canvasWidth, canvasHeight);
          obj.createPhysics(canvasWidth, canvasHeight, floorYForPhysics, {
            skipGround: challengeModeEnabled,
          });
        } catch (e) {
          console.warn("Rotor physics creation failed:", e);
        }
      }
    }
  }

  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  animationFrameId = window.requestAnimationFrame(tick);
}

async function initializeStage(stageNumberOverride) {
  if (!canvas || !board) {
    return;
  }

  resetStageState();

  currentStage = await loadStage(canvas, board, stageNumberOverride);
  if (currentStage?.coordinateSystem) {
    coordinateSystem = currentStage.coordinateSystem;
  }
  if (typeof currentStage?.initialize === "function") {
    currentStage.initialize();
  }

  try {
    createStageClearOverlay();
  } catch (error) {
    console.warn("stage clear overlay creation failed:", error);
  }

  // Populate gameObjects from stage data (if any)
  gameObjects = [];
  stageCleared = false;
  physicsStrokes = [];
  currentStroke = null;
  isDrawing = false;
  lastPoint = null;
  lastPhysicsTime = 0;
  stageEventCount = 0;
  stageMinEvents = Number.isFinite(currentStage?.minEvents) ? currentStage.minEvents : 0;
  hideStageClearOverlay();
  if (Array.isArray(currentStage?.objects)) {
    for (const obj of currentStage.objects) {
      if (obj.type === "circle") {
        gameObjects.push(
          new CircleObject({
            x: obj.x,
            y: obj.y,
            radius: obj.radius,
            isStatic: obj.isStatic === true,
          })
        );
      } else if (obj.type === "ball") {
        gameObjects.push(new Ball({ x: obj.x, y: obj.y, radius: obj.radius }));
      } else if (obj.type === "star") {
        gameObjects.push(new Star({ x: obj.x, y: obj.y, radius: obj.radius }));
      } else if (obj.type === "platform") {
        gameObjects.push(
          new Platform({
            x: obj.x,
            y: obj.y,
            width: obj.width,
            height: obj.height,
          })
        );
      } else if (obj.type === "stripedRect") {
        gameObjects.push(
          new StripedRectObject({
            x: obj.x,
            y: obj.y,
            width: obj.width,
            height: obj.height,
          })
        );
      } else if (obj.type === "portal") {
        gameObjects.push(
          new Portal({
            x: obj.x,
            y: obj.y,
            width: obj.width,
            height: obj.height,
            color: obj.color,
            portalId: obj.portalId,
          })
        );
      } else if (obj.type === "segment") {
        gameObjects.push(
          new Segment({
            x1: obj.x1,
            y1: obj.y1,
            x2: obj.x2,
            y2: obj.y2,
          })
        );
      } else if (obj.type === "poly" || obj.type === "complex") {
        // points provided as normalized coordinates [{x,y}, ...]
        gameObjects.push(
          new ComplexObject({
            points: obj.points || [],
            closed: !!obj.closed,
            isStatic: obj.isStatic !== false,
          })
        );
      } else if (obj.type === "rotor") {
        const spinMode = obj.spinMode === "auto" ? "auto" : "free";
        gameObjects.push(
          new Rotor({
            points: obj.points || [],
            closed: obj.closed !== false,
            x: obj.x,
            y: obj.y,
            radius: obj.radius,
            pointCount: obj.pointCount,
            axisX: obj.axisX,
            axisY: obj.axisY,
            spinMode,
            motorSpeed: obj.motorSpeed,
            maxMotorTorque: obj.maxMotorTorque,
            isStatic: obj.isStatic === true,
          })
        );
      } else if (obj.type === "text") {
        gameObjects.push(
          new TextLabel({
            x: obj.x,
            y: obj.y,
            text: obj.text,
            fontSize: obj.fontSize,
            color: obj.color,
            fontFamily: obj.fontFamily,
          })
        );
      }
      // future: handle other types (star, obstacle, etc.)
    }
  }

  createGameExitButton();
  createGameRetryButton();
}

function getPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function drawStroke(start, end, width = 8, options = {}) {
  const targetRough = options.roughCanvasOverride || roughCanvas;
  if (!targetRough || !coordinateSystem) {
    return;
  }

  const targetColor = options.color || "#4f3b24";
  const alpha = options.alpha ?? 0.15;
  const scaledWidth = Math.max(1.5, width * 0.55);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.hypot(dx, dy);

  targetRough.ctx.save();
  targetRough.ctx.globalAlpha = alpha;
  const step = Math.max(1.5, scaledWidth * 0.4);
  for (let i = 0; i <= distance; i += step) {
    const t = distance === 0 ? 0 : i / distance;
    targetRough.circle(start.x + dx * t, start.y + dy * t, scaledWidth, {
      stroke: "none",
      fill: targetColor,
      fillStyle: "solid",
      roughness: options.roughness ?? 2.0,
    });
  }
  targetRough.ctx.restore();
}

function drawStrokePreview(points, width = 8) {
  if (!points || points.length < 2 || !ctx) return;

  const dpr = window.devicePixelRatio || 1;
  if (!previewCtx || !previewCanvas) return;

  // Ensure preview canvas uses same pixel size as main canvas
  if (
    previewCanvas.width !== Math.max(1, canvasWidth) * dpr ||
    previewCanvas.height !== Math.max(1, canvasHeight) * dpr
  ) {
    previewCanvas.width = Math.max(1, canvasWidth) * dpr;
    previewCanvas.height = Math.max(1, canvasHeight) * dpr;
    previewCanvas.style.width = `${Math.max(1, canvasWidth)}px`;
    previewCanvas.style.height = `${Math.max(1, canvasHeight)}px`;
    previewCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    currentStrokePreviewLastIndex = 0; // force full redraw on resize
  }

  const lastIdx = currentStrokePreviewLastIndex ?? 0;

  // If we haven't drawn the stroke yet, draw all segments once into the
  // persistent preview canvas. Subsequent pointer events will only append
  // newly added segments (no full re-render).
  if (lastIdx === 0) {
    previewCtx.clearRect(0, 0, canvasWidth, canvasHeight);
    const rc = rough.canvas(previewCanvas);
    for (let i = 0; i < points.length - 1; i += 1) {
      drawStroke(points[i], points[i + 1], width, {
        targetCanvas: previewCanvas,
        roughCanvasOverride: rc,
      });
    }
    currentStrokePreviewLastIndex = Math.max(0, points.length - 1);
    currentStrokePreviewDirty = false;
    return;
  }

  if (lastIdx < points.length - 1) {
    const rc = rough.canvas(previewCanvas);
    for (let i = Math.max(0, lastIdx); i < points.length - 1; i += 1) {
      drawStroke(points[i], points[i + 1], width, {
        targetCanvas: previewCanvas,
        roughCanvasOverride: rc,
      });
    }
    currentStrokePreviewLastIndex = Math.max(0, points.length - 1);
    currentStrokePreviewDirty = false;
  }
}

function createStrokeTexture(stroke, previewSource) {
  if (!stroke?.points?.length) {
    return;
  }

  const points = stroke.points;
  const centerX = stroke.body.x;
  const centerY = stroke.body.y;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const localPoints = points.map((node) => {
    const x = node.x - centerX;
    const y = node.y - centerY;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    return { x, y };
  });

  const padding = 16;
  const width = Math.ceil(maxX - minX + padding * 2);
  const height = Math.ceil(maxY - minY + padding * 2);
  if (width <= 0 || height <= 0) {
    return;
  }
  const offsetPoints = localPoints.map((node) => ({
    x: node.x - minX + padding,
    y: node.y - minY + padding,
  }));

  // If a preview source canvas is provided, copy the relevant region from
  // that canvas into the stroke texture so the appearance remains identical
  // between preview and finalized physics stroke.
  if (previewSource && previewSource instanceof HTMLCanvasElement) {
    const offscreen = document.createElement("canvas");
    offscreen.width = width;
    offscreen.height = height;
    const offscreenCtx = offscreen.getContext("2d");
    offscreenCtx.clearRect(0, 0, width, height);

    // previewSource is a high-DPR canvas (internal pixels = css * dpr).
    const dpr = window.devicePixelRatio || 1;
    const sx = (centerX + minX - padding) * dpr;
    const sy = (centerY + minY - padding) * dpr;
    const sw = width * dpr;
    const sh = height * dpr;

    try {
      offscreenCtx.drawImage(previewSource, sx, sy, sw, sh, 0, 0, width, height);
      stroke.texture = offscreen;
      stroke.textureOffset = {
        centerX: -minX + padding,
        centerY: -minY + padding,
        width,
        height,
      };
      return;
    } catch (e) {
      console.warn("createStrokeTexture: drawImage from previewSource failed:", e);
      // fall through to generate texture procedurally
    }
  }

  // Fall back: procedurally render the textured stroke into an offscreen canvas.
  const offscreen = document.createElement("canvas");
  offscreen.width = width;
  offscreen.height = height;
  const offscreenCtx = offscreen.getContext("2d");
  const offscreenRough = rough.canvas(offscreen);
  offscreenCtx.clearRect(0, 0, width, height);

  for (let i = 0; i < offsetPoints.length - 1; i += 1) {
    drawStroke(offsetPoints[i], offsetPoints[i + 1], 8, {
      color: "#4f3b24",
      alpha: 0.15,
      roughness: 2.0,
      targetCanvas: offscreen,
      roughCanvasOverride: offscreenRough,
    });
  }

  stroke.texture = offscreen;
  stroke.textureOffset = {
    centerX: -minX + padding,
    centerY: -minY + padding,
    width,
    height,
  };
}

function drawPhysicsStroke(stroke) {
  if (!ctx || !stroke?.points?.length) {
    return;
  }

  if (stroke.texture && stroke.textureOffset) {
    const { centerX, centerY, width, height } = stroke.textureOffset;
    ctx.save();
    ctx.translate(stroke.body.x, stroke.body.y);
    ctx.rotate(stroke.angle);
    ctx.globalAlpha = 1;
    ctx.drawImage(stroke.texture, -centerX, -centerY, width, height);
    ctx.restore();
    return;
  }

  const vertices = stroke.points;

  for (let i = 0; i < vertices.length - 1; i += 1) {
    const p1 = vertices[i];
    const p2 = vertices[i + 1];
    drawStroke(p1, p2, 8, {
      alpha: 0.18,
      roughness: 2.0,
    });
  }
}

function tick(timestamp = 0) {
  // Stop physics when not in fullscreen mode
  const isGameActive = playPage?.classList.contains("is-active");

  if (!isGameActive) {
    // Still schedule next frame to check game state
    animationFrameId = window.requestAnimationFrame(tick);
    return;
  }

  const height = canvas?.clientHeight || 0;

  const floorY = height - 24;

  // Update physics whenever the game page is active.
  if (isGameActive) {
    // Initialize physics timing on the first tick after stage load so we
    // don't simulate a huge time gap from page load or navigation.
    if (lastPhysicsTime === 0) {
      lastPhysicsTime = timestamp;
    }
    // Catch up physics: run as many 1/60s sub-steps as needed to reach current timestamp
    while (timestamp - lastPhysicsTime >= physicsFrameDuration) {
      if (currentStage && typeof currentStage.update === "function") {
        currentStage.update(physicsStrokes, floorY);
      } else {
        stepPhysicsWorld({ deltaTime: 1 / 60 });
        physicsStrokes.forEach((stroke) => {
          if (!stroke?.points?.length || !stroke.body) {
            return;
          }

          updateStrokeBody(stroke, floorY);
        });
      }
      lastPhysicsTime += physicsFrameDuration;
      stageHasSimulated = true;
    }
  }

  // Sync circular game object positions from physics bodies (perfect circle hitboxes)
  if (gameObjects && gameObjects.length) {
    for (const obj of gameObjects) {
      if (obj.physicsBody) {
        const pos = obj.physicsBody.getPosition();
        obj.screenX = pos.x;
        obj.screenY = pos.y;
        if (typeof obj.physicsBody.getAngle === "function") {
          obj.angle = obj.physicsBody.getAngle();
        }
        if (
          obj instanceof Rotor &&
          obj.spinMode === "auto" &&
          typeof obj.physicsBody.setAngularVelocity === "function"
        ) {
          const targetVelocity = typeof obj.motorSpeed === "number" ? obj.motorSpeed : 1.5;
          obj.physicsBody.setAngularVelocity(targetVelocity);
        }
      } else {
        // non-physical objects (stars) use normalized coords
        obj.screenX = obj.nx * canvasWidth;
        obj.screenY = obj.ny * canvasHeight;
      }
    }
  }

  // Check collisions between balls and stars (simple circle overlap)
  if (gameObjects && gameObjects.length) {
    const balls = gameObjects.filter((g) => g instanceof Ball);
    const portals = gameObjects.filter((g) => g instanceof Portal);

    for (const ball of balls) {
      if (ball.physicsBody) {
        const bx = ball.screenX != null ? ball.screenX : ball.nx * canvasWidth;
        const by = ball.screenY != null ? ball.screenY : ball.ny * canvasHeight;
        const br =
          ball.physicalRadius ??
          (ball.radius > 1 ? ball.radius : ball.radius * Math.min(canvasWidth, canvasHeight));

        for (const portal of portals) {
          if (ball._portalCooldownPortalId === portal.portalId) {
            continue;
          }

          const px = portal.screenX != null ? portal.screenX : portal.nx * canvasWidth;
          const py = portal.screenY != null ? portal.screenY : portal.ny * canvasHeight;
          const pw = portal.width > 1 ? portal.width : portal.width * canvasWidth;
          const ph = portal.height > 1 ? portal.height : portal.height * canvasHeight;
          const rx = pw / 2 + br;
          const ry = ph / 2 + br;
          const dx = bx - px;
          const dy = by - py;
          if (rx > 0 && ry > 0 && (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1) {
            const target = portals.find((other) => other.portalId !== portal.portalId);
            if (target && ball.physicsBody) {
              const velocity = ball.physicsBody.getLinearVelocity();
              const angularVelocity =
                typeof ball.physicsBody.getAngularVelocity === "function"
                  ? ball.physicsBody.getAngularVelocity()
                  : 0;
              const targetX = target.screenX != null ? target.screenX : target.nx * canvasWidth;
              const targetY = target.screenY != null ? target.screenY : target.ny * canvasHeight;
              try {
                ball.physicsBody.setTransform(
                  planck.Vec2(targetX, targetY),
                  ball.physicsBody.getAngle()
                );
                ball.physicsBody.setLinearVelocity(velocity);
                if (typeof ball.physicsBody.setAngularVelocity === "function") {
                  ball.physicsBody.setAngularVelocity(angularVelocity);
                }
                ball._portalCooldownPortalId = target.portalId;
              } catch (e) {
                console.warn("portal teleport failed:", e);
              }
            }
            break;
          }
        }
      }
    }

    const stars = gameObjects.filter((g) => g instanceof Star && !g.collected);
    for (const star of stars) {
      for (const ball of balls) {
        const bx = ball.screenX != null ? ball.screenX : ball.nx * canvasWidth;
        const by = ball.screenY != null ? ball.screenY : ball.ny * canvasHeight;
        const br =
          ball.physicalRadius ??
          (ball.radius > 1 ? ball.radius : ball.radius * Math.min(canvasWidth, canvasHeight));
        const sx = star.screenX != null ? star.screenX : star.nx * canvasWidth;
        const sy = star.screenY != null ? star.screenY : star.ny * canvasHeight;
        const sr =
          star.radius > 1 ? star.radius : star.radius * Math.min(canvasWidth, canvasHeight);
        const d = Math.hypot(bx - sx, by - sy);
        if (d <= br + sr) {
          star.collected = true;
          console.debug("star collected", star, "by", ball);
          // optional: remove from gameObjects array later
          break;
        }
      }
    }

    // If all stars collected, signal stage clear
    const remaining = gameObjects.filter((g) => g instanceof Star && !g.collected);
    if (remaining.length === 0 && !stageCleared) {
      stageCleared = true;
      showStageClearOverlay("Stage Cleared!");
      if (currentStage && typeof currentStage.onClear === "function") {
        try {
          currentStage.onClear();
        } catch (e) {
          console.warn("currentStage.onClear failed:", e);
        }
      }
      window.dispatchEvent(new CustomEvent("stageClear", { detail: { stage: currentStage } }));
    }
  }
  render();
  // Continue animation loop
  animationFrameId = window.requestAnimationFrame(tick);
}

function render() {
  if (!roughCanvas || !ctx) return;

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // Check if in fullscreen mode
  const isFullscreen = document.fullscreenElement || window.innerHeight === screen.height;

  // If not fullscreen, show guidance message
  if (!isFullscreen) {
    ctx.save();

    const fontSize = Math.max(24, Math.round(canvasHeight * 0.08));
    ctx.font = `bold ${fontSize}px MyeongjoFont, serif`;
    ctx.fillStyle = "#4f3b24";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const centerY = canvasHeight / 2;
    ctx.fillText("Press F11 to enter fullscreen", canvasWidth / 2, centerY - fontSize * 0.8);
    ctx.fillText("to continue playing", canvasWidth / 2, centerY + fontSize * 0.2);

    ctx.restore();
    return;
  }

  if (currentStroke && currentStroke.length > 1) {
    drawStrokePreview(currentStroke, 8);
  }

  physicsStrokes.forEach((stroke) => drawPhysicsStroke(stroke));

  // Draw stage-declared objects (balls, stars...)
  if (gameObjects && gameObjects.length) {
    for (const obj of gameObjects) {
      if (typeof obj.draw === "function") {
        obj.draw(canvasWidth, canvasHeight, ctx);
      }
    }
  }
}

function startDrawing(event) {
  if (stageCleared || (challengeModeEnabled && challengeModeStrokeCount >= 1)) {
    return;
  }
  stageEventCount += 1;
  isDrawing = true;
  lastPoint = getPoint(event);
  currentStroke = [];
  // reset preview cache for a new stroke
  if (previewCtx) previewCtx.clearRect(0, 0, canvasWidth, canvasHeight);
  currentStrokePreviewDirty = false;
  currentStrokePreviewLastIndex = 0;
}

function continueDrawing(event) {
  const isFullscreen = document.fullscreenElement || window.innerHeight === screen.height;
  if (!isFullscreen || stageCleared || !isDrawing || !lastPoint) {
    return;
  }

  const currentPoint = getPoint(event);
  currentStroke.push(currentPoint);
  lastPoint = currentPoint;
  // mark preview cache dirty so it'll be re-generated once per change
  currentStrokePreviewDirty = true;
}

function stopDrawing(event) {
  if (!isDrawing) {
    return;
  }

  if (stageCleared) {
    isDrawing = false;
    lastPoint = null;
    if (previewCtx) previewCtx.clearRect(0, 0, canvasWidth, canvasHeight);
    currentStrokePreviewDirty = false;
    currentStrokePreviewLastIndex = 0;
    currentStroke = null;
    return;
  }

  isDrawing = false;
  lastPoint = null;

  if (!currentStroke || currentStroke.length < 2) {
    if (challengeModeEnabled) {
      currentStroke = null;
      return;
    }
    // treat as a click if user didn't draw a stroke
    const clickPos = event ? getPoint(event) : null;
    if (clickPos && gameObjects && gameObjects.length) {
      for (const obj of gameObjects) {
        if (obj instanceof Ball) {
          const bx = obj.screenX != null ? obj.screenX : obj.nx * canvasWidth;
          const by = obj.screenY != null ? obj.screenY : obj.ny * canvasHeight;
          const pr =
            obj.physicalRadius ??
            (obj.radius > 1 ? obj.radius : obj.radius * Math.min(canvasWidth, canvasHeight));
          const dx = clickPos.x - bx;
          const dy = clickPos.y - by;
          const dist = Math.hypot(dx, dy);
          if (dist <= pr + 6) {
            // apply impulse to the right
            // Apply an off-center impulse to produce immediate torque (less sliding)
            const IMPULSE_LINEAR = 99999; // reduced linear impulse
            const ANGULAR_IMPULSE = 99999; // stronger angular impulse for visible rolling
            if (obj.physicsBody) {
              try {
                const offsetY = -Math.max(2, obj.physicalRadius * 0.6);
                applyImpulseAtLocalPoint(obj.physicsBody, IMPULSE_LINEAR, 0, 0, offsetY);
                applyAngularImpulseToBody(obj.physicsBody, ANGULAR_IMPULSE);
                console.debug(
                  "applied off-center impulse",
                  IMPULSE_LINEAR,
                  "and angular impulse",
                  ANGULAR_IMPULSE,
                  "to ball at",
                  bx,
                  by
                );
              } catch (e) {
                console.warn("failed to apply impulse:", e);
              }
            }
            break;
          }
        }
      }
    }

    currentStroke = null;
    return;
  }

  // If the user drew a very short stroke (tiny jitter), treat it as a click.
  const CLICK_DISTANCE_THRESHOLD = 6; // pixels
  let totalDist = 0;
  for (let i = 1; i < currentStroke.length; i += 1) {
    const a = currentStroke[i - 1];
    const b = currentStroke[i];
    totalDist += Math.hypot(b.x - a.x, b.y - a.y);
  }
  if (totalDist <= CLICK_DISTANCE_THRESHOLD) {
    if (challengeModeEnabled) {
      currentStroke = null;
      return;
    }
    const clickPos = currentStroke[currentStroke.length - 1];
    if (clickPos && gameObjects && gameObjects.length) {
      for (const obj of gameObjects) {
        if (obj instanceof Ball) {
          const bx = obj.screenX != null ? obj.screenX : obj.nx * canvasWidth;
          const by = obj.screenY != null ? obj.screenY : obj.ny * canvasHeight;
          const pr =
            obj.physicalRadius ??
            (obj.radius > 1 ? obj.radius : obj.radius * Math.min(canvasWidth, canvasHeight));
          const dx = clickPos.x - bx;
          const dy = clickPos.y - by;
          const dist = Math.hypot(dx, dy);
          if (dist <= pr + 6) {
            const IMPULSE_LINEAR = 3500;
            const ANGULAR_IMPULSE = -1.2;
            if (obj.physicsBody) {
              try {
                const offsetY = -Math.max(2, obj.physicalRadius * 0.6);
                applyImpulseAtLocalPoint(obj.physicsBody, IMPULSE_LINEAR, 0, 0, offsetY);
                applyAngularImpulseToBody(obj.physicsBody, ANGULAR_IMPULSE);
                console.debug(
                  "applied impulse (short drag)",
                  IMPULSE_LINEAR,
                  "and angular impulse",
                  ANGULAR_IMPULSE,
                  "to ball at",
                  bx,
                  by
                );
              } catch (e) {
                console.warn("failed to apply impulse:", e);
              }
            }
            break;
          }
        }
      }
    }
    currentStroke = null;
    return;
  }

  const stageCreateStrokeBody = currentStage?.createStrokeBody || createStrokeBody;
  const stageInitializeStrokeBody = currentStage?.initializeStrokeBody || initializeStrokeBody;

  if (challengeModeEnabled && challengeModeStrokeCount >= 1) {
    currentStroke = null;
    return;
  }

  challengeModeStrokeCount += 1;

  const intersectsCancelObject = gameObjects.some((obj) => {
    if (obj instanceof CircleObject || obj instanceof Ball) {
      const circleX = obj.screenX ?? (obj.nx != null ? obj.nx * canvasWidth : null);
      const circleY = obj.screenY ?? (obj.ny != null ? obj.ny * canvasHeight : null);
      const radius =
        obj.physicalRadius ??
        (obj.radius > 1 ? obj.radius : obj.radius * Math.min(canvasWidth, canvasHeight));

      if (circleX == null || circleY == null || !Number.isFinite(radius) || radius <= 0) {
        return false;
      }

      for (let i = 1; i < currentStroke.length; i += 1) {
        const a = currentStroke[i - 1];
        const b = currentStroke[i];
        if (
          segmentIntersectsCircle(
            { x1: a.x, y1: a.y, x2: b.x, y2: b.y },
            { x: circleX, y: circleY, radius }
          )
        ) {
          return true;
        }
      }
      return false;
    }

    if (obj instanceof StripedRectObject) {
      const rectX = obj.screenX ?? (obj.nx != null ? obj.nx * canvasWidth : null);
      const rectY = obj.screenY ?? (obj.ny != null ? obj.ny * canvasHeight : null);
      const width = obj.width > 1 ? obj.width : obj.width * canvasWidth;
      const height = obj.height > 1 ? obj.height : obj.height * canvasHeight;

      if (rectX == null || rectY == null || !Number.isFinite(width) || !Number.isFinite(height)) {
        return false;
      }

      for (let i = 1; i < currentStroke.length; i += 1) {
        const a = currentStroke[i - 1];
        const b = currentStroke[i];
        if (
          segmentIntersectsRect(
            { x1: a.x, y1: a.y, x2: b.x, y2: b.y },
            { x: rectX - width / 2, y: rectY - height / 2, width, height }
          )
        ) {
          return true;
        }
      }
      return false;
    }

    return false;
  });

  const strokeBody = stageCreateStrokeBody(currentStroke);
  if (strokeBody && !intersectsCancelObject) {
    const floorY = (canvas?.clientHeight || 0) - 24;
    stageInitializeStrokeBody(strokeBody, floorY, {
      skipGround: challengeModeEnabled,
    });
    // Prefer using the preview canvas snapshot so the finalized texture
    // matches exactly what the player saw during drawing.
    createStrokeTexture(strokeBody, previewCanvas);
    physicsStrokes.push(strokeBody);
  }

  // clear preview overlay after capturing snapshot for the finalized stroke
  if (previewCtx) previewCtx.clearRect(0, 0, canvasWidth, canvasHeight);
  currentStrokePreviewDirty = false;
  currentStrokePreviewLastIndex = 0;
  currentStroke = null;
}

canvas?.addEventListener("pointerdown", startDrawing);
canvas?.addEventListener("pointermove", continueDrawing);
window.addEventListener("pointerup", stopDrawing);
window.addEventListener("pointerleave", stopDrawing);

window.addEventListener("resize", resizeCanvas);
window.addEventListener("orientationchange", resizeCanvas);
window.addEventListener("fullscreenchange", async () => {
  if (!document.fullscreenElement) return;
  if (!currentStage || stageHasSimulated || physicsStrokes.length > 0) return;
  await initializeStage(currentStageNumber);
  resizeCanvas();
});

stageButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    const stageNumber = Number(button.dataset.stage);
    if (!stageNumber || button.classList.contains("is-hidden")) {
      return;
    }
    await startStage(stageNumber);
  });
});

stagePageButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (button.classList.contains("is-disabled")) {
      return;
    }
    if (button.dataset.stagePage === "prev") {
      stagePageIndex = Math.max(0, stagePageIndex - 1);
    } else {
      stagePageIndex = Math.min(totalStagePages - 1, stagePageIndex + 1);
    }
    updateStageSelectionPage();
  });
});

initializePageFlow();
window.requestAnimationFrame(() => {
  resizeCanvas();
  window.requestAnimationFrame(() => {
    resizeCanvas();
  });
});

window.addEventListener("beforeunload", () => {
  if (playPage?.classList.contains("is-active")) {
    updateStageUrl(currentStageNumber || getRequestedStageFromUrl());
  } else {
    updateStageUrl();
  }
});

window.addEventListener("load", () => {
  document.documentElement.classList.add("js-ready");
  const loader = document.getElementById("page-loader");
  if (loader) loader.remove();
});
