export function getStrokeDistance(points) {
  if (!Array.isArray(points) || points.length < 2) {
    return 0;
  }

  let distance = 0;
  for (let i = 1; i < points.length; i += 1) {
    const previous = points[i - 1];
    const current = points[i];
    distance += Math.hypot(current.x - previous.x, current.y - previous.y);
  }
  return distance;
}

export function getLogicalStrokeDistance(points, coordinateSystem) {
  if (!Array.isArray(points) || points.length < 2) {
    return 0;
  }

  if (!coordinateSystem) {
    return getStrokeDistance(points);
  }

  const logicalPoints = points.map((point) => coordinateSystem.toLogicalPoint(point));
  return getStrokeDistance(logicalPoints);
}

export function exceedsLineLengthLimit({
  totalDrawnLength,
  stroke,
  lineLengthLimit,
  coordinateSystem,
}) {
  if (lineLengthLimit == null) {
    return false;
  }

  const nextTotalDrawnLength =
    totalDrawnLength + getLogicalStrokeDistance(stroke, coordinateSystem);
  const comparisonTolerance =
    Number.EPSILON * Math.max(1, Math.abs(nextTotalDrawnLength), Math.abs(lineLengthLimit)) * 10;
  return nextTotalDrawnLength > lineLengthLimit + comparisonTolerance;
}
