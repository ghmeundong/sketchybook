import planck from "planck";
import { Ball, Portal, Star } from "../objects/index.js";

function getObjectScreenPosition(object, canvasWidth, canvasHeight) {
  return {
    x: object.screenX != null ? object.screenX : object.nx * canvasWidth,
    y: object.screenY != null ? object.screenY : object.ny * canvasHeight,
  };
}

function getObjectRadius(object, canvasWidth, canvasHeight) {
  if (object.physicalRadius != null) {
    return object.physicalRadius;
  }

  return object.radius > 1 ? object.radius : object.radius * Math.min(canvasWidth, canvasHeight);
}

function teleportBallThroughPortals(ball, portals, canvasWidth, canvasHeight) {
  if (!ball.physicsBody) {
    return;
  }

  const ballPosition = getObjectScreenPosition(ball, canvasWidth, canvasHeight);
  const ballRadius = getObjectRadius(ball, canvasWidth, canvasHeight);

  for (const portal of portals) {
    if (ball._portalCooldownPortalId === portal.portalId) {
      continue;
    }

    const portalPosition = getObjectScreenPosition(portal, canvasWidth, canvasHeight);
    const portalWidth = portal.width > 1 ? portal.width : portal.width * canvasWidth;
    const portalHeight = portal.height > 1 ? portal.height : portal.height * canvasHeight;
    const radiusX = portalWidth / 2 + ballRadius;
    const radiusY = portalHeight / 2 + ballRadius;
    const deltaX = ballPosition.x - portalPosition.x;
    const deltaY = ballPosition.y - portalPosition.y;
    const isInsidePortal =
      radiusX > 0 &&
      radiusY > 0 &&
      (deltaX * deltaX) / (radiusX * radiusX) + (deltaY * deltaY) / (radiusY * radiusY) <= 1;

    if (!isInsidePortal) {
      continue;
    }

    const target = portals.find((other) => other.portalId !== portal.portalId);
    if (!target) {
      break;
    }

    const targetPosition = getObjectScreenPosition(target, canvasWidth, canvasHeight);
    const velocity = ball.physicsBody.getLinearVelocity();
    const angularVelocity =
      typeof ball.physicsBody.getAngularVelocity === "function"
        ? ball.physicsBody.getAngularVelocity()
        : 0;
    try {
      ball.physicsBody.setTransform(
        planck.Vec2(targetPosition.x, targetPosition.y),
        ball.physicsBody.getAngle()
      );
      ball.physicsBody.setLinearVelocity(velocity);
      if (typeof ball.physicsBody.setAngularVelocity === "function") {
        ball.physicsBody.setAngularVelocity(angularVelocity);
      }
      ball._portalCooldownPortalId = target.portalId;
    } catch (error) {
      console.warn("portal teleport failed:", error);
    }
    break;
  }
}

function collectStars(balls, stars, canvasWidth, canvasHeight, onStarCollected) {
  for (const star of stars) {
    for (const ball of balls) {
      const ballPosition = getObjectScreenPosition(ball, canvasWidth, canvasHeight);
      const ballRadius = getObjectRadius(ball, canvasWidth, canvasHeight);
      const starPosition = getObjectScreenPosition(star, canvasWidth, canvasHeight);
      const starRadius = getObjectRadius(star, canvasWidth, canvasHeight);

      if (
        Math.hypot(ballPosition.x - starPosition.x, ballPosition.y - starPosition.y) <=
        ballRadius + starRadius
      ) {
        star.collected = true;
        onStarCollected?.(star, ball);
        break;
      }
    }
  }
}

export function processBallObjectInteractions({
  gameObjects,
  canvasWidth,
  canvasHeight,
  onStarCollected,
}) {
  if (!Array.isArray(gameObjects) || !gameObjects.length) {
    return { hasStars: false, allStarsCollected: false };
  }

  const balls = gameObjects.filter((object) => object instanceof Ball);
  const portals = gameObjects.filter((object) => object instanceof Portal);
  const stars = gameObjects.filter((object) => object instanceof Star && !object.collected);

  for (const ball of balls) {
    teleportBallThroughPortals(ball, portals, canvasWidth, canvasHeight);
  }
  collectStars(balls, stars, canvasWidth, canvasHeight, onStarCollected);

  const hasStars = gameObjects.some((object) => object instanceof Star);
  const allStarsCollected =
    hasStars && !gameObjects.some((object) => object instanceof Star && !object.collected);

  return { hasStars, allStarsCollected };
}
