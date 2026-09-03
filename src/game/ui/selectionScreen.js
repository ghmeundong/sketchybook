import rough from "roughjs";
import { createActionIconCanvas } from "../ui/uiIcons.js";
import {
  getStoredStageProgress,
  renderStageSelectionButtons as renderStageSelectionButtonsUI,
  renderStageScoreBadge,
} from "../ui/stageProgress.js";
import { dom, stagePageSize, totalStagePages } from "../engine/core/domRefs.js";
import { state } from "../engine/core/gameState.js";
import {
  isChallengeClearedStage,
  setActivePage,
  startStage,
} from "../engine/core/gameController.js";

function setHelpPanelVisible(visible = true) {
  if (!dom.helpPanel || !dom.helpToggle) return;
  dom.helpPanel.hidden = !visible;
  dom.helpToggle.setAttribute("aria-expanded", String(visible));
}

function drawRoughFrame(card) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.style.display = "block";
  svg.style.position = "absolute";
  svg.style.inset = "0";
  svg.style.pointerEvents = "none";
  svg.style.overflow = "visible";

  const rc = rough.svg(svg);
  const shape = rc.rectangle(8, 8, 84, 84, {
    stroke: "#4f3b24",
    strokeWidth: 1.3,
    roughness: 1.6,
    bowing: 1.2,
    fill: undefined,
    fillStyle: "solid",
  });

  svg.appendChild(shape);
  card.appendChild(svg);
}

export function refreshStageSelectionButtons() {
  renderStageSelectionButtonsUI(dom.stageButtons, state.currentDifficulty);
  updateStageSelectionPage();
}

export function updateStageSelectionPage() {
  const unlockedStage = getStoredStageProgress(state.currentDifficulty);
  const startIndex = state.stagePageIndex * stagePageSize;
  const endIndex = startIndex + stagePageSize;

  dom.stageButtons.forEach((button) => {
    const stageNumber = Number(button.dataset.stage);
    const isVisible = stageNumber > startIndex && stageNumber <= endIndex;
    const isUnlocked = stageNumber <= unlockedStage;
    const shouldDisable = !isVisible || !isUnlocked;
    const isChallengeClearedStageNum = isChallengeClearedStage(stageNumber);

    button.classList.toggle("is-hidden", !isVisible);
    button.disabled = shouldDisable;
    button.classList.toggle("is-disabled", shouldDisable);
    button.classList.toggle("is-challenge-cleared", isChallengeClearedStageNum);
    button.setAttribute("aria-disabled", String(shouldDisable));
  });

  const firstPage = state.stagePageIndex === 0;
  const lastPage = state.stagePageIndex >= totalStagePages - 1;

  dom.stagePageButtons.forEach((button) => {
    const isPrev = button.dataset.stagePage === "prev";
    const shouldDisable = isPrev ? firstPage : lastPage;
    button.disabled = shouldDisable;
    button.classList.toggle("is-disabled", shouldDisable);
  });
}

export function initSelectionScreen() {
  if (dom.helpToggle && dom.helpPanel) {
    dom.helpToggle.textContent = "";
    dom.helpToggle.appendChild(
      createActionIconCanvas("question", { w: 40, h: 40, strokeWidth: 2.2 })
    );
    dom.helpToggle.addEventListener("click", () => {
      setHelpPanelVisible(dom.helpPanel.hidden);
    });

    document.addEventListener("click", (event) => {
      const target = event.target;
      const clickedToggle = target === dom.helpToggle || dom.helpToggle.contains(target);
      const clickedPanel = dom.helpPanel.contains(target);
      if (!dom.helpPanel.hidden && !clickedToggle && !clickedPanel) {
        setHelpPanelVisible(false);
      }
    });
  }

  dom.stageButtons.forEach((card) => {
    drawRoughFrame(card);
    const stageNumber = Number(card.dataset.stage);
    renderStageScoreBadge(card, stageNumber, state.currentDifficulty);
  });

  dom.stagePageButtons.forEach((button) => {
    const type = button.dataset.stagePage === "prev" ? "prev" : "next";
    button.appendChild(createActionIconCanvas(type, { w: 48, h: 40, strokeWidth: 2.8 }));
  });

  if (dom.backHomeButton) {
    dom.backHomeButton.appendChild(
      createActionIconCanvas("exit", { w: 60, h: 48, strokeWidth: 2.5 })
    );
    dom.backHomeButton.addEventListener("click", () => {
      setActivePage(dom.startPage);
      window.dispatchEvent(new Event("sketchybook:show-start"));
    });
  }

  dom.stageButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const stageNumber = Number(button.dataset.stage);
      if (!stageNumber || button.classList.contains("is-hidden")) {
        return;
      }
      await startStage(stageNumber);
    });
  });

  dom.stagePageButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (button.classList.contains("is-disabled")) {
        return;
      }
      if (button.dataset.stagePage === "prev") {
        state.stagePageIndex = Math.max(0, state.stagePageIndex - 1);
      } else {
        state.stagePageIndex = Math.min(totalStagePages - 1, state.stagePageIndex + 1);
      }
      updateStageSelectionPage();
    });
  });

  refreshStageSelectionButtons();
}
