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
