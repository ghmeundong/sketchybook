import { describe, expect, it } from "vitest";
import { createCoordinateSystem } from "./coordinates.js";

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
});
