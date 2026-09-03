import { getSfxVolume } from "./audioSettings.js";
import buttonSoundUrl from "../assets/sounds/Mechanical, Click, Fan, Handheld, Button Press.wav";
import gameStartSoundUrl from "../assets/sounds/universfield-click-button-140881.mp3";

const buttonSound = new Audio(buttonSoundUrl);
buttonSound.preload = "auto";
buttonSound.volume = getSfxVolume();
const stageSelectionSound = new Audio(gameStartSoundUrl);
stageSelectionSound.preload = "auto";
stageSelectionSound.volume = getSfxVolume();

window.addEventListener("sketchybook:audio-settings-change", (event) => {
  const sfxVolume = event.detail?.sfx;
  if (!Number.isFinite(sfxVolume)) return;
  buttonSound.volume = sfxVolume;
  stageSelectionSound.volume = sfxVolume;
});

document.addEventListener("click", (event) => {
  const button = event.target.closest?.("button");
  if (
    !button ||
    button.disabled ||
    button.matches("[data-challenge-mode-toggle]") ||
    button.matches("[data-start-button], .insane-warning-button.is-primary")
  ) {
    return;
  }

  if (button.matches(".stage-card")) {
    stageSelectionSound.currentTime = 0;
    void stageSelectionSound.play().catch(() => {});
    return;
  }

  buttonSound.currentTime = 0;
  void buttonSound.play().catch(() => {});
});
