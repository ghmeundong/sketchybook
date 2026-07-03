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
  createCircleBody,
  createBoxBody,
  createEdgeBody,
  createPolygonBody,
  createRotorBody,
  applyImpulseToBody,
  applyAngularImpulseToBody,
  applyImpulseAtLocalPoint,
  resetPhysicsWorld,
} from "./physics.js";

const board = document.querySelector("#game-board");
const canvas = document.querySelector("#game-canvas");
const selectionPage = document.querySelector(".page-selection");
const playPage = document.querySelector(".page-play");
const stageButtons = Array.from(document.querySelectorAll(".stage-card"));

let stageClearOverlay = null;
let stageClearMessage = null;
let gameExitButton = null;
let gameRetryButton = null;

const body = document.body;
body.style.backgroundImage = `url(${paperTexture})`;
body.style.backgroundSize = "cover";
body.style.backgroundPosition = "center";
body.style.backgroundRepeat = "no-repeat";
body.style.backgroundAttachment = "fixed";

function drawRoughFrame(card) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.style.display = "block";
  svg.style.position = "absolute";
  svg.style.inset = "0";
  svg.style.pointerEvents = "none";
  svg.style.overflow = "visible";

  const rc = rough.svg(svg);
  const shape = rc.rectangle(8, 8, 84, 84, {
    stroke: "#4f3b24",
    strokeWidth: 1.3,
    roughness: 1.6,
    bowing: 1.2,
    fill: "transparent",
  });

  svg.appendChild(shape);
  card.appendChild(svg);
}

stageButtons.forEach((card) => drawRoughFrame(card));

function resetStageState() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  resetPhysicsWorld();
  gameObjects = [];
  physicsStrokes = [];
  currentStroke = null;
  isDrawing = false;
  lastPoint = null;
  stageCleared = false;
  currentStage = null;
  stageHasSimulated = false;
  hideStageClearOverlay();
  hideGameRetryButton();
  hideGameExitButton();
}

function setActivePage(page) {
  [selectionPage, playPage].forEach((item) => {
    if (!item) return;
    item.classList.toggle("is-active", item === page);
  });
  if (page === selectionPage) {
    resetStageState();
  }
}

async function tryEnterFullscreen() {
  if (document.fullscreenElement) {
    return;
  }
  if (document.documentElement.requestFullscreen) {
    try {
      await document.documentElement.requestFullscreen();
    } catch (err) {
      console.warn("전체화면 전환 실패:", err);
    }
  }
}

function createStageClearOverlay() {
  if (!board) {
    return;
  }
  if (stageClearOverlay) return;

  stageClearOverlay = document.createElement("div");
  stageClearOverlay.className = "stage-clear-overlay";
  stageClearOverlay.setAttribute("aria-hidden", "true");
  stageClearOverlay.style.display = "grid";

  stageClearMessage = document.createElement("div");
  stageClearMessage.className = "stage-clear-box";
  stageClearMessage.innerHTML = `
    <p class="stage-clear-title">Stage Cleared!</p>
    <div class="stage-clear-actions">
      <button class="stage-clear-btn stage-clear-exit"></button>
      <button class="stage-clear-btn stage-clear-retry"></button>
      <button class="stage-clear-btn stage-clear-next"></button>
    </div>
  `;

  stageClearMessage.style.backgroundImage = `url(${paperTexture})`;
  stageClearMessage.style.backgroundSize = "cover";
  stageClearMessage.style.backgroundPosition = "center";
  stageClearMessage.style.backgroundRepeat = "no-repeat";
  stageClearMessage.style.position = "relative";
  stageClearMessage.style.zIndex = "1";

  const frameCanvas = document.createElement("canvas");
  frameCanvas.className = "stage-clear-frame";
  frameCanvas.width = 420;
  frameCanvas.height = 420;
  frameCanvas.style.position = "absolute";
  frameCanvas.style.inset = "0";
  frameCanvas.style.width = "100%";
  frameCanvas.style.height = "100%";
  frameCanvas.style.pointerEvents = "none";
  frameCanvas.style.zIndex = "0";

  const rc = rough.canvas(frameCanvas);
  rc.rectangle(12, 12, frameCanvas.width - 24, frameCanvas.height - 24, {
    stroke: "#4f3b24",
    strokeWidth: 3.2,
    roughness: 1.7,
    bowing: 1.6,
    fill: "transparent",
  });

  stageClearOverlay.appendChild(frameCanvas);
  stageClearOverlay.appendChild(stageClearMessage);
  board.appendChild(stageClearOverlay);

  // Decorate action buttons with rough borders and wire handlers
  const drawIcon = (btn, type) => {
    if (!btn) return;
    const iconWrap = document.createElement("span");
    iconWrap.className = "stage-clear-icon";
    const canvas = document.createElement("canvas");
    const w = 64;
    const h = 40;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = "#4f3b24";
    ctx.fillStyle = "#4f3b24";
    ctx.lineWidth = 3;

    if (type === "exit") {
      // taller vertical rectangle with left-pointing arrow
      ctx.strokeRect(18, 6, 20, 28);
      ctx.beginPath();
      ctx.moveTo(50, 20);
      ctx.lineTo(24, 20);
      ctx.lineTo(30, 14);
      ctx.moveTo(24, 20);
      ctx.lineTo(30, 26);
      ctx.stroke();
    } else if (type === "retry") {
      // two 90-degree turns: right, up, then right with arrowhead
      ctx.beginPath();
      ctx.moveTo(22, 30);
      ctx.lineTo(42, 30); // right
      ctx.lineTo(42, 10); // up
      ctx.lineTo(22, 10); // left
      ctx.lineTo(22, 20); // down
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(16, 14);
      ctx.lineTo(22, 20);
      ctx.lineTo(28, 14);
      ctx.stroke();
    } else if (type === "next") {
      // right-pointing triangle
      ctx.beginPath();
      ctx.moveTo(18, 8);
      ctx.lineTo(18, 32);
      ctx.lineTo(46, 20);
      ctx.closePath();
      ctx.fill();
    }

    iconWrap.appendChild(canvas);
    btn.insertBefore(iconWrap, btn.firstChild);
  };

  const decorate = (btn) => {
    if (!btn) return;
    btn.style.position = "relative";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 100 40");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.style.position = "absolute";
    svg.style.inset = "0";
    svg.style.pointerEvents = "none";
    svg.style.width = "100%";
    svg.style.height = "100%";
    const rcBtn = rough.svg(svg);
    rcBtn.rectangle(4, 4, 92, 32, {
      stroke: "#4f3b24",
      strokeWidth: 1.8,
      roughness: 1.5,
      bowing: 1.2,
      fill: "transparent",
    });
    btn.appendChild(svg);
  };

  const exitBtn = stageClearMessage.querySelector(".stage-clear-exit");
  const retryBtn = stageClearMessage.querySelector(".stage-clear-retry");
  const nextBtn = stageClearMessage.querySelector(".stage-clear-next");

  [exitBtn, retryBtn, nextBtn].forEach((b) => {
    decorate(b);
    if (b) {
      if (b.classList.contains("stage-clear-exit")) drawIcon(b, "exit");
      if (b.classList.contains("stage-clear-retry")) drawIcon(b, "retry");
      if (b.classList.contains("stage-clear-next")) drawIcon(b, "next");
    }
  });

  if (exitBtn) {
    exitBtn.addEventListener("click", async () => {
      hideStageClearOverlay();
      setActivePage(selectionPage);
      // stop physics animation when leaving
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      // exit fullscreen
      if (document.fullscreenElement) {
        try {
          await document.exitFullscreen();
        } catch (err) {
          console.warn("전체화면 해제 실패:", err);
        }
      }
    });
  }
  if (retryBtn) {
    retryBtn.addEventListener("click", async () => {
      hideStageClearOverlay();
      await initializeStage(currentStageNumber);
      resizeCanvas();
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener("click", async () => {
      hideStageClearOverlay();
      const next = Math.min((currentStageNumber || 1) + 1, 6);
      await startStage(next);
    });
  }
}

function showStageClearOverlay(message = "Stage Cleared!") {
  if (!stageClearOverlay || !stageClearMessage) {
    createStageClearOverlay();
  }
  if (!stageClearOverlay || !stageClearMessage) return;

  stageClearMessage.querySelector(".stage-clear-title").textContent = message;
  stageClearOverlay.classList.add("is-visible");
  stageClearOverlay.setAttribute("aria-hidden", "false");
  stageClearOverlay.style.display = "grid";
  stageClearOverlay.style.opacity = "1";
  stageClearOverlay.style.visibility = "visible";
  canvas?.style.setProperty("pointer-events", "none");
}

function hideStageClearOverlay() {
  if (!stageClearOverlay) return;
  stageClearOverlay.classList.remove("is-visible");
  stageClearOverlay.setAttribute("aria-hidden", "true");
  stageClearOverlay.style.opacity = "0";
  stageClearOverlay.style.visibility = "hidden";
  canvas?.style.setProperty("pointer-events", "auto");
}

function createGameExitButton() {
  if (!board || gameExitButton) return;

  gameExitButton = document.createElement("button");
  gameExitButton.className = "game-exit-btn";
  gameExitButton.setAttribute("type", "button");
  gameExitButton.setAttribute("aria-label", "Exit to stage selection");
  gameExitButton.style.position = "absolute";
  gameExitButton.style.top = "1rem";
  gameExitButton.style.left = "1rem";
  gameExitButton.style.zIndex = "100";
  gameExitButton.style.background = "transparent";
  gameExitButton.style.border = "none";
  gameExitButton.style.cursor = "pointer";
  gameExitButton.style.padding = "0.5rem";
  gameExitButton.style.display = "flex";
  gameExitButton.style.alignItems = "center";
  gameExitButton.style.justifyContent = "center";

  const canvas = document.createElement("canvas");
  const w = 48;
  const h = 32;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.strokeStyle = "#4f3b24";
  ctx.fillStyle = "#4f3b24";
  ctx.lineWidth = 2.5;

  // Exit icon: vertical rectangle with left-pointing arrow
  ctx.strokeRect(13, 4, 15, 22);
  ctx.beginPath();
  ctx.moveTo(37, 15);
  ctx.lineTo(18, 15);
  ctx.lineTo(23, 10);
  ctx.moveTo(18, 15);
  ctx.lineTo(23, 20);
  ctx.stroke();

  gameExitButton.appendChild(canvas);
  gameExitButton.addEventListener("click", async () => {
    hideStageClearOverlay();
    setActivePage(selectionPage);
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    // exit fullscreen
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch (err) {
        console.warn("전체화면 해제 실패:", err);
      }
    }
  });

  board.appendChild(gameExitButton);
}

function createGameRetryButton() {
  if (!board || gameRetryButton) return;

  gameRetryButton = document.createElement("button");
  gameRetryButton.className = "game-retry-btn";
  gameRetryButton.setAttribute("type", "button");
  gameRetryButton.setAttribute("aria-label", "Retry current stage");
  gameRetryButton.style.position = "absolute";
  gameRetryButton.style.top = "1rem";
  gameRetryButton.style.right = "1rem";
  gameRetryButton.style.zIndex = "100";
  gameRetryButton.style.background = "transparent";
  gameRetryButton.style.border = "none";
  gameRetryButton.style.cursor = "pointer";
  gameRetryButton.style.padding = "0.5rem";
  gameRetryButton.style.display = "flex";
  gameRetryButton.style.alignItems = "center";
  gameRetryButton.style.justifyContent = "center";

  const canvas = document.createElement("canvas");
  const w = 48;
  const h = 32;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.strokeStyle = "#4f3b24";
  ctx.fillStyle = "#4f3b24";
  ctx.lineWidth = 2.5;

  // Retry icon: two 90-degree turns with arrowhead
  ctx.beginPath();
  ctx.moveTo(22, 30);
  ctx.lineTo(42, 30); // right
  ctx.lineTo(42, 10); // up
  ctx.lineTo(22, 10); // left
  ctx.lineTo(22, 20); // down
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(16, 14);
  ctx.lineTo(22, 20);
  ctx.lineTo(28, 14);
  ctx.stroke();

  gameRetryButton.appendChild(canvas);
  gameRetryButton.addEventListener("click", async () => {
    hideStageClearOverlay();
    await initializeStage(currentStageNumber);
    resizeCanvas();
  });

  board.appendChild(gameRetryButton);
}

function hideGameExitButton() {
  if (gameExitButton) {
    gameExitButton.remove();
    gameExitButton = null;
  }
}

function hideGameRetryButton() {
  if (gameRetryButton) {
    gameRetryButton.remove();
    gameRetryButton = null;
  }
}

function getRequestedStageFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const value = Number(params.get("stage"));
  return Number.isInteger(value) && value >= 1 && value <= 6 ? value : null;
}

async function startStage(stageNumber) {
  if (!stageNumber) {
    return;
  }
  currentStageNumber = stageNumber;
  await tryEnterFullscreen();
  setActivePage(playPage);
  window.history.replaceState(null, "", `?stage=${stageNumber}`);
  await initializeStage(stageNumber);
  resizeCanvas();
}

async function initializePageFlow() {
  const requestedStage = getRequestedStageFromUrl();
  if (requestedStage) {
    currentStageNumber = requestedStage;
    setActivePage(playPage);
    await initializeStage(requestedStage);
    resizeCanvas();
  } else {
    setActivePage(selectionPage);
  }
}

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
// Preview cache for the stroke currently being drawn. We only re-create
// this offscreen texture when the stroke changes (point added), avoiding
// repeated rough rendering each frame which caused the jittery look.
let currentStrokePreviewDirty = false;
let currentStrokePreviewLastIndex = 0;
let previewCanvas = null;
let previewCtx = null;
const physicsFrameDuration = 1000 / 60;
const renderFrameDuration = 1000 / 60;

let stageCleared = false;
let stageHasSimulated = false;

// Game objects (balls, stars, etc.) that stages can declare.
let gameObjects = [];
let currentStageNumber = 1;

class Ball {
  // x, y: normalized (0..1) positions relative to canvas width/height
  // radius: normalized (0..1) relative to min(canvasWidth, canvasHeight) or pixels if >1
  constructor(opts = {}) {
    const { x, y, radius } = opts || {};
    this.nx = typeof x === "number" ? x : 0.5;
    this.ny = typeof y === "number" ? y : 0.5;
    this.radius = typeof radius === "number" ? radius : 0.02;
  }

  // Create an offscreen texture (hollow circle) sized for the current canvas.
  createTexture(canvasW, canvasH) {
    const minDim = Math.min(canvasW, canvasH);
    const r = this.physicalRadius ?? (this.radius > 1 ? this.radius : this.radius * minDim);
    const diameter = Math.max(2, Math.ceil(r * 2));
    const padding = 8;
    const size = diameter + padding * 2;

    const off = document.createElement("canvas");
    off.width = size;
    off.height = size;
    const offCtx = off.getContext("2d");
    offCtx.clearRect(0, 0, size, size);

    const offRough = rough.canvas(off);
    const cx = size / 2;
    const cy = size / 2;

    // Draw outline only (no fill)
    offRough.circle(cx, cy, diameter, {
      stroke: "black",
      strokeWidth: 2,
      fill: "none",
      roughness: 1.4,
    });

    // no rotation mark — texture is outline-only

    this.texture = off;
    this.textureOffset = {
      centerX: cx,
      centerY: cy,
      width: size,
      height: size,
    };
    this._lastCanvasSize = { w: canvasW, h: canvasH };
  }

  draw(canvasW, canvasH, roughCanvasInstance) {
    if (!ctx) return;
    // Re-create texture when canvas size changes
    if (
      !this.texture ||
      !this._lastCanvasSize ||
      this._lastCanvasSize.w !== canvasW ||
      this._lastCanvasSize.h !== canvasH
    ) {
      this.createTexture(canvasW, canvasH);
    }

    const px = this.screenX != null ? this.screenX : this.nx * canvasW;
    const py = this.screenY != null ? this.screenY : this.ny * canvasH;
    const { centerX, centerY, width, height } = this.textureOffset || {};

    if (this.texture && centerX != null) {
      ctx.save();
      ctx.globalAlpha = 1;
      // apply rotation about center so the radial mark shows rolling
      const angle = this.angle || 0;
      ctx.translate(px, py);
      if (angle) ctx.rotate(angle);
      ctx.drawImage(this.texture, -centerX, -centerY, width, height);
      ctx.restore();
      return;
    }

    // Fallback: draw simple outline
    ctx.save();
    ctx.beginPath();
    const minDim = Math.min(canvasW, canvasH);
    const r = this.radius > 1 ? this.radius : this.radius * minDim;
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.strokeStyle = "black";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
}

class Star {
  constructor(opts = {}) {
    const { x, y, radius } = opts || {};
    this.nx = typeof x === "number" ? x : 0.5;
    this.ny = typeof y === "number" ? y : 0.5;
    this.radius = typeof radius === "number" ? radius : 0.02;
    this.collected = false;
  }

  createTexture(canvasW, canvasH) {
    const minDim = Math.min(canvasW, canvasH);
    const r = this.radius > 1 ? this.radius : this.radius * minDim;
    const diameter = Math.max(2, Math.ceil(r * 2));
    const padding = 8;
    const size = diameter + padding * 2;
    const dpr = window.devicePixelRatio || 1;

    const off = document.createElement("canvas");
    off.width = size * dpr;
    off.height = size * dpr;
    off.style.width = `${size}px`;
    off.style.height = `${size}px`;

    const offCtx = off.getContext("2d");
    offCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    offCtx.clearRect(0, 0, size, size);

    const offRough = rough.canvas(off);
    const center = size / 2;
    const points = [];
    for (let i = 0; i < 5; i += 1) {
      const outer = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      const inner = outer + Math.PI / 5;
      points.push([Math.cos(outer) * r + center, Math.sin(outer) * r + center]);
      points.push([Math.cos(inner) * (r * 0.5) + center, Math.sin(inner) * (r * 0.5) + center]);
    }

    offRough.polygon(points, {
      stroke: "#b8860b",
      strokeWidth: 2,
      fill: "#ffd54f",
      fillStyle: "solid",
      roughness: 1.5,
    });

    this.texture = off;
    this.textureOffset = {
      centerX: center,
      centerY: center,
      width: size,
      height: size,
    };
    this._lastCanvasSize = { w: canvasW, h: canvasH };
  }

  draw(canvasW, canvasH, roughCanvasInstance) {
    if (!ctx || this.collected) return;
    if (
      !this.texture ||
      !this._lastCanvasSize ||
      this._lastCanvasSize.w !== canvasW ||
      this._lastCanvasSize.h !== canvasH
    ) {
      this.createTexture(canvasW, canvasH);
    }

    const px = this.screenX != null ? this.screenX : this.nx * canvasW;
    const py = this.screenY != null ? this.screenY : this.ny * canvasH;
    const { centerX, centerY, width, height } = this.textureOffset || {};

    if (this.texture && centerX != null && width != null && height != null) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.texture, px - centerX, py - centerY, width, height);
      ctx.restore();
      return;
    }
  }
}

class Platform {
  constructor(opts = {}) {
    const { x, y, width, height } = opts || {};
    this.nx = typeof x === "number" ? x : 0.5;
    this.ny = typeof y === "number" ? y : 0.75;
    this.width = typeof width === "number" ? width : 0.1;
    this.height = typeof height === "number" ? height : 0.05;
    this.physicsBody = null;
    this.texture = null;
    this.textureOffset = null;
    this._lastCanvasSize = null;
  }

  createTexture(canvasW, canvasH) {
    const w = this.width > 1 ? this.width : Math.max(4, this.width * canvasW);
    const h = this.height > 1 ? this.height : Math.max(4, this.height * canvasH);
    const padding = 8;
    const sizeW = Math.ceil(w + padding * 2);
    const sizeH = Math.ceil(h + padding * 2);

    const off = document.createElement("canvas");
    off.width = sizeW;
    off.height = sizeH;
    const offCtx = off.getContext("2d");
    offCtx.clearRect(0, 0, sizeW, sizeH);

    const offRough = rough.canvas(off);
    const x = padding;
    const y = padding;
    offRough.rectangle(x, y, w, h, {
      stroke: "#4f3b24",
      strokeWidth: 2,
      fill: "transparent",
      fillStyle: "solid",
      roughness: 1.6,
    });

    this.texture = off;
    this.textureOffset = {
      centerX: sizeW / 2,
      centerY: sizeH / 2,
      width: sizeW,
      height: sizeH,
      drawX: x,
      drawY: y,
    };
    this._lastCanvasSize = { w: canvasW, h: canvasH };
  }

  draw(canvasW, canvasH, roughCanvasInstance) {
    if (!ctx) return;
    if (
      !this.texture ||
      !this._lastCanvasSize ||
      this._lastCanvasSize.w !== canvasW ||
      this._lastCanvasSize.h !== canvasH
    ) {
      this.createTexture(canvasW, canvasH);
    }

    const px = this.screenX != null ? this.screenX : this.nx * canvasW;
    const py = this.screenY != null ? this.screenY : this.ny * canvasH;
    const { width, height } = this.textureOffset || {};

    if (this.texture && width != null && height != null) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.drawImage(this.texture, px - width / 2, py - height / 2, width, height);
      ctx.restore();
    }
  }
}

class Segment {
  constructor({ x1 = 0.2, y1 = 0.6, x2 = 0.8, y2 = 0.6 } = {}) {
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
    this.physicsBody = null;
    this.texture = null;
    this.textureOffset = null;
    this._lastCanvasSize = null;
  }

  createTexture(canvasW, canvasH) {
    const p1 = { x: this.x1 * canvasW, y: this.y1 * canvasH };
    const p2 = { x: this.x2 * canvasW, y: this.y2 * canvasH };
    const padding = 12;
    const minX = Math.min(p1.x, p2.x);
    const minY = Math.min(p1.y, p2.y);
    const maxX = Math.max(p1.x, p2.x);
    const maxY = Math.max(p1.y, p2.y);
    const width = Math.max(2, Math.ceil(maxX - minX + padding * 2));
    const height = Math.max(2, Math.ceil(maxY - minY + padding * 2));

    const off = document.createElement("canvas");
    off.width = width;
    off.height = height;
    const offCtx = off.getContext("2d");
    offCtx.clearRect(0, 0, width, height);

    const offRough = rough.canvas(off);
    const x1 = p1.x - minX + padding;
    const y1 = p1.y - minY + padding;
    const x2 = p2.x - minX + padding;
    const y2 = p2.y - minY + padding;

    offRough.line(x1, y1, x2, y2, {
      stroke: "#4f3b24",
      strokeWidth: 3,
      roughness: 3.0,
      bowing: 1,
    });

    // Add a second, slightly offset hand-drawn line for extra sketchy texture.
    offRough.line(x1 + 1.5, y1 - 1.0, x2 + 1.5, y2 - 1.0, {
      stroke: "#4f3b24",
      strokeWidth: 2,
      roughness: 2.6,
      opacity: 0.8,
    });

    this.texture = off;
    this.textureOffset = {
      left: minX - padding,
      top: minY - padding,
      width,
      height,
    };
    this._lastCanvasSize = { w: canvasW, h: canvasH };
  }

  draw(canvasW, canvasH, roughCanvasInstance) {
    if (!ctx) return;
    if (
      !this.texture ||
      !this._lastCanvasSize ||
      this._lastCanvasSize.w !== canvasW ||
      this._lastCanvasSize.h !== canvasH
    ) {
      this.createTexture(canvasW, canvasH);
    }

    if (this.texture && this.textureOffset) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.drawImage(
        this.texture,
        this.textureOffset.left,
        this.textureOffset.top,
        this.textureOffset.width,
        this.textureOffset.height
      );
      ctx.restore();
    }
  }
}

class ComplexObject {
  constructor({ points = [], closed = false, isStatic = true } = {}) {
    // points expected normalized (0..1) objects: [{x, y}, ...]
    this.normalizedPoints = Array.isArray(points) ? points.slice() : [];
    this.closed = !!closed;
    this.isStatic = !!isStatic;
    this.pixelPoints = null; // filled by createTexture
    this.physicsBodies = null;
    this.texture = null;
    this.textureOffset = null;
    this._lastCanvasSize = null;
  }

  createTexture(canvasW, canvasH) {
    if (!Array.isArray(this.normalizedPoints) || this.normalizedPoints.length < 2) return;

    // compute pixel points
    const pts = this.normalizedPoints.map((p) => ({ x: p.x * canvasW, y: p.y * canvasH }));
    this.pixelPoints = pts;

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const p of pts) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }

    const padding = 12;
    const width = Math.max(2, Math.ceil(maxX - minX + padding * 2));
    const height = Math.max(2, Math.ceil(maxY - minY + padding * 2));

    const off = document.createElement("canvas");
    off.width = width;
    off.height = height;
    const offCtx = off.getContext("2d");
    offCtx.clearRect(0, 0, width, height);

    const offRough = rough.canvas(off);
    const normalizedPts = pts.map((p) => ({ x: p.x - minX + padding, y: p.y - minY + padding }));

    if (this.closed && pts.length > 2) {
      offRough.polygon(normalizedPts, {
        stroke: "#4f3b24",
        strokeWidth: 3,
        roughness: 2.6,
        fill: "#fff6eb",
        fillStyle: "solid",
      });
    }

    // draw segments
    for (let i = 0; i < pts.length - 1; i += 1) {
      const a = normalizedPts[i];
      const b = normalizedPts[i + 1];
      offRough.line(a.x, a.y, b.x, b.y, {
        stroke: "#4f3b24",
        strokeWidth: 3,
        roughness: 2.6,
      });
    }
    if (this.closed && pts.length > 2) {
      const a = normalizedPts[pts.length - 1];
      const b = normalizedPts[0];
      offRough.line(a.x, a.y, b.x, b.y, {
        stroke: "#4f3b24",
        strokeWidth: 3,
        roughness: 2.6,
      });
    }

    this.texture = off;
    this.textureOffset = { left: minX - padding, top: minY - padding, width, height };
    this._lastCanvasSize = { w: canvasW, h: canvasH };
  }

  createPhysics(floorY) {
    if (!Array.isArray(this.pixelPoints) || this.pixelPoints.length < 2) return;
    if (this.physicsBodies && this.physicsBodies.length) return; // already created

    this.physicsBodies = [];
    const pts = this.pixelPoints;
    if (this.closed && pts.length >= 3) {
      try {
        const body = createPolygonBody(pts, floorY, {
          isStatic: this.isStatic,
          friction: 0.8,
          density: this.isStatic ? 0 : 1,
        });
        if (body) {
          this.physicsBodies.push(body);
          return;
        }
      } catch (e) {
        console.warn("createPolygonBody failed for complex object:", e);
      }
    }

    for (let i = 0; i < pts.length - 1; i += 1) {
      const a = pts[i];
      const b = pts[i + 1];
      try {
        const body = createEdgeBody(a.x, a.y, b.x, b.y, floorY, {
          type: this.isStatic ? "static" : "dynamic",
          friction: 0.8,
        });
        this.physicsBodies.push(body);
      } catch (e) {
        console.warn("createEdgeBody failed for complex object segment:", e);
      }
    }
    if (this.closed && pts.length > 2) {
      const a = pts[pts.length - 1];
      const b = pts[0];
      try {
        const body = createEdgeBody(a.x, a.y, b.x, b.y, floorY, {
          type: this.isStatic ? "static" : "dynamic",
          friction: 0.8,
        });
        this.physicsBodies.push(body);
      } catch (e) {
        console.warn("createEdgeBody failed for complex object closing segment:", e);
      }
    }
  }

  draw(canvasW, canvasH) {
    if (!ctx) return;
    if (
      !this.texture ||
      !this._lastCanvasSize ||
      this._lastCanvasSize.w !== canvasW ||
      this._lastCanvasSize.h !== canvasH
    ) {
      this.createTexture(canvasW, canvasH);
    }
    if (this.texture && this.textureOffset) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.drawImage(
        this.texture,
        this.textureOffset.left,
        this.textureOffset.top,
        this.textureOffset.width,
        this.textureOffset.height
      );
      ctx.restore();
    }
  }
}

class Rotor {
  constructor({
    points = [],
    closed = false,
    x = 0.5,
    y = 0.5,
    radius = null,
    pointCount = 24,
    axisX,
    axisY,
    spinMode = "free",
    motorSpeed = 0,
    maxMotorTorque = 1000,
    isStatic = false,
  } = {}) {
    const normalizedPoints = Array.isArray(points) ? points.slice() : [];
    if (
      (!Array.isArray(normalizedPoints) || normalizedPoints.length < 2) &&
      typeof radius === "number"
    ) {
      const count = Math.max(3, Math.min(64, Math.round(pointCount)));
      for (let i = 0; i < count; i += 1) {
        const angle = (i / count) * Math.PI * 2;
        normalizedPoints.push({
          x: x + Math.cos(angle) * radius,
          y: y + Math.sin(angle) * radius,
        });
      }
      this.closed = true;
    } else {
      this.closed = !!closed;
    }

    this.normalizedPoints = normalizedPoints;
    this.cx = typeof x === "number" ? x : 0.5;
    this.cy = typeof y === "number" ? y : 0.5;
    this.radius = typeof radius === "number" ? radius : null;
    this.pointCount = Math.max(3, Math.min(64, Math.round(pointCount)));
    this.axisX = typeof axisX === "number" ? axisX : this.cx;
    this.axisY = typeof axisY === "number" ? axisY : this.cy;
    this.spinMode = spinMode === "auto" ? "auto" : "free";
    this.motorSpeed =
      typeof motorSpeed === "number" ? motorSpeed : this.spinMode === "auto" ? 1.5 : 0;
    this.maxMotorTorque = typeof maxMotorTorque === "number" ? maxMotorTorque : 1000;
    this.isStatic = !!isStatic;
    this.pixelPoints = null;
    this.physicsBody = null;
    this.texture = null;
    this.textureOffset = null;
    this._lastCanvasSize = null;
  }

  createTexture(canvasW, canvasH) {
    if (!Array.isArray(this.normalizedPoints) || this.normalizedPoints.length < 2) return;

    const pts = this.normalizedPoints.map((p) => ({ x: p.x * canvasW, y: p.y * canvasH }));
    this.pixelPoints = pts;

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    const center = pts.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    center.x /= pts.length;
    center.y /= pts.length;

    for (const p of pts) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }

    const padding = 12;
    const width = Math.max(2, Math.ceil(maxX - minX + padding * 2));
    const height = Math.max(2, Math.ceil(maxY - minY + padding * 2));
    const centerOffsetX = center.x - minX + padding;
    const centerOffsetY = center.y - minY + padding;

    const off = document.createElement("canvas");
    off.width = width;
    off.height = height;
    const offCtx = off.getContext("2d");
    offCtx.clearRect(0, 0, width, height);

    const offRough = rough.canvas(off);
    for (let i = 0; i < pts.length - 1; i += 1) {
      const a = pts[i];
      const b = pts[i + 1];
      offRough.line(
        a.x - minX + padding,
        a.y - minY + padding,
        b.x - minX + padding,
        b.y - minY + padding,
        {
          stroke: "#4f3b24",
          strokeWidth: 3,
          roughness: 2.6,
        }
      );
    }
    if (this.closed && pts.length > 2) {
      const a = pts[pts.length - 1];
      const b = pts[0];
      offRough.line(
        a.x - minX + padding,
        a.y - minY + padding,
        b.x - minX + padding,
        b.y - minY + padding,
        {
          stroke: "#4f3b24",
          strokeWidth: 3,
          roughness: 2.6,
        }
      );
    }

    this.texture = off;
    this.textureOffset = {
      left: minX - padding,
      top: minY - padding,
      width,
      height,
      centerOffsetX,
      centerOffsetY,
    };

    if (typeof this.axisX === "number" && typeof this.axisY === "number") {
      const markerSize = 5;
      const markerCanvas = document.createElement("canvas");
      markerCanvas.width = markerSize * 2;
      markerCanvas.height = markerSize * 2;
      const markerCtx = markerCanvas.getContext("2d");
      const markerRough = rough.canvas(markerCanvas);
      markerRough.circle(markerSize, markerSize, markerSize * 1.4, {
        stroke: "#c92d39",
        strokeWidth: 1.5,
        fill: "#e64956",
        roughness: 1.8,
        fillStyle: "solid",
      });
      this.axisMarker = {
        texture: markerCanvas,
        size: markerSize,
      };
    } else {
      this.axisMarker = null;
    }

    this._lastCanvasSize = { w: canvasW, h: canvasH };
  }

  createPhysics(canvasW, canvasH, floorY) {
    if (!Array.isArray(this.pixelPoints) || this.pixelPoints.length < 2) {
      this.createTexture(canvasW, canvasH);
    }
    if (!Array.isArray(this.pixelPoints) || this.pixelPoints.length < 2) return;
    if (this.physicsBody) return;

    const axisPixel = {
      x: typeof this.axisX === "number" ? this.axisX * canvasW : null,
      y: typeof this.axisY === "number" ? this.axisY * canvasH : null,
    };

    this.physicsBody = createRotorBody(this.pixelPoints, axisPixel, floorY, {
      closed: this.closed,
      isStatic: this.isStatic,
      motor: this.spinMode === "auto",
      motorSpeed: this.motorSpeed,
      maxMotorTorque: this.maxMotorTorque,
      friction: 0.8,
      density: this.isStatic ? 0 : 1,
    });
  }

  draw(canvasW, canvasH, roughCanvasInstance) {
    if (!ctx) return;
    if (
      !this.texture ||
      !this._lastCanvasSize ||
      this._lastCanvasSize.w !== canvasW ||
      this._lastCanvasSize.h !== canvasH
    ) {
      this.createTexture(canvasW, canvasH);
    }
    if (!this.texture || !this.textureOffset) return;

    const px = this.screenX != null ? this.screenX : 0;
    const py = this.screenY != null ? this.screenY : 0;
    const angle = this.angle || 0;
    const { centerOffsetX, centerOffsetY, width, height } = this.textureOffset;

    ctx.save();
    ctx.translate(px, py);
    if (angle) ctx.rotate(angle);
    ctx.globalAlpha = 1;
    ctx.drawImage(this.texture, -centerOffsetX, -centerOffsetY, width, height);
    ctx.restore();

    if (this.axisMarker && typeof this.axisX === "number" && typeof this.axisY === "number") {
      const axisPx = this.axisX * canvasW;
      const axisPy = this.axisY * canvasH;
      const { texture: markerCanvas, size: markerSize } = this.axisMarker;
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.drawImage(
        markerCanvas,
        axisPx - markerSize,
        axisPy - markerSize,
        markerSize * 2,
        markerSize * 2
      );
      ctx.restore();
    }
  }
}

class TextLabel {
  constructor(opts = {}) {
    const { x, y, text, fontSize, color, fontFamily } = opts || {};
    this.nx = typeof x === "number" ? x : 0.5;
    this.ny = typeof y === "number" ? y : 0.2;
    this.text = text || "";
    this.fontSize = typeof fontSize === "number" ? fontSize : 0.04;
    this.color = typeof color === "string" ? color : "#4f3b24";
    this.fontFamily = typeof fontFamily === "string" ? fontFamily : "MyeongjoFont, serif";
    this.texture = null;
    this.textureOffset = null;
    this._lastCanvasSize = null;
  }

  createTexture(canvasW, canvasH) {
    const fontPx =
      this.fontSize > 1 ? this.fontSize : Math.max(10, Math.round(this.fontSize * canvasH));
    const fontFamily = this.fontFamily || "MyeongjoFont, serif";
    const lines = String(this.text)
      .split("\n")
      .map((line) => line.trim());
    const off = document.createElement("canvas");
    const offCtx = off.getContext("2d");
    offCtx.font = `${fontPx}px ${fontFamily}`;
    offCtx.textBaseline = "middle";
    offCtx.textAlign = "center";

    const lineWidths = lines.map((line) => offCtx.measureText(line).width);
    const textWidth = Math.max(...lineWidths, 1);
    const textHeight = fontPx * lines.length + fontPx * 0.4 * Math.max(lines.length - 1, 0);
    const padding = Math.max(12, Math.round(fontPx * 0.4));
    const width = Math.ceil(textWidth + padding * 2);
    const height = Math.ceil(textHeight + padding * 2);

    off.width = width;
    off.height = height;

    const dpr = window.devicePixelRatio || 1;
    const scaledWidth = width * dpr;
    const scaledHeight = height * dpr;
    off.width = scaledWidth;
    off.height = scaledHeight;
    off.style.width = `${width}px`;
    off.style.height = `${height}px`;
    const hid = off.getContext("2d");
    hid.setTransform(dpr, 0, 0, dpr, 0, 0);
    hid.clearRect(0, 0, width, height);
    hid.font = `${fontPx}px ${fontFamily}`;
    hid.textBaseline = "middle";
    hid.textAlign = "center";
    hid.fillStyle = this.color;
    hid.strokeStyle = this.color;
    hid.lineWidth = Math.max(1, Math.round(fontPx * 0.12));

    const centerX = width / 2;
    let centerY = padding + fontPx / 2;
    for (const line of lines) {
      hid.fillText(line, centerX, centerY);
      centerY += fontPx * 1.4;
    }

    this.texture = off;
    this.textureOffset = {
      centerX: width / 2,
      centerY: height / 2,
      width,
      height,
    };
    this._lastCanvasSize = { w: canvasW, h: canvasH };
  }

  draw(canvasW, canvasH, roughCanvasInstance) {
    if (!ctx) return;
    if (
      !this.texture ||
      !this._lastCanvasSize ||
      this._lastCanvasSize.w !== canvasW ||
      this._lastCanvasSize.h !== canvasH
    ) {
      this.createTexture(canvasW, canvasH);
    }

    const px = this.screenX != null ? this.screenX : this.nx * canvasW;
    const py = this.screenY != null ? this.screenY : this.ny * canvasH;
    const { centerX, centerY, width, height } = this.textureOffset || {};

    if (this.texture && centerX != null && centerY != null && width != null && height != null) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.drawImage(this.texture, px - centerX, py - centerY, width, height);
      ctx.restore();
    }
  }
}

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

  // Create or resize the preview overlay canvas. This canvas sits above
  // the main game canvas and is only updated when the stroke changes.
  if (!previewCanvas) {
    previewCanvas = document.createElement("canvas");
    previewCanvas.className = "game-preview-canvas";
    previewCanvas.style.position = "absolute";
    previewCanvas.style.inset = "0";
    previewCanvas.style.pointerEvents = "none";
    previewCanvas.style.zIndex = "50";
    if (board) board.appendChild(previewCanvas);
  }
  previewCanvas.width = Math.max(1, canvasWidth) * dpr;
  previewCanvas.height = Math.max(1, canvasHeight) * dpr;
  previewCanvas.style.width = `${Math.max(1, canvasWidth)}px`;
  previewCanvas.style.height = `${Math.max(1, canvasHeight)}px`;
  previewCtx = previewCanvas.getContext("2d");
  previewCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  previewCtx.clearRect(0, 0, canvasWidth, canvasHeight);

  // If the stage was loaded but not yet simulated, recreate physics bodies
  // when the canvas size changes (e.g. entering fullscreen after refresh).
  const shouldRebuildPhysics =
    currentStage &&
    !stageHasSimulated &&
    physicsStrokes.length === 0 &&
    gameObjects.some((obj) => obj.physicsBody || (obj.physicsBodies && obj.physicsBodies.length));
  if (shouldRebuildPhysics) {
    resetPhysicsWorld();
    for (const obj of gameObjects) {
      if (obj.physicsBody) {
        obj.physicsBody = null;
      }
      if (obj.physicsBodies) {
        obj.physicsBodies = null;
      }
    }
  }

  // Ensure circular game object physics bodies exist now that canvas size is known
  const floorYForPhysics = canvas?.clientHeight ? canvas.clientHeight - 24 : canvasHeight - 24;
  if (gameObjects && gameObjects.length) {
    for (const obj of gameObjects) {
      if (obj instanceof Ball && !obj.physicsBody) {
        const px = obj.nx * canvasWidth;
        const py = obj.ny * canvasHeight;
        const minDim = Math.min(canvasWidth, canvasHeight);
        const rPixels = obj.radius > 1 ? obj.radius : Math.max(2, obj.radius * minDim);
        try {
          const body = createCircleBody(px, py, rPixels, floorYForPhysics, { density: 1 });
          obj.physicsBody = body;
          obj.physicalRadius = rPixels;
        } catch (e) {
          // ignore physics creation errors
          console.warn("createCircleBody failed:", e);
        }
      } else if (obj instanceof Platform && !obj.physicsBody) {
        const px = obj.nx * canvasWidth;
        const py = obj.ny * canvasHeight;
        const widthPx = obj.width > 1 ? obj.width : Math.max(4, obj.width * canvasWidth);
        const heightPx = obj.height > 1 ? obj.height : Math.max(4, obj.height * canvasHeight);
        try {
          const body = createBoxBody(px, py, widthPx, heightPx, floorYForPhysics, {
            type: "static",
            friction: 0.8,
          });
          obj.physicsBody = body;
        } catch (e) {
          console.warn("createBoxBody failed:", e);
        }
      } else if (obj instanceof Segment && !obj.physicsBody) {
        const x1 = obj.x1 * canvasWidth;
        const y1 = obj.y1 * canvasHeight;
        const x2 = obj.x2 * canvasWidth;
        const y2 = obj.y2 * canvasHeight;
        try {
          const body = createEdgeBody(x1, y1, x2, y2, floorYForPhysics, {
            type: "static",
            friction: 0.8,
          });
          obj.physicsBody = body;
        } catch (e) {
          console.warn("createEdgeBody failed:", e);
        }
      } else if (
        obj instanceof ComplexObject &&
        (!obj.physicsBodies || !obj.physicsBodies.length)
      ) {
        // ensure texture/pixel points available
        try {
          obj.createTexture(canvasWidth, canvasHeight);
          obj.createPhysics(floorYForPhysics);
        } catch (e) {
          console.warn("ComplexObject physics creation failed:", e);
        }
      } else if (obj instanceof Rotor && !obj.physicsBody) {
        try {
          obj.createTexture(canvasWidth, canvasHeight);
          obj.createPhysics(canvasWidth, canvasHeight, floorYForPhysics);
        } catch (e) {
          console.warn("Rotor physics creation failed:", e);
        }
      }
    }
  }

  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  animationFrameId = window.requestAnimationFrame(tick);
}

async function initializeStage(stageNumberOverride) {
  if (!canvas || !board) {
    return;
  }

  resetStageState();

  currentStage = await loadStage(canvas, board, stageNumberOverride);
  if (currentStage?.coordinateSystem) {
    coordinateSystem = currentStage.coordinateSystem;
  }
  if (typeof currentStage?.initialize === "function") {
    currentStage.initialize();
  }

  try {
    createStageClearOverlay();
  } catch (error) {
    console.warn("stage clear overlay creation failed:", error);
  }

  // Populate gameObjects from stage data (if any)
  gameObjects = [];
  stageCleared = false;
  physicsStrokes = [];
  currentStroke = null;
  isDrawing = false;
  lastPoint = null;
  lastPhysicsTime = 0;
  hideStageClearOverlay();
  if (Array.isArray(currentStage?.objects)) {
    for (const obj of currentStage.objects) {
      if (obj.type === "ball") {
        gameObjects.push(new Ball({ x: obj.x, y: obj.y, radius: obj.radius }));
      } else if (obj.type === "star") {
        gameObjects.push(new Star({ x: obj.x, y: obj.y, radius: obj.radius }));
      } else if (obj.type === "platform") {
        gameObjects.push(
          new Platform({
            x: obj.x,
            y: obj.y,
            width: obj.width,
            height: obj.height,
          })
        );
      } else if (obj.type === "segment") {
        gameObjects.push(
          new Segment({
            x1: obj.x1,
            y1: obj.y1,
            x2: obj.x2,
            y2: obj.y2,
          })
        );
      } else if (obj.type === "poly" || obj.type === "complex") {
        // points provided as normalized coordinates [{x,y}, ...]
        gameObjects.push(
          new ComplexObject({
            points: obj.points || [],
            closed: !!obj.closed,
            isStatic: obj.isStatic !== false,
          })
        );
      } else if (obj.type === "rotor") {
        const spinMode = obj.spinMode === "auto" ? "auto" : "free";
        gameObjects.push(
          new Rotor({
            points: obj.points || [],
            closed: obj.closed !== false,
            x: obj.x,
            y: obj.y,
            radius: obj.radius,
            pointCount: obj.pointCount,
            axisX: obj.axisX,
            axisY: obj.axisY,
            spinMode,
            motorSpeed: obj.motorSpeed,
            maxMotorTorque: obj.maxMotorTorque,
            isStatic: obj.isStatic === true,
          })
        );
      } else if (obj.type === "text") {
        gameObjects.push(
          new TextLabel({
            x: obj.x,
            y: obj.y,
            text: obj.text,
            fontSize: obj.fontSize,
            color: obj.color,
            fontFamily: obj.fontFamily,
          })
        );
      }
      // future: handle other types (star, obstacle, etc.)
    }
  }

  createGameExitButton();
  createGameRetryButton();
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

  targetRough.ctx.save();
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
  targetRough.ctx.restore();
}

function drawStrokePreview(points, width = 8) {
  if (!points || points.length < 2 || !ctx) return;

  const dpr = window.devicePixelRatio || 1;
  if (!previewCtx || !previewCanvas) return;

  // Ensure preview canvas uses same pixel size as main canvas
  if (
    previewCanvas.width !== Math.max(1, canvasWidth) * dpr ||
    previewCanvas.height !== Math.max(1, canvasHeight) * dpr
  ) {
    previewCanvas.width = Math.max(1, canvasWidth) * dpr;
    previewCanvas.height = Math.max(1, canvasHeight) * dpr;
    previewCanvas.style.width = `${Math.max(1, canvasWidth)}px`;
    previewCanvas.style.height = `${Math.max(1, canvasHeight)}px`;
    previewCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    currentStrokePreviewLastIndex = 0; // force full redraw on resize
  }

  const lastIdx = currentStrokePreviewLastIndex ?? 0;

  // If we haven't drawn the stroke yet, draw all segments once into the
  // persistent preview canvas. Subsequent pointer events will only append
  // newly added segments (no full re-render).
  if (lastIdx === 0) {
    previewCtx.clearRect(0, 0, canvasWidth, canvasHeight);
    const rc = rough.canvas(previewCanvas);
    for (let i = 0; i < points.length - 1; i += 1) {
      drawStroke(points[i], points[i + 1], width, {
        targetCanvas: previewCanvas,
        roughCanvasOverride: rc,
      });
    }
    currentStrokePreviewLastIndex = Math.max(0, points.length - 1);
    currentStrokePreviewDirty = false;
    return;
  }

  if (lastIdx < points.length - 1) {
    const rc = rough.canvas(previewCanvas);
    for (let i = Math.max(0, lastIdx); i < points.length - 1; i += 1) {
      drawStroke(points[i], points[i + 1], width, {
        targetCanvas: previewCanvas,
        roughCanvasOverride: rc,
      });
    }
    currentStrokePreviewLastIndex = Math.max(0, points.length - 1);
    currentStrokePreviewDirty = false;
  }
}

function createStrokeTexture(stroke, previewSource) {
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
    const dpr = window.devicePixelRatio || 1;
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
  // Stop physics when not in fullscreen mode
  const isFullscreen = document.fullscreenElement || window.innerHeight === screen.height;
  const isGameActive = playPage?.classList.contains("is-active");

  if (!isGameActive) {
    // Still schedule next frame to check game state
    animationFrameId = window.requestAnimationFrame(tick);
    return;
  }

  const width = canvas?.clientWidth || 0;
  const height = canvas?.clientHeight || 0;

  const floorY = height - 24;

  // Update physics whenever the game page is active.
  if (isGameActive) {
    // Initialize physics timing on the first tick after stage load so we
    // don't simulate a huge time gap from page load or navigation.
    if (lastPhysicsTime === 0) {
      lastPhysicsTime = timestamp;
    }
    // Catch up physics: run as many 1/60s sub-steps as needed to reach current timestamp
    while (timestamp - lastPhysicsTime >= physicsFrameDuration) {
      if (currentStage && typeof currentStage.update === "function") {
        currentStage.update(physicsStrokes, floorY);
      } else {
        stepPhysicsWorld({ deltaTime: 1 / 60 });
        physicsStrokes.forEach((stroke) => {
          if (!stroke?.points?.length || !stroke.body) {
            return;
          }

          updateStrokeBody(stroke, floorY);
        });
      }
      lastPhysicsTime += physicsFrameDuration;
      stageHasSimulated = true;
    }
  }

  // Sync circular game object positions from physics bodies (perfect circle hitboxes)
  if (gameObjects && gameObjects.length) {
    for (const obj of gameObjects) {
      if (obj.physicsBody) {
        const pos = obj.physicsBody.getPosition();
        obj.screenX = pos.x;
        obj.screenY = pos.y;
        if (typeof obj.physicsBody.getAngle === "function") {
          obj.angle = obj.physicsBody.getAngle();
        }
      } else {
        // non-physical objects (stars) use normalized coords
        obj.screenX = obj.nx * canvasWidth;
        obj.screenY = obj.ny * canvasHeight;
      }
    }
  }

  // Check collisions between balls and stars (simple circle overlap)
  if (gameObjects && gameObjects.length) {
    const balls = gameObjects.filter((g) => g instanceof Ball);
    const stars = gameObjects.filter((g) => g instanceof Star && !g.collected);
    for (const star of stars) {
      for (const ball of balls) {
        const bx = ball.screenX != null ? ball.screenX : ball.nx * canvasWidth;
        const by = ball.screenY != null ? ball.screenY : ball.ny * canvasHeight;
        const br =
          ball.physicalRadius ??
          (ball.radius > 1 ? ball.radius : ball.radius * Math.min(canvasWidth, canvasHeight));
        const sx = star.screenX != null ? star.screenX : star.nx * canvasWidth;
        const sy = star.screenY != null ? star.screenY : star.ny * canvasHeight;
        const sr =
          star.radius > 1 ? star.radius : star.radius * Math.min(canvasWidth, canvasHeight);
        const d = Math.hypot(bx - sx, by - sy);
        if (d <= br + sr) {
          star.collected = true;
          console.debug("star collected", star, "by", ball);
          // optional: remove from gameObjects array later
          break;
        }
      }
    }

    // If all stars collected, signal stage clear
    const remaining = gameObjects.filter((g) => g instanceof Star && !g.collected);
    if (remaining.length === 0 && !stageCleared) {
      stageCleared = true;
      showStageClearOverlay("Stage Cleared!");
      if (currentStage && typeof currentStage.onClear === "function") {
        try {
          currentStage.onClear();
        } catch (e) {
          console.warn("currentStage.onClear failed:", e);
        }
      }
      window.dispatchEvent(new CustomEvent("stageClear", { detail: { stage: currentStage } }));
    }
  }
  render();
  // Continue animation loop
  animationFrameId = window.requestAnimationFrame(tick);
}

function render() {
  if (!roughCanvas || !ctx) return;

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // Check if in fullscreen mode
  const isFullscreen = document.fullscreenElement || window.innerHeight === screen.height;

  // If not fullscreen, show guidance message
  if (!isFullscreen) {
    ctx.save();

    const fontSize = Math.max(24, Math.round(canvasHeight * 0.08));
    ctx.font = `bold ${fontSize}px MyeongjoFont, serif`;
    ctx.fillStyle = "#4f3b24";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const centerY = canvasHeight / 2;
    ctx.fillText("Press F11 to enter fullscreen", canvasWidth / 2, centerY - fontSize * 0.8);
    ctx.fillText("to continue playing", canvasWidth / 2, centerY + fontSize * 0.2);

    ctx.restore();
    return;
  }

  if (currentStroke && currentStroke.length > 1) {
    drawStrokePreview(currentStroke, 8);
  }

  physicsStrokes.forEach((stroke) => drawPhysicsStroke(stroke));

  // Draw stage-declared objects (balls, stars...)
  if (gameObjects && gameObjects.length) {
    for (const obj of gameObjects) {
      if (typeof obj.draw === "function") {
        obj.draw(canvasWidth, canvasHeight, roughCanvas);
      }
    }
  }
}

function startDrawing(event) {
  if (stageCleared) {
    return;
  }
  isDrawing = true;
  lastPoint = getPoint(event);
  currentStroke = [];
  // reset preview cache for a new stroke
  if (previewCtx) previewCtx.clearRect(0, 0, canvasWidth, canvasHeight);
  currentStrokePreviewDirty = false;
  currentStrokePreviewLastIndex = 0;
}

function continueDrawing(event) {
  const isFullscreen = document.fullscreenElement || window.innerHeight === screen.height;
  if (!isFullscreen || stageCleared || !isDrawing || !lastPoint) {
    return;
  }

  const currentPoint = getPoint(event);
  currentStroke.push(currentPoint);
  lastPoint = currentPoint;
  // mark preview cache dirty so it'll be re-generated once per change
  currentStrokePreviewDirty = true;
}

function stopDrawing(event) {
  if (!isDrawing) {
    return;
  }

  if (stageCleared) {
    isDrawing = false;
    lastPoint = null;
    if (previewCtx) previewCtx.clearRect(0, 0, canvasWidth, canvasHeight);
    currentStrokePreviewDirty = false;
    currentStrokePreviewLastIndex = 0;
    currentStroke = null;
    return;
  }

  isDrawing = false;
  lastPoint = null;

  if (!currentStroke || currentStroke.length < 2) {
    // treat as a click if user didn't draw a stroke
    const clickPos = event ? getPoint(event) : null;
    if (clickPos && gameObjects && gameObjects.length) {
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
            // apply impulse to the right
            // Apply an off-center impulse to produce immediate torque (less sliding)
            const IMPULSE_LINEAR = 80023; // reduced linear impulse
            const ANGULAR_IMPULSE = 999999; // stronger angular impulse for visible rolling
            if (obj.physicsBody) {
              try {
                const offsetY = -Math.max(2, obj.physicalRadius * 0.6);
                applyImpulseAtLocalPoint(obj.physicsBody, IMPULSE_LINEAR, 0, 0, offsetY);
                applyAngularImpulseToBody(obj.physicsBody, ANGULAR_IMPULSE);
                console.debug(
                  "applied off-center impulse",
                  IMPULSE_LINEAR,
                  "and angular impulse",
                  ANGULAR_IMPULSE,
                  "to ball at",
                  bx,
                  by
                );
              } catch (e) {
                console.warn("failed to apply impulse:", e);
              }
            }
            break;
          }
        }
      }
    }

    currentStroke = null;
    return;
  }

  // If the user drew a very short stroke (tiny jitter), treat it as a click.
  const CLICK_DISTANCE_THRESHOLD = 6; // pixels
  let totalDist = 0;
  for (let i = 1; i < currentStroke.length; i += 1) {
    const a = currentStroke[i - 1];
    const b = currentStroke[i];
    totalDist += Math.hypot(b.x - a.x, b.y - a.y);
  }
  if (totalDist <= CLICK_DISTANCE_THRESHOLD) {
    const clickPos = currentStroke[currentStroke.length - 1];
    if (clickPos && gameObjects && gameObjects.length) {
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
            const IMPULSE_LINEAR = 3500;
            const ANGULAR_IMPULSE = -1.2;
            if (obj.physicsBody) {
              try {
                const offsetY = -Math.max(2, obj.physicalRadius * 0.6);
                applyImpulseAtLocalPoint(obj.physicsBody, IMPULSE_LINEAR, 0, 0, offsetY);
                applyAngularImpulseToBody(obj.physicsBody, ANGULAR_IMPULSE);
                console.debug(
                  "applied impulse (short drag)",
                  IMPULSE_LINEAR,
                  "and angular impulse",
                  ANGULAR_IMPULSE,
                  "to ball at",
                  bx,
                  by
                );
              } catch (e) {
                console.warn("failed to apply impulse:", e);
              }
            }
            break;
          }
        }
      }
    }
    currentStroke = null;
    return;
  }

  const stageCreateStrokeBody = currentStage?.createStrokeBody || createStrokeBody;
  const stageInitializeStrokeBody = currentStage?.initializeStrokeBody || initializeStrokeBody;

  const strokeBody = stageCreateStrokeBody(currentStroke);
  if (strokeBody) {
    const floorY = (canvas?.clientHeight || 0) - 24;
    stageInitializeStrokeBody(strokeBody, floorY);
    // Prefer using the preview canvas snapshot so the finalized texture
    // matches exactly what the player saw during drawing.
    createStrokeTexture(strokeBody, previewCanvas);
    physicsStrokes.push(strokeBody);
  }

  // clear preview overlay after capturing snapshot for the finalized stroke
  if (previewCtx) previewCtx.clearRect(0, 0, canvasWidth, canvasHeight);
  currentStrokePreviewDirty = false;
  currentStrokePreviewLastIndex = 0;
  currentStroke = null;
}

canvas?.addEventListener("pointerdown", startDrawing);
canvas?.addEventListener("pointermove", continueDrawing);
window.addEventListener("pointerup", stopDrawing);
window.addEventListener("pointerleave", stopDrawing);

window.addEventListener("resize", resizeCanvas);
window.addEventListener("orientationchange", resizeCanvas);
window.addEventListener("fullscreenchange", async () => {
  if (!document.fullscreenElement) return;
  if (!currentStage || stageHasSimulated || physicsStrokes.length > 0) return;
  await initializeStage(currentStageNumber);
  resizeCanvas();
});

stageButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    const stageNumber = Number(button.dataset.stage);
    if (!stageNumber) {
      return;
    }
    await startStage(stageNumber);
  });
});

initializePageFlow();
resizeCanvas();

window.addEventListener("load", () => {
  document.documentElement.classList.add("js-ready");
  const loader = document.getElementById("page-loader");
  if (loader) loader.remove();
});
