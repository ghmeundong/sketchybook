import rough from "roughjs";
import { state } from "../engine/core/gameState.js";
import { isFullscreenActive } from "../engine/core/fullscreen.js";
import { getPhysicsScaleProfile } from "../engine/physics/physics.js";
import { INK, FONT_DISPLAY } from "../../theme.js";

export function getRenderDpr() {
  return Math.min(2, Math.max(1, window.devicePixelRatio || 1));
}

export function getStrokeWidth() {
  const viewportScale = state.canvasHeight > 0 ? state.canvasHeight / 900 : 1;
  return Math.min(10, Math.max(4, 8 * viewportScale));
}

export function drawStroke(start, end, width = 8, options = {}) {
  const targetRough = options.roughCanvasOverride || state.roughCanvas;
  if (!targetRough || !state.coordinateSystem) {
    return;
  }

  const targetColor = options.color || INK;
  const alpha = options.alpha ?? 0.15;
  const scaledWidth = Math.max(1.5, width * 0.55 * (getStrokeWidth() / 8));
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.hypot(dx, dy);

  targetRough.ctx.save();
  targetRough.ctx.globalAlpha = alpha;
  const step = Math.max(1, scaledWidth * 0.22);
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

export function drawStrokePreview(points) {
  if (!points || points.length < 2 || !state.ctx) return;

  const dpr = getRenderDpr();
  if (!state.previewCtx || !state.previewCanvas) return;

  // Ensure preview canvas uses same pixel size as main canvas
  if (
    state.previewCanvas.width !== Math.max(1, state.canvasWidth) * dpr ||
    state.previewCanvas.height !== Math.max(1, state.canvasHeight) * dpr
  ) {
    state.previewCanvas.width = Math.max(1, state.canvasWidth) * dpr;
    state.previewCanvas.height = Math.max(1, state.canvasHeight) * dpr;
    state.previewCanvas.style.width = `${Math.max(1, state.canvasWidth)}px`;
    state.previewCanvas.style.height = `${Math.max(1, state.canvasHeight)}px`;
    state.previewCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    state.currentStrokePreviewLastIndex = 0; // force full redraw on resize
  }

  const lastIdx = state.currentStrokePreviewLastIndex ?? 0;

  // If we haven't drawn the stroke yet, draw all segments once into the
  // persistent preview canvas. Subsequent pointer events will only append
  // newly added segments (no full re-render).
  if (lastIdx === 0) {
    state.previewCtx.clearRect(0, 0, state.canvasWidth, state.canvasHeight);
    const rc = rough.canvas(state.previewCanvas);
    for (let index = 0; index < points.length - 1; index += 1) {
      drawStroke(points[index], points[index + 1], 8, {
        roughCanvasOverride: rc,
      });
    }
    state.currentStrokePreviewLastIndex = Math.max(0, points.length - 1);
    state.currentStrokePreviewDirty = false;
    return;
  }

  if (lastIdx < points.length - 1) {
    const rc = rough.canvas(state.previewCanvas);
    for (let index = Math.max(0, lastIdx); index < points.length - 1; index += 1) {
      drawStroke(points[index], points[index + 1], 8, {
        roughCanvasOverride: rc,
      });
    }
    state.currentStrokePreviewLastIndex = Math.max(0, points.length - 1);
    state.currentStrokePreviewDirty = false;
  }
}

export function createStrokeTexture(stroke, previewSource) {
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
    const dpr = getRenderDpr();
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
      color: INK,
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

export function drawPhysicsStroke(stroke) {
  const ctx = state.ctx;
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

export function ensureFloorTexture() {
  const {
    canvasWidth,
    canvasHeight,
    floorTextureCanvas,
    floorTextureKey,
    difficultyRules,
    challengeModeEnabled,
  } = state;
  if (!canvasWidth || !canvasHeight) {
    return null;
  }

  const floorY = getPhysicsScaleProfile()?.floorY ?? Math.max(0, canvasHeight - 24);
  const grassHeight = 18;
  const floorOverscan = Math.max(32, Math.round(canvasHeight * 0.08));
  const textureKey = `${canvasWidth}x${canvasHeight}:${floorY}:${floorOverscan}:${grassHeight}:${difficultyRules.hasFloor}:${challengeModeEnabled}`;

  if (floorTextureCanvas && floorTextureKey === textureKey) {
    return floorTextureCanvas;
  }

  const floorCanvas = document.createElement("canvas");
  floorCanvas.width = canvasWidth;
  floorCanvas.height = canvasHeight + floorOverscan;

  const floorCtx = floorCanvas.getContext("2d");
  if (!floorCtx) {
    return null;
  }

  floorCtx.fillStyle = "#8d6a42";
  floorCtx.fillRect(0, floorY, canvasWidth, floorCanvas.height - floorY);

  const grassLineColor = "#4a7b5b";
  floorCtx.fillStyle = grassLineColor;
  floorCtx.fillRect(0, floorY, canvasWidth, grassHeight);

  const roughFloor = rough.canvas(floorCanvas);
  const segmentLength = 20;
  const step = Math.max(18, Math.min(28, canvasWidth / 18));
  for (let index = 0; index < canvasWidth; index += step) {
    const xStart = index + (index % 2 === 0 ? 0 : 5);
    const xEnd = Math.min(canvasWidth, xStart + segmentLength + (index % 3 === 0 ? 8 : 0));
    const yBase = floorY + 2 + (index % 4) * 1.2;
    drawStroke({ x: xStart, y: yBase }, { x: xEnd, y: yBase + (index % 2 === 0 ? 2 : 4) }, 10, {
      color: grassLineColor,
      alpha: 1,
      roughness: 2.3,
      targetCanvas: floorCanvas,
      roughCanvasOverride: roughFloor,
    });
  }

  state.floorTextureCanvas = floorCanvas;
  state.floorTextureKey = textureKey;
  return floorCanvas;
}

export function render() {
  const {
    roughCanvas,
    ctx,
    canvasWidth,
    canvasHeight,
    challengeModeEnabled,
    difficultyRules,
    currentStroke,
    physicsStrokes,
    gameObjects,
  } = state;
  if (!roughCanvas || !ctx) return;

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  const shouldRenderFloor = !challengeModeEnabled && difficultyRules.hasFloor;
  if (shouldRenderFloor) {
    const cachedFloor = ensureFloorTexture();
    if (cachedFloor) {
      ctx.drawImage(cachedFloor, 0, 0);
    }
  }

  // Check if in fullscreen mode
  const isFullscreen = isFullscreenActive();

  // If not fullscreen, show guidance message
  if (!isFullscreen) {
    ctx.save();

    const fontSize = Math.max(24, Math.round(canvasHeight * 0.08));
    ctx.font = `bold ${fontSize}px ${FONT_DISPLAY}`;
    ctx.fillStyle = INK;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const centerY = canvasHeight / 2;
    ctx.fillText("Game paused", canvasWidth / 2, centerY);

    ctx.restore();
    return;
  }

  if (currentStroke && currentStroke.length > 1) {
    drawStrokePreview(currentStroke);
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
