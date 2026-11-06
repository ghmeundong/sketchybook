import { describe, expect, it } from "vitest";
import { Ball, Portal, Star } from "../src/game/objects/index.js";
import { processBallObjectInteractions } from "../src/game/systems/gameObjectInteractions.js";

describe("processBallObjectInteractions", () => {
  it("collects a star when a ball overlaps it", () => {
    const ball = new Ball({ x: 0.5, y: 0.5, radius: 0.04 });
    const star = new Star({ x: 0.52, y: 0.5, radius: 0.03 });
    const collected = [];

    const result = processBallObjectInteractions({
      gameObjects: [ball, star],
      canvasWidth: 1600,
      canvasHeight: 900,
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
        canvasWidth: 1600,
        canvasHeight: 900,
      })
    ).toEqual({ hasStars: true, allStarsCollected: false });
  });

  it("does not report a clear for an empty object list", () => {
    expect(
      processBallObjectInteractions({
        gameObjects: [],
        canvasWidth: 1600,
        canvasHeight: 900,
      })
    ).toEqual({ hasStars: false, allStarsCollected: false });
  });

  it.each([
    { sourceId: "orange", sourceX: 0.25, targetId: "blue", targetX: 0.75 },
    { sourceId: "green", sourceX: 0.4, targetId: "purple", targetX: 0.6 },
  ])(
    "teleports through the $sourceId portal to its matching pair",
    ({ sourceId, sourceX, targetId, targetX }) => {
      const ball = new Ball({ x: sourceX, y: 0.5, radius: 0.02 });
      const portalObjects = [
        new Portal({ x: 0.25, y: 0.5, width: 0.025, height: 0.12, portalId: "orange" }),
        new Portal({ x: 0.75, y: 0.5, width: 0.025, height: 0.12, portalId: "blue" }),
        new Portal({ x: 0.4, y: 0.5, width: 0.025, height: 0.12, portalId: "green" }),
        new Portal({ x: 0.6, y: 0.5, width: 0.025, height: 0.12, portalId: "purple" }),
      ];
      let teleportedTo;
      ball.physicsBody = {
        getLinearVelocity: () => ({ x: 0, y: 0 }),
        getAngle: () => 0,
        setTransform: (position) => {
          teleportedTo = position;
        },
        setLinearVelocity: () => {},
      };

      processBallObjectInteractions({
        gameObjects: [ball, ...portalObjects],
        canvasWidth: 1000,
        canvasHeight: 1000,
      });

      expect(portalObjects.find((portal) => portal.portalId === sourceId).nx).toBe(sourceX);
      expect(portalObjects.find((portal) => portal.portalId === targetId).nx).toBe(targetX);
      expect(teleportedTo.x).toBe(targetX * 1000);
    }
  );
});
