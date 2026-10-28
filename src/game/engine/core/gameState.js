// Shared mutable runtime state for the active game session.
// Every module that needs to read/write cross-cutting game state imports
// this single object instead of holding its own module-scope copies.
export const state = {
  // page / difficulty
  currentDifficulty: null,
  difficultyRules: null,
  electronFullscreen: null,
  challengeModeEnabled: false,
  challengeModeStrokeCount: 0,

  // stage selection
  stagePageIndex: 0,

  // stage lifecycle
  currentStage: null,
  currentStageNumber: 1,
  isPlayground: false,
  isTutorialPlay: false,
  isMapTest: false,
  mapTestDefinition: null,
  stageCleared: false,
  stageClearRequestPending: false,
  stageHasSimulated: false,
  stageEventCount: 0,
  stageMinEvents: 0,
  stageClearOverlayTimer: null,

  // canvas / rendering
  canvasWidth: 0,
  canvasHeight: 0,
  ctx: null,
  roughCanvas: null,
  coordinateSystem: null,
  animationFrameId: null,
  previewCanvas: null,
  previewCtx: null,
  floorTextureCanvas: null,
  floorTextureKey: null,
  currentStrokePreviewDirty: false,
  currentStrokePreviewLastIndex: 0,

  // drawing / physics
  isDrawing: false,
  lastPoint: null,
  currentStroke: null,
  physicsStrokes: [],
  roomStrokePreviews: [],
  gameObjects: [],
  playgroundUndoStack: [],
  playgroundRedoStack: [],
  lastPhysicsTime: 0,
  physicsAccumulatorMs: 0,
  totalDrawnLength: 0,
  drawLimitProgressTrackDrawn: false,

  // audio / music page tracking
  activeAudioPage: null,
  gamePageFirstRenderVerified: false,

  // stage clear overlay elements
  stageClearOverlay: null,
  stageClearMessage: null,
  gameExitButton: null,
  gameRetryButton: null,
};
