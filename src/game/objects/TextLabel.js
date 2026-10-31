import { INK, FONT_DISPLAY } from "../../theme.js";
import { translateText } from "../../app/localization.js";

export class TextLabel {
  constructor(opts = {}) {
    const {
      x,
      y,
      text,
      mobileText,
      fontSize,
      color,
      fontFamily,
      shouldTranslate = true,
      useKoreanTextScale = true,
    } = opts || {};
    const isMobile =
      window.matchMedia?.("(hover: none) and (pointer: coarse)").matches ??
      navigator.maxTouchPoints > 0;
    this.nx = typeof x === "number" ? x : 0.5;
    this.ny = typeof y === "number" ? y : 0.2;
    this.sourceText = isMobile && mobileText ? mobileText : text || "";
    this.mobileText = mobileText || null;
    this.shouldTranslate = shouldTranslate;
    this.useKoreanTextScale = useKoreanTextScale;
    this.text = this.shouldTranslate ? translateText(this.sourceText) : this.sourceText;
    this.fontSize = typeof fontSize === "number" ? fontSize : 0.04;
    this.color = typeof color === "string" ? color : INK;
    this.fontFamily = typeof fontFamily === "string" ? fontFamily : null;
    this.texture = null;
    this.textureOffset = null;
    this._lastCanvasSize = null;
    this._lastFontFamily = null;
  }

  createTexture(canvasW, canvasH) {
    const useKoreanTextStyle = this.useKoreanTextScale && document.documentElement.lang === "ko";
    const fontPx =
      (this.fontSize > 1 ? this.fontSize : Math.max(10, Math.round(this.fontSize * canvasH))) *
      (useKoreanTextStyle ? 1.05 : 1);
    const fontFamily = this.fontFamily || FONT_DISPLAY;
    const lines = String(this.text)
      .split("\n")
      .map((line) => line.trim());
    const off = document.createElement("canvas");
    const offCtx = off.getContext("2d");
    offCtx.font = `${useKoreanTextStyle ? "700 " : ""}${fontPx}px ${fontFamily}`;
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

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const scaledWidth = width * dpr;
    const scaledHeight = height * dpr;
    off.width = scaledWidth;
    off.height = scaledHeight;
    off.style.width = `${width}px`;
    off.style.height = `${height}px`;
    const hid = off.getContext("2d");
    hid.setTransform(dpr, 0, 0, dpr, 0, 0);
    hid.clearRect(0, 0, width, height);
    hid.font = `${useKoreanTextStyle ? "700 " : ""}${fontPx}px ${fontFamily}`;
    hid.textBaseline = "middle";
    hid.textAlign = "center";
    hid.fillStyle = this.color;

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
    this._lastFontFamily = fontFamily;
  }

  draw(canvasW, canvasH, ctx) {
    if (!ctx) return;
    const nextText = this.shouldTranslate ? translateText(this.sourceText) : this.sourceText;
    const fontFamily = this.fontFamily || FONT_DISPLAY;
    if (this.text !== nextText) {
      this.text = nextText;
      this.texture = null;
    }
    if (
      !this.texture ||
      !this._lastCanvasSize ||
      this._lastCanvasSize.w !== canvasW ||
      this._lastCanvasSize.h !== canvasH ||
      this._lastFontFamily !== fontFamily
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
