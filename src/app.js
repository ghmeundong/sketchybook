import paperTexture from "./img/paper-texture.jpg";

const startTitle = document.querySelector("[data-start-button]");
const titleText = document.querySelector(".brand-title");
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

function prepareInitialState() {
  body.style.backgroundColor = "#000";
  body.style.backgroundImage = "none";
  setLoaderText("Loading background…");
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
