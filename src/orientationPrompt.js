let promptInstance = null;

// 1. 단순 모바일 터치 기기인지 검사 (크기 변화를 실시간으로 감지하지 않음)
export function isMobileDevice() {
  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const isSmallScreen = window.matchMedia("(max-width: 900px)").matches;
  return hasTouch && isSmallScreen;
}

function createPrompt() {
  const overlay = document.createElement("div");
  overlay.className = "orientation-prompt";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-live", "polite");
  overlay.setAttribute("aria-label", "Rotate device to landscape");
  overlay.innerHTML = `
    <div class="orientation-prompt-card">
      <p class="orientation-prompt-eyebrow">Mobile play</p>
      <h2 class="orientation-prompt-title">Please rotate your device</h2>
      <p class="orientation-prompt-body">
        Sketchybook plays best in landscape mode. Turn your phone sideways to continue.
      </p>
      <div class="orientation-prompt-icon" aria-hidden="true">
        <span class="orientation-prompt-device"></span>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  return overlay;
}

// 2. 초기화 함수 심플하게 변경
export function initializeOrientationPrompt() {
  if (promptInstance) return promptInstance;
  if (!document.body) return null;

  promptInstance = createPrompt();

  // 모바일 기기라면 최상단 html 태그에 클래스 주입
  if (isMobileDevice()) {
    document.documentElement.classList.add("has-orientation-prompt");
  }

  return promptInstance;
}
