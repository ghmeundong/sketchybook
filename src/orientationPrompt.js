export function shouldShowOrientationPrompt({
  hasTouch = typeof window !== "undefined" &&
    ("ontouchstart" in window || navigator.maxTouchPoints > 0),
  isSmallScreen = typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches,
  width = typeof window !== "undefined" ? window.innerWidth : 0,
  height = typeof window !== "undefined" ? window.innerHeight : 0,
} = {}) {
  if (!hasTouch || !isSmallScreen) {
    return false;
  }

  return height > width;
}

export function isMobileDevice() {
  if (typeof window === "undefined") {
    return false;
  }

  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const isSmallScreen = window.matchMedia("(max-width: 900px)").matches;
  return hasTouch && isSmallScreen;
}

function updateOrientationMode() {
  const portraitMobile = shouldShowOrientationPrompt({
    hasTouch: "ontouchstart" in window || navigator.maxTouchPoints > 0,
    isSmallScreen: window.matchMedia("(max-width: 900px)").matches,
    width: window.innerWidth,
    height: window.innerHeight,
  });

  document.documentElement.classList.toggle("is-auto-rotate-portrait", portraitMobile);
  document.documentElement.classList.toggle("has-orientation-prompt", false);
}

export function initializeOrientationPrompt() {
  if (!document.body) return null;

  updateOrientationMode();
  window.addEventListener("resize", updateOrientationMode);
  return null;
}
