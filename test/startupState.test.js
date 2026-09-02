import { describe, expect, it } from "vitest";
import { shouldRevealStartPage } from "../src/app/startupState.js";

describe("shouldRevealStartPage", () => {
  it("waits until the page and background are both ready", () => {
    expect(
      shouldRevealStartPage({
        backgroundLoaded: true,
        pageLoadComplete: false,
        fallbackTriggered: false,
      })
    ).toBe(false);

    expect(
      shouldRevealStartPage({
        backgroundLoaded: false,
        pageLoadComplete: true,
        fallbackTriggered: false,
      })
    ).toBe(false);
  });

  it("reveals the start screen when the safety fallback is triggered", () => {
    expect(
      shouldRevealStartPage({
        backgroundLoaded: false,
        pageLoadComplete: false,
        fallbackTriggered: true,
      })
    ).toBe(true);
  });
});
