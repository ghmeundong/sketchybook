import rough from "roughjs";
import { createCoordinateSystem } from "./coordinates.js";
import {
  createStrokeBody,
  initializeStrokeBody,
  updateStrokeBody,
  stepPhysicsWorld,
  createCircleBody,
  createBoxBody,
  createEdgeBody,
  applyImpulseAtLocalPoint,
  applyAngularImpulseToBody,
  resetPhysicsWorld,
} from "./physics.js";
import { createStrokeTexture } from "./strokes.js";

export function createGameLoop({
  board,
  canvas,
  playPage,
  currentStageRef,
  gameState,
  onStageClear,
}) {
  const physicsFrameDuration = 1000 / 60;
  let animationFrameId = null;
  let lastPhysicsTime = 0;

  const isBallObject = (obj) =>
    Boolean(
      obj &&
      typeof obj === "object" &&
      "nx" in obj &&
      "ny" in obj &&
      "radius" in obj &&
      typeof obj.draw === "function"
    );
  const isPlatformObject = (obj) =>
    Boolean(
      obj &&
      typeof obj === "object" &&
      "nx" in obj &&
      "ny" in obj &&
      "width" in obj &&
      "height" in obj
    );
  const isSegmentObject = (obj) =>
    Boolean(
      obj && typeof obj === "object" && "x1" in obj && "x2" in obj && "y1" in obj && "y2" in obj
    );
  const isComplexObject = (obj) =>
    Boolean(
      obj &&
      typeof obj === "object" &&
      typeof obj.createTexture === "function" &&
      typeof obj.createPhysics === "function"
    );
  const isRotorObject = (obj) =>
    Boolean(
      obj &&
      typeof obj === "object" &&
      typeof obj.createTexture === "function" &&
      typeof obj.createPhysics === "function" &&
      "physicsBody" in obj
    );
  const isStarObject = (obj) =>
    Boolean(
      obj &&
      typeof obj === "object" &&
      "collected" in obj &&
      "radius" in obj &&
      "nx" in obj &&
      "ny" in obj
    );

  function getPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function drawStroke(start, end, width = 8, options = {}) {
    const targetRough = options.roughCanvasOverride || gameState.roughCanvas;
    if (!targetRough || !gameState.coordinateSystem) return;

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
    if (!points || points.length < 2 || !gameState.ctx) return;
    const dpr = window.devicePixelRatio || 1;
    if (!gameState.previewCtx || !gameState.previewCanvas) return;

    if (
      gameState.previewCanvas.width !== Math.max(1, gameState.canvasWidth) * dpr ||
      gameState.previewCanvas.height !== Math.max(1, gameState.canvasHeight) * dpr
    ) {
      gameState.previewCanvas.width = Math.max(1, gameState.canvasWidth) * dpr;
      gameState.previewCanvas.height = Math.max(1, gameState.canvasHeight) * dpr;
      gameState.previewCanvas.style.width = `${Math.max(1, gameState.canvasWidth)}px`;
      gameState.previewCanvas.style.height = `${Math.max(1, gameState.canvasHeight)}px`;
      gameState.previewCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      gameState.currentStrokePreviewLastIndex = 0;
    }

    const lastIdx = gameState.currentStrokePreviewLastIndex ?? 0;
    if (lastIdx === 0) {
      gameState.previewCtx.clearRect(0, 0, gameState.canvasWidth, gameState.canvasHeight);
      const rc = rough.canvas(gameState.previewCanvas);
      for (let i = 0; i < points.length - 1; i += 1) {
        drawStroke(points[i], points[i + 1], width, {
          targetCanvas: gameState.previewCanvas,
          roughCanvasOverride: rc,
        });
      }
      gameState.currentStrokePreviewLastIndex = Math.max(0, points.length - 1);
      gameState.currentStrokePreviewDirty = false;
      return;
    }

    if (lastIdx < points.length - 1) {
      const rc = rough.canvas(gameState.previewCanvas);
      for (let i = Math.max(0, lastIdx); i < points.length - 1; i += 1) {
        drawStroke(points[i], points[i + 1], width, {
          targetCanvas: gameState.previewCanvas,
          roughCanvasOverride: rc,
        });
      }
      gameState.currentStrokePreviewLastIndex = Math.max(0, points.length - 1);
      gameState.currentStrokePreviewDirty = false;
    }
  }

  function drawPhysicsStroke(stroke) {
    if (!gameState.ctx || !stroke?.points?.length) return;
    if (stroke.texture && stroke.textureOffset) {
      const { centerX, centerY, width, height } = stroke.textureOffset;
      gameState.ctx.save();
      gameState.ctx.translate(stroke.body.x, stroke.body.y);
      gameState.ctx.rotate(stroke.angle);
      gameState.ctx.globalAlpha = 1;
      gameState.ctx.drawImage(stroke.texture, -centerX, -centerY, width, height);
      gameState.ctx.restore();
      return;
    }

    const vertices = stroke.points;
    for (let i = 0; i < vertices.length - 1; i += 1) {
      const p1 = vertices[i];
      const p2 = vertices[i + 1];
      drawStroke(p1, p2, 8, { alpha: 0.18, roughness: 2.0 });
    }
  }

  function resizeCanvas() {
    if (!board || !canvas) return;

    gameState.canvasWidth = board.clientWidth;
    gameState.canvasHeight = board.clientHeight;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = gameState.canvasWidth * dpr;
    canvas.height = gameState.canvasHeight * dpr;
    canvas.style.width = `${gameState.canvasWidth}px`;
    canvas.style.height = `${gameState.canvasHeight}px`;

    gameState.ctx = canvas.getContext("2d");
    if (!gameState.ctx) return;

    gameState.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    gameState.ctx.clearRect(0, 0, gameState.canvasWidth, gameState.canvasHeight);

    gameState.coordinateSystem = createCoordinateSystem({
      viewportWidth: gameState.canvasWidth,
      viewportHeight: gameState.canvasHeight,
    });
    gameState.roughCanvas = rough.canvas(canvas);
    gameState.roughCanvas.ctx.globalAlpha = 1;

    if (!gameState.previewCanvas) {
      gameState.previewCanvas = document.createElement("canvas");
      gameState.previewCanvas.className = "game-preview-canvas";
      gameState.previewCanvas.style.position = "absolute";
      gameState.previewCanvas.style.inset = "0";
      gameState.previewCanvas.style.pointerEvents = "none";
      gameState.previewCanvas.style.zIndex = "50";
      if (board) board.appendChild(gameState.previewCanvas);
    }
    gameState.previewCanvas.width = Math.max(1, gameState.canvasWidth) * dpr;
    gameState.previewCanvas.height = Math.max(1, gameState.canvasHeight) * dpr;
    gameState.previewCanvas.style.width = `${Math.max(1, gameState.canvasWidth)}px`;
    gameState.previewCanvas.style.height = `${Math.max(1, gameState.canvasHeight)}px`;
    gameState.previewCtx = gameState.previewCanvas.getContext("2d");
    gameState.previewCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    gameState.previewCtx.clearRect(0, 0, gameState.canvasWidth, gameState.canvasHeight);

    const shouldRebuildPhysics =
      currentStageRef.current &&
      !gameState.stageHasSimulated &&
      gameState.physicsStrokes.length === 0 &&
      gameState.gameObjects.some(
        (obj) => obj.physicsBody || (obj.physicsBodies && obj.physicsBodies.length)
      );
    if (shouldRebuildPhysics) {
      resetPhysicsWorld();
      for (const obj of gameState.gameObjects) {
        if (obj.physicsBody) obj.physicsBody = null;
        if (obj.physicsBodies) obj.physicsBodies = null;
      }
    }

    const floorYForPhysics = canvas?.clientHeight
      ? canvas.clientHeight - 24
      : gameState.canvasHeight - 24;
    if (gameState.gameObjects?.length) {
      for (const obj of gameState.gameObjects) {
        if (isBallObject(obj) && !obj.physicsBody) {
          const px = obj.nx * gameState.canvasWidth;
          const py = obj.ny * gameState.canvasHeight;
          const minDim = Math.min(gameState.canvasWidth, gameState.canvasHeight);
          const rPixels = obj.radius > 1 ? obj.radius : Math.max(2, obj.radius * minDim);
          try {
            const body = createCircleBody(px, py, rPixels, floorYForPhysics, { density: 1 });
            obj.physicsBody = body;
            obj.physicalRadius = rPixels;
          } catch (e) {
            console.warn("createCircleBody failed:", e);
          }
        } else if (isPlatformObject(obj) && !obj.physicsBody) {
          const px = obj.nx * gameState.canvasWidth;
          const py = obj.ny * gameState.canvasHeight;
          const widthPx =
            obj.width > 1 ? obj.width : Math.max(4, obj.width * gameState.canvasWidth);
          const heightPx =
            obj.height > 1 ? obj.height : Math.max(4, obj.height * gameState.canvasHeight);
          try {
            const body = createBoxBody(px, py, widthPx, heightPx, floorYForPhysics, {
              type: "static",
              friction: 0.8,
            });
            obj.physicsBody = body;
          } catch (e) {
            console.warn("createBoxBody failed:", e);
          }
        } else if (isSegmentObject(obj) && !obj.physicsBody) {
          const x1 = obj.x1 * gameState.canvasWidth;
          const y1 = obj.y1 * gameState.canvasHeight;
          const x2 = obj.x2 * gameState.canvasWidth;
          const y2 = obj.y2 * gameState.canvasHeight;
          try {
            const body = createEdgeBody(x1, y1, x2, y2, floorYForPhysics, {
              type: "static",
              friction: 0.8,
            });
            obj.physicsBody = body;
          } catch (e) {
            console.warn("createEdgeBody failed:", e);
          }
        } else if (isComplexObject(obj) && (!obj.physicsBodies || !obj.physicsBodies.length)) {
          try {
            obj.createTexture(gameState.canvasWidth, gameState.canvasHeight);
            obj.createPhysics(floorYForPhysics);
          } catch (e) {
            console.warn("ComplexObject physics creation failed:", e);
          }
        } else if (isRotorObject(obj) && !obj.physicsBody) {
          try {
            obj.createTexture(gameState.canvasWidth, gameState.canvasHeight);
            obj.createPhysics(gameState.canvasWidth, gameState.canvasHeight, floorYForPhysics);
          } catch (e) {
            console.warn("Rotor physics creation failed:", e);
          }
        }
      }
    }

    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    animationFrameId = window.requestAnimationFrame(tick);
  }

  function render() {
    if (!gameState.roughCanvas || !gameState.ctx) return;
    gameState.ctx.clearRect(0, 0, gameState.canvasWidth, gameState.canvasHeight);

    const isFullscreen = document.fullscreenElement || window.innerHeight === screen.height;
    if (!isFullscreen) {
      gameState.ctx.save();
      const fontSize = Math.max(24, Math.round(gameState.canvasHeight * 0.08));
      gameState.ctx.font = `bold ${fontSize}px MyeongjoFont, serif`;
      gameState.ctx.fillStyle = "#4f3b24";
      gameState.ctx.textAlign = "center";
      gameState.ctx.textBaseline = "middle";
      const centerY = gameState.canvasHeight / 2;
      gameState.ctx.fillText(
        "Press F11 to enter fullscreen",
        gameState.canvasWidth / 2,
        centerY - fontSize * 0.8
      );
      gameState.ctx.fillText(
        "to continue playing",
        gameState.canvasWidth / 2,
        centerY + fontSize * 0.2
      );
      gameState.ctx.restore();
      return;
    }

    if (gameState.currentStroke && gameState.currentStroke.length > 1) {
      drawStrokePreview(gameState.currentStroke, 8);
    }

    gameState.physicsStrokes.forEach((stroke) => drawPhysicsStroke(stroke));

    if (gameState.gameObjects?.length) {
      for (const obj of gameState.gameObjects) {
        if (typeof obj.draw === "function") {
          obj.draw(gameState.canvasWidth, gameState.canvasHeight, gameState.roughCanvas);
        }
      }
    }
  }

  function tick(timestamp = 0) {
    const isFullscreen = document.fullscreenElement || window.innerHeight === screen.height;
    const isGameActive = playPage?.classList.contains("is-active");
    if (!isGameActive) {
      animationFrameId = window.requestAnimationFrame(tick);
      return;
    }

    const width = canvas?.clientWidth || 0;
    const height = canvas?.clientHeight || 0;
    const floorY = height - 24;

    if (isGameActive) {
      if (lastPhysicsTime === 0) lastPhysicsTime = timestamp;
      while (timestamp - lastPhysicsTime >= physicsFrameDuration) {
        if (currentStageRef.current && typeof currentStageRef.current.update === "function") {
          currentStageRef.current.update(gameState.physicsStrokes, floorY);
        } else {
          stepPhysicsWorld({ deltaTime: 1 / 60 });
          gameState.physicsStrokes.forEach((stroke) => {
            if (!stroke?.points?.length || !stroke.body) return;
            updateStrokeBody(stroke, floorY);
          });
        }
        lastPhysicsTime += physicsFrameDuration;
        gameState.stageHasSimulated = true;
      }
    }

    for (const obj of gameState.gameObjects) {
      if (obj.physicsBody) {
        const pos = obj.physicsBody.getPosition();
        obj.screenX = pos.x;
        obj.screenY = pos.y;
        if (typeof obj.physicsBody.getAngle === "function") obj.angle = obj.physicsBody.getAngle();
      } else {
        obj.screenX = obj.nx * gameState.canvasWidth;
        obj.screenY = obj.ny * gameState.canvasHeight;
      }
    }

    if (gameState.gameObjects?.length) {
      const balls = gameState.gameObjects.filter((g) => isBallObject(g));
      const stars = gameState.gameObjects.filter((g) => isStarObject(g) && !g.collected);
      for (const star of stars) {
        for (const ball of balls) {
          const bx = ball.screenX != null ? ball.screenX : ball.nx * gameState.canvasWidth;
          const by = ball.screenY != null ? ball.screenY : ball.ny * gameState.canvasHeight;
          const br =
            ball.physicalRadius ??
            (ball.radius > 1
              ? ball.radius
              : ball.radius * Math.min(gameState.canvasWidth, gameState.canvasHeight));
          const sx = star.screenX != null ? star.screenX : star.nx * gameState.canvasWidth;
          const sy = star.screenY != null ? star.screenY : star.ny * gameState.canvasHeight;
          const sr =
            star.radius > 1
              ? star.radius
              : star.radius * Math.min(gameState.canvasWidth, gameState.canvasHeight);
          const d = Math.hypot(bx - sx, by - sy);
          if (d <= br + sr) {
            star.collected = true;
            break;
          }
        }
      }

      const remaining = gameState.gameObjects.filter((g) => isStarObject(g) && !g.collected);
      if (remaining.length === 0 && !gameState.stageCleared) {
        gameState.stageCleared = true;
        if (typeof onStageClear === "function") onStageClear();
      }
    }

    render();
    animationFrameId = window.requestAnimationFrame(tick);
  }

  function startDrawing(event) {
    if (gameState.stageCleared) return;
    gameState.stageEventCount += 1;
    gameState.isDrawing = true;
    gameState.lastPoint = getPoint(event);
    gameState.currentStroke = [];
    if (gameState.previewCtx)
      gameState.previewCtx.clearRect(0, 0, gameState.canvasWidth, gameState.canvasHeight);
    gameState.currentStrokePreviewDirty = false;
    gameState.currentStrokePreviewLastIndex = 0;
  }

  function continueDrawing(event) {
    const isFullscreen = document.fullscreenElement || window.innerHeight === screen.height;
    if (!isFullscreen || gameState.stageCleared || !gameState.isDrawing || !gameState.lastPoint)
      return;

    const currentPoint = getPoint(event);
    gameState.currentStroke.push(currentPoint);
    gameState.lastPoint = currentPoint;
    gameState.currentStrokePreviewDirty = true;
  }

  function stopDrawing(event) {
    if (!gameState.isDrawing) return;

    if (gameState.stageCleared) {
      gameState.isDrawing = false;
      gameState.lastPoint = null;
      if (gameState.previewCtx)
        gameState.previewCtx.clearRect(0, 0, gameState.canvasWidth, gameState.canvasHeight);
      gameState.currentStrokePreviewDirty = false;
      gameState.currentStrokePreviewLastIndex = 0;
      gameState.currentStroke = null;
      return;
    }

    gameState.isDrawing = false;
    gameState.lastPoint = null;

    if (!gameState.currentStroke || gameState.currentStroke.length < 2) {
      const clickPos = event ? getPoint(event) : null;
      if (clickPos && gameState.gameObjects?.length) {
        for (const obj of gameState.gameObjects) {
          if (isBallObject(obj)) {
            const bx = obj.screenX != null ? obj.screenX : obj.nx * gameState.canvasWidth;
            const by = obj.screenY != null ? obj.screenY : obj.ny * gameState.canvasHeight;
            const pr =
              obj.physicalRadius ??
              (obj.radius > 1
                ? obj.radius
                : obj.radius * Math.min(gameState.canvasWidth, gameState.canvasHeight));
            const dx = clickPos.x - bx;
            const dy = clickPos.y - by;
            const dist = Math.hypot(dx, dy);
            if (dist <= pr + 6) {
              const IMPULSE_LINEAR = 80023;
              const ANGULAR_IMPULSE = 999999;
              if (obj.physicsBody) {
                try {
                  const offsetY = -Math.max(2, obj.physicalRadius * 0.6);
                  applyImpulseAtLocalPoint(obj.physicsBody, IMPULSE_LINEAR, 0, 0, offsetY);
                  applyAngularImpulseToBody(obj.physicsBody, ANGULAR_IMPULSE);
                } catch (e) {
                  console.warn("failed to apply impulse:", e);
                }
              }
              break;
            }
          }
        }
      }
      gameState.currentStroke = null;
      return;
    }

    let totalDist = 0;
    for (let i = 1; i < gameState.currentStroke.length; i += 1) {
      const a = gameState.currentStroke[i - 1];
      const b = gameState.currentStroke[i];
      totalDist += Math.hypot(b.x - a.x, b.y - a.y);
    }
    if (totalDist <= 6) {
      const clickPos = gameState.currentStroke[gameState.currentStroke.length - 1];
      if (clickPos && gameState.gameObjects?.length) {
        for (const obj of gameState.gameObjects) {
          if (isBallObject(obj)) {
            const bx = obj.screenX != null ? obj.screenX : obj.nx * gameState.canvasWidth;
            const by = obj.screenY != null ? obj.screenY : obj.ny * gameState.canvasHeight;
            const pr =
              obj.physicalRadius ??
              (obj.radius > 1
                ? obj.radius
                : obj.radius * Math.min(gameState.canvasWidth, gameState.canvasHeight));
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
                } catch (e) {
                  console.warn("failed to apply impulse:", e);
                }
              }
              break;
            }
          }
        }
      }
      gameState.currentStroke = null;
      return;
    }

    const stageCreateStrokeBody = currentStageRef.current?.createStrokeBody || createStrokeBody;
    const stageInitializeStrokeBody =
      currentStageRef.current?.initializeStrokeBody || initializeStrokeBody;
    const strokeBody = stageCreateStrokeBody(gameState.currentStroke);
    if (strokeBody) {
      const floorY = (canvas?.clientHeight || 0) - 24;
      stageInitializeStrokeBody(strokeBody, floorY);
      createStrokeTexture(strokeBody, gameState.previewCanvas);
      gameState.physicsStrokes.push(strokeBody);
    }

    if (gameState.previewCtx)
      gameState.previewCtx.clearRect(0, 0, gameState.canvasWidth, gameState.canvasHeight);
    gameState.currentStrokePreviewDirty = false;
    gameState.currentStrokePreviewLastIndex = 0;
    gameState.currentStroke = null;
  }

  function attachInputHandlers() {
    canvas?.addEventListener("pointerdown", startDrawing);
    canvas?.addEventListener("pointermove", continueDrawing);
    window.addEventListener("pointerup", stopDrawing);
    window.addEventListener("pointerleave", stopDrawing);
    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("orientationchange", resizeCanvas);
    window.addEventListener("fullscreenchange", async () => {
      if (!document.fullscreenElement) return;
      if (
        !currentStageRef.current ||
        gameState.stageHasSimulated ||
        gameState.physicsStrokes.length > 0
      )
        return;
      await gameState.initializeStage(currentStageRef.current);
      resizeCanvas();
    });
  }

  return { resizeCanvas, attachInputHandlers, tick, startDrawing, continueDrawing, stopDrawing };
}
