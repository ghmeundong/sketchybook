import { describe, expect, it, beforeEach } from "vitest";
import planck from "planck";
import {
  createCircleBody,
  createRotorBody,
  createStrokeBody,
  createStrokeSegments,
  initializeStrokeBody,
  updateStrokeBody,
  resetPhysicsWorld,
  stepPhysicsWorld,
} from "../src/game/physics.js";

describe("createCircleBody", () => {
  beforeEach(() => {
    resetPhysicsWorld();
  });

  it("creates a static circle body when requested", () => {
    const body = createCircleBody(100, 100, 10, 200, { isStatic: true, density: 0 });

    expect(body.getType()).toBe("static");
  });

  it("keeps a motorized circle body spinning with angular velocity", () => {
    const body = createCircleBody(100, 100, 10, 200, {
      motor: true,
      motorSpeed: 2,
      maxMotorTorque: 100,
      jointAnchor: { x: 120, y: 100 },
    });

    expect(body.getAngularVelocity()).toBeCloseTo(2);
  });

  it("applies angular velocity for motorized circle bodies", () => {
    const body = createCircleBody(100, 100, 10, 200, {
      motor: true,
      motorSpeed: 2,
      maxMotorTorque: 100,
      jointAnchor: { x: 120, y: 100 },
    });

    expect(body.getAngularVelocity()).toBeCloseTo(2);
  });

  it("keeps static rotor bodies anchored instead of falling under gravity", () => {
    const body = createCircleBody(100, 100, 10, 200, {
      isStatic: true,
      motor: false,
      jointAnchor: { x: 100, y: 100 },
      density: 1,
    });

    for (let i = 0; i < 120; i += 1) {
      stepPhysicsWorld({ deltaTime: 1 / 60 });
    }

    const position = body.getPosition();
    expect(position.y).toBeCloseTo(100, 1);
  });
});

describe("createRotorBody", () => {
  beforeEach(() => {
    resetPhysicsWorld();
  });

  it("creates a dynamic rotor body for motorized polygon rotors", () => {
    const body = createRotorBody(
      [
        { x: -10, y: -10 },
        { x: 10, y: -10 },
        { x: 10, y: 10 },
        { x: -10, y: 10 },
      ],
      { x: 0, y: 0 },
      200,
      { isStatic: false, enableMotor: true, motorSpeed: 2, maxMotorTorque: 100 }
    );

    expect(body.getType()).toBe("dynamic");
  });

  it("keeps motorized static rotors on a kinematic body with an anchor", () => {
    const body = createRotorBody(
      [
        { x: -10, y: -10 },
        { x: 10, y: -10 },
        { x: 10, y: 10 },
        { x: -10, y: 10 },
      ],
      { x: 0, y: 0 },
      200,
      { isStatic: true, spinMode: "auto", motorSpeed: 2, maxMotorTorque: 100 }
    );

    expect(body.getType()).toBe("kinematic");
    expect(body.getAngularVelocity()).toBeCloseTo(2);
  });
});

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
