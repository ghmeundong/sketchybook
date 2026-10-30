import { describe, expect, it } from "vitest";
import {
  createCircleBody,
  createDeviceSafePhysicsProfile,
  createStrokeBody,
  initializeStrokeBody,
  resetPhysicsWorld,
  resolveStrokeThickness,
  setPhysicsScaleProfile,
  stepPhysicsWorld,
} from "../src/game/engine/physics/physics.js";
import { getBallImpulseValues } from "../src/game/engine/physics/bodySetup.js";

describe("createDeviceSafePhysicsProfile", () => {
  it("keeps physics parameters fixed across viewport sizes and device pixel ratios", () => {
    const mobileProfile = createDeviceSafePhysicsProfile({
      width: 844,
      height: 390,
      dpr: 3,
    });

    const desktopProfile = createDeviceSafePhysicsProfile({
      width: 1600,
      height: 900,
      dpr: 1,
    });

    expect(mobileProfile.scale).toBe(1);
    expect(mobileProfile.scaleX).toBe(1);
    expect(mobileProfile.scaleY).toBe(1);
    expect(desktopProfile.scale).toBe(1);
    expect(mobileProfile.gravity.y).toBe(238);
    expect(desktopProfile.gravity.y).toBe(238);
    expect(mobileProfile.floorY).toBe(868);
    expect(desktopProfile.floorY).toBe(868);
    expect(mobileProfile.maxSubsteps).toBe(desktopProfile.maxSubsteps);
  });

  it("uses the same launch impulse regardless of the viewport", () => {
    setPhysicsScaleProfile(createDeviceSafePhysicsProfile({ width: 390, height: 844, dpr: 3 }));
    const mobileImpulse = getBallImpulseValues();
    setPhysicsScaleProfile(createDeviceSafePhysicsProfile({ width: 1920, height: 1080, dpr: 1 }));

    expect(getBallImpulseValues()).toEqual(mobileImpulse);
    expect(mobileImpulse).toEqual({ linear: 99999, angular: 99999 });
  });

  it("keeps rendered and physical stroke thickness in logical units", () => {
    setPhysicsScaleProfile(createDeviceSafePhysicsProfile({ width: 390, height: 844, dpr: 3 }));
    const mobileThickness = resolveStrokeThickness(8);
    setPhysicsScaleProfile(createDeviceSafePhysicsProfile({ width: 1920, height: 1080, dpr: 1 }));
    const desktopThickness = resolveStrokeThickness(8);

    expect(mobileThickness).toBeCloseTo(4.4, 5);
    expect(mobileThickness).toBe(desktopThickness);
  });

  it("keeps circle mass and inertia the same across viewport profiles", () => {
    resetPhysicsWorld();
    setPhysicsScaleProfile(createDeviceSafePhysicsProfile({ width: 480, height: 800, dpr: 2 }));
    const mobileBody = createCircleBody(800, 450, 24, 868, { skipGround: true });
    const mobileMass = mobileBody.getMass();
    const mobileInertia = mobileBody.getInertia();
    expect(mobileBody.getFixtureList().getShape().m_radius).toBe(24);

    resetPhysicsWorld();
    setPhysicsScaleProfile(createDeviceSafePhysicsProfile({ width: 1920, height: 1080, dpr: 1 }));
    const desktopBody = createCircleBody(800, 450, 24, 868, { skipGround: true });

    expect(desktopBody.getMass()).toBe(mobileMass);
    expect(desktopBody.getInertia()).toBe(mobileInertia);
  });

  it("uses the rendered logical stroke thickness for Planck collision fixtures", () => {
    resetPhysicsWorld();
    setPhysicsScaleProfile(createDeviceSafePhysicsProfile({ width: 390, height: 844, dpr: 3 }));
    const stroke = createStrokeBody([
      { x: 100, y: 100 },
      { x: 200, y: 100 },
    ]);
    initializeStrokeBody(stroke, 868, { skipGround: true });

    const vertices = stroke.physicsBody.getFixtureList().getShape().m_vertices;
    const fixtureThickness =
      Math.max(...vertices.map((vertex) => vertex.y)) -
      Math.min(...vertices.map((vertex) => vertex.y));

    expect(fixtureThickness).toBeCloseTo(resolveStrokeThickness(8), 5);
  });

  it("produces the same falling-ball and floor-collision trajectory across device profiles", () => {
    const simulate = (profile) => {
      resetPhysicsWorld();
      setPhysicsScaleProfile(profile);
      const body = createCircleBody(800, 820, 19, profile.floorY, {
        friction: 0.1,
        restitution: 0.1,
      });
      body.setLinearVelocity({ x: 18, y: 120 });
      body.setAngularVelocity(1.25);

      const trajectory = [];
      for (let tick = 0; tick < 60; tick += 1) {
        stepPhysicsWorld({ deltaTime: 1 / 60, substeps: 4, velocityIterations: 8 });
        const position = body.getPosition();
        const velocity = body.getLinearVelocity();
        trajectory.push([
          position.x,
          position.y,
          velocity.x,
          velocity.y,
          body.getAngle(),
          body.getAngularVelocity(),
        ]);
      }
      return trajectory;
    };

    const mobileTrajectory = simulate(
      createDeviceSafePhysicsProfile({ width: 844, height: 390, dpr: 3 })
    );
    const desktopTrajectory = simulate(
      createDeviceSafePhysicsProfile({ width: 1920, height: 1080, dpr: 1 })
    );

    expect(mobileTrajectory).toEqual(desktopTrajectory);
    expect(mobileTrajectory.some((sample) => sample[1] > 820)).toBe(true);
  });
});
