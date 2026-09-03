import rough from "roughjs";
import { createCoordinateSystem } from "./coordinates.js";
import { loadStage } from "../../levels/loader/stageLoader.js";
import { resolveCircleRadius, segmentIntersectsCircle, segmentIntersectsRect } from "./geometry.js";
import { getStagePageIndexForStage } from "../../levels/pages/stagePages.js";
import { rescalePoint } from "../systems/resizeState.js";
import { shouldDeferResize } from "../systems/layoutSync.js";
import { remapGameObjects } from "../../render/canvasObjectResize.js";
import { processBallObjectInteractions } from "../../systems/gameObjectInteractions.js";
import { createActionIconCanvas } from "../../ui/uiIcons.js";
import {
  createStageClearOverlay as createStageClearOverlayUI,
  showStageClearOverlay as showStageClearOverlayUI,
  hideStageClearOverlay as hideStageClearOverlayUI,
} from "../../ui/gameUi.js";
import { getChallengeModePreference, setChallengeModePreference } from "../config/challengeMode.js";
import { shouldAdvancePhysics, shouldRenderGuidanceMessage } from "../config/inputRules.js";
import { shouldRebuildPhysicsWorld } from "../physics/physicsState.js";
import { isChallengeClearedLocal, saveChallengeCleared } from "../../ui/stageProgress.js";
import {
  stepPhysicsWorld,
  updateStrokeBody,
  resetPhysicsWorld,
  createDeviceSafePhysicsProfile,
  getPhysicsScaleProfile,
  setPhysicsScaleProfile,
} from "../physics/physics.js";
import { createPhysicsBodiesForGameObjects } from "../physics/bodySetup.js";
import { Rotor } from "../../objects/index.js";
import { syncProgressForMode } from "../../../services/auth.js";
import { createGameObjects } from "../../stages/gameObjectFactory.js";
import { DIFFICULTY_LEVELS, getDifficultyRules } from "../config/difficultyLevels.js";
import { dom, stagePageSize, totalStageCount, totalStagePages } from "./domRefs.js";
import { state } from "./gameState.js";
import { isFullscreenActive } from "./fullscreen.js";
import { render, getRenderDpr } from "../../render/gameRenderer.js";
import {
  playScoreStarSound,
  playStageClearSound,
  playStarCollectSound,
  verifyGamePageMusicAfterFirstRender,
  setActiveAudioPage,
} from "../../audio/gameAudio.js";
import { drawingAudio } from "../../audio/drawingAudioInstance.js";
import {
  updateStageSelectionPage,
  refreshStageSelectionButtons,
} from "../../ui/selectionScreen.js";
import { INK } from "../../../theme.js";

state.currentDifficulty = getInitialDifficulty();
state.difficultyRules = getDifficultyRules(state.currentDifficulty);

export function getInitialDifficulty() {
  const params = new URLSearchParams(window.location.search);
  const requestedDifficulty =
    params.get("difficulty") || sessionStorage.getItem("selectedDifficulty");
  return Object.values(DIFFICULTY_LEVELS).includes(requestedDifficulty)
    ? requestedDifficulty
    : DIFFICULTY_LEVELS.NORMAL;
}

export function isChallengeClearedStage(stageNumber) {
  return isChallengeClearedLocal(stageNumber, state.currentDifficulty);
}

export function setChallengeCleared(stageNumber) {
  saveChallengeCleared(stageNumber, state.currentDifficulty);
}

export function getLineLengthLimit() {
  const limit = state.difficultyRules?.maxLineLength ?? null;
  return limit == null ? null : limit;
}

export function isDrawLimitReached() {
  const limit = getLineLengthLimit();
  return limit != null && state.totalDrawnLength >= limit;
}

export function updateDrawLimitProgressUI({ previewLength = state.totalDrawnLength } = {}) {
  const limit = getLineLengthLimit();
  const {
    drawLimitProgress,
    drawLimitProgressTrackCanvas,
    drawLimitProgressFillCanvas,
    mobileLaunchButton,
  } = dom;
  if (!drawLimitProgress || !drawLimitProgressTrackCanvas || !drawLimitProgressFillCanvas) {
    return;
  }

  if (limit == null) {
    drawLimitProgress.classList.remove("is-visible");
    if (mobileLaunchButton) mobileLaunchButton.disabled = false;
    state.drawLimitProgressTrackDrawn = false;
    const trackCtx = drawLimitProgressTrackCanvas.getContext("2d");
    const fillCtx = drawLimitProgressFillCanvas.getContext("2d");
    if (trackCtx) {
      trackCtx.clearRect(
        0,
        0,
        drawLimitProgressTrackCanvas.width,
        drawLimitProgressTrackCanvas.height
      );
    }
    if (fillCtx) {
      fillCtx.clearRect(
        0,
        0,
        drawLimitProgressFillCanvas.width,
        drawLimitProgressFillCanvas.height
      );
    }
    return;
  }

  const displayLength = Math.max(
    0,
    Number.isFinite(previewLength) ? previewLength : state.totalDrawnLength
  );
  if (mobileLaunchButton) {
    mobileLaunchButton.disabled = isDrawLimitReached();
    mobileLaunchButton.setAttribute("aria-disabled", String(mobileLaunchButton.disabled));
  }
  const dpr = getRenderDpr();
  const pxWidth = drawLimitProgress.clientWidth || 320;
  const pxHeight = drawLimitProgress.clientHeight || 12;
  const width = Math.max(1, pxWidth);
  const height = Math.max(1, pxHeight);
  const padding = 6;
  const trackY = 1;
  const trackW = width - padding * 2;
  const trackH = Math.max(8, height - 2);
  const ratio = Math.min(Math.max(displayLength / limit, 0), 1);
  const fillW = Math.max(0, trackW * ratio);

  if (!state.drawLimitProgressTrackDrawn) {
    drawLimitProgressTrackCanvas.width = Math.max(1, width * dpr);
    drawLimitProgressTrackCanvas.height = Math.max(1, height * dpr);
    drawLimitProgressTrackCanvas.style.width = `${width}px`;
    drawLimitProgressTrackCanvas.style.height = `${height}px`;

    const rcTrack = rough.canvas(drawLimitProgressTrackCanvas);
    const trackCtx = drawLimitProgressTrackCanvas.getContext("2d");
    if (trackCtx) {
      trackCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      trackCtx.clearRect(0, 0, width, height);
    }

    rcTrack.rectangle(padding, trackY, trackW, trackH, {
      fill: "rgba(79, 59, 36, 0.08)",
      stroke: INK,
      strokeWidth: 1.2,
      roughness: 1.8,
      bowing: 1.2,
    });

    state.drawLimitProgressTrackDrawn = true;
  }

  drawLimitProgressFillCanvas.width = Math.max(1, width * dpr);
  drawLimitProgressFillCanvas.height = Math.max(1, height * dpr);
  drawLimitProgressFillCanvas.style.width = `${width}px`;
  drawLimitProgressFillCanvas.style.height = `${height}px`;

  const rcFill = rough.canvas(drawLimitProgressFillCanvas);
  const fillCtx = drawLimitProgressFillCanvas.getContext("2d");
  if (fillCtx) {
    fillCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fillCtx.clearRect(0, 0, width, height);
  }

  if (fillW > 0) {
    rcFill.rectangle(padding, trackY, fillW, trackH, {
      fill: "rgba(160, 110, 55, 0.72)",
      stroke: INK,
      strokeWidth: 1,
      roughness: 2.2,
      bowing: 1.4,
    });
  }

  drawLimitProgress.classList.add("is-visible");
}

export function lockLandscapeOrientation() {
  const attemptLock = () => {
    try {
      if (!screen?.orientation || typeof screen.orientation.lock !== "function") {
        return;
      }
      screen.orientation.lock("landscape").catch(() => {
        // iOS/Safari often rejects orientation locking; do not block the app.
      });
    } catch {
      // Ignore unsupported or blocked orientation locks.
    }
  };

  attemptLock();
  window.addEventListener("orientationchange", attemptLock, { passive: true });
}

export function resetStageState() {
  if (state.stageClearOverlayTimer) {
    clearTimeout(state.stageClearOverlayTimer);
    state.stageClearOverlayTimer = null;
  }
  if (state.animationFrameId) {
    cancelAnimationFrame(state.animationFrameId);
    state.animationFrameId = null;
  }
  // 난이도 규칙 적용: Challenge 모드는 hard/insane에서만 활성화 가능
  const userPrefersChallenge = getChallengeModePreference();
  const canEnableChallenge = state.difficultyRules.enableChallengeMode;
  state.challengeModeEnabled =
    state.currentDifficulty === DIFFICULTY_LEVELS.INSANE ||
    (userPrefersChallenge && canEnableChallenge);

  resetPhysicsWorld();
  state.gameObjects = [];
  state.physicsStrokes = [];
  state.currentStroke = null;
  state.isDrawing = false;
  state.lastPoint = null;
  state.stageCleared = false;
  state.currentStage = null;
  state.stageHasSimulated = false;
  state.stageEventCount = 0;
  state.challengeModeStrokeCount = 0;
  state.stageMinEvents = 0;
  state.totalDrawnLength = 0;
  state.drawLimitProgressTrackDrawn = false;
  state.lastPhysicsTime = 0;
  state.floorTextureCanvas = null;
  state.floorTextureKey = null;
  state.currentStrokePreviewDirty = false;
  state.currentStrokePreviewLastIndex = 0;
  if (state.ctx && state.canvasWidth > 0 && state.canvasHeight > 0) {
    state.ctx.clearRect(0, 0, state.canvasWidth, state.canvasHeight);
  }
  if (state.previewCtx && state.canvasWidth > 0 && state.canvasHeight > 0) {
    state.previewCtx.clearRect(0, 0, state.canvasWidth, state.canvasHeight);
  }
  updateDrawLimitProgressUI();
  hideStageClearOverlay();
  hideGameRetryButton();
  hideGameExitButton();
}

export function updateStageUrl(stageNumber = null) {
  const nextUrl = new URL(window.location.href);
  if (stageNumber) {
    nextUrl.searchParams.set("stage", String(stageNumber));
  } else {
    nextUrl.searchParams.delete("stage");
  }
  window.history.replaceState(null, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
}

export function setActivePage(page) {
  [dom.startPage, dom.selectionPage, dom.playPage].forEach((item) => {
    if (!item) return;
    item.classList.toggle("is-active", item === page);
  });
  setActiveAudioPage(page);
  if (page === dom.selectionPage) {
    resetStageState();
    updateStageUrl();
    if (Number.isInteger(state.currentStageNumber)) {
      state.stagePageIndex = getStagePageIndexForStage(
        state.currentStageNumber,
        stagePageSize,
        totalStagePages
      );
      updateStageSelectionPage();
    }
  }
}

export async function tryEnterFullscreen() {
  const isFullscreen = isFullscreenActive();
  if (isFullscreen) {
    return;
  }
  if (window.electronAPI?.setFullscreen) {
    try {
      await window.electronAPI.setFullscreen(true);
      return;
    } catch (err) {
      console.warn("Electron 전체화면 전환 실패:", err);
    }
  }
  if (document.documentElement.requestFullscreen) {
    try {
      await document.documentElement.requestFullscreen();
    } catch (err) {
      console.warn("전체화면 전환 실패:", err);
    }
  }
}

export function createStageClearOverlay() {
  if (!dom.board || state.stageClearOverlay) return;
  const stageClearOverlayRef = { current: null };
  const stageClearMessageRef = { current: null };
  createStageClearOverlayUI({
    board: dom.board,
    stageClearOverlayRef,
    stageClearMessageRef,
  });
  state.stageClearOverlay = stageClearOverlayRef.current;
  state.stageClearMessage = stageClearMessageRef.current;

  if (!state.stageClearOverlay || !state.stageClearMessage) return;

  const exitBtn = state.stageClearMessage.querySelector(".stage-clear-exit");
  const retryBtn = state.stageClearMessage.querySelector(".stage-clear-retry");
  const nextBtn = state.stageClearMessage.querySelector(".stage-clear-next");

  if (exitBtn) {
    exitBtn.addEventListener("click", async () => {
      hideStageClearOverlay();
      setActivePage(dom.selectionPage);
      if (state.animationFrameId) cancelAnimationFrame(state.animationFrameId);
    });
  }
  if (retryBtn) {
    retryBtn.addEventListener("click", async () => {
      hideStageClearOverlay();
      await initializeStage(state.currentStageNumber);
      resizeCanvas();
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener("click", async () => {
      hideStageClearOverlay();
      const next = Math.min((state.currentStageNumber || 1) + 1, totalStageCount);
      await startStage(next);
    });
  }
}

export function showStageClearOverlay(message = "Stage Cleared!") {
  if (!state.stageClearOverlay || !state.stageClearMessage) {
    createStageClearOverlay();
  }
  if (!state.stageClearOverlay || !state.stageClearMessage) return;

  state.stageClearMessage.querySelector(".stage-clear-title").textContent = message;

  // Challenge 모드로 클리어한 경우 저장
  if (state.challengeModeEnabled) {
    setChallengeCleared(state.currentStageNumber);
  }

  showStageClearOverlayUI({
    overlay: state.stageClearOverlay,
    message: state.stageClearMessage,
    stageClearState: {
      stageMinEvents: state.stageMinEvents,
      stageEventCount: state.stageEventCount,
    },
    stageButtons: dom.stageButtons,
    canvas: dom.canvas,
    stageNumber: state.currentStageNumber,
    difficulty: state.currentDifficulty,
    onAfterSave: () => {
      refreshStageSelectionButtons();
    },
    onScoreStarAppear: playScoreStarSound,
  });
}

export function hideStageClearOverlay() {
  hideStageClearOverlayUI(state.stageClearOverlay, dom.canvas);
}

export function createGameExitButton() {
  if (!dom.board || state.gameExitButton) return;

  const gameExitButton = document.createElement("button");
  gameExitButton.className = "game-exit-btn game-hud-corner-btn";
  gameExitButton.setAttribute("type", "button");
  gameExitButton.setAttribute("aria-label", "Exit to stage selection");

  gameExitButton.appendChild(createActionIconCanvas("exit", { w: 60, h: 48, strokeWidth: 2.5 }));
  gameExitButton.addEventListener("click", async () => {
    hideStageClearOverlay();
    setActivePage(dom.selectionPage);
    if (state.animationFrameId) cancelAnimationFrame(state.animationFrameId);
  });

  dom.board.appendChild(gameExitButton);
  state.gameExitButton = gameExitButton;
}

export function createGameRetryButton() {
  if (!dom.board || state.gameRetryButton) return;

  const gameRetryButton = document.createElement("button");
  gameRetryButton.className = "game-retry-btn game-hud-corner-btn";
  gameRetryButton.setAttribute("type", "button");
  gameRetryButton.setAttribute("aria-label", "Retry current stage");

  gameRetryButton.appendChild(createActionIconCanvas("retry", { w: 60, h: 48, strokeWidth: 2.5 }));
  gameRetryButton.addEventListener("click", async () => {
    hideStageClearOverlay();
    await initializeStage(state.currentStageNumber);
    resizeCanvas();
  });

  dom.board.appendChild(gameRetryButton);
  state.gameRetryButton = gameRetryButton;
}

export function hideGameExitButton() {
  if (state.gameExitButton) {
    state.gameExitButton.remove();
    state.gameExitButton = null;
  }
}

export function hideGameRetryButton() {
  if (state.gameRetryButton) {
    state.gameRetryButton.remove();
    state.gameRetryButton = null;
  }
}

export function getRequestedStageFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const value = Number(params.get("stage"));
  return Number.isInteger(value) && value >= 1 && value <= totalStageCount ? value : null;
}

export async function startStage(stageNumber) {
  if (!stageNumber) {
    return;
  }
  state.currentStageNumber = stageNumber;
  setActivePage(dom.playPage);
  await tryEnterFullscreen();
  updateStageUrl(stageNumber);
  await initializeStage(stageNumber);
  resizeCanvas();
}

window.addEventListener("sketchybook:start-game", async (event) => {
  const requestedDifficulty = event.detail?.difficulty;
  if (Object.values(DIFFICULTY_LEVELS).includes(requestedDifficulty)) {
    state.currentDifficulty = requestedDifficulty;
    state.difficultyRules = getDifficultyRules(state.currentDifficulty);
    if (state.currentDifficulty === DIFFICULTY_LEVELS.INSANE) {
      setChallengeModePreference(true);
    }
    sessionStorage.setItem("selectedDifficulty", state.currentDifficulty);
  }

  setActivePage(dom.selectionPage);
  updateStageSelectionPage();
  await tryEnterFullscreen();
});

export async function initializePageFlow() {
  const requestedStage = getRequestedStageFromUrl();
  if (requestedStage) {
    state.currentStageNumber = requestedStage;
    setActivePage(dom.playPage);
    updateStageUrl(requestedStage);
    await initializeStage(requestedStage);
    resizeCanvas();
  } else {
    state.stagePageIndex = getStagePageIndexForStage(
      state.currentStageNumber,
      stagePageSize,
      totalStagePages
    );
    setActivePage(dom.startPage);
  }
}

export async function initializeStage(stageNumberOverride) {
  if (!dom.canvas || !dom.board) {
    return;
  }

  resetStageState();
  if (Number.isInteger(stageNumberOverride)) {
    state.currentStageNumber = stageNumberOverride;
  }

  state.currentStage = await loadStage(
    dom.canvas,
    dom.board,
    stageNumberOverride,
    state.currentDifficulty
  );
  if (state.currentStage?.coordinateSystem) {
    state.coordinateSystem = state.currentStage.coordinateSystem;
  }
  if (typeof state.currentStage?.initialize === "function") {
    state.currentStage.initialize();
  }

  try {
    createStageClearOverlay();
  } catch (error) {
    console.warn("stage clear overlay creation failed:", error);
  }

  // Populate gameObjects from stage data (if any)
  state.gameObjects = [];
  state.stageCleared = false;
  state.physicsStrokes = [];
  state.currentStroke = null;
  state.isDrawing = false;
  state.lastPoint = null;
  state.lastPhysicsTime = 0;
  state.stageEventCount = 0;
  state.stageMinEvents = Number.isFinite(state.currentStage?.minEvents)
    ? state.currentStage.minEvents
    : 0;
  hideStageClearOverlay();
  state.gameObjects = createGameObjects(state.currentStage?.objects);

  createGameExitButton();
  createGameRetryButton();
  updateDrawLimitProgressUI();
}

export function resizeCanvas() {
  if (!dom.board || !dom.canvas) {
    return;
  }

  const measuredWidth = dom.board.clientWidth;
  const measuredHeight = dom.board.clientHeight;
  const dpr = getRenderDpr();

  if (shouldDeferResize(measuredWidth, measuredHeight)) {
    return;
  }

  const previousCanvasWidth = state.canvasWidth;
  const previousCanvasHeight = state.canvasHeight;
  let previewSnapshot = null;
  if (
    state.currentStroke?.length &&
    state.previewCanvas &&
    previousCanvasWidth > 0 &&
    previousCanvasHeight > 0
  ) {
    previewSnapshot = document.createElement("canvas");
    previewSnapshot.width = state.previewCanvas.width;
    previewSnapshot.height = state.previewCanvas.height;
    const snapshotCtx = previewSnapshot.getContext("2d");
    snapshotCtx?.drawImage(state.previewCanvas, 0, 0);
  }
  state.canvasWidth = measuredWidth;
  state.canvasHeight = measuredHeight;

  dom.canvas.width = state.canvasWidth * dpr;
  dom.canvas.height = state.canvasHeight * dpr;
  dom.canvas.style.width = `${state.canvasWidth}px`;
  dom.canvas.style.height = `${state.canvasHeight}px`;

  state.ctx = dom.canvas.getContext("2d");
  if (!state.ctx) {
    return;
  }

  state.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const nextPhysicsProfile = createDeviceSafePhysicsProfile({
    width: state.canvasWidth,
    height: state.canvasHeight,
    dpr,
  });
  setPhysicsScaleProfile(nextPhysicsProfile);
  state.ctx.clearRect(0, 0, state.canvasWidth, state.canvasHeight);

  state.coordinateSystem = createCoordinateSystem({
    viewportWidth: state.canvasWidth,
    viewportHeight: state.canvasHeight,
  });
  state.roughCanvas = rough.canvas(dom.canvas);
  state.roughCanvas.ctx.globalAlpha = 1;

  // Create or resize the preview overlay canvas. This canvas sits above
  // the main game canvas and is only updated when the stroke changes.
  if (!state.previewCanvas) {
    state.previewCanvas = document.createElement("canvas");
    state.previewCanvas.className = "game-preview-canvas";
    state.previewCanvas.style.position = "absolute";
    state.previewCanvas.style.inset = "0";
    state.previewCanvas.style.pointerEvents = "none";
    state.previewCanvas.style.zIndex = "50";
    if (dom.board) dom.board.appendChild(state.previewCanvas);
  }
  state.previewCanvas.width = Math.max(1, state.canvasWidth) * dpr;
  state.previewCanvas.height = Math.max(1, state.canvasHeight) * dpr;
  state.previewCanvas.style.width = `${Math.max(1, state.canvasWidth)}px`;
  state.previewCanvas.style.height = `${Math.max(1, state.canvasHeight)}px`;
  state.previewCtx = state.previewCanvas.getContext("2d");
  state.previewCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  state.previewCtx.clearRect(0, 0, state.canvasWidth, state.canvasHeight);
  if (previewSnapshot && previousCanvasWidth > 0 && previousCanvasHeight > 0) {
    state.previewCtx.drawImage(
      previewSnapshot,
      0,
      0,
      previewSnapshot.width,
      previewSnapshot.height,
      0,
      0,
      state.canvasWidth,
      state.canvasHeight
    );
  }

  const needsLayoutRemap =
    previousCanvasWidth > 0 &&
    previousCanvasHeight > 0 &&
    (previousCanvasWidth !== state.canvasWidth || previousCanvasHeight !== state.canvasHeight);

  if (needsLayoutRemap && state.gameObjects.length) {
    remapGameObjects(
      state.gameObjects,
      previousCanvasWidth,
      previousCanvasHeight,
      state.canvasWidth,
      state.canvasHeight
    );
  }

  if (needsLayoutRemap && state.currentStroke?.length) {
    state.currentStroke = state.currentStroke.map((point) =>
      rescalePoint(
        point,
        previousCanvasWidth,
        previousCanvasHeight,
        state.canvasWidth,
        state.canvasHeight
      )
    );
    state.currentStrokePreviewDirty = false;
  }

  const shouldRebuildPhysics = shouldRebuildPhysicsWorld({
    needsLayoutRemap,
    stageHasSimulated: state.stageHasSimulated,
    physicsStrokeCount: state.physicsStrokes.length,
    hasExistingPhysicsBodies: state.gameObjects.some(
      (obj) => obj.physicsBody || (obj.physicsBodies && obj.physicsBodies.length)
    ),
  });
  if (shouldRebuildPhysics) {
    resetPhysicsWorld();
    for (const obj of state.gameObjects) {
      if (obj.physicsBody) {
        obj.physicsBody = null;
      }
      if (obj.physicsBodies) {
        obj.physicsBodies = null;
      }
    }
    for (const stroke of state.physicsStrokes) {
      stroke.physicsBody = null;
      stroke.physicsSegments = [];
      stroke.grounded = false;
      stroke.angle = 0;
      stroke.angularVelocity = 0;
      stroke.texture = null;
      stroke.textureOffset = null;
    }
  }

  const floorYForPhysics = dom.canvas?.clientHeight
    ? dom.canvas.clientHeight - 24
    : state.canvasHeight - 24;

  createPhysicsBodiesForGameObjects({
    gameObjects: state.gameObjects,
    canvasWidth: state.canvasWidth,
    canvasHeight: state.canvasHeight,
    floorYForPhysics,
    challengeModeEnabled: state.challengeModeEnabled,
    difficultyRules: state.difficultyRules,
  });

  if (state.animationFrameId) {
    cancelAnimationFrame(state.animationFrameId);
  }
  state.animationFrameId = window.requestAnimationFrame(tick);
}

export function syncGamePlayState() {
  const isGameActive = dom.playPage?.classList.contains("is-active");
  const isFullscreen = isFullscreenActive();
  const isPageVisible = !document.hidden;
  const shouldPauseForFocusLoss = !state.isWindowFocused || !document.hasFocus();

  if (
    !shouldAdvancePhysics({ isGameActive, isFullscreen, isPageVisible }) ||
    shouldPauseForFocusLoss
  ) {
    state.lastPhysicsTime = 0;
    if (state.isDrawing) {
      state.isDrawing = false;
      state.lastPoint = null;
      if (state.previewCtx) state.previewCtx.clearRect(0, 0, state.canvasWidth, state.canvasHeight);
      state.currentStrokePreviewDirty = false;
      state.currentStrokePreviewLastIndex = 0;
      state.currentStroke = null;
    }
  }
}

export function tick(timestamp = 0) {
  const isGameActive = dom.playPage?.classList.contains("is-active");
  const isFullscreen = isFullscreenActive();
  const isPageVisible = !document.hidden;
  const shouldPauseForFocusLoss = !state.isWindowFocused || !document.hasFocus();
  const shouldRunSimulation =
    shouldAdvancePhysics({
      isGameActive,
      isFullscreen,
      isPageVisible,
    }) && !shouldPauseForFocusLoss;

  if (!shouldRunSimulation) {
    if (shouldRenderGuidanceMessage({ isGameActive, isFullscreen, isPageVisible })) {
      render();
      verifyGamePageMusicAfterFirstRender(isGameActive);
    }
    state.animationFrameId = window.requestAnimationFrame(tick);
    return;
  }

  const height = dom.canvas?.clientHeight || 0;
  const profile =
    getPhysicsScaleProfile() ||
    createDeviceSafePhysicsProfile({
      width: state.canvasWidth || window.innerWidth || 900,
      height: state.canvasHeight || window.innerHeight || 600,
      dpr: window.devicePixelRatio || 1,
    });
  const floorY = profile?.floorY ?? height - 24;

  if (shouldRunSimulation) {
    if (state.lastPhysicsTime === 0) {
      state.lastPhysicsTime = timestamp;
    }

    const elapsed = Math.max(0, timestamp - state.lastPhysicsTime);
    if (elapsed > 0) {
      const deltaSeconds = Math.min(elapsed / 1000, 0.032);
      const nextProfile =
        profile ||
        createDeviceSafePhysicsProfile({
          width: state.canvasWidth || window.innerWidth || 900,
          height: state.canvasHeight || window.innerHeight || 600,
          dpr: window.devicePixelRatio || 1,
        });
      setPhysicsScaleProfile(nextProfile);

      if (state.currentStage && typeof state.currentStage.update === "function") {
        state.currentStage.update(state.physicsStrokes, floorY, {
          deltaTime: deltaSeconds,
          substeps: nextProfile.maxSubsteps,
          velocityIterations: 8,
        });
      } else {
        stepPhysicsWorld({
          deltaTime: deltaSeconds,
          substeps: nextProfile.maxSubsteps,
          velocityIterations: 8,
        });
        state.physicsStrokes.forEach((stroke) => {
          if (!stroke?.points?.length || !stroke.body) {
            return;
          }

          updateStrokeBody(stroke, floorY);
        });
      }

      state.lastPhysicsTime = timestamp;
      state.stageHasSimulated = true;
    }
  }

  // Sync circular game object positions from physics bodies (perfect circle hitboxes)
  if (state.gameObjects && state.gameObjects.length) {
    for (const obj of state.gameObjects) {
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
        obj.screenX = obj.nx * state.canvasWidth;
        obj.screenY = obj.ny * state.canvasHeight;
      }
    }
  }

  const { allStarsCollected } = processBallObjectInteractions({
    gameObjects: state.gameObjects,
    canvasWidth: state.canvasWidth,
    canvasHeight: state.canvasHeight,
    onStarCollected: (star, ball) => {
      playStarCollectSound(star, ball);
      console.debug("star collected", star, "by", ball);
    },
  });

  // If all stars collected, signal stage clear
  if (allStarsCollected && !state.stageCleared) {
    state.stageCleared = true;
    drawingAudio.stop();
    const currentMode = state.currentDifficulty;
    syncProgressForMode(currentMode).catch((err) => {
      console.error("[Sync] 데이터 동기화 실패:", err);
    });
    state.stageClearOverlayTimer = window.setTimeout(() => {
      state.stageClearOverlayTimer = null;
      playStageClearSound();
      showStageClearOverlay("Stage Cleared!");
    }, 750);
    if (state.currentStage && typeof state.currentStage.onClear === "function") {
      try {
        state.currentStage.onClear();
      } catch (e) {
        console.warn("currentStage.onClear failed:", e);
      }
    }
    window.dispatchEvent(new CustomEvent("stageClear", { detail: { stage: state.currentStage } }));
  }
  render();
  verifyGamePageMusicAfterFirstRender(isGameActive);
  // Continue animation loop
  state.animationFrameId = window.requestAnimationFrame(tick);
}
