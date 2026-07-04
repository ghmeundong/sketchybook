import rough from "roughjs";

export function createRoughStarCanvas(stars = 0, { size = 24, gap = 6 } = {}) {
  const safeStars = Math.max(0, Math.min(3, Number.isFinite(stars) ? Math.round(stars) : 0));
  const canvasWidth = safeStars * size + (safeStars - 1) * gap;
  const canvasHeight = size;
  const dpr = window.devicePixelRatio || 1;
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
  const dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return canvas;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.strokeStyle = stroke;
  ctx.fillStyle = fill;
  ctx.lineWidth = strokeWidth;

  if (type === "exit") {
    ctx.beginPath();
    ctx.moveTo(18, 34);
    ctx.lineTo(18, 6);
    ctx.lineTo(38, 6);
    ctx.lineTo(38, 34);
    ctx.stroke();

    ctx.moveTo(50, 20);
    ctx.lineTo(24, 20);

    ctx.moveTo(23, 21);
    ctx.lineTo(30, 14);

    ctx.moveTo(23, 19);
    ctx.lineTo(30, 26);
    ctx.stroke();
  } else if (type === "settings") {
    ctx.beginPath();
    ctx.moveTo(26, 18);
    ctx.lineTo(26, 14);
    ctx.lineTo(34, 14);
    ctx.lineTo(34, 18);
    ctx.lineTo(38, 18);
    ctx.lineTo(38, 21);
    ctx.lineTo(42, 21);
    ctx.lineTo(42, 27);
    ctx.lineTo(38, 27);
    ctx.lineTo(38, 30);
    ctx.lineTo(34, 30);
    ctx.lineTo(34, 34);
    ctx.lineTo(26, 34);
    ctx.lineTo(26, 30);
    ctx.lineTo(22, 30);
    ctx.lineTo(22, 27);
    ctx.lineTo(18, 27);
    ctx.lineTo(18, 21);
    ctx.lineTo(22, 21);
    ctx.lineTo(22, 18);
    ctx.lineTo(26, 18);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(30, 24, 4, 0, 2 * Math.PI);
    ctx.stroke();
  } else if (type === "retry") {
    ctx.beginPath();
    ctx.moveTo(22, 30);
    ctx.lineTo(42, 30);
    ctx.lineTo(42, 10);
    ctx.lineTo(22, 10);
    ctx.lineTo(22, 20);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(16, 14);
    ctx.lineTo(22, 20);
    ctx.lineTo(28, 14);
    ctx.stroke();
  } else if (type === "next") {
    ctx.beginPath();
    ctx.moveTo(18, 8);
    ctx.lineTo(18, 32);
    ctx.lineTo(46, 20);
    ctx.closePath();
    ctx.fill();
  } else if (type === "prev") {
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.beginPath();
    ctx.moveTo(18, 8);
    ctx.lineTo(18, 32);
    ctx.lineTo(46, 20);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  return canvas;
}
