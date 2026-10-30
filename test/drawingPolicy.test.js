import { describe, expect, it } from "vitest";
import {
  exceedsLineLengthLimit,
  getLogicalInputTolerance,
  getLogicalStrokeDistance,
  getStrokeDistance,
  shouldRejectStroke,
} from "../src/game/input/drawingPolicy.js";

describe("drawing policy distance", () => {
  it("keeps click tolerance constant in screen pixels across viewport scales", () => {
    expect(getLogicalInputTolerance(6, { scaleX: 0.25 })).toBe(24);
    expect(getLogicalInputTolerance(6, { scaleX: 1 })).toBe(6);
    expect(getLogicalInputTolerance(6, { scaleX: 2 })).toBe(3);
  });

  it("calculates screen distance for raw points", () => {
    expect(
      getStrokeDistance([
        { x: 0, y: 0 },
        { x: 3, y: 4 },
      ])
    ).toBe(5);
  });

  it("calculates stroke distance directly in logical coordinates", () => {
    expect(
      getLogicalStrokeDistance([
        { x: 0, y: 0 },
        { x: 500, y: 0 },
      ])
    ).toBe(500);
  });

  it("rejects only when the logical total exceeds the configured limit", () => {
    const stroke = [
      { x: 0, y: 0 },
      { x: 500, y: 0 },
    ];

    expect(
      exceedsLineLengthLimit({
        totalDrawnLength: 0,
        stroke,
        lineLengthLimit: 500,
      })
    ).toBe(false);
    expect(
      exceedsLineLengthLimit({
        totalDrawnLength: 1,
        stroke,
        lineLengthLimit: 500,
      })
    ).toBe(true);
  });
});

describe("drawing policy object restrictions", () => {
  it("rejects strokes through striped areas at every difficulty", () => {
    expect(
      shouldRejectStroke({
        intersectsStripedArea: true,
        intersectsHatchedCircle: false,
        intersectsBall: false,
        canDrawOnBall: true,
      })
    ).toBe(true);
  });

  it("rejects strokes through hatched circles at every difficulty", () => {
    expect(
      shouldRejectStroke({
        intersectsStripedArea: false,
        intersectsHatchedCircle: true,
        intersectsBall: false,
        canDrawOnBall: true,
      })
    ).toBe(true);
  });

  it("keeps ball drawing controlled by the difficulty setting", () => {
    expect(
      shouldRejectStroke({
        intersectsStripedArea: false,
        intersectsHatchedCircle: false,
        intersectsBall: true,
        canDrawOnBall: true,
      })
    ).toBe(false);
    expect(
      shouldRejectStroke({
        intersectsStripedArea: false,
        intersectsHatchedCircle: false,
        intersectsBall: true,
        canDrawOnBall: false,
      })
    ).toBe(true);
  });
});
