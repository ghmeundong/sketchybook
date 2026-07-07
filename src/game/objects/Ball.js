import rough from "roughjs";
import { resolveCircleRadius } from "../geometry.js";

export class Ball {
  constructor(opts = {}) {
    const { x, y, radius } = opts || {};
    this.nx = typeof x === "number" ? x : 0.5;
    this.ny = typeof y === "number" ? y : 0.5;
    this.radius = typeof radius === "number" ? radius : 0.02;
  }

  createTexture(canvasW, canvasH) {
    const minDim = Math.min(canvasW, canvasH);
    const baseR = this.physicalRadius ?? resolveCircleRadius(this.radius, minDim);
    const r = Math.max(1, Math.round(baseR));
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
    const cx = size / 2;
    const cy = size / 2;

    offRough.circle(cx, cy, diameter, {
      stroke: "#4f3b24",
      strokeWidth: 2,
      fill: "#2f3e6f",
      fillStyle: "hachure",
      roughness: 1.1,
      hachureGap: 3,
      hachureAngle: -35,
    });

    this.texture = off;
    this.textureOffset = {
      centerX: cx,
      centerY: cy,
      width: size,
      height: size,
    };
    this._lastCanvasSize = { w: canvasW, h: canvasH };
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

    const px = this.screenX != null ? this.screenX : this.nx * canvasW;
    const py = this.screenY != null ? this.screenY : this.ny * canvasH;
    const { centerX, centerY, width, height } = this.textureOffset || {};

    if (this.texture && centerX != null) {
      ctx.save();
      ctx.globalAlpha = 1;
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
