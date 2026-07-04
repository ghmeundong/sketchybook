import planck from "planck";

planck.Settings.maxTranslation = 200.0;
planck.Settings.maxRotation = 100.0;

const physicsWorld = planck.World({ gravity: { x: 0, y: 238 } });
let physicsGround = null;
let physicsFloorY = null;
let physicsLeftWall = null;
let physicsRightWall = null;

function ensurePhysicsGround(floorY) {
  if (physicsGround && physicsFloorY === floorY) {
    return;
  }

  if (physicsGround) physicsWorld.destroyBody(physicsGround);
  if (physicsLeftWall) physicsWorld.destroyBody(physicsLeftWall);
  if (physicsRightWall) physicsWorld.destroyBody(physicsRightWall);

  // 1. 물리 시뮬레이션은 CSS 픽셀 좌표계를 기준으로 합니다.
  const canvas = typeof document !== "undefined" ? document.querySelector("canvas") : null;
  const fallbackWidth =
    typeof window !== "undefined" && Number.isFinite(window.innerWidth) ? window.innerWidth : 800;
  const gameWidth = canvas ? canvas.clientWidth : fallbackWidth;

  // 2. 바닥 생성 (0부터 gameWidth까지)
  physicsGround = physicsWorld.createBody();
  physicsGround.createFixture({
    shape: planck.Edge(planck.Vec2(0, floorY), planck.Vec2(gameWidth, floorY)),
    density: 0,
    friction: 1,
  });

  // 3. 왼쪽 벽 (X: 0)
  physicsLeftWall = physicsWorld.createBody();
  physicsLeftWall.createFixture({
    shape: planck.Edge(planck.Vec2(0, -10000), planck.Vec2(0, floorY)),
    density: 0,
    friction: 0.5,
  });

  // 4. 오른쪽 벽 (X: gameWidth)
  physicsRightWall = physicsWorld.createBody();
  physicsRightWall.createFixture({
    shape: planck.Edge(planck.Vec2(gameWidth, -10000), planck.Vec2(gameWidth, floorY)),
    density: 0,
    friction: 0.5,
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

export function createCircleBody(x, y, radius, floorY = 0, options = {}) {
  ensurePhysicsGround(floorY);

  const shouldCreateRevoluteJoint = Boolean(
    options.jointAnchor ||
    options.anchorX ||
    options.axisX ||
    options.pivotX ||
    options.motor ||
    options.enableMotor ||
    options.spinMode === "auto"
  );
  const bodyType = shouldCreateRevoluteJoint
    ? options.isStatic
      ? "kinematic"
      : "dynamic"
    : options.isStatic
      ? "static"
      : (options.type ?? "dynamic");
  const body = physicsWorld.createBody({
    type: bodyType,
    position: planck.Vec2(x, y),
  });
  body.setLinearDamping(options.linearDamping ?? 0);
  body.setAngularDamping(options.angularDamping ?? 0);
  body.setBullet(!!options.bullet || true);
  body.setSleepingAllowed(false);

  const fixture = body.createFixture({
    shape: planck.Circle(planck.Vec2(0, 0), radius),
    density: options.density ?? 0.05,
    friction: options.friction ?? 0.1,
    restitution: options.restitution ?? 0.1,
  });

  if (shouldCreateRevoluteJoint) {
    const anchorX =
      options.jointAnchor?.x ?? options.anchorX ?? options.axisX ?? options.pivotX ?? x;
    const anchorY =
      options.jointAnchor?.y ?? options.anchorY ?? options.axisY ?? options.pivotY ?? y;
    const anchorBody = physicsWorld.createBody({
      type: "static",
      position: planck.Vec2(anchorX, anchorY),
    });
    physicsWorld.createJoint(
      planck.RevoluteJoint(
        {
          enableMotor: !!(options.motor || options.enableMotor || options.spinMode === "auto"),
          motorSpeed: typeof options.motorSpeed === "number" ? options.motorSpeed : 0,
          maxMotorTorque:
            typeof options.maxMotorTorque === "number" ? options.maxMotorTorque : 1000,
          collideConnected: false,
        },
        anchorBody,
        body,
        planck.Vec2(anchorX, anchorY)
      )
    );
    if (options.motor || options.enableMotor || options.spinMode === "auto") {
      body.setAngularVelocity(typeof options.motorSpeed === "number" ? options.motorSpeed : 1.5);
    }
  }

  return body;
}

export function createBoxBody(x, y, width, height, floorY = 0, options = {}) {
  ensurePhysicsGround(floorY);

  const body = physicsWorld.createBody({
    type: options.type ?? "static",
    position: planck.Vec2(x, y),
  });
  body.setLinearDamping(options.linearDamping ?? 0);
  body.setAngularDamping(options.angularDamping ?? 0);
  body.setBullet(!!options.bullet);
  body.setSleepingAllowed(false);

  const fixture = body.createFixture({
    shape: planck.Box(width / 2, height / 2),
    density: options.density ?? 0,
    friction: options.friction ?? 0.8,
    restitution: options.restitution ?? 0,
  });

  return body;
}

export function createEdgeBody(x1, y1, x2, y2, floorY = 0, options = {}) {
  ensurePhysicsGround(floorY);

  const body = physicsWorld.createBody({
    type: options.type ?? "static",
    position: planck.Vec2(0, 0),
  });
  body.setLinearDamping(options.linearDamping ?? 0);
  body.setAngularDamping(options.angularDamping ?? 0);
  body.setSleepingAllowed(false);

  body.createFixture({
    shape: planck.Edge(planck.Vec2(x1, y1), planck.Vec2(x2, y2)),
    density: options.density ?? 0,
    friction: options.friction ?? 0.8,
    restitution: options.restitution ?? 0,
  });

  return body;
}

export function createPolygonBody(points, floorY = 0, options = {}) {
  if (!Array.isArray(points) || points.length < 3) {
    return null;
  }

  ensurePhysicsGround(floorY);

  const pts = points.map((p) => ({ x: p.x, y: p.y }));
  const center = pts.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  center.x /= pts.length;
  center.y /= pts.length;

  const bodyType = options.isStatic ? "static" : (options.type ?? "dynamic");
  const body = physicsWorld.createBody({
    type: bodyType,
    position: planck.Vec2(center.x, center.y),
  });
  body.setLinearDamping(options.linearDamping ?? 0);
  body.setAngularDamping(options.angularDamping ?? 0);
  body.setBullet(!!options.bullet);
  body.setSleepingAllowed(false);

  const verts = pts.map((p) => planck.Vec2(p.x - center.x, p.y - center.y));
  try {
    body.createFixture({
      shape: planck.Polygon(verts),
      density: options.density ?? (bodyType === "dynamic" ? 1 : 0),
      friction: options.friction ?? 0.8,
      restitution: options.restitution ?? 0,
    });
  } catch (e) {
    console.warn("createPolygonBody failed:", e);
    return null;
  }

  return body;
}

export function createRotorBody(points, axis = {}, floorY = 0, options = {}) {
  if (!Array.isArray(points) || points.length < 2) {
    return null;
  }

  ensurePhysicsGround(floorY);

  const pts = points.map((p) => ({ x: p.x, y: p.y }));
  const center = pts.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  center.x /= pts.length;
  center.y /= pts.length;

  const shouldCreateJoint = Boolean(
    axis?.x != null ||
    axis?.y != null ||
    options.motor ||
    options.enableMotor ||
    options.spinMode === "auto"
  );
  const bodyType = shouldCreateJoint
    ? options.isStatic
      ? "kinematic"
      : "dynamic"
    : options.isStatic
      ? "static"
      : (options.type ?? "dynamic");
  const body = physicsWorld.createBody({
    type: bodyType,
    position: planck.Vec2(center.x, center.y),
  });
  body.setLinearDamping(options.linearDamping ?? 0);
  body.setAngularDamping(options.angularDamping ?? 0);
  body.setBullet(!!options.bullet || bodyType === "dynamic");
  body.setSleepingAllowed(false);

  const thickness = typeof options.thickness === "number" ? options.thickness : 8;
  const makeSegmentFixture = (start, end) => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy) || 1;
    const angle = Math.atan2(dy, dx);
    const midX = (start.x + end.x) / 2 - center.x;
    const midY = (start.y + end.y) / 2 - center.y;
    body.createFixture({
      shape: planck.Box(length / 2, thickness / 2, planck.Vec2(midX, midY), angle),
      density: options.density ?? (bodyType === "dynamic" ? 1 : 0),
      friction: options.friction ?? 0.8,
      restitution: options.restitution ?? 0,
    });
  };

  for (let i = 0; i < pts.length - 1; i += 1) {
    makeSegmentFixture(pts[i], pts[i + 1]);
  }
  if (options.closed && pts.length > 2) {
    makeSegmentFixture(pts[pts.length - 1], pts[0]);
  }

  if (shouldCreateJoint) {
    const anchorX = typeof axis.x === "number" ? axis.x : center.x;
    const anchorY = typeof axis.y === "number" ? axis.y : center.y;
    const anchorBody = physicsWorld.createBody({
      type: "static",
      position: planck.Vec2(anchorX, anchorY),
    });
    physicsWorld.createJoint(
      planck.RevoluteJoint(
        {
          enableMotor: !!(options.motor || options.enableMotor || options.spinMode === "auto"),
          motorSpeed: typeof options.motorSpeed === "number" ? options.motorSpeed : 0,
          maxMotorTorque:
            typeof options.maxMotorTorque === "number" ? options.maxMotorTorque : 1000,
          collideConnected: false,
        },
        anchorBody,
        body,
        planck.Vec2(anchorX, anchorY)
      )
    );
    if (options.motor || options.enableMotor || options.spinMode === "auto") {
      body.setAngularVelocity(typeof options.motorSpeed === "number" ? options.motorSpeed : 1.5);
    }
  }

  return body;
}

export function applyImpulseToBody(body, ix, iy) {
  if (!body) return;
  try {
    body.applyLinearImpulse(planck.Vec2(ix, iy), body.getWorldCenter());
  } catch (e) {
    // fallback: try without Vec2 wrapper
    try {
      body.applyLinearImpulse({ x: ix, y: iy }, body.getWorldCenter());
    } catch (err) {
      console.warn("applyImpulseToBody failed:", err);
    }
  }
}

export function applyImpulseAtLocalPoint(body, ix, iy, localX = 0, localY = 0) {
  if (!body) return;
  try {
    const worldPoint = body.getWorldPoint({ x: localX, y: localY });
    body.applyLinearImpulse(planck.Vec2(ix, iy), worldPoint, true);
  } catch (e) {
    try {
      const worldPoint = body.getWorldPoint({ x: localX, y: localY });
      body.applyLinearImpulse({ x: ix, y: iy }, worldPoint, true);
    } catch (err) {
      console.warn("applyImpulseAtLocalPoint failed:", err);
    }
  }
}

export function applyAngularImpulseToBody(body, impulse) {
  if (!body) return;
  try {
    // Planck.js: applyAngularImpulse exists
    if (typeof body.applyAngularImpulse === "function") {
      body.applyAngularImpulse(impulse);
      return;
    }
    // fallback: adjust angular velocity
    const av = body.getAngularVelocity ? body.getAngularVelocity() : 0;
    if (typeof body.setAngularVelocity === "function") {
      body.setAngularVelocity(av + impulse);
      return;
    }
  } catch (e) {
    try {
      const av = body.getAngularVelocity ? body.getAngularVelocity() : 0;
      if (typeof body.setAngularVelocity === "function") body.setAngularVelocity(av + impulse);
    } catch (err) {
      console.warn("applyAngularImpulseToBody failed:", err);
    }
  }
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
  physicsWorld.step(step, 8, 3);
}
