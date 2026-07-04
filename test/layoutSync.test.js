import { describe, expect, it } from "vitest";
import { shouldDeferResize } from "../src/game/layoutSync.js";

describe("shouldDeferResize", () => {
  it("defers resize when the board has not measured a real size yet", () => {
    expect(shouldDeferResize(0, 300)).toBe(true);
    expect(shouldDeferResize(320, 0)).toBe(true);
    expect(shouldDeferResize(320, 240)).toBe(false);
  });
});
