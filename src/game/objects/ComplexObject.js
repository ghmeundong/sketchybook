import rough from "roughjs";
import { getPolygonTextureLayout, getCanvasVisualAnchor } from "../geometry.js";
import { createPolygonBody, createEdgeBody } from "../physics.js";

export class ComplexObject {
  constructor({ points = [], closed = false, isStatic = true } = {}) {
    this.normalizedPoints = Array.isArray(points) ? points.slice() : [];
    this.closed = !!closed;
    this.isStatic = !!isStatic;
    this.pixelPoints = null;
    this.physicsBodies = null;
    this.texture = null;
    this.textureOffset = null;
    this.textureAnchor = null;
    this._lastCanvasSize = null;
  }

  createTexture(canvasW, canvasH) {
    if (!Array.isArray(this.normalizedPoints) || this.normalizedPoints.length < 2) return;

    const pts = this.normalizedPoints.map((p) => ({ x: p.x * canvasW, y: p.y * canvasH }));
    this.pixelPoints = pts;

    const layout = getPolygonTextureLayout(pts, canvasW, canvasH, 12);
    const padding = 12;
    const width = layout?.width ?? 2;
    const height = layout?.height ?? 2;

    const off = document.createElement("canvas");
    off.width = width;
    off.height = height;
    const offCtx = off.getContext("2d");
    offCtx.clearRect(0, 0, width, height);

    const offRough = rough.canvas(off);
    const normalizedPts = pts.map((p) => ({
      x: p.x - (layout?.offset?.left ?? 0) - padding,
      y: p.y - (layout?.offset?.top ?? 0) - padding,
    }));

    if (this.closed && pts.length > 2) {
      offRough.polygon(normalizedPts, {
        stroke: "#4f3b24",
        strokeWidth: 3,
        roughness: 2.6,
        fill: "#fff6eb",
        fillStyle: "solid",
      });
    }

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

    const visualAnchor = getCanvasVisualAnchor(off, layout?.anchor ?? null);

    this.texture = off;
    this.textureOffset = {
      left: layout?.offset?.left ?? 0,
      top: layout?.offset?.top ?? 0,
      width,
      height,
    };
    this.textureAnchor = {
      x: visualAnchor?.x ?? layout?.anchor?.x ?? width / 2,
      y: visualAnchor?.y ?? layout?.anchor?.y ?? height / 2,
    };
    this._lastCanvasSize = { w: canvasW, h: canvasH };
  }

  createPhysics(floorY, options = {}) {
    if (!Array.isArray(this.pixelPoints) || this.pixelPoints.length < 2) return;
    if (this.physicsBodies && this.physicsBodies.length) return;

    this.physicsBodies = [];
    const pts = this.pixelPoints;
    if (this.closed && pts.length >= 3) {
      try {
        const body = createPolygonBody(pts, floorY, {
          isStatic: this.isStatic,
          friction: 0.8,
          density: this.isStatic ? 0 : 1,
          skipGround: options.skipGround,
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
          skipGround: options.skipGround,
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
          skipGround: options.skipGround,
        });
        this.physicsBodies.push(body);
      } catch (e) {
        console.warn("createEdgeBody failed for complex object closing segment:", e);
      }
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
    if (this.texture && this.textureOffset) {
      ctx.save();
      ctx.globalAlpha = 1;

      const physicsBody = this.physicsBodies?.[0] || null;
      const bodyPosition =
        physicsBody && typeof physicsBody.getPosition === "function"
          ? physicsBody.getPosition()
          : null;
      const bodyAngle =
        physicsBody && typeof physicsBody.getAngle === "function" ? physicsBody.getAngle() : 0;

      if (bodyPosition && this.textureAnchor) {
        ctx.translate(bodyPosition.x, bodyPosition.y);
        if (bodyAngle) {
          ctx.rotate(bodyAngle);
        }
        ctx.drawImage(
          this.texture,
          -this.textureAnchor.x,
          -this.textureAnchor.y,
          this.textureOffset.width,
          this.textureOffset.height
        );
      } else {
        ctx.drawImage(
          this.texture,
          this.textureOffset.left,
          this.textureOffset.top,
          this.textureOffset.width,
          this.textureOffset.height
        );
      }

      ctx.restore();
    }
  }
}
