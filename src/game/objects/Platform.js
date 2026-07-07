import rough from "roughjs";

export class Platform {
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
    const { width, height } = this.textureOffset || {};

    if (this.texture && width != null && height != null) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.drawImage(this.texture, px - width / 2, py - height / 2, width, height);
      ctx.restore();
    }
  }
}
