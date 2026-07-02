import planck from "planck";

const physicsWorld = planck.World({ gravity: { x: 0, y: 200 } });
let physicsGround = null;
let physicsFloorY = null;

function ensurePhysicsGround(floorY) {
  if (physicsGround && physicsFloorY === floorY) {
    return;
  }

  if (physicsGround) {
    physicsWorld.destroyBody(physicsGround);
  }

  physicsGround = physicsWorld.createBody();
  physicsGround.createFixture({
    shape: planck.Edge(planck.Vec2(-1000, floorY), planck.Vec2(1000, floorY)),
    density: 0,
    friction: 1,
  });
  physicsFloorY = floorY;
}

function createPlanckBody(stroke, floorY) {
  ensurePhysicsGround(floorY);

  const body = physicsWorld.createBody({
    type: "dynamic",
    position: { x: stroke.body.x, y: stroke.body.y },
  });
  body.setLinearDamping(0);
  body.setAngularDamping(0);
  body.setBullet(true);
  body.setSleepingAllowed(false);

  const segments = [];
  for (let i = 1; i < stroke.points.length; i += 1) {
    const start = stroke.points[i - 1];
    const end = stroke.points[i];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy) || 1;
    const angle = Math.atan2(dy, dx);
    const midpointX = (start.x + end.x) / 2 - stroke.body.x;
    const midpointY = (start.y + end.y) / 2 - stroke.body.y;
    const thickness = 1.8;

    const fixture = body.createFixture({
      shape: planck.Box(length / 2, thickness / 2, planck.Vec2(midpointX, midpointY), angle),
      density: 5,
      friction: 0.8,
      restitution: 0,
    });
    segments.push(fixture);
  }

  body.setAngularVelocity(0.06);
  stroke.physicsBody = body;
  stroke.physicsSegments = segments;

  return body;
}

function syncStrokeFromPhysics(stroke) {
  if (!stroke.physicsBody) {
    return;
  }

  const bodyPosition = stroke.physicsBody.getPosition();
  stroke.body.x = bodyPosition.x;
  stroke.body.y = bodyPosition.y;
  stroke.angle = stroke.physicsBody.getAngle();
  stroke.angularVelocity = stroke.physicsBody.getAngularVelocity();

  stroke.points.forEach((node) => {
    const worldPoint = stroke.physicsBody.getWorldPoint({ x: node.restX, y: node.restY });
    node.x = worldPoint.x;
    node.y = worldPoint.y;
  });

  const lowestPoint = stroke.points.reduce(
    (lowest, point) => (point.y > lowest.y ? point : lowest),
    stroke.points[0]
  );

  stroke.centerOfMass.x = stroke.body.x;
  stroke.centerOfMass.y = stroke.body.y;
  stroke.grounded = lowestPoint.y >= physicsGround.getPosition().y - 1;

  if (stroke.grounded && stroke.angularVelocity >= 0) {
    stroke.angularVelocity = -Math.abs(stroke.angularVelocity || 0.01) - 0.001;
  }
}

export function createStrokeSegments(points, physicsScale, thickness) {
  if (!Array.isArray(points) || points.length < 2) {
    return [];
  }

  return points.slice(1).map((point, index) => {
    const start = points[index];
    const end = point;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy) || 1;
    const midpointX = (start.x + end.x) / 2;
    const midpointY = (start.y + end.y) / 2;
    const angle = Math.atan2(dy, dx);

    return {
      length,
      angle,
      midpointX,
      midpointY,
      halfWidth: (thickness * physicsScale) / 2,
      halfHeight: (length * physicsScale) / 2,
    };
  });
}

export function createStrokeBody(points) {
  if (!Array.isArray(points) || points.length < 2) {
    return null;
  }

  const maxPoints = 40;
  const sampleStep = Math.max(1, Math.floor(points.length / maxPoints));
  const sampledPoints = points.filter((_, index) => index % sampleStep === 0);

  if (sampledPoints.length < 2) {
    return null;
  }

  const centerX = sampledPoints.reduce((sum, point) => sum + point.x, 0) / sampledPoints.length;
  const centerY = sampledPoints.reduce((sum, point) => sum + point.y, 0) / sampledPoints.length;

  const nodes = sampledPoints.map((point) => ({
    x: point.x,
    y: point.y,
    restX: point.x - centerX,
    restY: point.y - centerY,
    vx: 0,
    vy: 0,
  }));

  return {
    points: nodes,
    body: {
      x: centerX,
      y: centerY,
      vx: 0,
      vy: 0,
    },
    centerOfMass: {
      x: centerX,
      y: centerY,
    },
    grounded: false,
    angle: 0,
    angularVelocity: 0,
    anchorPoint: null,
  };
}

export function initializeStrokeBody(stroke, floorY = 0) {
  if (!stroke || !stroke.points?.length || !stroke.body) {
    return stroke;
  }

  stroke.points.forEach((node) => {
    node.x = stroke.body.x + node.restX;
    node.y = stroke.body.y + node.restY;
  });

  stroke.centerOfMass.x = stroke.body.x;
  stroke.centerOfMass.y = stroke.body.y;

  if (!stroke.physicsBody && floorY) {
    createPlanckBody(stroke, floorY);
  }

  return stroke;
}

export function updateStrokeBody(stroke, floorY, options = {}) {
  if (!stroke || !stroke.points?.length || !stroke.body) {
    return stroke;
  }

  if (!stroke.physicsBody) {
    createPlanckBody(stroke, floorY);
  }

  if (stroke.physicsBody) {
    syncStrokeFromPhysics(stroke);
  }

  if (stroke.grounded && stroke.anchorPoint === null) {
    stroke.anchorPoint = {
      x: stroke.body.x,
      y: floorY,
    };
  }

  stroke.body.vx = stroke.physicsBody.getLinearVelocity().x;
  stroke.body.vy = stroke.physicsBody.getLinearVelocity().y;

  return stroke;
}

export function resetPhysicsWorld() {
  let body = physicsWorld.getBodyList();
  while (body) {
    const nextBody = body.getNext();
    physicsWorld.destroyBody(body);
    body = nextBody;
  }

  physicsGround = null;
  physicsFloorY = null;
}

export function stepPhysicsWorld(options = {}) {
  const step = options.deltaTime ?? 1 / 60;
  physicsWorld.step(step, 10, 8);
}
