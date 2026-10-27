import { describe, expect, it } from "vitest";
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
} from "../src/game/objects/index.js";
import { createGameObject, createGameObjects } from "../src/game/stages/gameObjectFactory.js";

const definitions = [
  ["circle", CircleObject],
  ["ball", Ball],
  ["star", Star],
  ["platform", Platform],
  ["stripedRect", StripedRectObject],
  ["portal", Portal],
  ["segment", Segment],
  ["poly", ComplexObject],
  ["complex", ComplexObject],
  ["rotor", Rotor],
  ["text", TextLabel],
];

describe("createGameObject", () => {
  it.each(definitions)("creates a %s object", (type, expectedClass) => {
    const object = createGameObject({ type, points: [] });

    expect(object).toBeInstanceOf(expectedClass);
  });

  it("ignores missing and unknown object types", () => {
    expect(createGameObject()).toBeNull();
    expect(createGameObject({ type: "unknown" })).toBeNull();
  });

  it("preserves text labels marked as user-authored", () => {
    const object = createGameObject({
      type: "text",
      text: "My Map Name",
      shouldTranslate: false,
    });

    expect(object).toBeInstanceOf(TextLabel);
    expect(object.shouldTranslate).toBe(false);
    expect(object.text).toBe("My Map Name");
  });

  it("preserves explicit font styling and Korean scale settings for text labels", () => {
    const object = createGameObject({
      type: "text",
      text: "English label",
      fontFamily: "sketchyfont, serif",
      useKoreanTextScale: false,
    });

    expect(object.fontFamily).toBe("sketchyfont, serif");
    expect(object.useKoreanTextScale).toBe(false);
  });
});

describe("createGameObjects", () => {
  it("creates valid objects and skips unknown definitions", () => {
    const objects = createGameObjects([
      { type: "ball", x: 0.5, y: 0.5, radius: 0.04 },
      { type: "unknown" },
      { type: "star", x: 0.2, y: 0.2, radius: 0.03 },
    ]);

    expect(objects).toHaveLength(2);
    expect(objects[0]).toBeInstanceOf(Ball);
    expect(objects[1]).toBeInstanceOf(Star);
  });

  it("returns an empty list for non-array definitions", () => {
    expect(createGameObjects(null)).toEqual([]);
  });
});
