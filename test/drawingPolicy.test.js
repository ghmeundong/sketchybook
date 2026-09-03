import { describe, expect, it } from "vitest";
import { createCoordinateSystem } from "../src/game/engine/core/coordinates.js";
import {
  exceedsLineLengthLimit,
  getLogicalStrokeDistance,
  getStrokeDistance,
} from "../src/game/input/drawingPolicy.js";

describe("drawing policy distance", () => {
  it("calculates screen distance for raw points", () => {
    expect(
      getStrokeDistance([
        { x: 0, y: 0 },
        { x: 3, y: 4 },
      ])
    ).toBe(5);
  });

  it("calculates logical distance independently of viewport scale", () => {
    const coordinateSystem = createCoordinateSystem({
      viewportWidth: 2240,
      viewportHeight: 1260,
    });

    expect(
      getLogicalStrokeDistance(
        [
          { x: 0, y: 0 },
          { x: 700, y: 0 },
        ],
        coordinateSystem
      )
    ).toBeCloseTo(500);
  });

  it("rejects only when the logical total exceeds the configured limit", () => {
    const coordinateSystem = createCoordinateSystem({
      viewportWidth: 2240,
      viewportHeight: 1260,
    });
    const stroke = [
      { x: 0, y: 0 },
      { x: 700, y: 0 },
    ];

    expect(
      exceedsLineLengthLimit({
        totalDrawnLength: 0,
        stroke,
        lineLengthLimit: 500,
        coordinateSystem,
      })
    ).toBe(false);
    expect(
      exceedsLineLengthLimit({
        totalDrawnLength: 1,
        stroke,
        lineLengthLimit: 500,
        coordinateSystem,
      })
    ).toBe(true);
  });
});
