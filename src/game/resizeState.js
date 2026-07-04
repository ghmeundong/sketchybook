export function rescalePoint(point, oldWidth, oldHeight, newWidth, newHeight) {
  if (!point || !Number.isFinite(oldWidth) || !Number.isFinite(oldHeight)) {
    return point;
  }

  const widthScale = oldWidth > 0 ? newWidth / oldWidth : 1;
  const heightScale = oldHeight > 0 ? newHeight / oldHeight : 1;

  return {
    x: point.x * widthScale,
    y: point.y * heightScale,
  };
}

export function rescalePoints(points, oldWidth, oldHeight, newWidth, newHeight) {
  if (!Array.isArray(points)) {
    return [];
  }

  return points.map((point) => rescalePoint(point, oldWidth, oldHeight, newWidth, newHeight));
}
