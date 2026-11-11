# Object definitions for stages

## Overview

Stages declare `objects` as an array in the stage initializer returned by `initStageN()`.
Each object is a plain JS object with a `type` field and type-specific properties.
Positions are normalized (0..1) relative to the canvas width/height unless otherwise noted.

## Map editor JSON reference

The Map Maker's **JSON** tab edits the same object definitions used by stages. The root value is a map document with a version, a name, a difficulty, and an `objects` array:

```json
{
  "version": 1,
  "name": "First map",
  "difficulty": "normal",
  "objects": [
    { "type": "ball", "x": 0.25, "y": 0.3, "radius": 0.02 },
    { "type": "platform", "x": 0.5, "y": 0.7, "width": 0.3, "height": 0.04 },
    { "type": "star", "x": 0.8, "y": 0.35, "radius": 0.02 }
  ]
}
```

- `version` is currently `1`.
- `name` is the map title. `difficulty` is `easy`, `normal`, `hard`, or `insane` and defaults to `easy` when omitted. `objects` is an array of stage object definitions.
- Difficulty controls gameplay rules and objects' optional `levels` filters. Saved and shared maps retain their selected difficulty.
- Coordinates and dimensions from `0` to `1` are normalized to the canvas. For object sizes, values greater than `1` are interpreted as pixels by the engine.
- The JSON editor validates and applies valid edits as you type. Invalid JSON or object fields are reported without replacing the current map. JSON input is limited to 64 KiB, and valid changes can be undone.
- The JSON editor suggests supported `type` values and common fields while typing. Press `Tab` or `Enter` to accept a suggestion, and use the arrow keys to change the highlighted suggestion.
- **Save** requires you to sign in and stores maps in your account; a map must contain at least one ball and one star. **Export JSON** downloads a file that can be shared or edited externally without signing in.

Supported types are `ball`, `circle`, `star`, `platform`, `stripedRect`, `portal`, `segment`, `poly`/`complex`, `rotor`, and `text`. See the definitions below for their fields and examples.

---

## Common objects

### Ball

- `type`: `"ball"`
- `x`, `y`: normalized position
- `radius`: normalized size (0..1) or pixels if > 1
- default: `0.02`

```json
{
  "type": "ball",
  "x": 0.7,
  "y": 0.3,
  "radius": 0.02
}
```

### Circle

A static or dynamic circular physics object. Unlike `ball`, a circle can be configured as static.

- `type`: `"circle"`
- `x`, `y`: normalized center position (default `0.5`, `0.5`)
- `radius`: normalized radius or pixels if > 1 (default `0.025`)
- `isStatic`: boolean (default `false`)

```json
{ "type": "circle", "x": 0.5, "y": 0.55, "radius": 0.05, "isStatic": true }
```

### Star

Collectible goal object.

- `type`: `"star"`
- `x`, `y`: normalized center position (default `0.5`, `0.5`)
- `radius`: normalized radius or pixels if > 1 (default `0.02`)

```json
{ "type": "star", "x": 0.8, "y": 0.3, "radius": 0.025 }
```

### Platform

- `type`: `"platform"`
- `x`, `y`: normalized center
- `width`, `height`: normalized size or pixels if > 1
- defaults: `width: 0.1`, `height: 0.05`

```json
{
  "type": "platform",
  "x": 0.3,
  "y": 0.65,
  "width": 0.1,
  "height": 0.05
}
```

### Striped hazard

A red hatched area. It is a visual/drawing restriction region rather than a solid platform.

- `type`: `"stripedRect"`
- `x`, `y`: normalized center position (default `0.5`, `0.5`)
- `width`, `height`: normalized size or pixels if > 1 (defaults `0.12`, `0.08`)

```json
{ "type": "stripedRect", "x": 0.5, "y": 0.5, "width": 0.08, "height": 0.7 }
```

### Portal

A portal entrance. Portals pair by complementary color IDs: `orange` with `blue`, and `green` with `purple`.

- `type`: `"portal"`
- `x`, `y`: normalized center position (default `0.5`, `0.5`)
- `width`, `height`: normalized size or pixels if > 1 (defaults `0.02`, `0.1`)
- `portalId`: color and pair ID. Built-in IDs are `orange`, `blue`, `green`, and `purple`; unmatched IDs use the fallback portal color.
- Complementary IDs pair as `orange`-`blue` and `green`-`purple`.
- The map editor supports up to two portal pairs.

```json
{
  "version": 1,
  "name": "Portal pairs",
  "objects": [
    { "type": "portal", "x": 0.25, "y": 0.5, "width": 0.025, "height": 0.12, "portalId": "orange" },
    { "type": "portal", "x": 0.75, "y": 0.5, "width": 0.025, "height": 0.12, "portalId": "blue" },
    { "type": "portal", "x": 0.25, "y": 0.75, "width": 0.025, "height": 0.12, "portalId": "green" },
    { "type": "portal", "x": 0.75, "y": 0.75, "width": 0.025, "height": 0.12, "portalId": "purple" }
  ]
}
```

### Segment

- `type`: `"segment"`
- `x1`, `y1`, `x2`, `y2`: normalized end points

```json
{
  "type": "segment",
  "x1": 0.2,
  "y1": 0.6,
  "x2": 0.8,
  "y2": 0.6
}
```

In the Map Maker, draw a segment by dragging from its first endpoint to its second endpoint.

### Text label

- `type`: `"text"`
- `x`, `y`: normalized position
- `text`: string
- `fontSize`: normalized fraction of viewport height or px if > 1
- `color`, `fontFamily`: optional
- defaults: `fontSize`: `0.04`, `color`: `#4f3b24`, `fontFamily`: `MyeongjoFont, serif`

```json
{
  "type": "text",
  "x": 0.7,
  "y": 0.2,
  "text": "Hello",
  "fontSize": 0.03,
  "color": "#4f3b24",
  "fontFamily": "MyeongjoFont, serif"
}
```

---

### Complex / Polygon / Polyline

- `type`: `"poly"` or `"complex"`
- `points`: normalized point array `[{x:..., y:...}, ...]`
- `closed`: boolean (`true` closes last->first edge)
- `isStatic`: boolean (default `true`)

Use `closed: true` for a filled polygon and `closed: false` for an open polyline.

```json
{
  "type": "poly",
  "closed": true,
  "points": [
    { "x": 0.2, "y": 0.6 },
    { "x": 0.5, "y": 0.2 },
    { "x": 0.8, "y": 0.6 }
  ]
}
```

`complex` is an alias for `poly` and creates the same shape:

```json
{
  "type": "complex",
  "closed": true,
  "points": [
    { "x": 0.2, "y": 0.6 },
    { "x": 0.5, "y": 0.2 },
    { "x": 0.8, "y": 0.6 }
  ]
}
```

An open polyline example:

```json
{
  "type": "poly",
  "closed": false,
  "isStatic": true,
  "points": [
    { "x": 0.15, "y": 0.7 },
    { "x": 0.35, "y": 0.5 },
    { "x": 0.55, "y": 0.55 },
    { "x": 0.75, "y": 0.4 }
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
- `closed`: boolean (default `true`; set to `false` for an open shape)
- `axisX`, `axisY`: normalized pivot position (default rotor center)
- `spinMode`: `"free"` or `"auto"` (default `"free"`)
- `motorSpeed`: number (positive or negative decides direction)
- `maxMotorTorque`: number
- `isStatic`: boolean (default `false`)

```json
{
  "type": "rotor",
  "points": [
    { "x": 0.3, "y": 0.4 },
    { "x": 0.7, "y": 0.4 },
    { "x": 0.75, "y": 0.5 },
    { "x": 0.7, "y": 0.6 },
    { "x": 0.3, "y": 0.6 }
  ],
  "closed": true,
  "axisX": 0.5,
  "axisY": 0.5,
  "spinMode": "auto",
  "motorSpeed": -2.0,
  "maxMotorTorque": 400
}
```

```json
{
  "type": "rotor",
  "x": 0.5,
  "y": 0.5,
  "radius": 0.15,
  "spinMode": "auto",
  "motorSpeed": 1.2,
  "maxMotorTorque": 200
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
- `circle.radius`: 0.025
- `portal.width`: 0.02
- `portal.height`: 0.1
- `stripedRect.width`: 0.12
- `stripedRect.height`: 0.08
