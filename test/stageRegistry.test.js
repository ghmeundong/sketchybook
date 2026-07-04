import { describe, expect, it } from "vitest";
import { getStageDefinition } from "../src/game/stages/registry.js";

describe("stage registry", () => {
  it("exposes a stage definition for stage 30", () => {
    const definition = getStageDefinition(30);

    expect(definition).toMatchObject({ id: 30, title: "Stage 30" });
  });
});
