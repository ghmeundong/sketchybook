export function getStagePageIndexForStage(stageNumber, stagePageSize = 6, totalStagePages = 3) {
  if (!Number.isInteger(stageNumber) || stageNumber < 1) {
    return 0;
  }

  const pageIndex = Math.floor((stageNumber - 1) / stagePageSize);
  return Math.min(Math.max(pageIndex, 0), Math.max(totalStagePages - 1, 0));
}
