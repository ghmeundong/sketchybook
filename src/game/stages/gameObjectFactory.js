import {
  Ball,
  CircleObject,
  ComplexObject,
  Platform,
  Portal,
  Rotor,
  Segment,
  Star,
  StripedRectObject,
  TextLabel,
} from "../objects/index.js";

export function createGameObject(definition) {
  if (!definition?.type) {
    return null;
  }

  switch (definition.type) {
    case "circle":
      return new CircleObject({
        x: definition.x,
        y: definition.y,
        radius: definition.radius,
        isStatic: definition.isStatic === true,
      });
    case "ball":
      return new Ball({
        x: definition.x,
        y: definition.y,
        radius: definition.radius,
      });
    case "star":
      return new Star({
        x: definition.x,
        y: definition.y,
        radius: definition.radius,
      });
    case "platform":
      return new Platform({
        x: definition.x,
        y: definition.y,
        width: definition.width,
        height: definition.height,
      });
    case "stripedRect":
      return new StripedRectObject({
        x: definition.x,
        y: definition.y,
        width: definition.width,
        height: definition.height,
      });
    case "portal":
      return new Portal({
        x: definition.x,
        y: definition.y,
        width: definition.width,
        height: definition.height,
        color: definition.color,
        portalId: definition.portalId,
      });
    case "segment":
      return new Segment({
        x1: definition.x1,
        y1: definition.y1,
        x2: definition.x2,
        y2: definition.y2,
      });
    case "poly":
    case "complex":
      return new ComplexObject({
        points: definition.points || [],
        closed: !!definition.closed,
        isStatic: definition.isStatic !== false,
      });
    case "rotor":
      return new Rotor({
        points: definition.points || [],
        closed: definition.closed !== false,
        x: definition.x,
        y: definition.y,
        radius: definition.radius,
        pointCount: definition.pointCount,
        axisX: definition.axisX,
        axisY: definition.axisY,
        spinMode: definition.spinMode === "auto" ? "auto" : "free",
        motorSpeed: definition.motorSpeed,
        maxMotorTorque: definition.maxMotorTorque,
        isStatic: definition.isStatic === true,
      });
    case "text":
      return new TextLabel({
        x: definition.x,
        y: definition.y,
        text: definition.text,
        fontSize: definition.fontSize,
        color: definition.color,
        fontFamily: definition.fontFamily,
      });
    default:
      return null;
  }
}

export function createGameObjects(definitions) {
  if (!Array.isArray(definitions)) {
    return [];
  }

  return definitions.map(createGameObject).filter(Boolean);
}
