import { describe, expect, it, beforeEach } from "vitest";
import planck from "planck";
import {
  createStrokeBody,
  createStrokeSegments,
  initializeStrokeBody,
  updateStrokeBody,
  resetPhysicsWorld,
  stepPhysicsWorld,
} from "./physics.js";

describe("createStrokeSegments", () => {
  it("creates one segment per pair of points", () => {
    const segments = createStrokeSegments(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 5 },
      ],
      0.02,
      6
    );

    expect(segments).toHaveLength(2);
    expect(segments[0].length).toBeCloseTo(10);
    expect(segments[0].angle).toBeCloseTo(0);
    expect(segments[1].length).toBeCloseTo(Math.hypot(10, 5));
    expect(segments[1].angle).toBeCloseTo(Math.atan2(5, 10));
  });
});

describe("createStrokeBody", () => {
  it("creates a body centered on the stroke centroid", () => {
    const stroke = createStrokeBody([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ]);

    expect(stroke.body.x).toBeCloseTo(6.6666666667);
    expect(stroke.body.y).toBeCloseTo(3.3333333333);
    expect(stroke.centerOfMass.x).toBeCloseTo(6.6666666667);
    expect(stroke.centerOfMass.y).toBeCloseTo(3.3333333333);
    expect(stroke.points[0].restX).toBeCloseTo(-6.6666666667);
    expect(stroke.points[0].restY).toBeCloseTo(-3.3333333333);
  });
});

describe("updateStrokeBody", () => {
  beforeEach(() => {
    resetPhysicsWorld();
  });
  it("grounds the stroke and rotates it toward the lower center of mass", () => {
    const stroke = createStrokeBody([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ]);
    const floorY = 40;
    stroke.body.y = 50;
    initializeStrokeBody(stroke, floorY);

    for (let i = 0; i < 60 && !stroke.grounded; i += 1) {
      stepPhysicsWorld({ deltaTime: 1 / 60 });
      updateStrokeBody(stroke, floorY);
    }

    expect(stroke.grounded).toBe(true);
    expect(stroke.angle).not.toBe(0);
    expect(stroke.anchorPoint).toBeDefined();
  });

  it("reverses the spin direction once the stroke hits the floor", () => {
    const stroke = createStrokeBody([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ]);
    const floorY = 20;
    stroke.body.y = 30;
    stroke.angle = 0.1;
    stroke.angularVelocity = 0.02;
    initializeStrokeBody(stroke, floorY);

    if (stroke.physicsBody) {
      stroke.physicsBody.setTransform(planck.Vec2(stroke.body.x, stroke.body.y), stroke.angle);
      stroke.physicsBody.setAngularVelocity(stroke.angularVelocity);
    }

    for (let i = 0; i < 60 && !stroke.grounded; i += 1) {
      stepPhysicsWorld({ deltaTime: 1 / 60 });
      updateStrokeBody(stroke, floorY);
    }

    expect(stroke.grounded).toBe(true);
    expect(stroke.angularVelocity).toBeLessThan(0);
  });
});
