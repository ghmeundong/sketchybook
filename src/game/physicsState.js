export function shouldRebuildPhysicsWorld({
  needsLayoutRemap = false,
  stageHasSimulated = false,
  physicsStrokeCount = 0,
  hasExistingPhysicsBodies = false,
}) {
  if (stageHasSimulated || physicsStrokeCount > 0) {
    return false;
  }

  return Boolean(needsLayoutRemap || hasExistingPhysicsBodies);
}
