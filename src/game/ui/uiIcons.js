import rough from "roughjs";
import { INK } from "../../theme.js";

export function createRoughStarCanvas(stars = 0, { size = 24, gap = 6 } = {}) {
  const safeStars = Math.max(0, Math.min(3, Number.isFinite(stars) ? Math.round(stars) : 0));
  const canvasWidth = safeStars * size + (safeStars - 1) * gap;
  const canvasHeight = size;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth * dpr;
  canvas.height = canvasHeight * dpr;
  canvas.style.width = `${canvasWidth}px`;
  canvas.style.height = `${canvasHeight}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return canvas;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  const rc = rough.canvas(canvas);
  for (let index = 0; index < safeStars; index += 1) {
    const centerX = index * (size + gap) + size / 2;
    const centerY = size / 2;
    const points = [];
    for (let i = 0; i < 5; i += 1) {
      const outer = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      const inner = outer + Math.PI / 5;
      points.push([
        Math.cos(outer) * (size / 2.2) + centerX,
        Math.sin(outer) * (size / 2.2) + centerY,
      ]);
      points.push([
        Math.cos(inner) * (size / 4.6) + centerX,
        Math.sin(inner) * (size / 4.6) + centerY,
      ]);
    }

    rc.polygon(points, {
      stroke: "#b8860b",
      strokeWidth: 1.8,
      fill: "#ffd54f",
      fillStyle: "solid",
      roughness: 1.5,
    });
  }

  return canvas;
}

export function createMuteSlashCanvas({ w = 34, h = 28, stroke = INK } = {}) {
  const canvas = document.createElement("canvas");
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  canvas.style.position = "absolute";
  canvas.style.inset = "0";
  canvas.style.pointerEvents = "none";

  const context = canvas.getContext("2d");
  if (!context) return canvas;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  rough.canvas(canvas).line(w * 0.08, h * 0.9, w * 0.92, h * 0.1, {
    stroke,
    strokeWidth: 3.2,
    roughness: 1.4,
  });
  return canvas;
}

export function createActionIconCanvas(
  type,
  { w = 64, h = 40, stroke = INK, fill = INK, strokeWidth = 3, muted = false } = {}
) {
  const canvas = document.createElement("canvas");
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return canvas;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const rc = rough.canvas(canvas);
  const lineOptions = {
    stroke,
    strokeWidth,
    roughness: 1.4,
  };
  const fillOptions = {
    stroke,
    fill,
    fillStyle: "solid",
    strokeWidth,
    roughness: 1.4,
  };

  if (type === "exit") {
    rc.line(18, 34, 18, 6, lineOptions);
    rc.line(18, 6, 38, 6, lineOptions);
    rc.line(38, 6, 38, 34, lineOptions);
    rc.line(50, 20, 24, 20, lineOptions);
    rc.line(23, 21, 30, 14, lineOptions);
    rc.line(23, 19, 30, 26, lineOptions);
  } else if (type === "settings") {
    const centerX = w / 2;
    const centerY = h / 2;
    const gearPoints = [];
    const innerRadius = Math.min(w, h) * 0.32;
    const outerRadius = Math.min(w, h) * 0.43;
    for (let tooth = 0; tooth < 8; tooth += 1) {
      const toothCenter = (tooth * Math.PI) / 4 - Math.PI / 2;
      const angles = [-0.22, -0.12, 0.12, 0.22];
      const radii = [innerRadius, outerRadius, outerRadius, innerRadius];
      for (let index = 0; index < angles.length; index += 1) {
        const angle = toothCenter + angles[index];
        const radius = radii[index];
        gearPoints.push([centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius]);
      }
    }
    rc.polygon(gearPoints, lineOptions);
    rc.ellipse(centerX, centerY, Math.min(w, h) * 0.26, Math.min(w, h) * 0.26, lineOptions);
  } else if (type === "playground") {
    const beamStartX = w * 0.22;
    const beamEndX = w * 0.78;
    rc.polygon(
      [
        [w * 0.36, h * 0.8],
        [w * 0.5, h * 0.52],
        [w * 0.64, h * 0.8],
      ],
      lineOptions
    );
    rc.line(beamStartX, h * 0.43, beamEndX, h * 0.61, lineOptions);
  } else if (type === "retry") {
    rc.line(22, 30, 42, 30, lineOptions);
    rc.line(42, 30, 42, 10, lineOptions);
    rc.line(42, 10, 22, 10, lineOptions);
    rc.line(22, 10, 22, 20, lineOptions);
    rc.line(16, 14, 22, 20, lineOptions);
    rc.line(22, 20, 28, 14, lineOptions);
  } else if (type === "next") {
    rc.polygon(
      [
        [w * 0.3, h * 0.2],
        [w * 0.3, h * 0.8],
        [w * 0.8, h * 0.5],
      ],
      fillOptions
    );
  } else if (type === "prev") {
    rc.polygon(
      [
        [w * 0.7, h * 0.2],
        [w * 0.7, h * 0.8],
        [w * 0.2, h * 0.5],
      ],
      fillOptions
    );
  } else if (type === "undo" || type === "redo") {
    const isUndo = type === "undo";
    const arrowX = isUndo ? w * 0.2 : w * 0.8;
    const arrowY = h * 0.34;
    const curveStartX = isUndo ? w * 0.28 : w * 0.72;
    const curvePath = isUndo
      ? `M ${curveStartX} ${arrowY} C ${w * 0.62} ${arrowY}, ${w * 0.82} ${h * 0.42}, ${w * 0.82} ${h * 0.62} C ${w * 0.82} ${h * 0.84}, ${w * 0.62} ${h * 0.9}, ${w * 0.48} ${h * 0.9}`
      : `M ${curveStartX} ${arrowY} C ${w * 0.38} ${arrowY}, ${w * 0.18} ${h * 0.42}, ${w * 0.18} ${h * 0.62} C ${w * 0.18} ${h * 0.84}, ${w * 0.38} ${h * 0.9}, ${w * 0.52} ${h * 0.9}`;
    rc.path(curvePath, lineOptions);
    const arrowDirection = isUndo ? 1 : -1;
    rc.line(arrowX, arrowY, arrowX + arrowDirection * w * 0.16, h * 0.22, lineOptions);
    rc.line(arrowX, arrowY, arrowX + arrowDirection * w * 0.16, h * 0.46, lineOptions);
  } else if (type === "question") {
    const questionCurveOptions = {
      ...lineOptions,
      strokeWidth: Math.max(strokeWidth, 3.2),
      roughness: 0.8,
    };
    rc.path(
      `M ${w / 2 - 6} ${h / 2 - 5} C ${w / 2 - 4} ${h / 2 - 12}, ${w / 2 + 6} ${h / 2 - 12}, ${w / 2 + 6} ${h / 2 - 4} C ${w / 2 + 6} ${h / 2}, ${w / 2} ${h / 2}, ${w / 2} ${h / 2 + 5}`,
      questionCurveOptions
    );
    rc.ellipse(w / 2, h / 2 + 13, 2.5, 2.5, {
      ...lineOptions,
      fill: stroke,
      fillStyle: "solid",
    });
  } else if (type === "music") {
    rc.ellipse(w * 0.28, h * 0.75, w * 0.24, h * 0.2, fillOptions);
    rc.ellipse(w * 0.67, h * 0.62, w * 0.24, h * 0.2, fillOptions);
    rc.line(w * 0.4, h * 0.7, w * 0.4, h * 0.24, lineOptions);
    rc.line(w * 0.79, h * 0.57, w * 0.79, h * 0.13, lineOptions);
    rc.line(w * 0.4, h * 0.24, w * 0.79, h * 0.13, lineOptions);
  } else if (type === "sfx") {
    rc.polygon(
      [
        [w * 0.18, h * 0.42],
        [w * 0.36, h * 0.42],
        [w * 0.58, h * 0.22],
        [w * 0.58, h * 0.78],
        [w * 0.36, h * 0.58],
        [w * 0.18, h * 0.58],
      ],
      fillOptions
    );
    rc.arc(w * 0.55, h * 0.5, w * 0.42, h * 0.42, -Math.PI / 3, Math.PI / 3, false, lineOptions);
    rc.arc(w * 0.58, h * 0.5, w * 0.7, h * 0.7, -Math.PI / 3, Math.PI / 3, false, lineOptions);
  }

  if (muted) {
    rc.line(w * 0.08, h * 0.9, w * 0.92, h * 0.1, {
      ...lineOptions,
      strokeWidth: Math.max(strokeWidth, 3.2),
    });
  }

  return canvas;
}
