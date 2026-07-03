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
  applyImpulseToBody,
  applyAngularImpulseToBody,
  applyImpulseAtLocalPoint,
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
const physicsFrameDuration = 1000 / 60;
const renderFrameDuration = 1000 / 60;

let renderIntervalId = null;

let stageCleared = false;

// Game objects (balls, stars, etc.) that stages can declare.
let gameObjects = [];

class Ball {
  // x, y: normalized (0..1) positions relative to canvas width/height
  // radius: normalized (0..1) relative to min(canvasWidth, canvasHeight) or pixels if >1
  constructor({ x = 0.5, y = 0.5, radius = 0.05 } = {}) {
    this.nx = x;
    this.ny = y;
    this.radius = radius;
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
  constructor({ x = 0.5, y = 0.5, radius = 0.035 } = {}) {
    this.nx = x;
    this.ny = y;
    this.radius = radius;
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
      }
    }
  }

  if (!animationFrameId) {
    animationFrameId = window.requestAnimationFrame(tick);
  }

  // start or restart render interval at desired rate
  if (renderIntervalId) {
    clearInterval(renderIntervalId);
    renderIntervalId = null;
  }
  renderIntervalId = setInterval(() => {
    try {
      render();
    } catch (e) {
      console.warn("render error", e);
    }
  }, renderFrameDuration);
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
  // Populate gameObjects from stage data (if any)
  gameObjects = [];
  stageCleared = false;
  if (Array.isArray(currentStage?.objects)) {
    for (const obj of currentStage.objects) {
      if (obj.type === "ball") {
        gameObjects.push(new Ball({ x: obj.x, y: obj.y, radius: obj.radius }));
      } else if (obj.type === "star") {
        gameObjects.push(new Star({ x: obj.x, y: obj.y, radius: obj.radius }));
      }
      // future: handle other types (star, obstacle, etc.)
    }
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

  // Catch up physics: run as many 1/120s sub-steps as needed to reach current timestamp
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
  animationFrameId = window.requestAnimationFrame(tick);
}

function render() {
  if (!roughCanvas || !ctx) return;

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

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

function stopDrawing(event) {
  if (!isDrawing) {
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
    createStrokeTexture(strokeBody);
    physicsStrokes.push(strokeBody);
  }

  currentStroke = null;
}

canvas?.addEventListener("pointerdown", () => {
  if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch((err) => {
      console.log("게임 진입 후 전체화면 자동 전환 실패:", err.message);
    });
  }
});

canvas?.addEventListener("pointerdown", startDrawing);
canvas?.addEventListener("pointermove", continueDrawing);
window.addEventListener("pointerup", stopDrawing);
window.addEventListener("pointerleave", stopDrawing);

window.addEventListener("resize", resizeCanvas);
window.addEventListener("orientationchange", resizeCanvas);

initializeStage();
resizeCanvas();
