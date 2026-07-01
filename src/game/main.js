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

function startDrawing(event) {
  isDrawing = true;
  lastPoint = getPoint(event);
}

function continueDrawing(event) {
  if (!isDrawing || !lastPoint) {
    return;
  }

  const currentPoint = getPoint(event);
  drawStroke(lastPoint, currentPoint, 8);
  lastPoint = currentPoint;
}

function stopDrawing() {
  isDrawing = false;
  lastPoint = null;
}

canvas?.addEventListener("pointerdown", startDrawing);
canvas?.addEventListener("pointermove", continueDrawing);
window.addEventListener("pointerup", stopDrawing);
window.addEventListener("pointerleave", stopDrawing);
window.addEventListener("resize", resizeCanvas);
window.addEventListener("orientationchange", resizeCanvas);
resizeCanvas();
