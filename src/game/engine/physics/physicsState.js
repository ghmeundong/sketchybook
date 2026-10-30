export function shouldRebuildPhysicsWorld({
  needsLayoutRemap = false,
  stageHasSimulated = false,
  physicsStrokeCount = 0,
  hasExistingPhysicsBodies = false,
}) {
  if (needsLayoutRemap) {
    return true;
  }

  if (stageHasSimulated || physicsStrokeCount > 0) {
    return false;
  }

  return Boolean(hasExistingPhysicsBodies);
}

export function consumePhysicsStepBatch({ elapsedMs, accumulatedMs = 0, stepMs, maxSteps }) {
  const pendingMs = Math.max(0, elapsedMs) + Math.max(0, accumulatedMs);
  const stepCount = Math.min(Math.floor(pendingMs / stepMs), maxSteps);
  return {
    stepCount,
    remainingMs: pendingMs - stepCount * stepMs,
  };
}

export function createPhysicsCatchupBatch({ currentTimeMs, targetTimeMs, stepMs, maxSteps }) {
  const elapsedMs = Math.max(0, targetTimeMs - currentTimeMs);
  const stepCount = Math.min(Math.floor(elapsedMs / stepMs), maxSteps);
  const simulationTimeMs = currentTimeMs + stepCount * stepMs;
  const remainingMs = Math.max(0, targetTimeMs - simulationTimeMs);
  return {
    stepCount,
    simulationTimeMs,
    remainingMs,
    caughtUp: remainingMs < stepMs,
  };
}

export function enqueuePhysicsEvent(queue, applyAt, apply) {
  if (!Array.isArray(queue) || !Number.isFinite(applyAt) || typeof apply !== "function") {
    return false;
  }

  queue.push({ applyAt, apply });
  queue.sort((first, second) => first.applyAt - second.applyAt);
  return true;
}

export function consumeDuePhysicsEvents(queue, currentTime) {
  const firstPendingIndex = queue.findIndex((event) => event.applyAt > currentTime);
  const splitIndex = firstPendingIndex === -1 ? queue.length : firstPendingIndex;
  return {
    dueEvents: queue.slice(0, splitIndex),
    pendingEvents: queue.slice(splitIndex),
  };
}
