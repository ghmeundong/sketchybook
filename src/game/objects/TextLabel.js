export class TextLabel {
  constructor(opts = {}) {
    const { x, y, text, fontSize, color, fontFamily } = opts || {};
    this.nx = typeof x === "number" ? x : 0.5;
    this.ny = typeof y === "number" ? y : 0.2;
    this.text = text || "";
    this.fontSize = typeof fontSize === "number" ? fontSize : 0.04;
    this.color = typeof color === "string" ? color : "#4f3b24";
    this.fontFamily = typeof fontFamily === "string" ? fontFamily : "MyeongjoFont, serif";
    this.texture = null;
    this.textureOffset = null;
    this._lastCanvasSize = null;
  }

  createTexture(canvasW, canvasH) {
    const fontPx =
      this.fontSize > 1 ? this.fontSize : Math.max(10, Math.round(this.fontSize * canvasH));
    const fontFamily = this.fontFamily || "MyeongjoFont, serif";
    const lines = String(this.text)
      .split("\n")
      .map((line) => line.trim());
    const off = document.createElement("canvas");
    const offCtx = off.getContext("2d");
    offCtx.font = `${fontPx}px ${fontFamily}`;
    offCtx.textBaseline = "middle";
    offCtx.textAlign = "center";

    const lineWidths = lines.map((line) => offCtx.measureText(line).width);
    const textWidth = Math.max(...lineWidths, 1);
    const textHeight = fontPx * lines.length + fontPx * 0.4 * Math.max(lines.length - 1, 0);
    const padding = Math.max(12, Math.round(fontPx * 0.4));
    const width = Math.ceil(textWidth + padding * 2);
    const height = Math.ceil(textHeight + padding * 2);

    off.width = width;
    off.height = height;

    const dpr = window.devicePixelRatio || 1;
    const scaledWidth = width * dpr;
    const scaledHeight = height * dpr;
    off.width = scaledWidth;
    off.height = scaledHeight;
    off.style.width = `${width}px`;
    off.style.height = `${height}px`;
    const hid = off.getContext("2d");
    hid.setTransform(dpr, 0, 0, dpr, 0, 0);
    hid.clearRect(0, 0, width, height);
    hid.font = `${fontPx}px ${fontFamily}`;
    hid.textBaseline = "middle";
    hid.textAlign = "center";
    hid.fillStyle = this.color;
    hid.strokeStyle = this.color;
    hid.lineWidth = Math.max(1, Math.round(fontPx * 0.12));

    const centerX = width / 2;
    let centerY = padding + fontPx / 2;
    for (const line of lines) {
      hid.fillText(line, centerX, centerY);
      centerY += fontPx * 1.4;
    }

    this.texture = off;
    this.textureOffset = {
      centerX: width / 2,
      centerY: height / 2,
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

    const px = this.screenX != null ? this.screenX : this.nx * canvasW;
    const py = this.screenY != null ? this.screenY : this.ny * canvasH;
    const { centerX, centerY, width, height } = this.textureOffset || {};

    if (this.texture && centerX != null && centerY != null && width != null && height != null) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.drawImage(this.texture, px - centerX, py - centerY, width, height);
      ctx.restore();
    }
  }
}
