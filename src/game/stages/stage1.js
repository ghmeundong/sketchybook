import { createCoordinateSystem } from "../coordinates.js";
import {
  createStrokeBody,
  initializeStrokeBody,
  updateStrokeBody,
  stepPhysicsWorld,
} from "../physics.js";

export function initStage1(canvas, board) {
  const coordinateSystem = createCoordinateSystem({
    viewportWidth: board.clientWidth,
    viewportHeight: board.clientHeight,
  });

  return {
    coordinateSystem,
    minEvents: 1,
    initialize: () => {},
    update: (physicsStrokes, floorY) => {
      stepPhysicsWorld({ deltaTime: 1 / 60 });
      physicsStrokes.forEach((stroke) => updateStrokeBody(stroke, floorY));
    },
    // Stage-declared objects. Positions are normalized (0..1).
    objects: [
      {
        type: "text",
        x: 0.3,
        y: 0.3,
        text: "click a ball to move it",
      },
      { type: "ball", x: 0.3, y: 0.4 },
      { type: "platform", x: 0.3, y: 0.45 },
      { type: "platform", x: 0.7, y: 0.55 },
      { type: "segment", x1: 0.35, y1: 0.425, x2: 0.65, y2: 0.525 },
      { type: "star", x: 0.7, y: 0.5 },
    ],
    createStrokeBody,
    initializeStrokeBody,
  };
}
