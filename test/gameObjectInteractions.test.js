import { describe, expect, it } from "vitest";
import { Ball, Star } from "../src/game/objects/index.js";
import { processBallObjectInteractions } from "../src/game/systems/gameObjectInteractions.js";

describe("processBallObjectInteractions", () => {
  it("collects a star when a ball overlaps it", () => {
    const ball = new Ball({ x: 0.5, y: 0.5, radius: 0.04 });
    const star = new Star({ x: 0.52, y: 0.5, radius: 0.03 });
    const collected = [];

    const result = processBallObjectInteractions({
      gameObjects: [ball, star],
      canvasWidth: 800,
      canvasHeight: 450,
      onStarCollected: (collectedStar) => collected.push(collectedStar),
    });

    expect(star.collected).toBe(true);
    expect(collected).toEqual([star]);
    expect(result).toEqual({ hasStars: true, allStarsCollected: true });
  });

  it("does not clear while an uncollected star remains", () => {
    const ball = new Ball({ x: 0.1, y: 0.1, radius: 0.02 });
    const star = new Star({ x: 0.8, y: 0.8, radius: 0.03 });

    expect(
      processBallObjectInteractions({
        gameObjects: [ball, star],
        canvasWidth: 800,
        canvasHeight: 450,
      })
    ).toEqual({ hasStars: true, allStarsCollected: false });
  });

  it("does not report a clear for an empty object list", () => {
    expect(
      processBallObjectInteractions({
        gameObjects: [],
        canvasWidth: 800,
        canvasHeight: 450,
      })
    ).toEqual({ hasStars: false, allStarsCollected: false });
  });
});
