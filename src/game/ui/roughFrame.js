import rough from "roughjs";
import { INK } from "../../theme.js";

// Shared defaults for the hand-drawn (rough.js) rectangle frame used around
// cards, buttons, and tooltips throughout the app.
const DEFAULT_FRAME_OPTIONS = {
  stroke: INK,
  strokeWidth: 1.6,
  roughness: 1.6,
  bowing: 1.2,
  fill: "transparent",
  fillStyle: "solid",
};

const frameDrawers = new WeakMap();

export function drawRoughFrameRect(rc, x, y, width, height, overrides = {}) {
  return rc.rectangle(x, y, width, height, { ...DEFAULT_FRAME_OPTIONS, ...overrides });
}

export function attachRoughFrame(element, options = {}) {
  if (!element || element.querySelector(":scope > .rough-frame-canvas")) {
    return null;
  }

  const frameCanvas = document.createElement("canvas");
  const outside = options.outside ?? 5;
  frameCanvas.className = "rough-frame-canvas";
  frameCanvas.setAttribute("aria-hidden", "true");
  frameCanvas.style.position = "absolute";
  frameCanvas.style.top = `${-outside}px`;
  frameCanvas.style.left = `${-outside}px`;
  frameCanvas.style.width = `calc(100% + ${outside * 2}px)`;
  frameCanvas.style.height = `calc(100% + ${outside * 2}px)`;
  frameCanvas.style.pointerEvents = "none";
  frameCanvas.style.zIndex = "0";
  element.prepend(frameCanvas);

  const draw = () => {
    const rect = element.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    const canvasWidth = width + outside * 2;
    const canvasHeight = height + outside * 2;
    frameCanvas.width = Math.ceil(canvasWidth * dpr);
    frameCanvas.height = Math.ceil(canvasHeight * dpr);
    const context = frameCanvas.getContext("2d");
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, canvasWidth, canvasHeight);
    const roughCanvas = rough.canvas(frameCanvas);
    const inset = options.inset ?? 6;
    drawRoughFrameRect(
      roughCanvas,
      outside + inset,
      outside + inset,
      Math.max(1, width - inset * 2),
      Math.max(1, height - inset * 2),
      options
    );
  };

  frameDrawers.set(element, draw);

  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(draw);
    observer.observe(element);
  }
  window.requestAnimationFrame(draw);
  return frameCanvas;
}

export function refreshRoughFrame(element) {
  frameDrawers.get(element)?.();
}
