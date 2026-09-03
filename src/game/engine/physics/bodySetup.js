import { resolveCircleRadius } from "../core/geometry.js";
import {
  createCircleBody,
  createBoxBody,
  createEdgeBody,
  getPhysicsScaleProfile,
  resolveLaunchMotionScale,
} from "./physics.js";
import {
  CircleObject,
  Ball,
  Platform,
  Segment,
  ComplexObject,
  Rotor,
} from "../../objects/index.js";
import { state } from "../core/gameState.js";

export function getBallImpulseValues() {
  const profile = getPhysicsScaleProfile();
  const referenceDimension = 900;
  const viewportDimension =
    state.canvasHeight > 0 ? Math.min(state.canvasWidth, state.canvasHeight) : referenceDimension;
  const dimensionScale = viewportDimension / referenceDimension;
  const physicsScale = profile?.scale ?? Math.min(1, Math.max(0.5, dimensionScale));
  const motionScale = resolveLaunchMotionScale({
    viewportDimension,
    referenceDimension,
    scale: physicsScale,
  });

  return {
    linear: 99999 * motionScale,
    angular: 99999 * motionScale,
  };
}

// Creates physics bodies for any stage game object that doesn't have one yet.
// Mutates each object in place (attaches physicsBody / physicsBodies).
export function createPhysicsBodiesForGameObjects({
  gameObjects,
  canvasWidth,
  canvasHeight,
  floorYForPhysics,
  challengeModeEnabled,
  difficultyRules,
}) {
  if (!gameObjects || !gameObjects.length) return;

  for (const obj of gameObjects) {
    if ((obj instanceof CircleObject || obj instanceof Ball) && !obj.physicsBody) {
      const px = obj.nx * canvasWidth;
      const py = obj.ny * canvasHeight;
      const minDim = Math.min(canvasWidth, canvasHeight);
      const rPixels = resolveCircleRadius(obj.radius, minDim);
      const strokeWidth = 2;
      const rPhysics = Math.max(2, Math.round(rPixels + strokeWidth / 2));
      try {
        const shouldSkipGround = challengeModeEnabled || !difficultyRules.hasFloor;
        const body = createCircleBody(px, py, rPhysics, floorYForPhysics, {
          density: obj.isStatic ? 0 : 1,
          isStatic: obj.isStatic,
          skipGround: shouldSkipGround,
        });
        obj.physicsBody = body;
        obj.physicalRadius = rPixels;
      } catch (e) {
        console.warn("createCircleBody failed:", e);
      }
    } else if (obj instanceof Platform && !obj.physicsBody) {
      const px = obj.nx * canvasWidth;
      const py = obj.ny * canvasHeight;
      const widthPx = obj.width > 1 ? obj.width : Math.max(4, obj.width * canvasWidth);
      const heightPx = obj.height > 1 ? obj.height : Math.max(4, obj.height * canvasHeight);
      try {
        const shouldSkipGround = challengeModeEnabled || !difficultyRules.hasFloor;
        const body = createBoxBody(px, py, widthPx, heightPx, floorYForPhysics, {
          type: "static",
          friction: 0.8,
          skipGround: shouldSkipGround,
        });
        obj.physicsBody = body;
      } catch (e) {
        console.warn("createBoxBody failed:", e);
      }
    } else if (obj instanceof Segment && !obj.physicsBody) {
      const x1 = obj.x1 * canvasWidth;
      const y1 = obj.y1 * canvasHeight;
      const x2 = obj.x2 * canvasWidth;
      const y2 = obj.y2 * canvasHeight;
      try {
        const shouldSkipGround = challengeModeEnabled || !difficultyRules.hasFloor;
        const body = createEdgeBody(x1, y1, x2, y2, floorYForPhysics, {
          type: "static",
          friction: 0.8,
          skipGround: shouldSkipGround,
        });
        obj.physicsBody = body;
      } catch (e) {
        console.warn("createEdgeBody failed:", e);
      }
    } else if (obj instanceof ComplexObject && (!obj.physicsBodies || !obj.physicsBodies.length)) {
      // ensure texture/pixel points available
      try {
        obj.createTexture(canvasWidth, canvasHeight);
        const shouldSkipGround = challengeModeEnabled || !difficultyRules.hasFloor;
        obj.createPhysics(floorYForPhysics, { skipGround: shouldSkipGround });
      } catch (e) {
        console.warn("ComplexObject physics creation failed:", e);
      }
    } else if (obj instanceof Rotor && !obj.physicsBody) {
      try {
        obj.createTexture(canvasWidth, canvasHeight);
        const shouldSkipGround = challengeModeEnabled || !difficultyRules.hasFloor;
        obj.createPhysics(canvasWidth, canvasHeight, floorYForPhysics, {
          skipGround: shouldSkipGround,
        });
      } catch (e) {
        console.warn("Rotor physics creation failed:", e);
      }
    }
  }
}
