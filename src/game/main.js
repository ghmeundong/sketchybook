import rough from "roughjs";
import "../style.css";
import "../styles/game.css";
import paperTexture from "../img/paper-texture.jpg";
import { createCoordinateSystem } from "./coordinates.js";
import { createStrokeBody, initializeStrokeBody, updateStrokeBody } from "./physics.js";

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
let coordinateSystem = null;
let currentStroke = null;
let physicsStrokes = [];
let animationFrameId = null;

function resizeCanvas() {
  if (!board || !canvas) {
    return;
  }

  const width = board.clientWidth;
  const height = board.clientHeight;
  const dpr = window.devicePixelRatio || 1;

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);

  coordinateSystem = createCoordinateSystem({ viewportWidth: width, viewportHeight: height });
  roughCanvas = rough.canvas(canvas);
  roughCanvas.ctx.globalAlpha = 1;

  if (!animationFrameId) {
    animationFrameId = window.requestAnimationFrame(tick);
  }
}

function getPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function drawStroke(start, end, width = 8) {
  if (!roughCanvas || !coordinateSystem) {
    return;
  }

  const targetColor = "#4f3b24";
  const scaledWidth = Math.max(1.5, width * 0.55);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.hypot(dx, dy);

  roughCanvas.ctx.globalAlpha = 0.15;
  const step = Math.max(1.5, scaledWidth * 0.4);
  for (let i = 0; i <= distance; i += step) {
    const t = distance === 0 ? 0 : i / distance;
    roughCanvas.circle(start.x + dx * t, start.y + dy * t, scaledWidth, {
      stroke: "none",
      fill: targetColor,
      fillStyle: "solid",
      roughness: 2.0,
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

function drawPhysicsStroke(stroke) {
  if (!roughCanvas || !stroke?.points?.length) {
    return;
  }

  roughCanvas.ctx.globalAlpha = 0.18;
  const vertices = stroke.points;

  for (let i = 0; i < vertices.length - 1; i += 1) {
    const p1 = vertices[i];
    const p2 = vertices[i + 1];
    roughCanvas.line(p1.x, p1.y, p2.x, p2.y, {
      stroke: "#4f3b24",
      strokeWidth: 1.2,
      roughness: 1.2,
      bowing: 1.1,
    });
  }
}

function tick() {
  const width = canvas?.clientWidth || 0;
  const height = canvas?.clientHeight || 0;

  const floorY = height - 24;

  physicsStrokes.forEach((stroke) => {
    if (!stroke?.points?.length || !stroke.body) {
      return;
    }

    updateStrokeBody(stroke, floorY);
  });

  if (canvas && roughCanvas) {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const context = canvas.getContext("2d");

    if (context) {
      const dpr = window.devicePixelRatio || 1;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);

      if (currentStroke && currentStroke.length > 1) {
        drawStrokePreview(currentStroke, 8);
      }

      physicsStrokes.forEach((stroke) => drawPhysicsStroke(stroke));
    }
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

  const strokeBody = createStrokeBody(currentStroke);
  if (strokeBody) {
    const floorY = (canvas?.clientHeight || 0) - 24;
    initializeStrokeBody(strokeBody, floorY);
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
resizeCanvas();
