import { createCoordinateSystem } from "../coordinates.js";
import {
  createStrokeBody,
  initializeStrokeBody,
  updateStrokeBody,
  stepPhysicsWorld,
} from "../physics.js";

export function initStage3(canvas, board) {
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
      { type: "ball", x: 0.7, y: 0.3, radius: 0.02 },
      { type: "platform", x: 0.3, y: 0.65, width: 0.1, height: 0.05 },
      { type: "platform", x: 0.7, y: 0.35, width: 0.1, height: 0.05 },
      {
        type: "text",
        x: 0.3,
        y: 0.3,
        text: "draw a line to connect the platforms",
        fontSize: 0.03,
        color: "#4f3b24",
      },
      { type: "star", x: 0.3, y: 0.6, radius: 0.02 },
    ],
    createStrokeBody,
    initializeStrokeBody,
  };
}
