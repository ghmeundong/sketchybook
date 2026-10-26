import { describe, expect, it } from "vitest";
import {
  shouldAdvancePhysics,
  shouldAllowBallLaunch,
  shouldHandleSpacebarAction,
} from "../src/game/engine/config/inputRules.js";

describe("shouldAllowBallLaunch", () => {
  it("blocks ball launches after challenge mode has already consumed its stroke", () => {
    expect(
      shouldAllowBallLaunch({
        isGameActive: true,
        challengeModeEnabled: true,
        challengeModeStrokeCount: 1,
      })
    ).toBe(false);
  });

  it("blocks ball launches when the stage clear overlay is visible", () => {
    expect(
      shouldAllowBallLaunch({
        isGameActive: true,
        stageCleared: false,
        stageClearOverlayVisible: true,
      })
    ).toBe(false);
  });

  it("blocks ball launches after the stage has already been cleared", () => {
    expect(
      shouldAllowBallLaunch({
        isGameActive: true,
        stageCleared: true,
      })
    ).toBe(false);
  });

  it("allows ball launches when the game is active and no blocking state applies", () => {
    expect(
      shouldAllowBallLaunch({
        isGameActive: true,
        challengeModeEnabled: false,
        challengeModeStrokeCount: 0,
        stageCleared: false,
        stageClearOverlayVisible: false,
      })
    ).toBe(true);
  });

  it("ignores repeated space-bar events so the launch only runs once while held", () => {
    expect(
      shouldHandleSpacebarAction({
        isGameActive: true,
        challengeModeEnabled: false,
        challengeModeStrokeCount: 0,
        stageCleared: false,
        stageClearOverlayVisible: false,
        eventRepeat: true,
      })
    ).toBe(false);
  });

  it("advances physics when active even when the window is not focused", () => {
    expect(
      shouldAdvancePhysics({
        isGameActive: true,
        isFullscreen: false,
        isWindowFocused: false,
        isPageVisible: true,
      })
    ).toBe(true);
  });
});
