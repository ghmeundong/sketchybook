import { describe, expect, it } from "vitest";
import {
  createPhysicsCatchupBatch,
  consumeDuePhysicsEvents,
  consumePhysicsStepBatch,
  enqueuePhysicsEvent,
  shouldRebuildPhysicsWorld,
} from "../src/game/engine/physics/physicsState.js";

describe("shouldRebuildPhysicsWorld", () => {
  it("rebuilds the physics world after a layout remap even if simulation has started", () => {
    expect(
      shouldRebuildPhysicsWorld({
        needsLayoutRemap: true,
        stageHasSimulated: true,
        physicsStrokeCount: 0,
        hasExistingPhysicsBodies: true,
      })
    ).toBe(true);
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

  it("does not rebuild the physics world when there is no layout remap", () => {
    expect(
      shouldRebuildPhysicsWorld({
        stageHasSimulated: true,
        physicsStrokeCount: 1,
        hasExistingPhysicsBodies: true,
      })
    ).toBe(false);
  });
});

describe("consumePhysicsStepBatch", () => {
  it("retains simulation time when a client reaches its per-frame catch-up limit", () => {
    const batch = consumePhysicsStepBatch({
      elapsedMs: 1000,
      stepMs: 1000 / 60,
      maxSteps: 8,
    });

    expect(batch.stepCount).toBe(8);
    expect(batch.remainingMs).toBeCloseTo(1000 - (1000 / 60) * 8);
  });

  it("drains retained elapsed time in order on later frames", () => {
    const firstBatch = consumePhysicsStepBatch({
      elapsedMs: 1000,
      stepMs: 1000 / 60,
      maxSteps: 8,
    });
    const secondBatch = consumePhysicsStepBatch({
      elapsedMs: 20,
      accumulatedMs: firstBatch.remainingMs,
      stepMs: 1000 / 60,
      maxSteps: 8,
    });

    expect(secondBatch.stepCount).toBe(8);
    expect(secondBatch.remainingMs).toBeLessThan(firstBatch.remainingMs);
  });

  it("retains only the fractional remainder below the fixed-step boundary", () => {
    const batch = consumePhysicsStepBatch({
      elapsedMs: 20,
      stepMs: 1000 / 60,
      maxSteps: 8,
    });

    expect(batch.stepCount).toBe(1);
    expect(batch.remainingMs).toBeCloseTo(20 - 1000 / 60);
  });
});

describe("createPhysicsCatchupBatch", () => {
  it("advances toward server time in bounded fixed-step batches", () => {
    const batch = createPhysicsCatchupBatch({
      currentTimeMs: 1000,
      targetTimeMs: 11000,
      stepMs: 1000 / 60,
      maxSteps: 120,
    });

    expect(batch.stepCount).toBe(120);
    expect(batch.simulationTimeMs).toBeCloseTo(3000);
    expect(batch.remainingMs).toBeCloseTo(8000);
    expect(batch.caughtUp).toBe(false);
  });

  it("marks the final sub-tick interval as caught up", () => {
    const batch = createPhysicsCatchupBatch({
      currentTimeMs: 1000,
      targetTimeMs: 1010,
      stepMs: 1000 / 60,
      maxSteps: 120,
    });

    expect(batch.stepCount).toBe(0);
    expect(batch.remainingMs).toBe(10);
    expect(batch.caughtUp).toBe(true);
  });
});

describe("multiplayer physics event queue", () => {
  it("applies due actions in timestamp order and leaves future actions queued", () => {
    const queue = [];
    const applied = [];
    enqueuePhysicsEvent(queue, 120, () => applied.push("later"));
    enqueuePhysicsEvent(queue, 100, () => applied.push("earlier"));

    const due = consumeDuePhysicsEvents(queue, 100);
    due.dueEvents.forEach((event) => event.apply());

    expect(applied).toEqual(["earlier"]);
    expect(due.pendingEvents).toHaveLength(1);
    expect(consumeDuePhysicsEvents(due.pendingEvents, 120).dueEvents).toHaveLength(1);
  });

  it("replays queued room actions at their original fixed-tick times while catching up", () => {
    const queue = [];
    const appliedAt = [];
    enqueuePhysicsEvent(queue, 20, () => appliedAt.push(20));
    enqueuePhysicsEvent(queue, 40, () => appliedAt.push(40));
    let simulationTimeMs = 0;

    while (simulationTimeMs < 50) {
      const batch = createPhysicsCatchupBatch({
        currentTimeMs: simulationTimeMs,
        targetTimeMs: 50,
        stepMs: 10,
        maxSteps: 2,
      });
      for (let step = 0; step < batch.stepCount; step += 1) {
        simulationTimeMs += 10;
        const due = consumeDuePhysicsEvents(queue, simulationTimeMs);
        queue.splice(0, due.dueEvents.length);
        due.dueEvents.forEach((event) => event.apply());
      }
    }

    expect(appliedAt).toEqual([20, 40]);
  });
});
