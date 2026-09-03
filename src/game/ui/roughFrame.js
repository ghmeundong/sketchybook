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

export function drawRoughFrameRect(rc, x, y, width, height, overrides = {}) {
  return rc.rectangle(x, y, width, height, { ...DEFAULT_FRAME_OPTIONS, ...overrides });
}
