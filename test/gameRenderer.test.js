import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createStrokeTexture,
  getCanvasPixelSize,
  getStrokeSegmentSeed,
} from "../src/game/render/gameRenderer.js";

vi.mock("roughjs", () => ({
  default: {
    canvas: vi.fn((canvas) => ({
      ctx: canvas.getContext("2d"),
      circle: vi.fn(),
    })),
  },
}));

afterEach(() => vi.unstubAllGlobals());

describe("getCanvasPixelSize", () => {
  it("returns stable integer backing dimensions for fractional device pixel ratios", () => {
    expect(getCanvasPixelSize(375, 812, 1.25)).toEqual({ width: 469, height: 1015 });
  });

  it("keeps canvas backing dimensions at least one pixel", () => {
    expect(getCanvasPixelSize(0, 0, 1.5)).toEqual({ width: 1, height: 1 });
  });
});

describe("getStrokeSegmentSeed", () => {
  it("returns stable and distinct seeds for stroke segments", () => {
    expect(getStrokeSegmentSeed(0)).toBe(1);
    expect(getStrokeSegmentSeed(1)).toBe(10001);
    expect(getStrokeSegmentSeed(4)).toBe(40001);
  });
});

describe("createStrokeTexture", () => {
  it("renders finalized strokes at device pixel ratio while preserving logical dimensions", () => {
    const context = {
      clearRect: vi.fn(),
      restore: vi.fn(),
      save: vi.fn(),
      setTransform: vi.fn(),
    };
    const canvas = {
      getContext: vi.fn(() => context),
      height: 0,
      width: 0,
    };
    vi.stubGlobal("window", { devicePixelRatio: 2 });
    vi.stubGlobal("document", { createElement: vi.fn(() => canvas) });

    const stroke = {
      body: { x: 0, y: 0 },
      points: [
        { x: 0, y: 0 },
        { x: 20, y: 10 },
      ],
    };
    createStrokeTexture(stroke);

    expect(canvas.width).toBe(104);
    expect(canvas.height).toBe(84);
    expect(context.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
    expect(stroke.textureOffset).toEqual({
      centerX: 16,
      centerY: 16,
      width: 52,
      height: 42,
    });
  });
});
