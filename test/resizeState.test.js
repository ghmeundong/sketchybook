import { describe, expect, it } from "vitest";
import { rescalePoint, rescalePoints } from "../src/game/resizeState.js";

describe("rescalePoint", () => {
  it("keeps a point anchored to the same relative position when the viewport changes", () => {
    expect(rescalePoint({ x: 400, y: 300 }, 800, 600, 1200, 900)).toEqual({ x: 600, y: 450 });
  });
});

describe("rescalePoints", () => {
  it("maps an array of points to the new canvas size", () => {
    expect(
      rescalePoints(
        [
          { x: 0, y: 0 },
          { x: 400, y: 300 },
        ],
        800,
        600,
        1200,
        900
      )
    ).toEqual([
      { x: 0, y: 0 },
      { x: 600, y: 450 },
    ]);
  });
});
