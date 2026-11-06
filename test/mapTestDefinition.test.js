import { describe, expect, it } from "vitest";
import { createMapTestDefinition } from "../src/game/stages/mapTestDefinition.js";

describe("createMapTestDefinition", () => {
  it("keeps the selected difficulty and applies object level filters", () => {
    const definition = createMapTestDefinition({
      name: "Custom map",
      difficulty: "hard",
      objects: [
        { type: "ball", levels: ["easy", "hard"] },
        { type: "star", levels: ["easy"] },
        { type: "platform", levels: ["hard"] },
      ],
    });

    expect(definition.difficulty).toBe("hard");
    expect(definition.objects.map((object) => object.type)).toEqual(["ball", "platform"]);
  });

  it("applies hard and insane text restrictions", () => {
    const definition = createMapTestDefinition({
      difficulty: "insane",
      objects: [{ type: "text", text: "Label" }, { type: "ball" }],
    });

    expect(definition.objects.map((object) => object.type)).toEqual(["ball"]);
  });

  it("defaults maps without a valid difficulty to easy for compatibility", () => {
    const definition = createMapTestDefinition({ objects: [{ type: "text", text: "Map" }] });

    expect(definition.difficulty).toBe("easy");
    expect(definition.objects[0]).toMatchObject({
      type: "text",
      fontFamily: "sketchyfont, serif",
      useKoreanTextScale: false,
    });
  });

  it("rejects definitions without an object list", () => {
    expect(createMapTestDefinition({})).toBeNull();
  });
});
