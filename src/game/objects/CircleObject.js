import rough from "roughjs";

export class CircleObject {
  constructor(opts = {}) {
    const { x, y, radius, isStatic = false } = opts || {};
    this.nx = typeof x === "number" ? x : 0.5;
    this.ny = typeof y === "number" ? y : 0.5;
    this.radius = typeof radius === "number" ? radius : 0.025;
    this.isStatic = !!isStatic;
    this.physicsBody = null;
    this.texture = null;
    this.textureOffset = null;
    this._lastCanvasSize = null;
    this.screenX = null;
    this.screenY = null;
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
    const cx = size / 2;
    const cy = size / 2;
    offRough.circle(cx, cy, diameter, {
      stroke: "#4f3b24",
      strokeWidth: 2.2,
      fill: "#4f3b24",
      fillStyle: "hachure",
      roughness: 1.3,
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

    if (this.texture && centerX != null && centerY != null) {
      ctx.save();
      ctx.globalAlpha = 1;
      const angle = this.angle || 0;
      ctx.translate(px, py);
      if (angle) ctx.rotate(angle);
      ctx.drawImage(this.texture, -centerX, -centerY, width, height);
      ctx.restore();
    }
  }
}
