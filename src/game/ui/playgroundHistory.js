import { createActionIconCanvas } from "./uiIcons.js";
import { destroyStrokeBody, initializeStrokeBody } from "../engine/physics/physics.js";
import { dom } from "../engine/core/domRefs.js";
import { state } from "../engine/core/gameState.js";

let undoButton = null;
let redoButton = null;

function updatePlaygroundHistoryButtons() {
  if (!undoButton || !redoButton) return;
  undoButton.disabled = state.playgroundUndoStack.length === 0;
  redoButton.disabled = state.playgroundRedoStack.length === 0;
  undoButton.setAttribute("aria-disabled", String(undoButton.disabled));
  redoButton.setAttribute("aria-disabled", String(redoButton.disabled));
}

export function recordPlaygroundStroke(stroke) {
  if (!state.isPlayground || !stroke) return;
  state.playgroundUndoStack.push(stroke);
  state.playgroundRedoStack = [];
  updatePlaygroundHistoryButtons();
}

export function undoPlaygroundStroke() {
  if (!state.isPlayground || state.playgroundUndoStack.length === 0) return;
  const stroke = state.playgroundUndoStack.pop();
  const strokeIndex = state.physicsStrokes.indexOf(stroke);
  if (strokeIndex >= 0) {
    state.physicsStrokes.splice(strokeIndex, 1);
  }
  destroyStrokeBody(stroke);
  state.playgroundRedoStack.push(stroke);
  state.stageEventCount = Math.max(0, state.stageEventCount - 1);
  updatePlaygroundHistoryButtons();
}

export function redoPlaygroundStroke() {
  if (!state.isPlayground || state.playgroundRedoStack.length === 0) return;
  const stroke = state.playgroundRedoStack.pop();
  const floorY = (dom.canvas?.clientHeight || 0) - 24;
  initializeStrokeBody(stroke, floorY, {
    type: "dynamic",
    skipGround: false,
  });
  state.physicsStrokes.push(stroke);
  state.playgroundUndoStack.push(stroke);
  state.stageEventCount += 1;
  updatePlaygroundHistoryButtons();
}

export function initPlaygroundHistoryButtons() {
  if (!dom.board) return;
  removePlaygroundHistoryButtons();

  undoButton = document.createElement("button");
  undoButton.type = "button";
  undoButton.className = "playground-history-btn playground-undo-btn";
  undoButton.setAttribute("aria-label", "Undo last playground stroke");
  undoButton.title = "Undo";
  undoButton.appendChild(createActionIconCanvas("undo", { w: 52, h: 44, strokeWidth: 2.4 }));
  undoButton.addEventListener("click", undoPlaygroundStroke);

  redoButton = document.createElement("button");
  redoButton.type = "button";
  redoButton.className = "playground-history-btn playground-redo-btn";
  redoButton.setAttribute("aria-label", "Redo last playground stroke");
  redoButton.title = "Redo";
  redoButton.appendChild(createActionIconCanvas("redo", { w: 52, h: 44, strokeWidth: 2.4 }));
  redoButton.addEventListener("click", redoPlaygroundStroke);

  dom.board.appendChild(undoButton);
  dom.board.appendChild(redoButton);
  updatePlaygroundHistoryButtons();
}

export function removePlaygroundHistoryButtons() {
  undoButton?.remove();
  redoButton?.remove();
  undoButton = null;
  redoButton = null;
}
