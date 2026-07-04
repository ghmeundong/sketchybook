export function getPolygonTextureLayout(points, canvasW, canvasH, padding = 12) {
  if (!Array.isArray(points) || points.length < 2) {
    return null;
  }

  const isNormalized =
    points.every((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y)) &&
    points.every((p) => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1);

  const pts = (isNormalized ? points : points).map((p) => ({
    x: isNormalized ? p.x * canvasW : p.x,
    y: isNormalized ? p.y * canvasH : p.y,
  }));

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }

  const width = Math.max(2, Math.ceil(maxX - minX + padding * 2));
  const height = Math.max(2, Math.ceil(maxY - minY + padding * 2));
  const centerX = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
  const centerY = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;

  return {
    width,
    height,
    anchor: {
      x: centerX - minX + padding,
      y: centerY - minY + padding,
    },
    offset: {
      left: minX - padding,
      top: minY - padding,
    },
  };
}

export function resolveCircleRadius(radius, minDim) {
  if (!Number.isFinite(radius)) {
    return Math.max(2, 0.02 * minDim);
  }

  if (radius > 1) {
    return radius;
  }

  return Math.max(2, Math.round(radius * minDim * 100) / 100);
}

export function resolveRenderablePosition(object, canvasW, canvasH) {
  if (!object) {
    return { x: 0, y: 0 };
  }

  if (Number.isFinite(object.cx) && Number.isFinite(object.cy)) {
    return {
      x: object.cx * canvasW,
      y: object.cy * canvasH,
    };
  }

  if (Number.isFinite(object.nx) && Number.isFinite(object.ny)) {
    return {
      x: object.nx * canvasW,
      y: object.ny * canvasH,
    };
  }

  return { x: 0, y: 0 };
}

export function segmentIntersectsCircle(segment, circle) {
  if (!segment || !circle) {
    return false;
  }

  const { x1, y1, x2, y2 } = segment;
  const { x, y, radius } = circle;
  if (
    !Number.isFinite(x1) ||
    !Number.isFinite(y1) ||
    !Number.isFinite(x2) ||
    !Number.isFinite(y2)
  ) {
    return false;
  }
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(radius) || radius <= 0) {
    return false;
  }

  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return Math.hypot(x - x1, y - y1) <= radius;
  }

  const t = ((x - x1) * dx + (y - y1) * dy) / lengthSquared;
  const clampedT = Math.max(0, Math.min(1, t));
  const closestX = x1 + dx * clampedT;
  const closestY = y1 + dy * clampedT;

  const distanceSquared = (x - closestX) ** 2 + (y - closestY) ** 2;
  return distanceSquared <= radius * radius;
}

export function getCanvasVisualAnchor(canvas, fallbackAnchor = null) {
  if (!canvas) {
    return fallbackAnchor ?? null;
  }

  const context = canvas.getContext?.("2d");
  if (!context) {
    return fallbackAnchor ?? null;
  }

  const { width, height } = canvas;
  const imageData = context.getImageData(0, 0, width, height);
  let totalAlpha = 0;
  let sumX = 0;
  let sumY = 0;
  let count = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const alpha = imageData.data[index + 3];
      if (alpha > 0) {
        sumX += x;
        sumY += y;
        count += 1;
        totalAlpha += alpha;
      }
    }
  }

  if (!count) {
    return fallbackAnchor ?? null;
  }

  return {
    x: sumX / count,
    y: sumY / count,
  };
}
