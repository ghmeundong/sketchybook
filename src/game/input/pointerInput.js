import { segmentIntersectsCircle, segmentIntersectsRect } from "../engine/core/geometry.js";
import {
  CircleObject,
  Ball,
  Platform,
  StripedRectObject,
  Segment,
  Rotor,
} from "../objects/index.js";
import {
  createStrokeBody,
  initializeStrokeBody,
  applyAngularImpulseToBody,
  applyImpulseAtLocalPoint,
  isBodyTouchingSurface,
  attachBodyToBody,
  getPhysicsScaleProfile,
} from "../engine/physics/physics.js";
import { getBallImpulseValues } from "../engine/physics/bodySetup.js";
import { enqueuePhysicsEvent } from "../engine/physics/physicsState.js";
import {
  exceedsLineLengthLimit,
  getLogicalInputTolerance,
  getLogicalStrokeDistance,
  getStrokeDistance,
  shouldRejectStroke,
} from "./drawingPolicy.js";
import { shouldHandleSpacebarAction } from "../engine/config/inputRules.js";
import { createStrokeTexture } from "../render/gameRenderer.js";
import { drawingAudio } from "../audio/drawingAudioInstance.js";
import { dom } from "../engine/core/domRefs.js";
import { state } from "../engine/core/gameState.js";

import {
  getLineLengthLimit,
  isDrawLimitReached,
  updateDrawLimitProgressUI,
  completeTutorialStageThreeAfterReset,
  initializeStage,
  resizeCanvas,
  hideStageClearOverlay,
  startPlayground,
  startStage,
} from "../engine/core/gameController.js";
import { recordPlaygroundStroke } from "../ui/playgroundHistory.js";
import {
  isRoomConnected,
  sendRoomBallLaunch,
  sendRoomStroke,
  sendRoomStrokePreview,
  cancelRoomStrokePreview,
} from "../../services/multiplayer.js";
import { INK } from "../../theme.js";

const MAX_SHARED_STROKE_POINTS = 256;
const MAX_PREVIEW_BATCH_POINTS = 31;
const PREVIEW_SEND_INTERVAL_MS = 50;
const pendingBallLaunches = new Set();
const pendingBallLaunchTimers = new Map();
let liveStrokeId = null;
let liveStrokeSequence = 0;
let liveStrokeSentPointCount = 0;
let liveStrokeLastSentAt = 0;
let liveStrokeAnchor = null;

function segmentsCross(first, second) {
  const orientation = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const firstSide = orientation(first.a, first.b, second.a);
  const secondSide = orientation(first.a, first.b, second.b);
  const thirdSide = orientation(second.a, second.b, first.a);
  const fourthSide = orientation(second.a, second.b, first.b);

  return (
    ((firstSide > 0 && secondSide < 0) || (firstSide < 0 && secondSide > 0)) &&
    ((thirdSide > 0 && fourthSide < 0) || (thirdSide < 0 && fourthSide > 0))
  );
}

function strokeIntersectsObject(stroke, object) {
  if (!stroke?.length || !object) return false;
  const { canvasWidth, canvasHeight } = state;

  const strokeSegments = stroke.slice(1).map((point, index) => ({
    a: stroke[index],
    b: point,
  }));

  if (object instanceof CircleObject || object instanceof Ball) {
    const x = object.screenX ?? object.nx * canvasWidth;
    const y = object.screenY ?? object.ny * canvasHeight;
    const radius =
      object.physicalRadius ??
      (object.radius > 1 ? object.radius : object.radius * Math.min(canvasWidth, canvasHeight));
    return strokeSegments.some(({ a, b }) =>
      segmentIntersectsCircle({ x1: a.x, y1: a.y, x2: b.x, y2: b.y }, { x, y, radius })
    );
  }

  if (object instanceof Platform || object instanceof StripedRectObject) {
    const x = object.screenX ?? object.nx * canvasWidth;
    const y = object.screenY ?? object.ny * canvasHeight;
    const width = object.width > 1 ? object.width : object.width * canvasWidth;
    const height = object.height > 1 ? object.height : object.height * canvasHeight;
    return strokeSegments.some(({ a, b }) =>
      segmentIntersectsRect(
        { x1: a.x, y1: a.y, x2: b.x, y2: b.y },
        { x: x - width / 2, y: y - height / 2, width, height }
      )
    );
  }

  const points =
    object instanceof Segment
      ? [
          { x: object.x1 * canvasWidth, y: object.y1 * canvasHeight },
          { x: object.x2 * canvasWidth, y: object.y2 * canvasHeight },
        ]
      : object.pixelPoints;
  if (!Array.isArray(points) || points.length < 2) return false;

  const objectSegments = points.slice(1).map((point, index) => ({
    a: points[index],
    b: point,
  }));
  if (object.closed) {
    objectSegments.push({ a: points[points.length - 1], b: points[0] });
  }

  return strokeSegments.some((strokeSegment) =>
    objectSegments.some((objectSegment) => segmentsCross(strokeSegment, objectSegment))
  );
}

function findStrokeAttachment(stroke, floorY, hasFloor = true) {
  if (!stroke?.length) return null;
  if (hasFloor && !state.challengeModeEnabled && stroke.some((point) => point.y >= floorY)) {
    return { type: "floor" };
  }

  return (
    state.gameObjects.find(
      (object) => object instanceof Rotor && strokeIntersectsObject(stroke, object)
    ) || null
  );
}

function createAndRegisterStroke(points) {
  if (state.challengeModeEnabled && state.challengeModeStrokeCount >= 1) return false;

  const intersectsStripedArea = state.gameObjects.some(
    (obj) => obj instanceof StripedRectObject && strokeIntersectsObject(points, obj)
  );
  const intersectsHatchedCircle = state.gameObjects.some(
    (obj) => obj instanceof CircleObject && strokeIntersectsObject(points, obj)
  );
  const intersectsBall = state.gameObjects.some(
    (obj) => obj instanceof Ball && strokeIntersectsObject(points, obj)
  );
  const strokeBody = state.currentStage?.createStrokeBody
    ? state.currentStage.createStrokeBody(points)
    : createStrokeBody(points);
  if (
    !strokeBody ||
    shouldRejectStroke({
      intersectsStripedArea,
      intersectsHatchedCircle,
      intersectsBall,
      canDrawOnBall: state.difficultyRules.canDrawOnBall,
    })
  ) {
    updateDrawLimitProgressUI();
    return false;
  }

  const floorY = getPhysicsScaleProfile()?.floorY ?? state.canvasHeight - 32;
  const attachment = findStrokeAttachment(points, floorY, state.difficultyRules.hasFloor);
  const attachmentBody = attachment?.physicsBody;
  const isMovingAttachment =
    attachmentBody && typeof attachmentBody.getType === "function"
      ? attachmentBody.getType() !== "static"
      : false;
  const initializeBody = state.currentStage?.initializeStrokeBody
    ? state.currentStage.initializeStrokeBody.bind(state.currentStage)
    : initializeStrokeBody;
  initializeBody(strokeBody, floorY, {
    skipGround: state.challengeModeEnabled || !state.difficultyRules.hasFloor,
    type: attachment && !isMovingAttachment ? "static" : "dynamic",
  });
  if (isMovingAttachment) {
    strokeBody.attachedTo = attachment;
    attachBodyToBody(strokeBody.physicsBody, attachmentBody, attachmentBody.getPosition());
  }

  createStrokeTexture(strokeBody);
  state.physicsStrokes.push(strokeBody);
  recordPlaygroundStroke(strokeBody);
  if (state.challengeModeEnabled) state.challengeModeStrokeCount += 1;
  state.totalDrawnLength += getLogicalStrokeDistance(points);
  updateDrawLimitProgressUI();
  if (state.currentStageNumber === 5 && attachment instanceof Rotor) {
    window.dispatchEvent(new CustomEvent("sketchybook:stage-five-stroke"));
  }
  if (state.currentStageNumber === 9) {
    window.dispatchEvent(new CustomEvent("sketchybook:stage-nine-stroke"));
  }
  return true;
}

function compactStroke(points) {
  if (points.length <= MAX_SHARED_STROKE_POINTS) return points;
  return Array.from({ length: MAX_SHARED_STROKE_POINTS }, (_, index) => {
    const sourceIndex = Math.round((index * (points.length - 1)) / (MAX_SHARED_STROKE_POINTS - 1));
    return points[sourceIndex];
  });
}

function receiveRoomStroke(message) {
  if (
    !message?.eventId ||
    !Number.isFinite(message.applyAt) ||
    !Array.isArray(message.points) ||
    !state.coordinateSystem
  ) {
    return;
  }

  const logicalPoints = message.points;
  state.roomStrokePreviews = state.roomStrokePreviews.filter(
    (stroke) =>
      stroke.eventId !== message.eventId &&
      !(stroke.playerId === message.playerId && stroke.strokeId === message.strokeId)
  );
  state.roomStrokePreviews.push({
    eventId: message.eventId,
    strokeId: message.strokeId,
    playerId: message.playerId,
    points: logicalPoints,
    width: message.width,
    color: message.color,
  });

  enqueuePhysicsEvent(state.pendingPhysicsEvents, message.applyAt, () => {
    state.roomStrokePreviews = state.roomStrokePreviews.filter(
      (stroke) => stroke.eventId !== message.eventId
    );
    if (
      dom.playPage?.classList.contains("is-active") &&
      state.currentStageNumber === message.stageNumber
    ) {
      createAndRegisterStroke(logicalPoints);
    }
  });
}

function applyBallLaunch() {
  state.stageEventCount += 1;
  for (const obj of state.gameObjects) {
    if (!(obj instanceof Ball) || !obj.physicsBody) continue;

    try {
      const { linear: impulseLinear, angular: angularImpulse } = getBallImpulseValues();
      const offsetY = -Math.max(2, obj.physicalRadius * 0.6);
      applyImpulseAtLocalPoint(obj.physicsBody, impulseLinear, 0, 0, offsetY);
      applyAngularImpulseToBody(obj.physicsBody, angularImpulse);
      if (getLineLengthLimit() !== null) {
        state.totalDrawnLength += 200;
        updateDrawLimitProgressUI();
      }
    } catch (error) {
      console.warn("moving ball failed:", error);
    }
    break;
  }
}

function receiveRoomBallLaunch(message) {
  if (
    !message?.eventId ||
    !Number.isFinite(message.applyAt) ||
    !Number.isInteger(message.stageNumber)
  ) {
    return;
  }

  const pendingTimerId = pendingBallLaunchTimers.get(message.eventId);
  if (pendingTimerId) window.clearTimeout(pendingTimerId);
  pendingBallLaunchTimers.delete(message.eventId);
  pendingBallLaunches.delete(message.eventId);

  enqueuePhysicsEvent(state.pendingPhysicsEvents, message.applyAt, () => {
    if (
      dom.playPage?.classList.contains("is-active") &&
      state.currentStageNumber === message.stageNumber
    ) {
      applyBallLaunch();
    }
  });
}

function receiveRoomStrokePreview(message) {
  if (
    !message?.strokeId ||
    !message.playerId ||
    !Array.isArray(message.points) ||
    !state.coordinateSystem
  ) {
    return;
  }

  const preview = state.roomStrokePreviews.find(
    (stroke) => stroke.playerId === message.playerId && stroke.strokeId === message.strokeId
  );
  const logicalPoints = message.points;
  if (preview) {
    preview.points.push(...logicalPoints.slice(preview.points.length ? 1 : 0));
    preview.sequence = message.sequence;
    return;
  }

  state.roomStrokePreviews.push({
    playerId: message.playerId,
    strokeId: message.strokeId,
    sequence: message.sequence,
    points: logicalPoints,
    color: INK,
    width: 8,
  });
}

function removeRoomStrokePreview(message) {
  state.roomStrokePreviews = state.roomStrokePreviews.filter(
    (stroke) => stroke.playerId !== message.playerId || stroke.strokeId !== message.strokeId
  );
}

function sendLiveStrokePreview(force = false) {
  if (!liveStrokeId || !isRoomConnected() || !state.currentStroke?.length) return;
  const now = performance.now();
  if (!force && now - liveStrokeLastSentAt < PREVIEW_SEND_INTERVAL_MS) return;

  while (liveStrokeSentPointCount < state.currentStroke.length) {
    const nextEnd = Math.min(
      state.currentStroke.length,
      liveStrokeSentPointCount + MAX_PREVIEW_BATCH_POINTS
    );
    const previousPoint = liveStrokeSentPointCount
      ? state.currentStroke[liveStrokeSentPointCount - 1]
      : liveStrokeAnchor;
    const batch = [previousPoint, ...state.currentStroke.slice(liveStrokeSentPointCount, nextEnd)];
    if (!sendRoomStrokePreview(liveStrokeId, liveStrokeSequence, batch)) return;
    liveStrokeSentPointCount = nextEnd;
    liveStrokeSequence += 1;
  }
  liveStrokeLastSentAt = now;
}

function cancelLiveStrokePreview(notifyPeers = true) {
  if (notifyPeers) cancelRoomStrokePreview(liveStrokeId);
  liveStrokeId = null;
  liveStrokeSequence = 0;
  liveStrokeSentPointCount = 0;
  liveStrokeLastSentAt = 0;
  liveStrokeAnchor = null;
}

function clearRoomStrokePreviews() {
  for (const timerId of pendingBallLaunchTimers.values()) window.clearTimeout(timerId);
  pendingBallLaunchTimers.clear();
  pendingBallLaunches.clear();
  state.pendingPhysicsEvents = [];
  state.roomStrokePreviews = [];
}

function getPoint(event) {
  const rect = dom.canvas.getBoundingClientRect();
  return state.coordinateSystem.toLogicalPoint({
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  });
}

function findBallAtPoint(clickPos) {
  const { canvasWidth, canvasHeight, gameObjects } = state;
  if (!clickPos || !gameObjects?.length) return null;
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
      if (dist <= pr + getLogicalInputTolerance(6, state.coordinateSystem)) {
        return obj;
      }
    }
  }
  return null;
}

function startDrawing(event) {
  if (
    state.physicsCatchupPending ||
    state.physicsCatchupActive ||
    state.stageCleared ||
    (state.challengeModeEnabled && state.challengeModeStrokeCount >= 1)
  ) {
    return;
  }
  state.stageEventCount += 1;
  state.isDrawing = true;
  state.lastPoint = getPoint(event);
  liveStrokeId = isRoomConnected() ? crypto.randomUUID() : null;
  liveStrokeSequence = 0;
  liveStrokeSentPointCount = 0;
  liveStrokeLastSentAt = 0;
  liveStrokeAnchor = state.lastPoint;
  drawingAudio.start(state.lastPoint);
  state.currentStroke = [];
  // reset preview cache for a new stroke
  if (state.previewCtx) state.previewCtx.clearRect(0, 0, state.canvasWidth, state.canvasHeight);
  state.currentStrokePreviewDirty = false;
  state.currentStrokePreviewLastIndex = 0;
}

function continueDrawing(event) {
  if (state.stageCleared || !state.isDrawing || !state.lastPoint) {
    return;
  }

  const currentPoint = getPoint(event);
  drawingAudio.update(getPoint(event));
  state.currentStroke.push(currentPoint);
  state.lastPoint = currentPoint;
  updateDrawLimitProgressUI({
    previewLength: state.totalDrawnLength + getLogicalStrokeDistance(state.currentStroke),
  });
  // mark preview cache dirty so it'll be re-generated once per change
  state.currentStrokePreviewDirty = true;
  sendLiveStrokePreview();
}

function stopDrawing(event) {
  if (!state.isDrawing) {
    return;
  }

  drawingAudio.stop();

  if (state.stageCleared) {
    cancelLiveStrokePreview();
    state.isDrawing = false;
    state.lastPoint = null;
    if (state.previewCtx) state.previewCtx.clearRect(0, 0, state.canvasWidth, state.canvasHeight);
    state.currentStrokePreviewDirty = false;
    state.currentStrokePreviewLastIndex = 0;
    state.currentStroke = null;
    return;
  }

  state.isDrawing = false;
  state.lastPoint = null;

  if (!state.currentStroke || state.currentStroke.length < 2) {
    cancelLiveStrokePreview();
    if (state.challengeModeEnabled) {
      state.currentStroke = null;
      return;
    }
    // treat as a click if user didn't draw a stroke
    const clickPos = event ? getPoint(event) : null;
    const ball = findBallAtPoint(clickPos);
    if (ball?.physicsBody) {
      launchBallFromInput();
      window.dispatchEvent(new CustomEvent("sketchybook:tutorial-ball-click"));
    }

    state.currentStroke = null;
    return;
  }

  // If the user drew a very short stroke (tiny jitter), treat it as a click.
  const clickDistanceThreshold = getLogicalInputTolerance(6, state.coordinateSystem);
  const totalDist = getStrokeDistance(state.currentStroke);
  const logicalTotalDist = getLogicalStrokeDistance(state.currentStroke);

  const lineLengthLimit = getLineLengthLimit();
  if (
    exceedsLineLengthLimit({
      totalDrawnLength: state.totalDrawnLength,
      stroke: state.currentStroke,
      lineLengthLimit,
    })
  ) {
    const nextTotalDrawnLength = state.totalDrawnLength + logicalTotalDist;
    if (nextTotalDrawnLength > lineLengthLimit) {
      console.debug(
        `Total draw length too long (${Math.round(nextTotalDrawnLength)}px > ${Math.round(lineLengthLimit)}px), rejecting stroke`
      );
      if (state.previewCtx) state.previewCtx.clearRect(0, 0, state.canvasWidth, state.canvasHeight);
      state.currentStrokePreviewDirty = false;
      state.currentStrokePreviewLastIndex = 0;
      state.currentStroke = null;
      cancelLiveStrokePreview();
      updateDrawLimitProgressUI();
      return;
    }
  }

  if (totalDist <= clickDistanceThreshold) {
    cancelLiveStrokePreview();
    if (state.challengeModeEnabled) {
      state.currentStroke = null;
      return;
    }
    const clickPos = state.currentStroke[state.currentStroke.length - 1];
    const ball = findBallAtPoint(clickPos);
    if (ball?.physicsBody) {
      launchBallFromInput();
      window.dispatchEvent(new CustomEvent("sketchybook:tutorial-ball-click"));
    }
    state.currentStroke = null;
    return;
  }

  if (state.challengeModeEnabled) {
    if (state.challengeModeStrokeCount >= 1) {
      cancelLiveStrokePreview();
      state.currentStroke = null;
      return;
    }
  }

  if (isRoomConnected()) {
    sendLiveStrokePreview(true);
    const logicalPoints = compactStroke(state.currentStroke);
    sendRoomStroke(logicalPoints, { width: 8, color: INK, strokeId: liveStrokeId });
  } else {
    createAndRegisterStroke(state.currentStroke);
  }
  cancelLiveStrokePreview(false);

  // clear preview overlay after capturing snapshot for the finalized stroke
  if (state.previewCtx) state.previewCtx.clearRect(0, 0, state.canvasWidth, state.canvasHeight);
  state.currentStrokePreviewDirty = false;
  state.currentStrokePreviewLastIndex = 0;
  state.currentStroke = null;
}

export function launchBallFromInput(eventRepeat = false) {
  if (state.physicsCatchupPending || state.physicsCatchupActive) return;
  const isGameActive = dom.playPage?.classList.contains("is-active");
  if (isDrawLimitReached()) return;

  const canLaunchBall = shouldHandleSpacebarAction({
    isGameActive,
    challengeModeEnabled: state.challengeModeEnabled,
    challengeModeStrokeCount: state.challengeModeStrokeCount,
    stageCleared: state.stageCleared,
    stageClearOverlayVisible: Boolean(state.stageClearOverlay?.classList.contains("is-visible")),
    eventRepeat,
  });

  if (!canLaunchBall) return;

  const ball = state.gameObjects.find((obj) => obj instanceof Ball && obj.physicsBody);
  if (!ball || pendingBallLaunches.size > 0 || !isBodyTouchingSurface(ball.physicsBody)) {
    return;
  }

  if (isRoomConnected()) {
    const eventId = sendRoomBallLaunch();
    if (!eventId) {
      console.warn("Could not synchronize the ball launch with the room.");
      return;
    }

    pendingBallLaunches.add(eventId);
    const timeoutId = window.setTimeout(() => {
      pendingBallLaunches.delete(eventId);
      pendingBallLaunchTimers.delete(eventId);
    }, 5000);
    pendingBallLaunchTimers.set(eventId, timeoutId);
    return;
  }

  applyBallLaunch();
}

export function initPointerInput() {
  window.addEventListener("sketchybook:room-stroke", (event) => {
    receiveRoomStroke(event.detail);
  });
  window.addEventListener("sketchybook:room-ball-launch", (event) => {
    receiveRoomBallLaunch(event.detail);
  });
  window.addEventListener("sketchybook:room-stroke-preview", (event) => {
    receiveRoomStrokePreview(event.detail);
  });
  window.addEventListener("sketchybook:room-stroke-preview-end", (event) => {
    removeRoomStrokePreview(event.detail);
  });
  window.addEventListener("sketchybook:stage-reset", clearRoomStrokePreviews);
  window.addEventListener("sketchybook:room-lobby", clearRoomStrokePreviews);
  window.addEventListener("sketchybook:room-closed", clearRoomStrokePreviews);
  window.addEventListener("sketchybook:room-input-interrupted", () => {
    cancelLiveStrokePreview();
  });
  dom.canvas?.addEventListener("pointerdown", startDrawing);
  dom.canvas?.addEventListener("pointermove", continueDrawing);
  window.addEventListener("pointerup", stopDrawing);
  window.addEventListener("pointerleave", stopDrawing);
  window.addEventListener("pointercancel", () => {
    stopDrawing();
  });

  dom.mobileLaunchButton?.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    launchBallFromInput();
  });

  window.addEventListener("keydown", async (event) => {
    const isGameActive = dom.playPage?.classList.contains("is-active");
    if (state.physicsCatchupPending || state.physicsCatchupActive) {
      if (event.key === " " || event.code === "Space" || event.key.toLowerCase() === "r") {
        event.preventDefault();
      }
      return;
    }

    if (isGameActive && (event.key === "r" || event.key === "R")) {
      event.preventDefault();
      const retryEvent = new CustomEvent("sketchybook:stage-retry", {
        cancelable: true,
        detail: { stageNumber: state.currentStageNumber },
      });
      if (!window.dispatchEvent(retryEvent)) return;
      if (completeTutorialStageThreeAfterReset()) return;
      hideStageClearOverlay();
      if (state.isPlayground) {
        await startPlayground();
      } else if (state.isTutorialPlay) {
        await startStage(state.currentStageNumber, { tutorialPlay: true });
      } else {
        await initializeStage(state.currentStageNumber);
        resizeCanvas();
      }
    }

    if (event.key === " " || event.code === "Space") {
      event.preventDefault();
      if (isGameActive && !event.repeat) {
        window.dispatchEvent(new CustomEvent("sketchybook:tutorial-spacebar"));
      }
      launchBallFromInput(event.repeat);
    }
  });
}
