import { describe, expect, it } from "vitest";
import {
  createCircleBody,
  createDeviceSafePhysicsProfile,
  resetPhysicsWorld,
  setPhysicsScaleProfile,
} from "../src/game/physics.js";

describe("createDeviceSafePhysicsProfile", () => {
  it("returns a stable scale and gravity profile for smaller screens", () => {
    const profile = createDeviceSafePhysicsProfile({
      width: 480,
      height: 800,
      dpr: 2,
      referenceWidth: 900,
      referenceHeight: 600,
    });

    expect(profile.scale).toBeGreaterThan(0);
    expect(profile.gravity.y).toBeGreaterThan(0);
    expect(profile.impulseMultiplier).toBeGreaterThan(0);
    expect(profile.maxSubsteps).toBeGreaterThan(0);
  });

  it("keeps circle body size aligned with the intended radius", () => {
    resetPhysicsWorld();
    setPhysicsScaleProfile(createDeviceSafePhysicsProfile({ width: 480, height: 800, dpr: 2 }));

    const body = createCircleBody(100, 120, 24, 500, { skipGround: true });
    const fixture = body.getFixtureList();
    const shape = fixture.getShape();

    expect(shape.m_radius).toBe(24);
  });
});
