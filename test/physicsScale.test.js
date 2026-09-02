import { describe, expect, it } from "vitest";
import {
  createCircleBody,
  createDeviceSafePhysicsProfile,
  resetPhysicsWorld,
  resolveLaunchMotionScale,
  setPhysicsScaleProfile,
} from "../src/game/engine/physics/physics.js";

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

  it("scales launch motion by width squared so larger screens stay proportionally punchier", () => {
    const mobileLaunchScale = resolveLaunchMotionScale({
      viewportDimension: 480,
      referenceDimension: 900,
      scale: 0.75,
    });
    const desktopLaunchScale = resolveLaunchMotionScale({
      viewportDimension: 1600,
      referenceDimension: 900,
      scale: 1,
    });

    expect(mobileLaunchScale).toBeCloseTo((480 / 900) ** 2 * 0.75, 5);
    expect(desktopLaunchScale).toBeCloseTo((1600 / 900) ** 2 * 1, 5);
    expect(desktopLaunchScale).toBeGreaterThan(mobileLaunchScale);
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
