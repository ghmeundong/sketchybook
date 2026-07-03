import { createCoordinateSystem } from "../coordinates.js";
import {
  createStrokeBody,
  initializeStrokeBody,
  updateStrokeBody,
  stepPhysicsWorld,
} from "../physics.js";

export function initStage4(canvas, board) {
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
      { type: "text", x: 0.5, y: 0.3, text: "It looks like a see-saw, right?" },
      { type: "ball", x: 0.35, y: 0.5 },
      { type: "star", x: 0.35, y: 0.4 },
      {
        type: "rotor",
        points: [
          { x: 0.3, y: 0.53 },
          { x: 0.3, y: 0.55 },
          { x: 0.7, y: 0.55 },
          { x: 0.7, y: 0.53 },
        ],
        closed: false,
        axisX: 0.5,
        axisY: 0.55,
        spinMode: "free",
      },
      {
        type: "complex",
        points: [
          { x: 0.4, y: 0.6 },
          { x: 0.5, y: 0.56 },
          { x: 0.6, y: 0.6 },
        ],
        closed: true,
        isStatic: true,
      },
    ],
    createStrokeBody,
    initializeStrokeBody,
  };
}
