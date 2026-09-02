let promptInstance = null;

export function isMobileDevice() {
  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const isSmallScreen = window.matchMedia("(max-width: 600px)").matches;
  return hasTouch && isSmallScreen;
}

export function isIOSDevice() {
  const ua = navigator.userAgent || "";
  return (
    /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isFullscreen() {
  return Boolean(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    window.innerHeight === screen.height
  );
}

export function getSafeLandscapeLockPromise() {
  if (!screen?.orientation || typeof screen.orientation.lock !== "function") {
    return Promise.resolve();
  }

  const candidates = ["landscape-primary", "landscape", "landscape-secondary"];

  const tryLock = async (index) => {
    if (index >= candidates.length) {
      return undefined;
    }

    const orientationMode = candidates[index];

    try {
      return await screen.orientation.lock(orientationMode);
    } catch {
      return tryLock(index + 1);
    }
  };

  return Promise.resolve().then(() => tryLock(0));
}

export function requestLandscapeMode() {
  const element = document.documentElement;
  const fullscreenRequest = element?.requestFullscreen || element?.webkitRequestFullscreen;

  const fullscreenPromise = fullscreenRequest
    ? Promise.resolve()
        .then(() => fullscreenRequest.call(element))
        .catch(() => undefined)
    : Promise.resolve();

  return Promise.allSettled([fullscreenPromise, getSafeLandscapeLockPromise()]);
}

function createPrompt() {
  const overlay = document.createElement("div");
  overlay.className = "orientation-prompt";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-live", "polite");
  overlay.setAttribute("aria-label", "Enter landscape mode");
  overlay.innerHTML = `
    <div class="orientation-prompt-card">
      <p class="orientation-prompt-eyebrow">Mobile mode</p>
      <h2 class="orientation-prompt-title">Play in landscape</h2>
      <p class="orientation-prompt-body">
        Sketchybook is designed for a wider screen. Enter landscape mode to continue.
      </p>
      <div class="orientation-prompt-icon" aria-hidden="true">
        <span class="orientation-prompt-device"></span>
      </div>
      <button class="orientation-prompt-button" type="button">
        Enter landscape mode
      </button>
      <p class="orientation-prompt-status" aria-live="polite"></p>
    </div>
  `;

  const button = overlay.querySelector(".orientation-prompt-button");
  const status = overlay.querySelector(".orientation-prompt-status");
  button?.addEventListener("click", async () => {
    if (!button) return;
    button.disabled = true;
    button.textContent = "Entering landscape mode...";
    if (status) status.textContent = "";

    await requestLandscapeMode();

    button.disabled = false;
    button.textContent = "Enter landscape mode";
    if (window.innerHeight > window.innerWidth && status) {
      status.textContent = "Please rotate your device sideways to continue.";
    }
  });

  document.body.appendChild(overlay);
  return overlay;
}

export function initializeOrientationPrompt() {
  if (promptInstance) return promptInstance;
  if (!document.body) return null;

  promptInstance = createPrompt();

  const updatePromptVisibility = () => {
    const shouldShowPrompt =
      isMobileDevice() &&
      !isFullscreen() &&
      (window.innerWidth <= window.innerHeight || isIOSDevice());

    document.documentElement.classList.toggle("has-orientation-prompt", shouldShowPrompt);
  };

  updatePromptVisibility();
  document.addEventListener("fullscreenchange", updatePromptVisibility);
  document.addEventListener("webkitfullscreenchange", updatePromptVisibility);

  return promptInstance;
}
