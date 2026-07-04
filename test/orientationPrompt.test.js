import { describe, expect, it } from "vitest";
import { shouldShowOrientationPrompt } from "../src/orientationPrompt.js";

describe("shouldShowOrientationPrompt", () => {
  it("shows the prompt for portrait mobile screens", () => {
    expect(
      shouldShowOrientationPrompt({
        hasTouch: true,
        isSmallScreen: true,
        width: 390,
        height: 844,
      })
    ).toBe(true);
  });

  it("hides the prompt on landscape or desktop layouts", () => {
    expect(
      shouldShowOrientationPrompt({
        hasTouch: true,
        isSmallScreen: true,
        width: 844,
        height: 390,
      })
    ).toBe(false);

    expect(
      shouldShowOrientationPrompt({
        hasTouch: false,
        isSmallScreen: true,
        width: 390,
        height: 844,
      })
    ).toBe(false);
  });
});
