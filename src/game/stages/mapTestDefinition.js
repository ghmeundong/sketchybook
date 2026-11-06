import { DIFFICULTY_LEVELS, filterObjectsByDifficulty } from "../engine/config/difficultyLevels.js";

const VALID_DIFFICULTIES = new Set(Object.values(DIFFICULTY_LEVELS));

export function createMapTestDefinition(mapDefinition) {
  if (!mapDefinition || !Array.isArray(mapDefinition.objects)) return null;

  const difficulty = VALID_DIFFICULTIES.has(mapDefinition.difficulty)
    ? mapDefinition.difficulty
    : DIFFICULTY_LEVELS.EASY;
  const objects = filterObjectsByDifficulty(mapDefinition.objects, difficulty)
    .filter(
      (object) =>
        !(
          [DIFFICULTY_LEVELS.HARD, DIFFICULTY_LEVELS.INSANE].includes(difficulty) &&
          object.type === "text"
        )
    )
    .map((object) => {
      const copy = { ...object };
      if (copy.type === "text" && !/[가-힣]/.test(String(copy.text || ""))) {
        copy.fontFamily = "sketchyfont, serif";
        copy.useKoreanTextScale = false;
      }
      return copy;
    });

  return {
    id: mapDefinition.id,
    name: String(mapDefinition.name || "Untitled map"),
    difficulty,
    objects,
  };
}
