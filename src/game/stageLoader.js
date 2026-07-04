import { createStageFromDefinition } from "./stages/registry.js";

export async function loadStage(canvas, board, stageNumberOverride) {
  const params = new URLSearchParams(window.location.search);
  const requestedStage =
    typeof stageNumberOverride === "number" ? stageNumberOverride : Number(params.get("stage"));
  const stageNumber = Math.min(Math.max(requestedStage || 1, 1), 30);

  const builtStage = createStageFromDefinition(stageNumber, canvas, board);
  if (builtStage) {
    return builtStage;
  }

  const stageModules = import.meta.glob("./stages/stage*.js", { eager: true });
  const stagePath = `./stages/stage${stageNumber}.js`;
  const module = stageModules[stagePath];

  if (!module) {
    console.error(
      `스테이지 ${stageNumber} 파일을 찾을 수 없습니다. 경로를 확인해 주세요:`,
      stagePath
    );
    return null;
  }

  const initializer = module[`initStage${stageNumber}`];
  if (typeof initializer !== "function") {
    console.error(
      `스테이지 ${stageNumber} 초기화 함수를 찾을 수 없습니다. 파일을 확인해 주세요:`,
      stagePath
    );
    return null;
  }

  return initializer(canvas, board);
}
