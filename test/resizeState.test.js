import { describe, expect, it } from "vitest";
import {
  rescaleLocalPoint,
  rescalePoint,
  rescalePoints,
} from "../src/game/engine/systems/resizeState.js";

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

describe("rescaleLocalPoint", () => {
  it("preserves a rotated local point under a non-uniform canvas resize", () => {
    const point = { x: 8, y: 3 };
    const angle = Math.PI / 4;
    const resized = rescaleLocalPoint(point, angle, 2, 0.5);
    const rotate = ({ x, y }) => ({
      x: Math.cos(angle) * x - Math.sin(angle) * y,
      y: Math.sin(angle) * x + Math.cos(angle) * y,
    });

    const resizedWorldOffset = rotate(resized);
    const originalWorldOffset = rotate(point);
    expect(resizedWorldOffset.x).toBeCloseTo(originalWorldOffset.x * 2);
    expect(resizedWorldOffset.y).toBeCloseTo(originalWorldOffset.y * 0.5);
  });
});
