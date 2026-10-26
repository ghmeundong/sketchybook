import { describe, expect, it } from "vitest";
import {
  consumePhysicsStepBatch,
  shouldRebuildPhysicsWorld,
} from "../src/game/engine/physics/physicsState.js";

describe("shouldRebuildPhysicsWorld", () => {
  it("avoids rebuilding the physics world after simulation has already started", () => {
    expect(
      shouldRebuildPhysicsWorld({
        needsLayoutRemap: true,
        stageHasSimulated: true,
        physicsStrokeCount: 0,
        hasExistingPhysicsBodies: true,
      })
    ).toBe(false);
  });
  it("allows a rebuild when the stage is still fresh and layout remap is needed", () => {
    expect(
      shouldRebuildPhysicsWorld({
        needsLayoutRemap: true,
        stageHasSimulated: false,
        physicsStrokeCount: 0,
        hasExistingPhysicsBodies: false,
      })
    ).toBe(true);
  });
});

describe("consumePhysicsStepBatch", () => {
  it("retains simulation debt when a delayed client reaches its per-frame catch-up limit", () => {
    expect(
      consumePhysicsStepBatch({
        elapsedMs: 1000,
        stepMs: 1000 / 60,
        maxSteps: 8,
      })
    ).toEqual({
      stepCount: 8,
      remainingMs: expect.closeTo(1000 - (1000 / 60) * 8),
    });
  });

  it("drains retained simulation debt over later frames", () => {
    const firstBatch = consumePhysicsStepBatch({
      elapsedMs: 1000,
      stepMs: 1000 / 60,
      maxSteps: 8,
    });
    const secondBatch = consumePhysicsStepBatch({
      elapsedMs: 16,
      accumulatedMs: firstBatch.remainingMs,
      stepMs: 1000 / 60,
      maxSteps: 8,
    });

    expect(secondBatch.stepCount).toBe(8);
    expect(secondBatch.remainingMs).toBeLessThan(firstBatch.remainingMs);
  });
});
