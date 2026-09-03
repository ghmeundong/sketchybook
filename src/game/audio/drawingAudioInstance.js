import dragSoundUrl from "../../assets/sounds/Pencil On Paper, Stroke Normalized.wav";
import { getSfxVolume } from "../../app/audioSettings.js";
import { createDrawingAudioController } from "./drawingAudio.js";

// Shared singleton so both the pointer-input and game-loop modules control
// the same drawing sound instance.
export const drawingAudio = createDrawingAudioController({
  audioUrl: dragSoundUrl,
  getSfxVolume,
});
