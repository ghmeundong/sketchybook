import {
  Ball,
  CircleObject,
  ComplexObject,
  Platform,
  Rotor,
  Segment,
  Star,
} from "../objects/index.js";
import { rescalePoint, rescalePoints } from "../engine/systems/resizeState.js";

export function remapGameObjects(
  gameObjects,
  previousCanvasWidth,
  previousCanvasHeight,
  canvasWidth,
  canvasHeight
) {
  if (!Array.isArray(gameObjects)) {
    return;
  }

  for (const object of gameObjects) {
    if (object instanceof Ball || object instanceof CircleObject || object instanceof Star) {
      const previousX =
        object.screenX ?? (object.nx != null ? object.nx * previousCanvasWidth : null);
      const previousY =
        object.screenY ?? (object.ny != null ? object.ny * previousCanvasHeight : null);
      if (previousX != null && previousY != null) {
        const remapped = rescalePoint(
          { x: previousX, y: previousY },
          previousCanvasWidth,
          previousCanvasHeight,
          canvasWidth,
          canvasHeight
        );
        object.screenX = remapped.x;
        object.screenY = remapped.y;
        object.nx = remapped.x / canvasWidth;
        object.ny = remapped.y / canvasHeight;
      }
    }

    if (object instanceof Platform) {
      const previousX =
        object.screenX ?? (object.nx != null ? object.nx * previousCanvasWidth : null);
      const previousY =
        object.screenY ?? (object.ny != null ? object.ny * previousCanvasHeight : null);
      if (previousX != null && previousY != null) {
        const remapped = rescalePoint(
          { x: previousX, y: previousY },
          previousCanvasWidth,
          previousCanvasHeight,
          canvasWidth,
          canvasHeight
        );
        object.screenX = remapped.x;
        object.screenY = remapped.y;
        object.nx = remapped.x / canvasWidth;
        object.ny = remapped.y / canvasHeight;
      }
    }

    if (object instanceof Segment) {
      const remappedPoints = rescalePoints(
        [
          { x: object.x1 * previousCanvasWidth, y: object.y1 * previousCanvasHeight },
          { x: object.x2 * previousCanvasWidth, y: object.y2 * previousCanvasHeight },
        ],
        previousCanvasWidth,
        previousCanvasHeight,
        canvasWidth,
        canvasHeight
      );
      object.x1 = remappedPoints[0].x / canvasWidth;
      object.y1 = remappedPoints[0].y / canvasHeight;
      object.x2 = remappedPoints[1].x / canvasWidth;
      object.y2 = remappedPoints[1].y / canvasHeight;
      object.texture = null;
      object.textureOffset = null;
      object._lastCanvasSize = null;
    }

    if (object instanceof ComplexObject) {
      if (Array.isArray(object.normalizedPoints) && object.normalizedPoints.length) {
        const remappedPoints = rescalePoints(
          object.normalizedPoints.map((point) => ({
            x: point.x * previousCanvasWidth,
            y: point.y * previousCanvasHeight,
          })),
          previousCanvasWidth,
          previousCanvasHeight,
          canvasWidth,
          canvasHeight
        );
        object.normalizedPoints = remappedPoints.map((point) => ({
          x: point.x / canvasWidth,
          y: point.y / canvasHeight,
        }));
      }
      object.texture = null;
      object.textureOffset = null;
      object.textureAnchor = null;
      object._lastCanvasSize = null;
    }

    if (object instanceof Rotor) {
      if (object.screenX != null && object.screenY != null) {
        const remapped = rescalePoint(
          { x: object.screenX, y: object.screenY },
          previousCanvasWidth,
          previousCanvasHeight,
          canvasWidth,
          canvasHeight
        );
        object.screenX = remapped.x;
        object.screenY = remapped.y;
      }
      object.cx = object.screenX != null ? object.screenX / canvasWidth : object.cx;
      object.cy = object.screenY != null ? object.screenY / canvasHeight : object.cy;
      object.axisX = object.axisX != null ? object.axisX : object.cx;
      object.axisY = object.axisY != null ? object.axisY : object.cy;
      object.texture = null;
      object.textureOffset = null;
      object._lastCanvasSize = null;
    }
  }
}
