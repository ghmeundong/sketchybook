import rough from "roughjs";

export class Segment {
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
