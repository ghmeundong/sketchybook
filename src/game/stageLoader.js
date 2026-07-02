export async function loadStage(canvas, board) {
  const params = new URLSearchParams(window.location.search);
  const requestedStage = Number(params.get("stage")) || 1;
  const stageNumber = Math.min(Math.max(requestedStage, 1), 6);
  const module = await import(`./stages/stage${stageNumber}.js`);
  const initializer = module[`initStage${stageNumber}`];
  return initializer(canvas, board);
}
