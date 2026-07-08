import { describe, expect, it } from "vitest";
import { shouldRebuildPhysicsWorld } from "../src/game/physicsState.js";

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
