import rough from "roughjs";
import "../style.css";
import "../styles/game.css";
import paperTexture from "../img/paper-texture.jpg";
import { createCoordinateSystem } from "./coordinates.js";
import { loadStage } from "./stageLoader.js";
import {
  createStrokeBody,
  initializeStrokeBody,
  updateStrokeBody,
  stepPhysicsWorld,
} from "./physics.js";

const board = document.querySelector("#game-board");
const canvas = document.querySelector("#game-canvas");

const body = document.body;
body.style.backgroundImage = `url(${paperTexture})`;
body.style.backgroundSize = "cover";
body.style.backgroundPosition = "center";
body.style.backgroundRepeat = "no-repeat";
body.style.backgroundAttachment = "fixed";

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
const physicsFrameDuration = 1000 / 30;

function resizeCanvas() {
  if (!board || !canvas) {
    return;
  }

  canvasWidth = board.clientWidth;
  canvasHeight = board.clientHeight;
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

  if (!animationFrameId) {
    animationFrameId = window.requestAnimationFrame(tick);
  }
}

async function initializeStage() {
  if (!canvas || !board) {
    return;
  }

  currentStage = await loadStage(canvas, board);
  if (currentStage?.coordinateSystem) {
    coordinateSystem = currentStage.coordinateSystem;
  }
  if (typeof currentStage?.initialize === "function") {
    currentStage.initialize();
  }
}

function getPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function drawStroke(start, end, width = 8, options = {}) {
  const targetCanvas = options.targetCanvas || canvas;
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
}

function drawStrokePreview(points, width = 8) {
  if (!points || points.length < 2) {
    return;
  }

  for (let i = 0; i < points.length - 1; i += 1) {
    drawStroke(points[i], points[i + 1], width);
  }
}

function createStrokeTexture(stroke) {
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

  const offscreen = document.createElement("canvas");
  offscreen.width = width;
  offscreen.height = height;
  const offscreenCtx = offscreen.getContext("2d");
  const offscreenRough = rough.canvas(offscreen);
  offscreenCtx.clearRect(0, 0, width, height);

  const offsetPoints = localPoints.map((node) => ({
    x: node.x - minX + padding,
    y: node.y - minY + padding,
  }));

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
  const width = canvas?.clientWidth || 0;
  const height = canvas?.clientHeight || 0;

  const floorY = height - 24;

  if (timestamp - lastPhysicsTime >= physicsFrameDuration) {
    if (currentStage && typeof currentStage.update === "function") {
      currentStage.update(physicsStrokes, floorY);
    } else {
      stepPhysicsWorld({ deltaTime: 1 / 30 });
      physicsStrokes.forEach((stroke) => {
        if (!stroke?.points?.length || !stroke.body) {
          return;
        }

        updateStrokeBody(stroke, floorY);
      });
    }
    lastPhysicsTime = timestamp;
  }

  if (roughCanvas && ctx) {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    if (currentStroke && currentStroke.length > 1) {
      drawStrokePreview(currentStroke, 8);
    }

    physicsStrokes.forEach((stroke) => drawPhysicsStroke(stroke));
  }

  animationFrameId = window.requestAnimationFrame(tick);
}

function startDrawing(event) {
  isDrawing = true;
  lastPoint = getPoint(event);
  currentStroke = [];
}

function continueDrawing(event) {
  if (!isDrawing || !lastPoint) {
    return;
  }

  const currentPoint = getPoint(event);
  drawStroke(lastPoint, currentPoint, 8);
  currentStroke.push(currentPoint);
  lastPoint = currentPoint;
}

function stopDrawing() {
  if (!isDrawing) {
    return;
  }

  isDrawing = false;
  lastPoint = null;

  if (!currentStroke || currentStroke.length < 2) {
    currentStroke = null;
    return;
  }

  const stageCreateStrokeBody = currentStage?.createStrokeBody || createStrokeBody;
  const stageInitializeStrokeBody = currentStage?.initializeStrokeBody || initializeStrokeBody;

  const strokeBody = stageCreateStrokeBody(currentStroke);
  if (strokeBody) {
    const floorY = (canvas?.clientHeight || 0) - 24;
    stageInitializeStrokeBody(strokeBody, floorY);
    createStrokeTexture(strokeBody);
    physicsStrokes.push(strokeBody);
  }

  currentStroke = null;
}

canvas?.addEventListener("pointerdown", startDrawing);
canvas?.addEventListener("pointermove", continueDrawing);
window.addEventListener("pointerup", stopDrawing);
window.addEventListener("pointerleave", stopDrawing);
window.addEventListener("resize", resizeCanvas);
window.addEventListener("orientationchange", resizeCanvas);
initializeStage();
resizeCanvas();
