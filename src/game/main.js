import rough from "roughjs";
import "../style.css";
import "../styles/game.css";
import paperTexture from "../img/paper-texture.jpg";
import { createCoordinateSystem } from "./coordinates.js";

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

function createStrokeBody(points) {
  if (points.length < 2) {
    return null;
  }

  const maxPoints = 40;
  const sampleStep = Math.max(1, Math.floor(points.length / maxPoints));
  const sampledPoints = points.filter((_, index) => index % sampleStep === 0);

  if (sampledPoints.length < 2) {
    return null;
  }

  const centerX = sampledPoints.reduce((sum, point) => sum + point.x, 0) / sampledPoints.length;
  const centerY = sampledPoints.reduce((sum, point) => sum + point.y, 0) / sampledPoints.length;

  const nodes = sampledPoints.map((point) => ({
    x: point.x,
    y: point.y,
    restX: point.x - centerX,
    restY: point.y - centerY,
    vx: 0,
    vy: 0,
  }));

  return {
    points: nodes,
    body: {
      x: centerX,
      y: centerY,
      vx: 0,
      vy: 0,
    },
    grounded: false,
  };
}

function tick() {
  const width = canvas?.clientWidth || 0;
  const height = canvas?.clientHeight || 0;

  physicsStrokes.forEach((stroke) => {
    if (!stroke?.points?.length || !stroke.body) {
      return;
    }

    if (stroke.grounded) {
      return;
    }

    const gravity = 0.08;
    const stiffness = 0.065;
    const damping = 0.96;
    const floorY = height - 24;

    stroke.body.vy += gravity;
    stroke.body.vx *= 0.995;
    stroke.body.vy *= 0.995;
    stroke.body.x += stroke.body.vx;
    stroke.body.y += stroke.body.vy;

    let hitFloor = false;

    if (stroke.body.y > floorY) {
      stroke.body.y = floorY;
      stroke.body.vy = 0;
      stroke.body.vx = 0;
      hitFloor = true;
    }

    stroke.points.forEach((node) => {
      const targetX = stroke.body.x + node.restX;
      const targetY = stroke.body.y + node.restY;
      const dx = targetX - node.x;
      const dy = targetY - node.y;

      node.vx += dx * stiffness;
      node.vy += dy * stiffness;
      node.vx *= damping;
      node.vy *= damping;
      node.x += node.vx;
      node.y += node.vy;

      if (node.y > floorY) {
        node.y = floorY;
        node.vy = 0;
        node.vx = 0;
        hitFloor = true;
      }
    });

    if (hitFloor) {
      stroke.grounded = true;
      stroke.body.vx = 0;
      stroke.body.vy = 0;
      stroke.points.forEach((node) => {
        node.vx = 0;
        node.vy = 0;
      });
      return;
    }

    const centerX = stroke.points.reduce((sum, node) => sum + node.x, 0) / stroke.points.length;
    const centerY = stroke.points.reduce((sum, node) => sum + node.y, 0) / stroke.points.length;

    stroke.body.vx += (centerX - stroke.body.x) * 0.08;
    stroke.body.vy += (centerY - stroke.body.y) * 0.08;
    stroke.body.x += stroke.body.vx;
    stroke.body.y += stroke.body.vy;
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
