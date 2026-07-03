// 1. stages 폴더 내의 모든 js 파일들을 Vite가 빌드할 때 포함하도록 미리 등록합니다.
const stageModules = import.meta.glob("./stages/*.js");

export async function loadStage(canvas, board, stageNumberOverride) {
  const params = new URLSearchParams(window.location.search);
  const requestedStage =
    typeof stageNumberOverride === "number" ? stageNumberOverride : Number(params.get("stage"));
  const stageNumber = Math.min(Math.max(requestedStage || 1, 1), 6);

  // 2. 일치하는 객체 키 경로를 생성합니다. (상대 경로 일치 필수)
  const stagePath = `./stages/stage${stageNumber}.js`;

  if (stageModules[stagePath]) {
    // 3. Vite가 안전하게 번들링한 모듈을 가져옵니다.
    const module = await stageModules[stagePath]();
    const initializer = module[`initStage${stageNumber}`];
    return initializer(canvas, board);
  } else {
    console.error(
      `스테이지 ${stageNumber} 파일을 찾을 수 없습니다. 경로를 확인해 주세요:`,
      stagePath
    );
    return null;
  }
}
