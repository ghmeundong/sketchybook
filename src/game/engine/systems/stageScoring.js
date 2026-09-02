export function getStageStarRating(minEvents, eventCount) {
  const safeMinEvents = Number.isFinite(minEvents) ? Math.max(0, minEvents) : 0;
  const safeEventCount = Number.isFinite(eventCount) ? Math.max(0, eventCount) : 0;

  if (safeEventCount <= safeMinEvents) {
    return 3;
  }

  if (safeEventCount === safeMinEvents + 1) {
    return 2;
  }

  return 1;
}

export function formatStarRating(stars) {
  const safeStars = Number.isFinite(stars) ? Math.max(1, Math.min(3, stars)) : 1;
  return "★".repeat(safeStars);
}
