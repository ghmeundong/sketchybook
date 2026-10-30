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

export function getLogicalStrokeDistance(points) {
  return getStrokeDistance(points);
}

export function getLogicalInputTolerance(screenPixels, coordinateSystem) {
  const scale = coordinateSystem?.scaleX;
  if (!Number.isFinite(scale) || scale <= 0) {
    return screenPixels;
  }
  return screenPixels / scale;
}

export function exceedsLineLengthLimit({ totalDrawnLength, stroke, lineLengthLimit }) {
  if (lineLengthLimit == null) {
    return false;
  }

  const nextTotalDrawnLength = totalDrawnLength + getLogicalStrokeDistance(stroke);
  const comparisonTolerance =
    Number.EPSILON * Math.max(1, Math.abs(nextTotalDrawnLength), Math.abs(lineLengthLimit)) * 10;
  return nextTotalDrawnLength > lineLengthLimit + comparisonTolerance;
}

export function shouldRejectStroke({
  intersectsStripedArea,
  intersectsHatchedCircle,
  intersectsBall,
  canDrawOnBall,
}) {
  return Boolean(
    intersectsStripedArea || intersectsHatchedCircle || (intersectsBall && !canDrawOnBall)
  );
}
