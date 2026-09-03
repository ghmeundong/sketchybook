import "../style.css";
import "../styles/game.css";
import paperTexture from "../assets/img/paper-texture.webp";
import { dom } from "./engine/core/domRefs.js";
import { state } from "./engine/core/gameState.js";
import {
  lockLandscapeOrientation,
  initializePageFlow,
  resizeCanvas,
  syncGamePlayState,
  tryEnterFullscreen,
} from "./engine/core/gameController.js";
import { initSelectionScreen } from "./ui/selectionScreen.js";
import { initPointerInput } from "./input/pointerInput.js";
import { unlockBackgroundMusic, unlockStageClearSound } from "./audio/gameAudio.js";

// Paper-texture page background.
dom.body.style.backgroundImage = `url(${paperTexture})`;
dom.body.style.backgroundSize = "cover";
dom.body.style.backgroundPosition = "center";
dom.body.style.backgroundRepeat = "no-repeat";
dom.body.style.backgroundAttachment = "fixed";

initSelectionScreen();
lockLandscapeOrientation();
initPointerInput();

document.addEventListener("pointerdown", unlockBackgroundMusic, { passive: true });
document.addEventListener("pointerdown", unlockStageClearSound, { once: true, passive: true });
document.addEventListener(
  "pointerdown",
  () => {
    void tryEnterFullscreen();
  },
  { passive: true }
);
document.addEventListener(
  "keydown",
  () => {
    unlockBackgroundMusic();
  },
  { passive: true }
);
window.addEventListener("focus", () => {
  unlockBackgroundMusic();
});

window.addEventListener("resize", resizeCanvas);
window.addEventListener("orientationchange", resizeCanvas);
window.addEventListener("electron-fullscreen-change", (event) => {
  state.electronFullscreen = Boolean(event.detail?.isFullscreen);
  syncGamePlayState();
  window.requestAnimationFrame(() => {
    resizeCanvas();
    window.requestAnimationFrame(() => resizeCanvas());
  });
});
window.addEventListener("visibilitychange", () => {
  state.isWindowFocused = !document.hidden;
  syncGamePlayState();
});
window.addEventListener("focus", () => {
  state.isWindowFocused = true;
  syncGamePlayState();
});
window.addEventListener("blur", () => {
  state.isWindowFocused = false;
  syncGamePlayState();
});

dom.board?.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

initializePageFlow();
