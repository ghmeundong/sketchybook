import { describe, expect, it } from "vitest";
import { getCanvasPixelSize } from "../src/game/render/gameRenderer.js";

describe("getCanvasPixelSize", () => {
  it("returns stable integer backing dimensions for fractional device pixel ratios", () => {
    expect(getCanvasPixelSize(375, 812, 1.25)).toEqual({ width: 469, height: 1015 });
  });

  it("keeps canvas backing dimensions at least one pixel", () => {
    expect(getCanvasPixelSize(0, 0, 1.5)).toEqual({ width: 1, height: 1 });
  });
});
