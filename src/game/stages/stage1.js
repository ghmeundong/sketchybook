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
    initialize: () => {},
    update: (physicsStrokes, floorY) => {
      stepPhysicsWorld({ deltaTime: 1 / 60 });
      physicsStrokes.forEach((stroke) => updateStrokeBody(stroke, floorY));
    },
    // Stage-declared objects. Positions are normalized (0..1).
    objects: [
      { type: "ball", x: 0.3, y: 0.4, radius: 0.02 },
      { type: "platform", x: 0.3, y: 0.45, width: 0.1, height: 0.05 },
      { type: "star", x: 0.7, y: 0.5, radius: 0.02 },
      { type: "platform", x: 0.7, y: 0.55, width: 0.1, height: 0.05 },
    ],
    createStrokeBody,
    initializeStrokeBody,
  };
}
