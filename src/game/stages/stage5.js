import { createCoordinateSystem } from "../coordinates.js";
import {
  createStrokeBody,
  initializeStrokeBody,
  updateStrokeBody,
  stepPhysicsWorld,
} from "../physics.js";

export function initStage5(canvas, board) {
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
      {
        type: "text",
        x: 0.3,
        y: 0.5,
        text: "A red dot is a axis",
      },
      {
        type: "rotor",
        points: [
          { x: 0.25, y: 0.25 },
          { x: 0.35, y: 0.25 },
          { x: 0.35, y: 0.35 },
          { x: 0.25, y: 0.35 },
        ],
        closed: true,
        axisX: 0.3,
        axisY: 0.3,
        spinMode: "free",
      },
      { type: "ball", x: 0.3, y: 0.6 },
      { type: "platform", x: 0.3, y: 0.65 },
      { type: "platform", x: 0.7, y: 0.75 },
      { type: "star", x: 0.7, y: 0.7 },
    ],
    createStrokeBody,
    initializeStrokeBody,
  };
}
