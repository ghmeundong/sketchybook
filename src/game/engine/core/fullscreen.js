import { state } from "./gameState.js";

export function isFullscreenActive() {
  if (state.electronFullscreen !== null) return state.electronFullscreen;
  return Boolean(document.fullscreenElement || window.innerHeight === screen.height);
}
