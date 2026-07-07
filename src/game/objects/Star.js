import rough from "roughjs";

export class Star {
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

  draw(canvasW, canvasH, ctx) {
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
