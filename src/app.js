import paperTexture from "./img/paper-texture.webp";
import { initializeOrientationPrompt } from "./orientationPrompt.js";
import { createActionIconCanvas } from "./game/ui/uiIcons.js";
import { getChallengeModePreference, setChallengeModePreference } from "./game/challengeMode.js";

const startTitle = document.querySelector("[data-start-button]");
const titleText = document.querySelector(".brand-title");
const settingsToggle = document.querySelector("[data-settings-toggle]");
const challengeModeToggle = document.querySelector("[data-challenge-mode-toggle]");
const settingsPanel = document.getElementById("start-settings-panel");
const settingsClose = document.querySelector("[data-settings-close]");
const body = document.body;
const pageLoader = document.getElementById("page-loader");

const initialTitle = titleText?.textContent?.trim() || "SKETCHYBOOK";
let backgroundLoaded = false;
let pageLoadComplete = false;

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

function syncChallengeModeToggleUI() {
  if (!challengeModeToggle) return;
  const enabled = getChallengeModePreference();
  challengeModeToggle.setAttribute("aria-pressed", String(enabled));
  challengeModeToggle.classList.toggle("is-active", enabled);
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

function preloadGameAssets() {
  const htmlRequest = fetch("./game.html", { cache: "force-cache" });
  const scriptRequest = fetch("./src/game/main.js", { cache: "force-cache" });
  const preloadLink = document.createElement("link");
  preloadLink.rel = "modulepreload";
  preloadLink.href = "./src/game/main.js";
  document.head.appendChild(preloadLink);
  return Promise.all([htmlRequest, scriptRequest]);
}

prepareInitialState();
initializeOrientationPrompt();

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

if (challengeModeToggle) {
  challengeModeToggle.addEventListener("click", () => {
    const nextValue = !getChallengeModePreference();
    setChallengeModePreference(nextValue);
    syncChallengeModeToggleUI();
  });
}

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
  if (!settingsPanel?.hidden && !clickedToggle && !clickedPanel) {
    setSettingsPanelVisible(false);
  }
});

if (startTitle) {
  startTitle.addEventListener("click", async (event) => {
    event.preventDefault();
    if (startTitle.dataset.loading === "true") {
      return;
    }
    startTitle.dataset.loading = "true";
    showStartButton(false);
    setLoaderText("Loading game...");
    if (pageLoader) {
      pageLoader.style.display = "flex";
    }
    try {
      await preloadGameAssets();
    } catch (e) {
      console.warn("Game preload failed, navigating anyway:", e);
    }
    window.location.href = "./game.html";
  });
}
