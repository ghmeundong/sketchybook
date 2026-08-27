import rough from "roughjs";

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

export function createActionIconCanvas(
  type,
  { w = 64, h = 40, stroke = "#4f3b24", fill = "#4f3b24", strokeWidth = 3 } = {}
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
    rc.polygon(
      [
        [26, 18],
        [26, 14],
        [34, 14],
        [34, 18],
        [38, 18],
        [38, 21],
        [42, 21],
        [42, 27],
        [38, 27],
        [38, 30],
        [34, 30],
        [34, 34],
        [26, 34],
        [26, 30],
        [22, 30],
        [22, 27],
        [18, 27],
        [18, 21],
        [22, 21],
        [22, 18],
      ],
      lineOptions
    );
    rc.ellipse(30, 24, 8, 8, lineOptions);
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
  } else if (type === "question") {
    rc.path(
      `M ${w / 2 - 6} ${h / 2 - 5} C ${w / 2 - 4} ${h / 2 - 12}, ${w / 2 + 6} ${h / 2 - 12}, ${w / 2 + 6} ${h / 2 - 4} C ${w / 2 + 6} ${h / 2}, ${w / 2} ${h / 2}, ${w / 2} ${h / 2 + 5}`,
      lineOptions
    );
    rc.ellipse(w / 2, h / 2 + 13, 2.5, 2.5, {
      ...lineOptions,
      fill: stroke,
      fillStyle: "solid",
    });
  }

  return canvas;
}
