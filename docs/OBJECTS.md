# Object definitions for stages

## Overview

Stages declare `objects` as an array in the stage initializer returned by `initStageN()`.
Each object is a plain JS object with a `type` field and type-specific properties.
Positions are normalized (0..1) relative to the canvas width/height unless otherwise noted.

---

## Common objects

### Ball

- `type`: `"ball"`
- `x`, `y`: normalized position
- `radius`: normalized size (0..1) or pixels if > 1
- default: `0.05`

```js
{
  type: "ball",
  x: 0.7,
  y: 0.3,
  radius: 0.02
}
```

### Platform

- `type`: `"platform"`
- `x`, `y`: normalized center
- `width`, `height`: normalized size or pixels if > 1
- defaults: `width: 0.1`, `height: 0.05`

```js
{
  type: "platform",
  x: 0.3,
  y: 0.65,
  width: 0.1,
  height: 0.05
}
```

### Segment

- `type`: `"segment"`
- `x1`, `y1`, `x2`, `y2`: normalized end points

```js
{
  type: "segment",
  x1: 0.2,
  y1: 0.6,
  x2: 0.8,
  y2: 0.6
}
```

### Text label

- `type`: `"text"`
- `x`, `y`: normalized position
- `text`: string
- `fontSize`: normalized fraction of viewport height or px if > 1
- `color`, `fontFamily`: optional
- defaults: `fontSize: 0.04`, `color: "#4f3b24"`, `fontFamily: "MyeongjoFont, serif"`

```js
{
  type: "text",
  x: 0.7,
  y: 0.2,
  text: "Hello",
  fontSize: 0.03,
  color: "#4f3b24"
}
```

---

### Complex / Polygon / Polyline

- `type`: `"poly"` or `"complex"`
- `points`: normalized point array `[{x:..., y:...}, ...]`
- `closed`: boolean (`true` closes last->first edge)
- `isStatic`: boolean (default `true`)

```js
// closed triangle using poly (polygon)
{
  type: "poly",
  closed: true,
  points: [
    { x: 0.2, y: 0.6 },
    { x: 0.5, y: 0.2 },
    { x: 0.8, y: 0.6 }
  ]
}
```

```js
// same shape using complex alias
{
  type: "complex",
  closed: true,
  points: [
    { x: 0.2, y: 0.6 },
    { x: 0.5, y: 0.2 },
    { x: 0.8, y: 0.6 }
  ]
}
```

```js
// open polyline (series of edges)
{
  type: "poly",
  closed: false,
  isStatic: true,
  points: [
    { x: 0.15, y: 0.7 },
    { x: 0.35, y: 0.5 },
    { x: 0.55, y: 0.55 },
    { x: 0.75, y: 0.4 }
  ]
}
```

---

### Rotor

`rotor` creates a shape that can rotate around a pivot.

- `type`: `"rotor"`
- `points`: normalized point array for a custom rotor shape
- `x`, `y`: normalized center coordinates for a circular rotor
- `radius`: normalized radius for a circular rotor
- `pointCount`: number of sample points for circle approximation (default `24`)
- `closed`: boolean (default `false`, auto-set to `true` when `radius` is used)
- `axisX`, `axisY`: normalized pivot position (default rotor center)
- `spinMode`: `"free"` or `"auto"` (default `"free"`)
- `motorSpeed`: number (positive or negative decides direction)
- `maxMotorTorque`: number
- `isStatic`: boolean (default `false`)

```js
// free-form rotor polygon
{
  type: "rotor",
  points: [
    { x: 0.3, y: 0.4 },
    { x: 0.7, y: 0.4 },
    { x: 0.75, y: 0.5 },
    { x: 0.7, y: 0.6 },
    { x: 0.3, y: 0.6 }
  ],
  closed: true,
  axisX: 0.5,
  axisY: 0.5,
  spinMode: "auto",
  motorSpeed: -2.0,
  maxMotorTorque: 400
}
```

```js
// circular rotor
{
  type: "rotor",
  x: 0.5,
  y: 0.5,
  radius: 0.15,
  spinMode: "auto",
  motorSpeed: 1.2,
  maxMotorTorque: 200
}
```

---

If a stage object omits these size or style properties, the engine applies the defaults below automatically.

Defaults summary
- `ball.radius`: 0.02
- `star.radius`: 0.02
- `platform.width`: 0.1
- `platform.height`: 0.05
- `text.fontSize`: 0.04
- `text.color`: #4f3b24
- `text.fontFamily`: `MyeongjoFont, serif`

Notes
- The rendering system will generate a rough, hand-drawn texture for all of these objects when the stage loads (see `src/game/main.js`).
- Physics bodies are created after canvas sizing; the coordinate conversion uses canvas pixel dimensions so normalized coordinates work across resolutions.
- If you need a single rigid polygon collision body (instead of per-edge fixtures), add a `polygon` helper in `src/game/physics.js` and reference it from stage code.

Adding objects to a stage
- In your stage initializer (e.g. `src/game/stages/stage3.js`) include objects in the returned object:

return {
  ...,
  objects: [
    { type: "ball", x:0.7, y:0.3, radius:0.02 },
    { type: "poly", closed:true, points: [...] },
    ...
  ]
};

That's it — add new object types to `docs/OBJECTS.md` when you extend the engine.