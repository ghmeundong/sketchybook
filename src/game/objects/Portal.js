import rough from "roughjs";

export class Portal {
  static portalColors = {
    orange: "orange",
    blue: "dodgerblue",
    green: "limegreen",
    purple: "mediumpurple",
    portal: "purple",
  };

  static getColorForPortalId(portalId) {
    if (typeof portalId !== "string") {
      return Portal.portalColors.portal;
    }
    return Portal.portalColors[portalId] ?? Portal.portalColors.portal;
  }

  constructor(opts = {}) {
    const { x, y, width, height, color, portalId } = opts || {};
    this.nx = typeof x === "number" ? x : 0.5;
    this.ny = typeof y === "number" ? y : 0.5;
    this.width = typeof width === "number" ? width : 0.02;
    this.height = typeof height === "number" ? height : 0.1;
    this.portalId = typeof portalId === "string" ? portalId : "portal";
    this.color =
      typeof color === "string" && !this.portalId
        ? color
        : Portal.getColorForPortalId(this.portalId);
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

    const dpr = window.devicePixelRatio || 1;
    const off = document.createElement("canvas");
    off.width = sizeW * dpr;
    off.height = sizeH * dpr;
    off.style.width = `${sizeW}px`;
    off.style.height = `${sizeH}px`;
    const offCtx = off.getContext("2d");
    offCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    offCtx.clearRect(0, 0, sizeW, sizeH);

    const offRough = rough.canvas(off);
    const cx = sizeW / 2;
    const cy = sizeH / 2;
    offRough.ellipse(cx, cy, w, h, {
      stroke: this.color,
      strokeWidth: 4,
      fill: "transparent",
      roughness: 1.5,
      bowing: 1,
    });

    this.texture = off;
    this.textureOffset = {
      centerX: cx,
      centerY: cy,
      width: sizeW,
      height: sizeH,
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

    if (this.texture && centerX != null && width != null && height != null) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.drawImage(this.texture, px - centerX, py - centerY, width, height);
      ctx.restore();
    }
  }
}
