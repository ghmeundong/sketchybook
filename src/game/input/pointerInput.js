import { segmentIntersectsCircle, segmentIntersectsRect } from "../engine/core/geometry.js";
import {
  CircleObject,
  Ball,
  Platform,
  StripedRectObject,
  Segment,
  ComplexObject,
  Rotor,
} from "../objects/index.js";
import {
  createStrokeBody,
  initializeStrokeBody,
  applyAngularImpulseToBody,
  applyImpulseAtLocalPoint,
  isBodyTouchingSurface,
  attachBodyToBody,
} from "../engine/physics/physics.js";
import { getBallImpulseValues } from "../engine/physics/bodySetup.js";
import {
  exceedsLineLengthLimit,
  getLogicalStrokeDistance,
  getStrokeDistance,
} from "./drawingPolicy.js";
import { shouldHandleSpacebarAction } from "../engine/config/inputRules.js";
import { createStrokeTexture } from "../render/gameRenderer.js";
import { drawingAudio } from "../audio/drawingAudioInstance.js";
import { dom } from "../engine/core/domRefs.js";
import { state } from "../engine/core/gameState.js";
import { isFullscreenActive } from "../engine/core/fullscreen.js";
import {
  getLineLengthLimit,
  isDrawLimitReached,
  updateDrawLimitProgressUI,
  initializeStage,
  resizeCanvas,
  hideStageClearOverlay,
} from "../engine/core/gameController.js";

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

function getPoint(event) {
  const rect = dom.canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
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
      if (dist <= pr + 6) {
        return obj;
      }
    }
  }
  return null;
}

function startDrawing(event) {
  if (
    !isFullscreenActive() ||
    state.stageCleared ||
    (state.challengeModeEnabled && state.challengeModeStrokeCount >= 1)
  ) {
    return;
  }
  state.stageEventCount += 1;
  state.isDrawing = true;
  state.lastPoint = getPoint(event);
  drawingAudio.start(state.lastPoint);
  state.currentStroke = [];
  // reset preview cache for a new stroke
  if (state.previewCtx) state.previewCtx.clearRect(0, 0, state.canvasWidth, state.canvasHeight);
  state.currentStrokePreviewDirty = false;
  state.currentStrokePreviewLastIndex = 0;
}

function continueDrawing(event) {
  const isFullscreen = isFullscreenActive();
  if (!isFullscreen || state.stageCleared || !state.isDrawing || !state.lastPoint) {
    return;
  }

  const currentPoint = getPoint(event);
  drawingAudio.update(getPoint(event));
  state.currentStroke.push(currentPoint);
  state.lastPoint = currentPoint;
  updateDrawLimitProgressUI({
    previewLength:
      state.totalDrawnLength +
      getLogicalStrokeDistance(state.currentStroke, state.coordinateSystem),
  });
  // mark preview cache dirty so it'll be re-generated once per change
  state.currentStrokePreviewDirty = true;
}

function stopDrawing(event) {
  if (!state.isDrawing) {
    return;
  }

  drawingAudio.stop();

  if (state.stageCleared) {
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
    if (state.challengeModeEnabled) {
      state.currentStroke = null;
      return;
    }
    // treat as a click if user didn't draw a stroke
    const clickPos = event ? getPoint(event) : null;
    const ball = findBallAtPoint(clickPos);
    if (ball?.physicsBody) {
      launchBallFromInput();
    }

    state.currentStroke = null;
    return;
  }

  // If the user drew a very short stroke (tiny jitter), treat it as a click.
  const CLICK_DISTANCE_THRESHOLD = 6; // pixels
  const totalDist = getStrokeDistance(state.currentStroke);
  const logicalTotalDist = getLogicalStrokeDistance(state.currentStroke, state.coordinateSystem);

  const lineLengthLimit = getLineLengthLimit();
  if (
    exceedsLineLengthLimit({
      totalDrawnLength: state.totalDrawnLength,
      stroke: state.currentStroke,
      lineLengthLimit,
      coordinateSystem: state.coordinateSystem,
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
      updateDrawLimitProgressUI();
      return;
    }
  }

  if (totalDist <= CLICK_DISTANCE_THRESHOLD) {
    if (state.challengeModeEnabled) {
      state.currentStroke = null;
      return;
    }
    const clickPos = state.currentStroke[state.currentStroke.length - 1];
    const ball = findBallAtPoint(clickPos);
    if (ball?.physicsBody) {
      launchBallFromInput();
    }
    state.currentStroke = null;
    return;
  }

  const stageCreateStrokeBody = state.currentStage?.createStrokeBody || createStrokeBody;
  const stageInitializeStrokeBody =
    state.currentStage?.initializeStrokeBody || initializeStrokeBody;

  if (state.challengeModeEnabled) {
    if (state.challengeModeStrokeCount >= 1) {
      state.currentStroke = null;
      return;
    }
  }

  const { canvasWidth, canvasHeight } = state;
  const intersectsCancelObject = state.gameObjects.some((obj) => {
    if (obj instanceof CircleObject || obj instanceof Ball) {
      const circleX = obj.screenX ?? (obj.nx != null ? obj.nx * canvasWidth : null);
      const circleY = obj.screenY ?? (obj.ny != null ? obj.ny * canvasHeight : null);
      const radius =
        obj.physicalRadius ??
        (obj.radius > 1 ? obj.radius : obj.radius * Math.min(canvasWidth, canvasHeight));

      if (circleX == null || circleY == null || !Number.isFinite(radius) || radius <= 0) {
        return false;
      }

      for (let i = 1; i < state.currentStroke.length; i += 1) {
        const a = state.currentStroke[i - 1];
        const b = state.currentStroke[i];
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

      for (let i = 1; i < state.currentStroke.length; i += 1) {
        const a = state.currentStroke[i - 1];
        const b = state.currentStroke[i];
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

  const strokeBody = stageCreateStrokeBody(state.currentStroke);

  // 난이도 규칙에 따라 공 위에 그리기를 제한
  const shouldRejectIfIntersectsBall = !state.difficultyRules.canDrawOnBall;
  const shouldCreateStroke =
    strokeBody && (!shouldRejectIfIntersectsBall || !intersectsCancelObject);

  if (shouldCreateStroke) {
    const floorY = (dom.canvas?.clientHeight || 0) - 24;
    const attachment = findStrokeAttachment(
      state.currentStroke,
      floorY,
      state.difficultyRules.hasFloor
    );
    const attachmentBody = attachment?.physicsBody;
    const isMovingAttachment =
      attachmentBody && typeof attachmentBody.getType === "function"
        ? attachmentBody.getType() !== "static"
        : false;
    const shouldSkipGround = state.challengeModeEnabled || !state.difficultyRules.hasFloor;
    stageInitializeStrokeBody(strokeBody, floorY, {
      skipGround: shouldSkipGround,
      type: attachment && !isMovingAttachment ? "static" : "dynamic",
    });
    if (isMovingAttachment) {
      const targetPosition = attachmentBody.getPosition();
      attachBodyToBody(strokeBody.physicsBody, attachmentBody, targetPosition);
    }
    // Prefer using the preview canvas snapshot so the finalized texture
    // matches exactly what the player saw during drawing.
    createStrokeTexture(strokeBody, state.previewCanvas);
    state.physicsStrokes.push(strokeBody);
    if (state.challengeModeEnabled) {
      state.challengeModeStrokeCount += 1;
    }
    state.totalDrawnLength += getLogicalStrokeDistance(state.currentStroke, state.coordinateSystem);
    updateDrawLimitProgressUI();
  } else if (!shouldCreateStroke && state.currentStroke) {
    // 선이 취소됐을 때 (공이나 striped rect와 만났을 때) 진행 바 리셋
    updateDrawLimitProgressUI();
  }

  // clear preview overlay after capturing snapshot for the finalized stroke
  if (state.previewCtx) state.previewCtx.clearRect(0, 0, state.canvasWidth, state.canvasHeight);
  state.currentStrokePreviewDirty = false;
  state.currentStrokePreviewLastIndex = 0;
  state.currentStroke = null;
}

export function launchBallFromInput(eventRepeat = false) {
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
  if (!ball || !isBodyTouchingSurface(ball.physicsBody)) return;

  state.stageEventCount += 1;
  for (const obj of state.gameObjects) {
    if (obj instanceof Ball && obj.physicsBody) {
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
}

export function initPointerInput() {
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

    if (isGameActive && (event.key === "r" || event.key === "R")) {
      event.preventDefault();
      hideStageClearOverlay();
      await initializeStage(state.currentStageNumber);
      resizeCanvas();
    }

    if (event.key === " " || event.code === "Space") {
      event.preventDefault();
      launchBallFromInput(event.repeat);
    }
  });
}
