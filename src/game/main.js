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

  const coordinateSystem = createCoordinateSystem({ viewportWidth: width, viewportHeight: height });
  context.save();
  context.strokeStyle = "rgba(79, 59, 36, 0.12)";
  context.lineWidth = 1;
  for (let x = 0; x <= coordinateSystem.logicalWidth; x += 200) {
    const screenX = coordinateSystem.toScreenX(x);
    context.beginPath();
    context.moveTo(screenX, 0);
    context.lineTo(screenX, height);
    context.stroke();
  }
  for (let y = 0; y <= coordinateSystem.logicalHeight; y += 200) {
    const screenY = coordinateSystem.toScreenY(y);
    context.beginPath();
    context.moveTo(0, screenY);
    context.lineTo(width, screenY);
    context.stroke();
  }
  context.restore();
}

window.addEventListener("resize", resizeCanvas);
window.addEventListener("orientationchange", resizeCanvas);
resizeCanvas();
