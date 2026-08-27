import rough from "roughjs";
import paperTexture from "./assets/img/paper-texture.webp";
import challengeToggleSoundUrl from "./assets/sounds/Mechanical, Click, Heater Fan, Small, Thermostat, Click On Or Off.wav";
import { createActionIconCanvas } from "./game/ui/uiIcons.js";
import { initializeOrientationPrompt } from "./orientationPrompt.js";
import { getChallengeModePreference, setChallengeModePreference } from "./game/challengeMode.js";
import {
  DIFFICULTY_LEVELS,
  DIFFICULTY_CONFIG,
  getDifficultyList,
  getNextDifficulty,
  getPreviousDifficulty,
} from "./game/difficultyLevels.js";

const startTitle = document.querySelector("[data-start-button]");
const titleText = document.querySelector(".brand-title");
const settingsToggle = document.querySelector("[data-settings-toggle]");
const challengeModeToggle = document.querySelector("[data-challenge-mode-toggle]");
const challengeModeStatus = document.getElementById("challenge-mode-status");
const challengeModeOption = document.querySelector(".settings-option");
const settingsPanel = document.getElementById("start-settings-panel");
const settingsClose = document.querySelector("[data-settings-close]");
const helpToggle = document.querySelector("[data-help-toggle]");
const helpPanel = document.getElementById("start-help-panel");
const difficultyPrevBtn = document.querySelector("[data-difficulty-prev]");
const difficultyNextBtn = document.querySelector("[data-difficulty-next]");
const difficultyNameDisplay = document.getElementById("difficulty-name");
const difficultyDescription = document.getElementById("difficulty-description");
const body = document.body;
const pageLoader = document.getElementById("page-loader");

const initialTitle = titleText?.textContent?.trim() || "SKETCHYBOOK";
let backgroundLoaded = false;
let pageLoadComplete = false;

function getStoredSelectedDifficulty() {
  const rawValue = sessionStorage.getItem("selectedDifficulty");
  const normalized = typeof rawValue === "string" ? rawValue.trim().toLowerCase() : "";

  if (normalized && Object.values(DIFFICULTY_LEVELS).includes(normalized)) {
    return normalized;
  }

  return DIFFICULTY_LEVELS.NORMAL;
}

let selectedDifficulty = getStoredSelectedDifficulty();

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
  if (backgroundLoaded && pageLoadComplete) {
    revealStartPage();
  }
}

function setSettingsPanelVisible(visible = true) {
  if (!settingsPanel || !settingsToggle) return;
  settingsPanel.hidden = !visible;
  settingsToggle.setAttribute("aria-expanded", String(visible));
}

function setHelpPanelVisible(visible = true) {
  if (!helpPanel || !helpToggle) return;
  helpPanel.hidden = !visible;
  helpToggle.setAttribute("aria-expanded", String(visible));
}

function syncChallengeModeToggleUI() {
  if (!challengeModeToggle) return;
  const enabled = getChallengeModePreference();
  challengeModeToggle.setAttribute("aria-pressed", String(enabled));
  challengeModeToggle.classList.toggle("is-active", enabled);
}

function createChallengeModeTooltip() {
  const tooltipHost = challengeModeToggle?.parentElement;
  if (!tooltipHost || challengeModeToggle.dataset.tooltipReady === "true") {
    return tooltipHost?.querySelector(".challenge-mode-tooltip") || null;
  }

  const tooltip = document.createElement("div");
  tooltip.className = "challenge-mode-tooltip";
  tooltip.setAttribute("role", "status");
  tooltip.setAttribute("aria-live", "polite");

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 220 82");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.style.position = "absolute";
  svg.style.inset = "0";
  svg.style.width = "100%";
  svg.style.height = "100%";
  svg.style.pointerEvents = "none";

  const rc = rough.svg(svg);
  const roughFrame = rc.rectangle(8, 8, 202, 66, {
    stroke: "#4f3b24",
    strokeWidth: 2,
    roughness: 2,
    bowing: 1.2,
    fill: "rgba(250, 244, 216, 0.96)",
    fillStyle: "solid",
  });
  svg.appendChild(roughFrame);

  const label = document.createElement("div");
  label.className = "challenge-mode-tooltip-label";
  label.textContent =
    selectedDifficulty === DIFFICULTY_LEVELS.INSANE
      ? "Challenge Mode is always on in Insane and cannot be turned off."
      : "Challenge Mode is available on Hard and Insane levels only.";

  tooltip.appendChild(svg);
  tooltip.appendChild(label);
  tooltipHost.appendChild(tooltip);
  challengeModeToggle.dataset.tooltipReady = "true";

  return tooltip;
}

function positionChallengeModeTooltip(event) {
  const tooltip = challengeModeToggle?.parentElement?.querySelector(".challenge-mode-tooltip");
  if (!tooltip) return;

  const mouseX = event?.clientX ?? window.innerWidth / 2;
  const mouseY = event?.clientY ?? window.innerHeight / 2;
  const offset = 18;
  const tooltipWidth = tooltip.offsetWidth || 140;

  tooltip.style.left = `${Math.max(12, mouseX - tooltipWidth - offset)}px`;
  tooltip.style.top = `${mouseY - 8}px`;
  tooltip.style.transform = "translateY(0) rotate(0deg)";
}

function showChallengeModeTooltip(event) {
  const tooltip = createChallengeModeTooltip();
  if (!tooltip) return;
  const label = tooltip.querySelector(".challenge-mode-tooltip-label");
  if (label) {
    label.textContent =
      selectedDifficulty === DIFFICULTY_LEVELS.INSANE
        ? "Challenge Mode is always on in Insane and cannot be turned off."
        : "Challenge Mode is available on Hard and Insane levels only.";
  }
  positionChallengeModeTooltip(event);
  tooltip.classList.add("is-visible");
}

function hideChallengeModeTooltip() {
  const tooltip = challengeModeToggle?.parentElement?.querySelector(".challenge-mode-tooltip");
  if (!tooltip) return;
  tooltip.classList.remove("is-visible");
}

function createInsaneStartWarningModal() {
  const existing = document.querySelector(".insane-warning-modal");
  if (existing) {
    return existing;
  }

  const modal = document.createElement("div");
  modal.className = "insane-warning-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-label", "Insane level warning");

  const card = document.createElement("div");
  card.className = "insane-warning-card";

  const eyebrow = document.createElement("div");
  eyebrow.className = "insane-warning-eyebrow";
  eyebrow.textContent = "Warning";

  const title = document.createElement("h2");
  title.className = "insane-warning-title";
  title.textContent = "Insane difficulty";

  const message = document.createElement("p");
  message.className = "insane-warning-message";
  message.textContent =
    "We strongly recommend that you understand every mechanic, map structure, and principle before attempting this level. This is not a level created for fun; it is a brutal challenge designed for the most unforgiving difficulty.";

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

  return modal;
}

function showInsaneStartWarningModal() {
  createInsaneStartWarningModal();
}

function updateChallengeModeAvailability() {
  if (!challengeModeToggle) return;
  const config = DIFFICULTY_CONFIG[selectedDifficulty];
  const isInsane = selectedDifficulty === DIFFICULTY_LEVELS.INSANE;
  const isAvailable = config?.enableChallengeMode || false;

  if (isInsane) {
    setChallengeModePreference(true);
  } else if (!isAvailable) {
    setChallengeModePreference(false);
  }

  challengeModeToggle.disabled = !isAvailable || isInsane;
  challengeModeToggle.style.opacity = isAvailable && !isInsane ? "1" : "0.5";
  challengeModeToggle.style.cursor = isAvailable && !isInsane ? "pointer" : "not-allowed";

  // 비활성화 난이도에서는 항상 Challenge Mode를 off로 설정
  syncChallengeModeToggleUI();

  if (challengeModeStatus) {
    challengeModeStatus.innerHTML = isInsane
      ? 'Challenge Mode is always on in Insane.<br />It cannot be turned off.<br /><span class="challenge-mode-constraints">draw only one line <br />no clicks</span>'
      : '<span class="challenge-mode-constraints">draw only one line <br />no clicks</span>';
  }

  hideChallengeModeTooltip();
}

function updateDifficultyDisplay() {
  const config = DIFFICULTY_CONFIG[selectedDifficulty];

  if (difficultyNameDisplay) {
    difficultyNameDisplay.textContent = config?.name || "Unknown";
  }

  if (difficultyDescription) {
    const summary = config?.summary || config?.description || "";
    const isChallengeDescriptionVisible =
      selectedDifficulty === DIFFICULTY_LEVELS.INSANE ||
      (selectedDifficulty === DIFFICULTY_LEVELS.HARD && getChallengeModePreference());
    difficultyDescription.innerHTML = isChallengeDescriptionVisible
      ? `${summary} / <span class="challenge-mode-constraints">draw only one line / no clicks</span>`
      : summary;
  }
}

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
  try {
    // Screen Orientation API로 landscape 잠금
    if (screen?.orientation?.lock && typeof screen.orientation.lock === "function") {
      screen.orientation.lock("landscape").catch(() => {
        // Silently ignore
      });

      // Orientation 변경 시 계속 landscape 유지
      window.addEventListener("orientationchange", () => {
        try {
          if (screen?.orientation?.lock && typeof screen.orientation.lock === "function") {
            screen.orientation.lock("landscape").catch(() => {
              // Silently ignore
            });
          }
        } catch (e) {
          // Silently ignore
        }
      });
    }
  } catch (e) {
    // Silently ignore any errors
  }
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

prepareInitialState();
initializeOrientationPrompt();
lockLandscapeOrientation();

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
  challengeToggleSound.volume = 0.35;

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
  });

  challengeModeToggle.addEventListener("pointerenter", (event) => {
    if (challengeModeToggle.disabled) {
      showChallengeModeTooltip(event);
    }
  });
  challengeModeToggle.addEventListener("pointermove", (event) => {
    if (challengeModeToggle.disabled) {
      positionChallengeModeTooltip(event);
    }
  });
  challengeModeToggle.addEventListener("pointerleave", hideChallengeModeTooltip);
  challengeModeToggle.addEventListener("focus", (event) => {
    if (challengeModeToggle.disabled) {
      showChallengeModeTooltip(event);
    }
  });
  challengeModeToggle.addEventListener("blur", hideChallengeModeTooltip);
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

if (settingsClose && settingsPanel) {
  settingsClose.addEventListener("click", () => {
    setSettingsPanelVisible(false);
  });
}

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

    if (selectedDifficulty === DIFFICULTY_LEVELS.INSANE) {
      showInsaneStartWarningModal();
      return;
    }

    launchGameFromStart();
  });
}
