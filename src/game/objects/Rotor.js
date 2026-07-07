import rough from "roughjs";
import { resolveCircleRadius, resolveRenderablePosition } from "../geometry.js";
import { createCircleBody, createRotorBody } from "../physics.js";

export class Rotor {
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
    const hasPointShape = Array.isArray(normalizedPoints) && normalizedPoints.length >= 2;
    const hasExplicitCenter = typeof x === "number" && typeof y === "number";
    const resolvedRadius = typeof radius === "number" && radius > 0 ? radius : null;

    if ((!hasPointShape && hasExplicitCenter) || (resolvedRadius && !hasPointShape)) {
      this.closed = true;
    } else {
      this.closed = !!closed;
    }

    if (hasPointShape) {
      const center = normalizedPoints.reduce(
        (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
        { x: 0, y: 0 }
      );
      center.x /= normalizedPoints.length;
      center.y /= normalizedPoints.length;
      this.cx = hasExplicitCenter ? x : center.x;
      this.cy = hasExplicitCenter ? y : center.y;
    } else {
      this.cx = typeof x === "number" ? x : 0.5;
      this.cy = typeof y === "number" ? y : 0.5;
    }

    this.normalizedPoints = normalizedPoints;
    this.radius = resolvedRadius ?? (hasExplicitCenter && !hasPointShape ? 0.05 : null);
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
    this.angle = 0;
    this.textureOffset = null;
    this._lastCanvasSize = null;
    this.renderAsCircle = this.radius != null && this.radius > 0;
  }

  createTexture(canvasW, canvasH) {
    if (this.renderAsCircle && typeof this.radius === "number" && this.radius > 0) {
      const minDim = Math.min(canvasW, canvasH);
      const r = resolveCircleRadius(this.radius, minDim);
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
      offRough.circle(cx, cy, diameter, {
        stroke: "#4f3b24",
        strokeWidth: 3,
        fill: "none",
        roughness: 1.4,
      });

      this.texture = off;
      this.textureOffset = {
        centerX: cx,
        centerY: cy,
        width: size,
        height: size,
      };
      if (typeof this.axisX === "number" && typeof this.axisY === "number") {
        const markerSize = 5;
        const markerCanvas = document.createElement("canvas");
        markerCanvas.width = markerSize * 2;
        markerCanvas.height = markerSize * 2;
        markerCanvas.getContext("2d");
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
      return;
    }

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
      markerCanvas.getContext("2d");
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

  createPhysics(canvasW, canvasH, floorY, options = {}) {
    if (this.physicsBody) return;

    if (this.renderAsCircle && typeof this.radius === "number" && this.radius > 0) {
      const centerX = this.cx * canvasW;
      const centerY = this.cy * canvasH;
      const radiusPixels = resolveCircleRadius(this.radius, Math.min(canvasW, canvasH));
      try {
        this.physicsBody = createCircleBody(centerX, centerY, radiusPixels, floorY, {
          isStatic: this.isStatic,
          density: this.isStatic ? 0 : 1,
          friction: 0.8,
          restitution: 0.1,
          motor: this.spinMode === "auto",
          enableMotor: this.spinMode === "auto",
          motorSpeed: this.motorSpeed,
          maxMotorTorque: this.maxMotorTorque,
          jointAnchor: {
            x: this.axisX * canvasW,
            y: this.axisY * canvasH,
          },
          skipGround: options.skipGround,
        });
        if (this.physicsBody) {
          this.screenX = centerX;
          this.screenY = centerY;
        }
        return;
      } catch (e) {
        console.warn("Rotor circle physics creation failed:", e);
      }
    }

    if (!Array.isArray(this.pixelPoints) || this.pixelPoints.length < 2) {
      this.createTexture(canvasW, canvasH);
    }
    if (!Array.isArray(this.pixelPoints) || this.pixelPoints.length < 2) return;

    const axisPixel = {
      x: typeof this.axisX === "number" ? this.axisX * canvasW : null,
      y: typeof this.axisY === "number" ? this.axisY * canvasH : null,
    };
    this.screenX = this.cx * canvasW;
    this.screenY = this.cy * canvasH;

    this.physicsBody = createRotorBody(this.pixelPoints, axisPixel, floorY, {
      closed: this.closed,
      isStatic: this.isStatic,
      motor: this.spinMode === "auto",
      motorSpeed: this.motorSpeed,
      maxMotorTorque: this.maxMotorTorque,
      friction: 0.8,
      density: this.isStatic ? 0 : 1,
      skipGround: options.skipGround,
    });
    if (this.physicsBody) {
      this.screenX = this.cx * canvasW;
      this.screenY = this.cy * canvasH;
    }
  }

  draw(canvasW, canvasH, ctx) {
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

    const fallbackPosition = resolveRenderablePosition(this, canvasW, canvasH);
    let px = this.screenX != null ? this.screenX : fallbackPosition.x;
    let py = this.screenY != null ? this.screenY : fallbackPosition.y;
    if (this.physicsBody && typeof this.physicsBody.getPosition === "function") {
      const position = this.physicsBody.getPosition();
      px = position.x;
      py = position.y;
      this.screenX = px;
      this.screenY = py;
    }
    const angle = this.angle || 0;
    const { centerOffsetX, centerOffsetY, width, height } = this.textureOffset;
    const { centerX, centerY } = this.textureOffset || {};

    if (this.renderAsCircle && centerX != null && centerY != null) {
      ctx.save();
      ctx.translate(px, py);
      if (angle) ctx.rotate(angle);
      ctx.globalAlpha = 1;
      ctx.drawImage(this.texture, -centerX, -centerY, width, height);
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(px, py);
      if (angle) ctx.rotate(angle);
      ctx.globalAlpha = 1;
      ctx.drawImage(this.texture, -centerOffsetX, -centerOffsetY, width, height);
      ctx.restore();
    }

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
