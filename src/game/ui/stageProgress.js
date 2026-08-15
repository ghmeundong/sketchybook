import { createRoughStarCanvas } from "./uiIcons.js";
import { getChallengeModePreference } from "../challengeMode.js";

export const stageScoreStorageKey = "sketchybook-stage-scores";
export const stageProgressStorageKey = "sketchybook-stage-progress";
const DIFFICULTY_KEYS = ["easy", "normal", "hard", "insane"];

function normalizeDifficultyKey(difficulty) {
  const normalized = typeof difficulty === "string" ? difficulty.trim().toLowerCase() : "";

  if (DIFFICULTY_KEYS.includes(normalized)) {
    return normalized;
  }

  if (normalized === "challenge") {
    return getChallengeModePreference() ? "hard" : "normal";
  }

  const selectedDifficulty =
    window.sessionStorage?.getItem?.("selectedDifficulty") ||
    new URLSearchParams(window.location.search).get("difficulty") ||
    "normal";

  const candidate = selectedDifficulty.trim().toLowerCase();
  return DIFFICULTY_KEYS.includes(candidate) ? candidate : "normal";
}

function getDifficultyStorageKeys(difficulty) {
  const key = normalizeDifficultyKey(difficulty);
  return {
    scores: `${stageScoreStorageKey}-${key}`,
    progress: `${stageProgressStorageKey}-${key}`,
  };
}

export function getStoredStageScores(mode) {
  const { scores } = getDifficultyStorageKeys(mode);
  try {
    const raw = window.localStorage.getItem(scores);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.warn("Failed to read stage scores:", error);
    return {};
  }
}

export function getStoredStageProgress(mode) {
  const { progress } = getDifficultyStorageKeys(mode);
  const storedScores = getStoredStageScores(mode);
  const clearedStageNumbers = Object.keys(storedScores)
    .map((key) => Number(key))
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 30);

  if (clearedStageNumbers.length > 0) {
    const highestClearedStage = Math.max(...clearedStageNumbers);
    return Math.min(30, highestClearedStage + 1);
  }

  try {
    const raw = window.localStorage.getItem(progress);
    if (!raw) return 1;
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 30) {
      return 1;
    }
    return parsed;
  } catch (error) {
    console.warn("Failed to read stage progress:", error);
    return 1;
  }
}

export function setStoredStageProgress(stageNumber, mode) {
  const safeStageNumber = Number(stageNumber);
  if (!Number.isInteger(safeStageNumber) || safeStageNumber < 1) {
    return;
  }

  const { progress } = getDifficultyStorageKeys(mode);
  try {
    window.localStorage.setItem(progress, String(safeStageNumber));
  } catch (error) {
    console.warn("Failed to set stage progress:", error);
  }
}

export function setStoredStageScores(scores, mode) {
  const { scores: scoresKey } = getDifficultyStorageKeys(mode);
  try {
    window.localStorage.setItem(scoresKey, JSON.stringify(scores || {}));
  } catch (error) {
    console.warn("Failed to set stage scores:", error);
  }
}

export function saveStageProgress(stageNumber, mode) {
  const safeStageNumber = Number(stageNumber);
  if (!Number.isInteger(safeStageNumber) || safeStageNumber < 1) {
    return;
  }

  const nextUnlockedStage = Math.min(30, Math.max(1, safeStageNumber + 1));
  const currentUnlockedStage = getStoredStageProgress(mode);
  if (currentUnlockedStage >= nextUnlockedStage) {
    return;
  }

  const { progress } = getDifficultyStorageKeys(mode);
  try {
    window.localStorage.setItem(progress, String(nextUnlockedStage));
  } catch (error) {
    console.warn("Failed to save stage progress:", error);
  }
}

export function saveStageScore(stageNumber, stars, mode) {
  const safeStageNumber = Number(stageNumber);
  const safeStars = Math.max(0, Math.min(3, Number.isFinite(stars) ? Math.round(stars) : 0));
  if (!safeStageNumber || !safeStars) return;

  const storedScores = getStoredStageScores(mode);
  const previousScore = Number(storedScores[safeStageNumber]);
  const shouldOverwrite = !Number.isFinite(previousScore) || previousScore < safeStars;
  const { scores } = getDifficultyStorageKeys(mode);
  if (shouldOverwrite) {
    const nextScores = { ...storedScores, [safeStageNumber]: safeStars };
    try {
      window.localStorage.setItem(scores, JSON.stringify(nextScores));
    } catch (error) {
      console.warn("Failed to save stage score:", error);
    }
  }

  saveStageProgress(safeStageNumber, mode);
}

export function renderStageSelectionButtons(stageButtons = []) {
  const unlockedStage = getStoredStageProgress();
  stageButtons.forEach((button) => {
    const stageNumber = Number(button.dataset.stage);
    const isUnlocked = stageNumber <= unlockedStage;
    button.disabled = !isUnlocked;
    button.classList.toggle("is-disabled", !isUnlocked);
    button.setAttribute("aria-disabled", String(!isUnlocked));
  });
}

export function renderStageScoreBadge(card, stageNumber) {
  const score = getStoredStageScores()[stageNumber];
  if (!card || !score) return;

  let badge = card.querySelector(".stage-score-badge");
  if (!badge) {
    badge = document.createElement("div");
    badge.className = "stage-score-badge";
    card.appendChild(badge);
  }

  badge.innerHTML = "";
  badge.style.display = "flex";
  badge.style.alignItems = "center";
  badge.style.justifyContent = "center";
  badge.style.gap = "0.2rem";
  badge.style.marginTop = "0.45rem";
  badge.style.fontSize = "0.95rem";
  badge.style.fontWeight = "700";
  badge.style.color = "#4f3b24";
  badge.style.fontFamily = "MyeongjoFont, serif";

  badge.appendChild(createRoughStarCanvas(score, { size: 14, gap: 3 }));
}
