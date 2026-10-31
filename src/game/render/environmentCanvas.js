import rough from "roughjs";
import { ensureFloorTexture, getCanvasPixelSize, getRenderDpr } from "./gameRenderer.js";
import { state } from "../engine/core/gameState.js";
import { getPhysicsScaleProfile } from "../engine/physics/physics.js";

let environmentCanvas = null;
let environmentContext = null;
let environmentRoughCanvas = null;
let environmentBoard = null;
let gameRect = null;
let pointerPosition = null;
let currentAnimationFrame = 0;
let floorEnabled = false;

const HATCH_PROXIMITY_DISTANCE = 150;
const HATCH_SPOTLIGHT_RADIUS = 68;

function getBoardRect() {
  return environmentBoard?.getBoundingClientRect() ?? null;
}

function clipSegmentToRectangle(start, end, left, right, top, bottom) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  let enter = 0;
  let exit = 1;
  const boundaries = [
    [-dx, start.x - left],
    [dx, right - start.x],
    [-dy, start.y - top],
    [dy, bottom - start.y],
  ];

  for (const [direction, distance] of boundaries) {
    if (direction === 0) {
      if (distance < 0) return null;
      continue;
    }
    const ratio = distance / direction;
    if (direction < 0) enter = Math.max(enter, ratio);
    else exit = Math.min(exit, ratio);
    if (enter > exit) return null;
  }

  return {
    start: { x: start.x + dx * enter, y: start.y + dy * enter },
    end: { x: start.x + dx * exit, y: start.y + dy * exit },
  };
}

function getCircleClippedHatchSegment(centerX, centerY, radius, lineConstant) {
  const inverseSqrtTwo = 1 / Math.sqrt(2);
  const signedDistance = (centerX + centerY - lineConstant) * inverseSqrtTwo;
  if (Math.abs(signedDistance) > radius) return null;

  const halfChord = Math.sqrt(Math.max(0, radius * radius - signedDistance * signedDistance));
  const footX = centerX - signedDistance * inverseSqrtTwo;
  const footY = centerY - signedDistance * inverseSqrtTwo;

  return {
    start: {
      x: footX - inverseSqrtTwo * halfChord,
      y: footY + inverseSqrtTwo * halfChord,
    },
    end: {
      x: footX + inverseSqrtTwo * halfChord,
      y: footY - inverseSqrtTwo * halfChord,
    },
  };
}

function drawHatchLines(context, left, right, top, bottom, alpha, spotlight) {
  context.save();
  context.globalAlpha = alpha;
  const spacing = 16;

  const startOffset = -bottom;
  const endOffset = right - left + bottom;
  for (let offset = startOffset; offset <= endOffset; offset += spacing) {
    let start = { x: left + offset, y: bottom };
    let end = { x: left + offset + (bottom - top), y: top };

    if (spotlight) {
      const lineConstant = left + offset + bottom;
      const segment = getCircleClippedHatchSegment(
        spotlight.x,
        spotlight.y,
        spotlight.radius,
        lineConstant
      );
      if (!segment) continue;
      start = segment.start;
      end = segment.end;
      const clipped = clipSegmentToRectangle(start, end, left, right, top, bottom);
      if (!clipped) continue;
      start = clipped.start;
      end = clipped.end;
    } else {
      const clipped = clipSegmentToRectangle(start, end, left, right, top, bottom);
      if (!clipped) continue;
      start = clipped.start;
      end = clipped.end;
    }

    environmentRoughCanvas.line(start.x, start.y, end.x, end.y, {
      stroke: "#dc2323",
      strokeWidth: 2,
      roughness: 1.5,
      bowing: 1.2,
      disableMultiStroke: false,
    });
  }
  context.restore();
}

function renderEnvironment() {
  if (!environmentContext || !environmentCanvas || !gameRect) return;

  const dpr = getRenderDpr();
  const boardRect = getBoardRect();
  if (!boardRect) return;

  environmentContext.setTransform(dpr, 0, 0, dpr, 0, 0);
  environmentContext.clearRect(0, 0, boardRect.width, boardRect.height);

  const top = gameRect.top;
  const bottom = gameRect.bottom;

  drawEnvironmentFloor(boardRect);

  if (!pointerPosition) return;
  if (
    pointerPosition.y < top - HATCH_PROXIMITY_DISTANCE ||
    pointerPosition.y > bottom + HATCH_PROXIMITY_DISTANCE
  ) {
    return;
  }

  let side = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  let lightX = pointerPosition.x;

  if (pointerPosition.x < gameRect.left) {
    side = "left";
    nearestDistance = gameRect.left - pointerPosition.x;
    lightX = pointerPosition.x;
  } else if (pointerPosition.x > gameRect.right) {
    side = "right";
    nearestDistance = pointerPosition.x - gameRect.right;
    lightX = pointerPosition.x;
  } else {
    const leftDistance = pointerPosition.x - gameRect.left;
    const rightDistance = gameRect.right - pointerPosition.x;
    if (leftDistance <= HATCH_PROXIMITY_DISTANCE) {
      side = "left";
      nearestDistance = leftDistance;
      lightX = gameRect.left;
    }
    if (rightDistance <= HATCH_PROXIMITY_DISTANCE && rightDistance < nearestDistance) {
      side = "right";
      nearestDistance = rightDistance;
      lightX = gameRect.right;
    }
  }

  if (!side || nearestDistance > HATCH_PROXIMITY_DISTANCE) return;

  const lightStrength = 1 - nearestDistance / HATCH_PROXIMITY_DISTANCE;
  const spotlightRadius = HATCH_SPOTLIGHT_RADIUS * (0.65 + lightStrength * 0.35);
  const boundaryX = side === "left" ? gameRect.left : gameRect.right;
  const horizontalDistance = boundaryX - lightX;
  const halfChord = Math.sqrt(
    Math.max(0, spotlightRadius * spotlightRadius - horizontalDistance * horizontalDistance)
  );
  const boundaryTop = Math.max(top, pointerPosition.y - halfChord);
  const boundaryBottom = Math.min(bottom, pointerPosition.y + halfChord);

  if (boundaryBottom > boundaryTop && environmentRoughCanvas) {
    environmentRoughCanvas.line(boundaryX, boundaryTop, boundaryX, boundaryBottom, {
      stroke: "#dc2323",
      strokeWidth: 2,
      roughness: 1.5,
      bowing: 1.2,
      disableMultiStroke: false,
    });
  }

  const left = side === "left" ? 0 : gameRect.right;
  const right = side === "left" ? gameRect.left : boardRect.width;

  environmentContext.save();
  drawHatchLines(environmentContext, left, right, top, bottom, 0.85, {
    x: lightX,
    y: pointerPosition.y,
    radius: spotlightRadius,
  });
  environmentContext.restore();
}

function drawEnvironmentFloor(boardRect) {
  if (!floorEnabled || !gameRect || !environmentContext) return;

  const texture = ensureFloorTexture();
  if (!texture) return;

  const logicalHeight = state.canvasHeight || 900;
  const floorY = getPhysicsScaleProfile()?.floorY ?? Math.max(0, logicalHeight - 32);
  const viewScaleY = gameRect.height / logicalHeight;
  const screenFloorY = gameRect.top + floorY * viewScaleY;
  const textureScreenWidth = gameRect.width;
  const canvasFloorHeight = Math.max(0, gameRect.bottom - screenFloorY);
  const textureFloorHeight = Math.max(1, logicalHeight - floorY);

  environmentContext.save();
  environmentContext.imageSmoothingEnabled = false;

  let tileX = gameRect.left - Math.ceil(gameRect.left / textureScreenWidth) * textureScreenWidth;
  for (; tileX < boardRect.width; tileX += textureScreenWidth) {
    environmentContext.drawImage(
      texture,
      0,
      floorY,
      texture.width,
      textureFloorHeight,
      tileX,
      screenFloorY,
      textureScreenWidth,
      canvasFloorHeight
    );
  }

  if (boardRect.height > gameRect.bottom) {
    const overscanSourceY = logicalHeight;
    const overscanSourceHeight = Math.max(1, texture.height - overscanSourceY);
    tileX = gameRect.left - Math.ceil(gameRect.left / textureScreenWidth) * textureScreenWidth;
    for (; tileX < boardRect.width; tileX += textureScreenWidth) {
      environmentContext.drawImage(
        texture,
        0,
        overscanSourceY,
        texture.width,
        overscanSourceHeight,
        tileX,
        gameRect.bottom,
        textureScreenWidth,
        boardRect.height - gameRect.bottom
      );
    }
  }
  environmentContext.restore();
}

function scheduleEnvironmentRender() {
  if (currentAnimationFrame) return;
  currentAnimationFrame = window.requestAnimationFrame(() => {
    currentAnimationFrame = 0;
    renderEnvironment();
  });
}

export function initEnvironmentCanvas(canvas, board) {
  environmentCanvas = canvas;
  environmentBoard = board;
  environmentContext = canvas?.getContext("2d") ?? null;
  environmentRoughCanvas = canvas ? rough.canvas(canvas) : null;

  board?.addEventListener("pointermove", (event) => {
    const rect = board.getBoundingClientRect();
    pointerPosition = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    scheduleEnvironmentRender();
  });
  board?.addEventListener("pointerleave", () => {
    pointerPosition = null;
    scheduleEnvironmentRender();
  });
}

export function resizeEnvironmentCanvas(boardRect, canvasRect, options = {}) {
  if (!environmentCanvas || !environmentContext || !boardRect) return;
  floorEnabled = options.enabled !== false;

  const dpr = getRenderDpr();
  const pixelSize = getCanvasPixelSize(boardRect.width, boardRect.height, dpr);
  environmentCanvas.width = pixelSize.width;
  environmentCanvas.height = pixelSize.height;
  environmentCanvas.style.width = `${boardRect.width}px`;
  environmentCanvas.style.height = `${boardRect.height}px`;
  environmentContext = environmentCanvas.getContext("2d");
  environmentRoughCanvas = rough.canvas(environmentCanvas);
  gameRect = canvasRect
    ? {
        left: canvasRect.left - boardRect.left,
        top: canvasRect.top - boardRect.top,
        right: canvasRect.right - boardRect.left,
        bottom: canvasRect.bottom - boardRect.top,
        width: canvasRect.width,
        height: canvasRect.height,
      }
    : null;
  renderEnvironment();
}
