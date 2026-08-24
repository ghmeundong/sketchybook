import { describe, expect, it } from "vitest";
import {
  createCircleBody,
  createDeviceSafePhysicsProfile,
  resetPhysicsWorld,
  setPhysicsScaleProfile,
} from "../src/game/physics.js";

describe("createDeviceSafePhysicsProfile", () => {
  it("scales the physics world consistently for each viewport", () => {
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

    expect(mobileProfile.scale).toBe(0.75);
    expect(desktopProfile.scale).toBe(1);
    expect(mobileProfile.gravity.y).toBe(238 * mobileProfile.scale);
    expect(desktopProfile.gravity.y).toBe(238 * desktopProfile.scale);
    expect(mobileProfile.floorY).toBe(800 - 32 * mobileProfile.scale);
    expect(desktopProfile.floorY).toBe(900 - 32 * desktopProfile.scale);
    expect(mobileProfile.impulseMultiplier).toBe(1.4 * mobileProfile.scale);
    expect(desktopProfile.impulseMultiplier).toBe(1.4 * desktopProfile.scale);
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
