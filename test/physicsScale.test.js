import { describe, expect, it } from "vitest";
import {
  createCircleBody,
  createDeviceSafePhysicsProfile,
  resetPhysicsWorld,
  setPhysicsScaleProfile,
} from "../src/game/physics.js";

describe("createDeviceSafePhysicsProfile", () => {
  it("keeps the physics world stable regardless of viewport size", () => {
    const mobileProfile = createDeviceSafePhysicsProfile({
      width: 480,
      height: 800,
      dpr: 2,
      referenceWidth: 1600,
      referenceHeight: 900,
    });

    const desktopProfile = createDeviceSafePhysicsProfile({
      width: 1600,
      height: 900,
      dpr: 2,
      referenceWidth: 1600,
      referenceHeight: 900,
    });

    expect(mobileProfile.scale).toBe(desktopProfile.scale);
    expect(mobileProfile.gravity.y).toBe(desktopProfile.gravity.y);
    expect(mobileProfile.floorY).toBe(desktopProfile.floorY);
    expect(mobileProfile.impulseMultiplier).toBe(desktopProfile.impulseMultiplier);
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
