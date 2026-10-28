import { describe, expect, it } from "vitest";
import {
  TUTORIAL_PLAY_STAGE_NUMBERS,
  getNextTutorialPlayStage,
  shouldClearTutorialStageThreeAfterReset,
} from "../src/game/engine/config/tutorialPlay.js";

describe("tutorial stage play", () => {
  it("limits stages to the tutorial sequence", () => {
    expect(TUTORIAL_PLAY_STAGE_NUMBERS).toEqual([1, 2, 3, 5, 9]);
  });

  it("advances through the sequence and wraps to the first stage", () => {
    expect(TUTORIAL_PLAY_STAGE_NUMBERS.map(getNextTutorialPlayStage)).toEqual([2, 3, 5, 9, 1]);
  });

  it("clears tutorial stage three only after spacebar and an accepted reset", () => {
    expect(
      shouldClearTutorialStageThreeAfterReset({
        isTutorialPlay: true,
        stageNumber: 3,
        spacebarUsed: true,
      })
    ).toBe(true);
    expect(
      shouldClearTutorialStageThreeAfterReset({
        isTutorialPlay: true,
        stageNumber: 3,
        spacebarUsed: false,
      })
    ).toBe(false);
    expect(
      shouldClearTutorialStageThreeAfterReset({
        isTutorialPlay: false,
        stageNumber: 3,
        spacebarUsed: true,
      })
    ).toBe(false);
  });
});
