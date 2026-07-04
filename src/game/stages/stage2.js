import { createCoordinateSystem } from "../coordinates.js";
import {
  createStrokeBody,
  initializeStrokeBody,
  updateStrokeBody,
  stepPhysicsWorld,
} from "../physics.js";

export function initStage2(canvas, board) {
  const coordinateSystem = createCoordinateSystem({
    viewportWidth: board.clientWidth,
    viewportHeight: board.clientHeight,
  });

  return {
    coordinateSystem,
    minEvents: 2,
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
        text: "draw a line to connect the platforms",
      },
      { type: "ball", x: 0.3, y: 0.4 },
      { type: "platform", x: 0.3, y: 0.45 },
      { type: "platform", x: 0.7, y: 0.55 },
      { type: "star", x: 0.7, y: 0.5 },
    ],
    createStrokeBody,
    initializeStrokeBody,
  };
}
