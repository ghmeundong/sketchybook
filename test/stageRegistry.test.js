import { describe, expect, it } from "vitest";
import { getStageDefinition } from "../src/game/stages/registry.js";

describe("stage registry", () => {
  it("exposes a stage definition for stage 18", () => {
    const definition = getStageDefinition(18);

    expect(definition).toMatchObject({ id: 18, title: "Stage 18" });
  });

  it("does not expose stages after stage 18", () => {
    expect(getStageDefinition(19)).toBeNull();
  });
});
