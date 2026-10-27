import rough from "roughjs";
import paperTexture from "../assets/img/paper-texture.webp";
import challengeToggleSoundUrl from "../assets/sounds/Mechanical, Click, Heater Fan, Small, Thermostat, Click On Or Off.wav";
import gameStartSoundUrl from "../assets/sounds/universfield-click-button-140881.mp3";
import { createActionIconCanvas, createMuteSlashCanvas } from "../game/ui/uiIcons.js";
import { getAudioSettings, setAudioSettings } from "./audioSettings.js";
import { initializeOrientationPrompt } from "./orientationPrompt.js";
import { shouldRevealStartPage } from "./startupState.js";
import { INK, PAPER } from "../theme.js";
import { attachRoughFrame, refreshRoughFrame } from "../game/ui/roughFrame.js";
import {
  getChallengeModePreference,
  setChallengeModePreference,
} from "../game/engine/config/challengeMode.js";
import {
  DIFFICULTY_LEVELS,
  DIFFICULTY_CONFIG,
  getDifficultyList,
  getNextDifficulty,
  getPreviousDifficulty,
} from "../game/engine/config/difficultyLevels.js";
import { translateText } from "./localization.js";

const startTitle = document.querySelector("[data-start-button]");
const titleText = document.querySelector(".brand-title");
const globalToolbar = document.querySelector("[data-global-app-toolbar]");
const sharedToolbarContent = document.querySelector("[data-shared-toolbar-content]");
const playgroundButton = document.querySelector("[data-playground-button]");
const settingsToggle = document.querySelector("[data-settings-toggle]");
const challengeModeToggle = document.querySelector("[data-challenge-mode-toggle]");
const challengeModeStatus = document.getElementById("challenge-mode-status");
const challengeModeOption = document.querySelector(".settings-option");
const settingsPanel = document.getElementById("start-settings-panel");
const settingsCloseButtons = document.querySelectorAll("[data-settings-close]");
const helpToggle = document.querySelector("[data-help-toggle]");
const helpPanel = document.getElementById("start-help-panel");
const difficultyPrevBtn = document.querySelector("[data-difficulty-prev]");
const difficultyNextBtn = document.querySelector("[data-difficulty-next]");
const difficultyNameDisplay = document.getElementById("difficulty-name");
const difficultyDescription = document.getElementById("difficulty-description");
const body = document.body;
const pageLoader = document.getElementById("page-loader");
const gameStartSound = new Audio(gameStartSoundUrl);
gameStartSound.preload = "auto";
gameStartSound.volume = getAudioSettings().sfx;
const settingsOverlay = document.createElement("div");
settingsOverlay.className = "settings-overlay";
settingsOverlay.hidden = true;
settingsOverlay.setAttribute("aria-hidden", "true");
document.body.appendChild(settingsOverlay);
if (globalToolbar && sharedToolbarContent) {
  globalToolbar.appendChild(sharedToolbarContent);
}
window.addEventListener("sketchybook:audio-settings-change", (event) => {
  const sfxVolume = event.detail?.sfx;
  if (Number.isFinite(sfxVolume)) gameStartSound.volume = sfxVolume;
});

const initialTitle = titleText?.textContent?.trim() || "SKETCHYBOOK";
let backgroundLoaded = false;
let pageLoadComplete = false;
let fallbackTriggered = false;
let startupFallbackTimer = null;

function getStoredSelectedDifficulty() {
  const rawValue = sessionStorage.getItem("selectedDifficulty");
  const normalized = typeof rawValue === "string" ? rawValue.trim().toLowerCase() : "";

  if (normalized && Object.values(DIFFICULTY_LEVELS).includes(normalized)) {
    return normalized;
  }

  return DIFFICULTY_LEVELS.NORMAL;
}

let selectedDifficulty = getStoredSelectedDifficulty();
let roomDifficultyContext = null;

window.__delayLoadReady = true;

function setLoaderText(message) {
  if (pageLoader) {
    pageLoader.textContent = message;
  }
}

function showStartButton(enabled = false) {
  if (!startTitle) return;
  startTitle.textContent = enabled ? "Game Start" : "Loading...";
  startTitle.disabled = !enabled;
  startTitle.style.pointerEvents = enabled ? "auto" : "none";
}

function revealStartPage() {
  if (titleText) {
    titleText.textContent = initialTitle;
  }
  if (startTitle) {
    startTitle.dataset.loading = "false";
  }
  showStartButton(true);
  if (pageLoader) {
    pageLoader.style.display = "none";
  }
  document.documentElement.classList.add("js-ready");
  window.__delayLoadReady = false;
}

function maybeRevealStartPage() {
  if (shouldRevealStartPage({ backgroundLoaded, pageLoadComplete, fallbackTriggered })) {
    revealStartPage();
  }
}

function setSettingsPanelVisible(visible = true) {
  if (!settingsPanel || !settingsToggle) return;
  settingsPanel.hidden = !visible;
  settingsPanel.classList.toggle("is-overlay", visible);
  settingsOverlay.hidden = !visible;
  settingsOverlay.setAttribute("aria-hidden", String(!visible));
  document.body.classList.toggle("settings-is-open", visible);
  settingsToggle.setAttribute("aria-expanded", String(visible));
}

function setHelpPanelVisible(visible = true) {
  if (!helpPanel || !helpToggle) return;
  helpPanel.hidden = !visible;
  if (visible) {
    window.requestAnimationFrame(() => refreshRoughFrame(helpPanel));
  }
  helpToggle.setAttribute("aria-expanded", String(visible));
}

attachRoughFrame(helpPanel, {
  inset: 0,
  outside: 5,
  strokeWidth: 1.8,
  roughness: 1.8,
});

function syncChallengeModeToggleUI() {
  if (!challengeModeToggle) return;
  const enabled = getChallengeModePreference();
  challengeModeToggle.setAttribute("aria-pressed", String(enabled));
  challengeModeToggle.classList.toggle("is-active", enabled);
}

function createDifficultyStartWarningModal(difficulty) {
  const existing = document.querySelector(".insane-warning-modal");
  if (existing) {
    return existing;
  }

  const isInsane = difficulty === DIFFICULTY_LEVELS.INSANE;
  const titleText = isInsane ? "Insane difficulty" : "Hard difficulty";
  const messageText = isInsane
    ? "We strongly recommend that you understand every mechanic, map structure, and principle before attempting this level. This is not a level created for fun; it is a brutal challenge designed for the most unforgiving difficulty. Tutorials are unavailable on Hard and Insane difficulties."
    : "Tutorials are unavailable on Hard difficulty. Review the game mechanics before starting, because no in-game tutorial guidance will appear.";

  const modal = document.createElement("div");
  modal.className = "insane-warning-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-label", "Difficulty level warning");

  const card = document.createElement("div");
  card.className = "insane-warning-card";

  const eyebrow = document.createElement("div");
  eyebrow.className = "insane-warning-eyebrow";
  eyebrow.textContent = "Warning";

  const title = document.createElement("h2");
  title.className = "insane-warning-title";
  title.textContent = titleText;

  const message = document.createElement("p");
  message.className = "insane-warning-message";
  message.textContent = messageText;

  const prompt = document.createElement("p");
  prompt.className = "insane-warning-prompt";
  prompt.textContent = "Do you really want to continue to this level?";

  const actions = document.createElement("div");
  actions.className = "insane-warning-actions";

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "insane-warning-button is-secondary";
  cancelBtn.textContent = "Cancel";
  cancelBtn.addEventListener("click", () => {
    modal.remove();
  });

  const confirmBtn = document.createElement("button");
  confirmBtn.type = "button";
  confirmBtn.className = "insane-warning-button is-primary";
  confirmBtn.textContent = "Continue";
  confirmBtn.addEventListener("click", async () => {
    modal.remove();
    await launchGameFromStart(true);
  });

  actions.appendChild(cancelBtn);
  actions.appendChild(confirmBtn);
  card.appendChild(eyebrow);
  card.appendChild(title);
  card.appendChild(message);
  card.appendChild(prompt);
  card.appendChild(actions);
  modal.appendChild(card);
  document.body.appendChild(modal);

  attachRoughFrame(card, {
    inset: 0,
    outside: 7,
    strokeWidth: 2.2,
    roughness: 1.8,
  });
  card.querySelectorAll(".insane-warning-button").forEach((button) => {
    attachRoughFrame(button, {
      inset: 0,
      outside: 3,
      strokeWidth: 1.5,
      roughness: 1.6,
    });
  });

  return modal;
}

function showDifficultyStartWarningModal(difficulty) {
  createDifficultyStartWarningModal(difficulty);
}

function updateChallengeModeAvailability(difficulty = roomDifficultyContext || selectedDifficulty) {
  if (!challengeModeToggle) return;
  const config = DIFFICULTY_CONFIG[difficulty];
  const isInsane = difficulty === DIFFICULTY_LEVELS.INSANE;
  const isAvailable = config?.enableChallengeMode || false;
  const isRoomGuest =
    roomDifficultyContext != null && document.body.classList.contains("multiplayer-guest");

  if (isInsane) {
    setChallengeModePreference(true);
  } else if (!isAvailable) {
    setChallengeModePreference(false);
  }

  challengeModeToggle.disabled = !isAvailable || isInsane || isRoomGuest;
  challengeModeToggle.style.opacity = challengeModeToggle.disabled ? "0.5" : "1";
  challengeModeToggle.style.cursor = challengeModeToggle.disabled ? "not-allowed" : "pointer";
  challengeModeOption.tabIndex = challengeModeToggle.disabled ? 0 : -1;
  if (challengeModeToggle.disabled) {
    challengeModeOption.dataset.tooltip = isRoomGuest
      ? "Only the host can change Challenge Mode."
      : isInsane
        ? "Challenge Mode is always on in Insane and cannot be turned off."
        : "Challenge Mode is available on Hard and Insane levels only.";
  } else {
    delete challengeModeOption.dataset.tooltip;
  }

  // 비활성화 난이도에서는 항상 Challenge Mode를 off로 설정
  syncChallengeModeToggleUI();

  if (challengeModeStatus) {
    challengeModeStatus.innerHTML = isInsane
      ? 'Challenge Mode is always on in Insane.<br />It cannot be turned off.<br /><span class="challenge-mode-constraints">draw only one line <br />no clicks</span>'
      : '<span class="challenge-mode-constraints">draw only one line <br />no clicks</span>';
  }
}

window.addEventListener("sketchybook:room-difficulty-context", (event) => {
  const { difficulty } = event.detail || {};
  roomDifficultyContext = Object.values(DIFFICULTY_LEVELS).includes(difficulty) ? difficulty : null;
  updateChallengeModeAvailability();
});

function updateDifficultyDisplay(difficulty = roomDifficultyContext || selectedDifficulty) {
  const config = DIFFICULTY_CONFIG[difficulty];

  if (difficultyNameDisplay) {
    difficultyNameDisplay.textContent = config?.name || "Unknown";
  }

  if (difficultyDescription) {
    const summary = config?.summary || config?.description || "";
    const isChallengeDescriptionVisible =
      difficulty === DIFFICULTY_LEVELS.INSANE ||
      (difficulty === DIFFICULTY_LEVELS.HARD && getChallengeModePreference());
    difficultyDescription.replaceChildren(document.createTextNode(translateText(summary)));
    if (isChallengeDescriptionVisible) {
      difficultyDescription.append(document.createTextNode(" / "));
      const constraints = document.createElement("span");
      constraints.className = "challenge-mode-constraints";
      constraints.textContent = translateText("draw only one line / no clicks");
      difficultyDescription.appendChild(constraints);
    }
  }
}

window.addEventListener("sketchybook:language-change", () => updateDifficultyDisplay());

function changeDifficulty(newDifficulty) {
  const previousDifficulty = selectedDifficulty;
  selectedDifficulty = Object.values(DIFFICULTY_LEVELS).includes(newDifficulty)
    ? newDifficulty
    : DIFFICULTY_LEVELS.NORMAL;
  if (
    previousDifficulty === DIFFICULTY_LEVELS.INSANE &&
    selectedDifficulty !== DIFFICULTY_LEVELS.INSANE
  ) {
    setChallengeModePreference(false);
  }
  updateDifficultyDisplay();
  // sessionStorage에 저장하여 게임에서 접근 가능
  sessionStorage.setItem("selectedDifficulty", selectedDifficulty);
}

function lockLandscapeOrientation() {
  if (import.meta.env.MODE === "itch") return;

  const attemptLock = () => {
    try {
      if (!screen?.orientation || typeof screen.orientation.lock !== "function") {
        return;
      }

      const candidates = ["landscape-primary", "landscape", "landscape-secondary"];
      let index = 0;

      const tryNext = () => {
        if (index >= candidates.length) return;

        const orientationMode = candidates[index];
        index += 1;

        screen.orientation.lock(orientationMode).catch(() => {
          tryNext();
        });
      };

      tryNext();
    } catch {
      // Ignore unsupported or blocked orientation locks.
    }
  };

  attemptLock();
  window.addEventListener("orientationchange", attemptLock, { passive: true });
}

function prepareInitialState() {
  body.style.backgroundColor = "#000";
  body.style.backgroundImage = "none";
  setLoaderText("Loading background…");
  if (startTitle) {
    startTitle.dataset.loading = "false";
  }
  showStartButton(false);
}

function triggerStartupFallback() {
  if (fallbackTriggered) return;
  fallbackTriggered = true;
  if (startupFallbackTimer) {
    clearTimeout(startupFallbackTimer);
    startupFallbackTimer = null;
  }
  setLoaderText("Loading Sketchybook…");
  maybeRevealStartPage();
}

prepareInitialState();
initializeOrientationPrompt();
if (import.meta.env.MODE !== "itch") {
  lockLandscapeOrientation();
}

const bgImage = new Image();
bgImage.decoding = "async";
bgImage.src = paperTexture;
bgImage.onload = () => {
  backgroundLoaded = true;
  body.style.backgroundImage = `url(${paperTexture})`;
  body.style.backgroundSize = "cover";
  body.style.backgroundPosition = "center";
  body.style.backgroundRepeat = "no-repeat";
  body.style.backgroundAttachment = "fixed";
  setLoaderText("Loading Sketchybook…");
  maybeRevealStartPage();
};
bgImage.onerror = () => {
  backgroundLoaded = true;
  setLoaderText("Loading Sketchybook…");
  maybeRevealStartPage();
};

startupFallbackTimer = window.setTimeout(() => {
  triggerStartupFallback();
}, 4000);

if (document.readyState === "complete") {
  pageLoadComplete = true;
  maybeRevealStartPage();
} else {
  window.addEventListener("load", () => {
    pageLoadComplete = true;
    maybeRevealStartPage();
  });
}

if (settingsToggle && settingsPanel) {
  settingsToggle.appendChild(
    createActionIconCanvas("settings", { w: 48, h: 40, strokeWidth: 2.4 })
  );
  settingsToggle.addEventListener("click", () => {
    setSettingsPanelVisible(settingsPanel.hidden);
  });
}

if (playgroundButton) {
  playgroundButton.appendChild(
    createActionIconCanvas("playground", { w: 48, h: 40, strokeWidth: 2.4 })
  );
  playgroundButton.addEventListener("click", () => {
    window.dispatchEvent(new CustomEvent("sketchybook:start-playground"));
  });
}

const audioSettings = getAudioSettings();
const previousAudioVolumes = {
  music: audioSettings.music > 0 ? audioSettings.music : 1,
  sfx: audioSettings.sfx > 0 ? audioSettings.sfx : 1,
};
const audioVolumeControls = document.querySelectorAll("[data-audio-volume]");
audioVolumeControls.forEach((control) => {
  const type = control.dataset.audioVolume;
  const value = audioSettings[type];
  if (Number.isFinite(value)) {
    control.value = String(Math.round(value * 100));
  }
  const icon = document.querySelector(`[data-audio-icon="${type}"]`);
  const renderMuteSlash = (isMuted) => {
    if (!icon) return;
    const existingSlash = icon.querySelector(".settings-volume-mute-slash");
    if (isMuted && !existingSlash) {
      const slash = createMuteSlashCanvas();
      slash.className = "settings-volume-mute-slash";
      icon.appendChild(slash);
    } else if (!isMuted && existingSlash) {
      existingSlash.remove();
    }
  };
  if (icon) icon.replaceChildren(createActionIconCanvas(type, { w: 34, h: 28, strokeWidth: 2 }));
  renderMuteSlash(value === 0);
  if (icon) {
    icon.setAttribute("role", "button");
    icon.setAttribute("tabindex", "0");
    icon.setAttribute("aria-label", `${type} mute toggle`);
    const toggleMute = () => {
      const currentValue = getAudioSettings()[type];
      const nextValue = currentValue > 0 ? 0 : Math.max(0.01, previousAudioVolumes[type] || 1);
      if (currentValue > 0) previousAudioVolumes[type] = currentValue;
      control.value = String(Math.round(nextValue * 100));
      const nextSettings = setAudioSettings({ [type]: nextValue });
      if (output) output.value = `${Math.round(nextSettings[type] * 100)}%`;
      updateAudioThumb();
      renderMuteSlash(nextSettings[type] === 0);
    };
    icon.addEventListener("click", toggleMute);
    icon.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleMute();
      }
    });
  }
  const output = document.querySelector(`[data-audio-value="${type}"]`);
  if (output) output.value = `${Math.round(value * 100)}%`;

  const trackCanvas = document.querySelector(`[data-audio-track="${type}"]`);
  const thumbCanvas = document.querySelector(`[data-audio-thumb="${type}"]`);
  const renderAudioTrack = () => {
    if (!trackCanvas) return;
    const sliderWidth = trackCanvas.parentElement?.clientWidth || 240;
    const trackWidth = Math.max(1, sliderWidth - 18);
    const trackHeight = 20;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    trackCanvas.width = trackWidth * dpr;
    trackCanvas.height = trackHeight * dpr;
    trackCanvas.style.width = `${trackWidth}px`;
    trackCanvas.style.height = `${trackHeight}px`;
    trackCanvas.style.left = "9px";
    const trackContext = trackCanvas.getContext("2d");
    if (trackContext) {
      trackContext.setTransform(dpr, 0, 0, dpr, 0, 0);
      const trackRough = rough.canvas(trackCanvas);
      const trackInset = 7;
      trackRough.line(trackInset, 9, trackWidth - trackInset, 9, {
        stroke: INK,
        strokeWidth: 2,
        roughness: 1.4,
      });
      trackRough.line(trackInset, 11, trackWidth - trackInset, 11, {
        stroke: INK,
        strokeWidth: 1,
        roughness: 1.4,
      });
    }
  };

  const updateAudioThumb = () => {
    if (!thumbCanvas) return;
    const sliderWidth = thumbCanvas.parentElement?.clientWidth || 240;
    const thumbSize = 18;
    const ratio = Number(control.value) / 100;
    const thumbCenter = 9 + ratio * (sliderWidth - 18);
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    thumbCanvas.width = thumbSize * dpr;
    thumbCanvas.height = thumbSize * dpr;
    thumbCanvas.style.width = `${thumbSize}px`;
    thumbCanvas.style.height = `${thumbSize}px`;
    thumbCanvas.style.left = `${thumbCenter - thumbSize / 2}px`;
    const thumbContext = thumbCanvas.getContext("2d");
    if (!thumbContext) return;
    thumbContext.setTransform(dpr, 0, 0, dpr, 0, 0);
    const thumbRough = rough.canvas(thumbCanvas);
    thumbRough.ellipse(9, 9, 13, 13, {
      stroke: INK,
      strokeWidth: 2,
      fill: PAPER,
      fillStyle: "solid",
      roughness: 1.4,
    });
  };
  const refreshAudioControl = () => {
    renderAudioTrack();
    updateAudioThumb();
  };
  refreshAudioControl();
  if (trackCanvas?.parentElement && typeof ResizeObserver !== "undefined") {
    const audioControlObserver = new ResizeObserver(refreshAudioControl);
    audioControlObserver.observe(trackCanvas.parentElement);
  }

  control.addEventListener("input", () => {
    const nextValue = Number(control.value) / 100;
    if (nextValue > 0) previousAudioVolumes[type] = nextValue;
    const nextSettings = setAudioSettings({ [type]: nextValue });
    if (output) output.value = `${Math.round(nextSettings[type] * 100)}%`;
    updateAudioThumb();
    renderMuteSlash(nextSettings[type] === 0);
  });

  if (type === "sfx") {
    control.addEventListener("change", () => {
      window.dispatchEvent(new CustomEvent("sketchybook:sfx-volume-committed"));
    });
  }
});

if (difficultyPrevBtn) {
  difficultyPrevBtn.textContent = "";
  difficultyPrevBtn.appendChild(createActionIconCanvas("prev", { w: 24, h: 24, strokeWidth: 2 }));
}

if (difficultyNextBtn) {
  difficultyNextBtn.textContent = "";
  difficultyNextBtn.appendChild(createActionIconCanvas("next", { w: 24, h: 24, strokeWidth: 2 }));
}

if (helpToggle && helpPanel) {
  helpToggle.textContent = "";
  helpToggle.appendChild(createActionIconCanvas("question", { w: 40, h: 40, strokeWidth: 2.2 }));
  helpToggle.addEventListener("click", () => {
    setSettingsPanelVisible(false);
    setHelpPanelVisible(helpPanel.hidden);
  });
}

if (challengeModeToggle && challengeModeOption) {
  const challengeToggleSound = new Audio(challengeToggleSoundUrl);
  challengeToggleSound.preload = "auto";
  challengeToggleSound.volume = getAudioSettings().sfx;
  window.addEventListener("sketchybook:audio-settings-change", (event) => {
    const sfxVolume = event.detail?.sfx;
    if (Number.isFinite(sfxVolume)) challengeToggleSound.volume = sfxVolume;
  });

  challengeModeToggle.addEventListener("click", () => {
    if (challengeModeToggle.disabled) {
      return;
    }
    const nextValue = !getChallengeModePreference();
    setChallengeModePreference(nextValue);
    challengeToggleSound.currentTime = 0;
    void challengeToggleSound.play().catch(() => {});
    syncChallengeModeToggleUI();
    updateDifficultyDisplay();
    window.dispatchEvent(new Event("sketchybook:challenge-mode-change"));
  });
}

// 난이도 선택 이벤트 리스너
if (difficultyPrevBtn) {
  difficultyPrevBtn.addEventListener("click", () => {
    const newDifficulty = getPreviousDifficulty(selectedDifficulty);
    changeDifficulty(newDifficulty);
    updateChallengeModeAvailability();
  });
}

if (difficultyNextBtn) {
  difficultyNextBtn.addEventListener("click", () => {
    const newDifficulty = getNextDifficulty(selectedDifficulty);
    changeDifficulty(newDifficulty);
    updateChallengeModeAvailability();
  });
}

// 초기 난이도 표시
updateDifficultyDisplay();
changeDifficulty(selectedDifficulty);
updateChallengeModeAvailability();

syncChallengeModeToggleUI();

if (settingsCloseButtons.length && settingsPanel) {
  settingsCloseButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setSettingsPanelVisible(false);
    });
  });
}

settingsOverlay.addEventListener("click", () => {
  setSettingsPanelVisible(false);
});

document.addEventListener("click", (event) => {
  const target = event.target;
  const clickedToggle = target === settingsToggle || settingsToggle?.contains(target);
  const clickedPanel = settingsPanel?.contains(target);
  const clickedHelpToggle = target === helpToggle || helpToggle?.contains(target);
  const clickedHelpPanel = helpPanel?.contains(target);
  if (!settingsPanel?.hidden && !clickedToggle && !clickedPanel) {
    setSettingsPanelVisible(false);
  }
  if (!helpPanel?.hidden && !clickedHelpToggle && !clickedHelpPanel) {
    setHelpPanelVisible(false);
  }
});

function launchGameFromStart(force = false) {
  if (!force && startTitle.dataset.loading === "true") {
    return;
  }

  startTitle.dataset.loading = "true";
  showStartButton(false);
  gameStartSound.currentTime = 0;
  void gameStartSound.play().catch(() => {});
  window.dispatchEvent(
    new CustomEvent("sketchybook:start-game", {
      detail: { difficulty: selectedDifficulty },
    })
  );
}

window.addEventListener("sketchybook:show-start", () => {
  if (!startTitle) return;
  startTitle.dataset.loading = "false";
  showStartButton(true);
});

if (startTitle) {
  startTitle.addEventListener("click", (event) => {
    event.preventDefault();

    if (
      selectedDifficulty === DIFFICULTY_LEVELS.HARD ||
      selectedDifficulty === DIFFICULTY_LEVELS.INSANE
    ) {
      showDifficultyStartWarningModal(selectedDifficulty);
      return;
    }

    launchGameFromStart();
  });
}
