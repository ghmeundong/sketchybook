import { describe, expect, it } from "vitest";
import { Ball, Segment } from "../src/game/objects/index.js";
import { remapGameObjects } from "../src/game/render/canvasObjectResize.js";

describe("remapGameObjects", () => {
  it("keeps a ball at the same normalized position after resize", () => {
    const ball = new Ball({ x: 0.25, y: 0.5, radius: 0.04 });

    remapGameObjects([ball], 800, 450, 1600, 900);

    expect(ball.screenX).toBeCloseTo(400);
    expect(ball.screenY).toBeCloseTo(450);
    expect(ball.nx).toBeCloseTo(0.25);
    expect(ball.ny).toBeCloseTo(0.5);
  });

  it("rescales segment endpoints and clears its render cache", () => {
    const segment = new Segment({ x1: 0.1, y1: 0.2, x2: 0.8, y2: 0.9 });
    segment.texture = {};
    segment.textureOffset = {};
    segment._lastCanvasSize = { width: 800, height: 450 };

    remapGameObjects([segment], 800, 450, 1200, 900);

    expect(segment.x1).toBeCloseTo(0.1);
    expect(segment.y1).toBeCloseTo(0.2);
    expect(segment.x2).toBeCloseTo(0.8);
    expect(segment.y2).toBeCloseTo(0.9);
    expect(segment.texture).toBeNull();
    expect(segment.textureOffset).toBeNull();
    expect(segment._lastCanvasSize).toBeNull();
  });
});
