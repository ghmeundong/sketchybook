import { createCoordinateSystem } from "../coordinates.js";
import {
  createStrokeBody,
  initializeStrokeBody,
  updateStrokeBody,
  stepPhysicsWorld,
} from "../physics.js";

export function createStageTemplate(definition = {}, canvas, board) {
  const coordinateSystem = createCoordinateSystem({
    viewportWidth: board.clientWidth,
    viewportHeight: board.clientHeight,
  });

  const safeDefinition = definition && typeof definition === "object" ? definition : {};
  const stageNumber = safeDefinition.stageNumber ?? 1;
  const title = safeDefinition.title ?? `Stage ${stageNumber}`;
  const minEvents = Number.isInteger(safeDefinition.minEvents) ? safeDefinition.minEvents : 1;
  const objects = Array.isArray(safeDefinition.objects) ? safeDefinition.objects : [];

  return {
    coordinateSystem,
    minEvents,
    title,
    initialize: () => {},
    update: (physicsStrokes, floorY) => {
      stepPhysicsWorld({ deltaTime: 1 / 60 });
      physicsStrokes.forEach((stroke) => updateStrokeBody(stroke, floorY));
    },
    objects,
    createStrokeBody,
    initializeStrokeBody,
  };
}
