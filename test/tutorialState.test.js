import { describe, expect, it } from "vitest";
import {
  FIRST_STAGE_TUTORIAL_KEY,
  SECOND_STAGE_TUTORIAL_KEY,
  THIRD_STAGE_TUTORIAL_KEY,
  STAGE_FIVE_TUTORIAL_KEY,
  STAGE_NINE_TUTORIAL_KEY,
  advanceThirdStageTutorial,
  getFacingPlatformCorners,
  getSecondStageTutorialStatusAfterClear,
  getSecondStageTutorialStatusOnEntry,
  getThirdStageTutorialStatusAfterClear,
  getThirdStageTutorialStatusOnEntry,
  getStageFiveTutorialStatusAfterClear,
  getStageFiveTutorialStatusOnEntry,
  advanceStageFiveTutorialAfterStroke,
  restartStageFiveTutorialAfterReset,
  isFirstStageClickTutorialActive,
  isThirdStageTutorialActive,
  readFirstStageTutorialStatus,
  readSecondStageTutorialStatus,
  readThirdStageTutorialStatus,
  readStageFiveTutorialStatus,
  readStageNineTutorialStatus,
  shouldCompleteTutorialOnReset,
  shouldShowThirdStageTutorial,
  shouldShowStageFiveRotorTutorial,
  shouldShowStageNineTutorial,
  shouldShowSecondStageTutorial,
  shouldShowFirstStageTutorial,
  writeFirstStageTutorialStatus,
  writeSecondStageTutorialStatus,
  writeThirdStageTutorialStatus,
  writeStageFiveTutorialStatus,
  writeStageNineTutorialStatus,
} from "../src/app/tutorialState.js";

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

describe("first-stage tutorial state", () => {
  it("locks drawing and keyboard launches only during the single-player click step", () => {
    expect(isFirstStageClickTutorialActive("in_progress", 1, false, false)).toBe(true);
    expect(isFirstStageClickTutorialActive("stage1_completed", 1, false, false)).toBe(false);
    expect(isFirstStageClickTutorialActive("in_progress", 2, false, false)).toBe(false);
    expect(isFirstStageClickTutorialActive("in_progress", 1, false, true)).toBe(false);
    expect(isFirstStageClickTutorialActive("in_progress", 1, true, false)).toBe(false);
  });

  it("targets facing platform corners using their dimensions", () => {
    const [first, second] = getFacingPlatformCorners(
      { nx: 0.3, ny: 0.45, width: 0.1, height: 0.05 },
      { nx: 0.7, ny: 0.55, width: 0.1, height: 0.05 },
      { width: 1000, height: 500 },
      { x: 1, y: 1 }
    );

    expect(first).toEqual({ x: 350, y: 212.5, radius: 24 });
    expect(second).toEqual({ x: 650, y: 262.5, radius: 24 });
  });

  it("shows each stage tutorial based only on that stage's own completion", () => {
    expect(shouldShowFirstStageTutorial("not_started")).toBe(true);
    expect(shouldShowFirstStageTutorial("in_progress")).toBe(true);
    expect(shouldShowFirstStageTutorial("completed")).toBe(false);
    expect(shouldShowSecondStageTutorial("not_started")).toBe(true);
    expect(shouldShowSecondStageTutorial("in_progress")).toBe(true);
    expect(shouldShowSecondStageTutorial("completed")).toBe(false);
    expect(getSecondStageTutorialStatusOnEntry("not_started")).toBe("in_progress");
    expect(shouldShowThirdStageTutorial("not_started")).toBe(true);
    expect(getThirdStageTutorialStatusOnEntry("not_started")).toBe("in_progress_stage3_space");
    expect(shouldShowThirdStageTutorial("completed")).toBe(false);
    expect(getThirdStageTutorialStatusOnEntry("completed")).toBeNull();
    expect(shouldShowThirdStageTutorial("in_progress_stage3_space")).toBe(true);
    expect(shouldShowThirdStageTutorial("in_progress_stage3_reset")).toBe(true);
  });

  it("advances stage three from the spacebar prompt to the reset prompt", () => {
    expect(advanceThirdStageTutorial("in_progress_stage3_space")).toBe("in_progress_stage3_reset");
    expect(advanceThirdStageTutorial("in_progress_stage3_reset")).toBe("in_progress_stage3_reset");
  });

  it("completes Stage 2 and Stage 3 from their own clear events or reset", () => {
    expect(getSecondStageTutorialStatusAfterClear("in_progress", 2)).toBe("completed");
    expect(getSecondStageTutorialStatusAfterClear("not_started", 2)).toBeNull();
    expect(getSecondStageTutorialStatusAfterClear("in_progress", 1)).toBeNull();
    expect(getThirdStageTutorialStatusAfterClear("in_progress_stage3_space", 3)).toBe("completed");
    expect(getThirdStageTutorialStatusAfterClear("in_progress_stage3_reset", 3)).toBe("completed");
    expect(shouldCompleteTutorialOnReset("in_progress_stage3_reset", 3)).toBe(true);
    expect(shouldCompleteTutorialOnReset("in_progress_stage3_space", 3)).toBe(false);
  });

  it("locks stage-three gameplay input in either tutorial phase only", () => {
    expect(isThirdStageTutorialActive("in_progress_stage3_space", 3, false, false)).toBe(true);
    expect(isThirdStageTutorialActive("in_progress_stage3_reset", 3, false, false)).toBe(true);
    expect(isThirdStageTutorialActive("completed", 3, false, false)).toBe(false);
    expect(isThirdStageTutorialActive("in_progress_stage3_space", 2, false, false)).toBe(false);
    expect(isThirdStageTutorialActive("in_progress_stage3_space", 3, false, true)).toBe(false);
  });

  it("persists tutorial progress separately from game progress", () => {
    const storage = createStorage();

    expect(readFirstStageTutorialStatus(storage)).toBe("not_started");
    writeFirstStageTutorialStatus("in_progress", storage);

    expect(storage.getItem(FIRST_STAGE_TUTORIAL_KEY)).toBe("in_progress");
    expect(readFirstStageTutorialStatus(storage)).toBe("in_progress");
  });

  it("stores Stage 2 and Stage 3 progress independently", () => {
    const storage = createStorage();

    writeSecondStageTutorialStatus("completed", storage);
    writeThirdStageTutorialStatus("in_progress_stage3_space", storage);

    expect(storage.getItem(SECOND_STAGE_TUTORIAL_KEY)).toBe("completed");
    expect(storage.getItem(THIRD_STAGE_TUTORIAL_KEY)).toBe("in_progress_stage3_space");
    expect(readSecondStageTutorialStatus(storage)).toBe("completed");
    expect(readThirdStageTutorialStatus(storage)).toBe("in_progress_stage3_space");
    expect(readFirstStageTutorialStatus(storage)).toBe("not_started");
  });

  it("keeps the tutorial usable when storage throws", () => {
    const storage = {
      getItem() {
        throw new Error("storage unavailable");
      },
      setItem() {
        throw new Error("storage unavailable");
      },
    };

    expect(readFirstStageTutorialStatus(storage)).toBe("not_started");
    expect(() => writeFirstStageTutorialStatus("in_progress", storage)).not.toThrow();
  });

  it("shows the stage-five rotor hint independently and completes it on any stage-five clear", () => {
    expect(shouldShowStageFiveRotorTutorial("not_started")).toBe(true);
    expect(shouldShowStageFiveRotorTutorial("in_progress")).toBe(true);
    expect(shouldShowStageFiveRotorTutorial("completed")).toBe(false);
    expect(getStageFiveTutorialStatusOnEntry("not_started")).toBe("in_progress_first_line");
    expect(getStageFiveTutorialStatusOnEntry("in_progress_first_line")).toBe(
      "in_progress_first_line"
    );
    expect(getStageFiveTutorialStatusOnEntry("in_progress_second_line")).toBe(
      "in_progress_first_line"
    );
    expect(getStageFiveTutorialStatusOnEntry("completed")).toBeNull();
    expect(advanceStageFiveTutorialAfterStroke("in_progress_first_line")).toBe(
      "in_progress_second_line"
    );
    expect(advanceStageFiveTutorialAfterStroke("in_progress_second_line")).toBe(
      "in_progress_second_line"
    );
    expect(restartStageFiveTutorialAfterReset("in_progress_first_line", 5)).toBe(
      "in_progress_first_line"
    );
    expect(restartStageFiveTutorialAfterReset("in_progress_second_line", 5)).toBe(
      "in_progress_first_line"
    );
    expect(restartStageFiveTutorialAfterReset("completed", 5)).toBeNull();
    expect(restartStageFiveTutorialAfterReset("in_progress_second_line", 4)).toBeNull();
    expect(getStageFiveTutorialStatusAfterClear("in_progress_first_line", 5)).toBe("completed");
    expect(getStageFiveTutorialStatusAfterClear("in_progress_second_line", 5)).toBe("completed");
    expect(getStageFiveTutorialStatusAfterClear("in_progress", 5)).toBe("completed");
    expect(getStageFiveTutorialStatusAfterClear("in_progress", 4)).toBeNull();
  });

  it("persists stage-five tutorial status under a separate key", () => {
    const storage = createStorage();

    expect(readStageFiveTutorialStatus(storage)).toBe("not_started");
    writeStageFiveTutorialStatus("in_progress", storage);

    expect(storage.getItem(STAGE_FIVE_TUTORIAL_KEY)).toBe("in_progress");
    expect(readStageFiveTutorialStatus(storage)).toBe("in_progress");
  });

  it("persists stage-nine tutorial completion after a valid line is drawn", () => {
    const storage = createStorage();

    expect(shouldShowStageNineTutorial(readStageNineTutorialStatus(storage))).toBe(true);
    writeStageNineTutorialStatus("completed", storage);

    expect(storage.getItem(STAGE_NINE_TUTORIAL_KEY)).toBe("completed");
    expect(shouldShowStageNineTutorial(readStageNineTutorialStatus(storage))).toBe(false);
  });
});
