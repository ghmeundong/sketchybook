let promptInstance = null;

function isMobileViewport() {
  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const isSmallScreen = window.matchMedia("(max-width: 900px)").matches;
  return hasTouch && isSmallScreen;
}

export function shouldShowOrientationPrompt({
  hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0,
  isSmallScreen = window.matchMedia("(max-width: 900px)").matches,
  width = window.innerWidth,
  height = window.innerHeight,
} = {}) {
  if (!hasTouch || !isSmallScreen) {
    return false;
  }

  return height >= width;
}

function createPrompt() {
  const overlay = document.createElement("div");
  overlay.className = "orientation-prompt";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-live", "polite");
  overlay.setAttribute("aria-label", "Rotate device to landscape");
  overlay.innerHTML = `
    <div class="orientation-prompt__card">
      <p class="orientation-prompt__eyebrow">Mobile play</p>
      <h2 class="orientation-prompt__title">Please rotate your device</h2>
      <p class="orientation-prompt__body">
        Sketchybook plays best in landscape mode. Turn your phone sideways to continue.
      </p>
      <div class="orientation-prompt__icon" aria-hidden="true">
        <span class="orientation-prompt__device"></span>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  return overlay;
}

function updatePrompt() {
  if (!promptInstance) {
    return;
  }

  const shouldShow = shouldShowOrientationPrompt();
  promptInstance.classList.toggle("is-active", shouldShow);
  document.documentElement.classList.toggle("has-orientation-prompt", shouldShow);
}

async function requestOrientationLock() {
  if (!window.screen?.orientation?.lock) {
    return false;
  }

  try {
    await window.screen.orientation.lock("landscape");
    return true;
  } catch {
    return false;
  }
}

export function initializeOrientationPrompt() {
  if (promptInstance) {
    updatePrompt();
    return promptInstance;
  }

  if (!document.body) {
    return null;
  }

  promptInstance = createPrompt();
  updatePrompt();

  if (shouldShowOrientationPrompt()) {
    requestOrientationLock();
  }

  window.addEventListener("resize", updatePrompt);
  window.addEventListener("orientationchange", () => {
    updatePrompt();
    if (shouldShowOrientationPrompt()) {
      requestOrientationLock();
    }
  });

  return promptInstance;
}
