import { describe, expect, it } from "vitest";
import {
  getPolygonTextureLayout,
  resolveCircleRadius,
  segmentIntersectsCircle,
  segmentIntersectsRect,
} from "../src/game/geometry.js";

describe("getPolygonTextureLayout", () => {
  it("uses the polygon centroid as the texture anchor", () => {
    const layout = getPolygonTextureLayout(
      [
        { x: 0.2, y: 0.2 },
        { x: 0.8, y: 0.2 },
        { x: 0.2, y: 0.8 },
      ],
      100,
      100,
      12
    );

    expect(layout.anchor.x).toBeCloseTo(32);
    expect(layout.anchor.y).toBeCloseTo(32);
  });
});

describe("resolveCircleRadius", () => {
  it("converts normalized radii into pixel radii", () => {
    expect(resolveCircleRadius(0.12, 240)).toBe(28.8);
    expect(resolveCircleRadius(24, 240)).toBe(24);
  });
});

describe("segmentIntersectsCircle", () => {
  it("returns true when a segment passes through a circle interior", () => {
    expect(
      segmentIntersectsCircle({ x1: 0, y1: 0, x2: 10, y2: 10 }, { x: 5, y: 5, radius: 2 })
    ).toBe(true);
  });

  it("returns false when a segment only touches the circle boundary", () => {
    expect(
      segmentIntersectsCircle({ x1: 0, y1: 0, x2: 10, y2: 0 }, { x: 5, y: 0, radius: 5 })
    ).toBe(false);
  });
});

describe("segmentIntersectsRect", () => {
  it("returns true when a segment passes through the rectangle interior", () => {
    expect(
      segmentIntersectsRect({ x1: 0, y1: 0, x2: 10, y2: 10 }, { x: 2, y: 2, width: 4, height: 4 })
    ).toBe(true);
  });

  it("returns false when a segment only touches the rectangle edge", () => {
    expect(
      segmentIntersectsRect({ x1: 0, y1: 0, x2: 10, y2: 0 }, { x: 5, y: 0, width: 2, height: 2 })
    ).toBe(false);
  });
});
