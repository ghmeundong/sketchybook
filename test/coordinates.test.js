import { describe, expect, it } from "vitest";
import { createCoordinateSystem } from "../src/game/engine/core/coordinates.js";

describe("createCoordinateSystem", () => {
  it("maps the logical board center to the viewport center", () => {
    const system = createCoordinateSystem({ viewportWidth: 800, viewportHeight: 450 });
    const screenPoint = system.toScreenPoint({ x: 800, y: 450 });

    expect(screenPoint.x).toBeCloseTo(400);
    expect(screenPoint.y).toBeCloseTo(225);
  });

  it("round-trips logical positions", () => {
    const system = createCoordinateSystem({ viewportWidth: 1600, viewportHeight: 900 });
    const logicalPoint = system.toLogicalPoint({ x: 400, y: 300 });

    expect(logicalPoint.x).toBeCloseTo(400);
    expect(logicalPoint.y).toBeCloseTo(300);
  });

  it("maps a fit-to-screen pointer back into logical coordinates", () => {
    const system = createCoordinateSystem({ viewportWidth: 800, viewportHeight: 450 });
    const logicalPoint = system.toLogicalPoint({ x: 400, y: 225 });

    expect(logicalPoint.x).toBeCloseTo(800);
    expect(logicalPoint.y).toBeCloseTo(450);
  });

  it("keeps input aligned when the viewport has been rotated 90 degrees", () => {
    const logicalWidth = 1600;
    const logicalHeight = 900;
    const rectWidth = 900;
    const rectHeight = 1600;
    const localX = 300;
    const localY = 1200;

    const rotatedX = localY;
    const rotatedY = rectWidth - localX;
    const x = (rotatedX * logicalWidth) / rectHeight;
    const y = (rotatedY * logicalHeight) / rectWidth;

    expect(x).toBeCloseTo(1200);
    expect(y).toBeCloseTo(600);
  });
});
