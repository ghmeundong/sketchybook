import { createCoordinateSystem } from "../coordinates.js";
import {
  createStrokeBody,
  initializeStrokeBody,
  updateStrokeBody,
  stepPhysicsWorld,
} from "../physics.js";
import { filterObjectsByDifficulty } from "../difficultyLevels.js";

export function createStageTemplate(definition = {}, canvas, board, difficulty = "normal") {
  const coordinateSystem = createCoordinateSystem({
    viewportWidth: board.clientWidth,
    viewportHeight: board.clientHeight,
  });

  const safeDefinition = definition && typeof definition === "object" ? definition : {};
  const stageNumber = safeDefinition.stageNumber ?? 1;
  const title = safeDefinition.title ?? `Stage ${stageNumber}`;
  const minEvents = Number.isInteger(safeDefinition.minEvents) ? safeDefinition.minEvents : 1;
  const rawObjects = Array.isArray(safeDefinition.objects) ? safeDefinition.objects : [];

  // 난이도에 따라 오브젝트 필터링
  const objects = filterObjectsByDifficulty(rawObjects, difficulty).filter(
    (object) => !(difficulty === "hard" || difficulty === "insane") || object.type !== "text"
  );

  return {
    coordinateSystem,
    minEvents,
    title,
    difficulty,
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
