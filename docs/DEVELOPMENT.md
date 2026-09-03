# Development

## Frontend

```bash
npm install
npm run dev
```

## Backend

```bash
cd backend
npm install
npm run dev
```

## Formatting and linting

```bash
npm run lint
npm run format
```

## Drawing Audio Pipeline

The drawing sound uses a normalized WAV generated from the source recording:

- Source: `src/assets/sounds/Objects, Writing, Pencil On Paper, Stroke.wav`
- Runtime asset: `src/assets/sounds/Pencil On Paper, Stroke Normalized.wav`
- Generator: `tools/normalize-drawing-audio.mjs`

Regenerate the runtime asset after replacing or editing the source recording:

```bash
npm run normalize:audio
```

The generator currently assumes a 16-bit PCM WAV. It evaluates the selected loop window in 5 ms RMS windows, calculates the average RMS as the target, and applies interpolated per-window gain to the selected audio range. Gain is clamped between `0.7` and `1.5` to avoid excessive amplification or attenuation. The rest of the source file is copied unchanged.

The selected loop window is `0.37` to `0.53` of the source duration. The same normalized-time window is used by `src/game/audio/drawingAudioInstance.js` during gameplay. Keep these values synchronized when changing the loop selection.

At runtime, the game uses one `Audio` instance:

- Playback starts immediately at the loop start position when drawing begins.
- The selected loop is maintained by a short interval that seeks back to the loop start.
- Drawing speed controls volume after a `35 px/s` dead zone, with a range of `700 px/s`, a minimum of `0.12`, and a maximum of `0.72`.
- When pointer movement stops for `80 ms`, playback is paused and muted.
- Releasing, leaving, or cancelling the pointer stops playback immediately. There is no separate release sound.

After changing audio code or assets, verify the bundle and tests:

```bash
npm test
npm run build:electron
```

## Audio Settings and Feedback

Music and SFX levels are managed by `src/app/audioSettings.js` and persisted in browser storage:

- Music controls the looping `Brain-Teaser-2.ogg` background track.
- SFX controls UI clicks, drawing audio, star collection, the stage-clear stamp, and score-star coin sounds.
- Slider input updates volume immediately.
- The Music and SFX icons toggle mute; clicking again restores the last non-zero volume.

Stage feedback timing is owned by `src/game/engine/core/gameController.js` and `src/game/audio/gameAudio.js`:

- Star collection plays `liecio-achive-sound-132273.mp3` immediately.
- The clear overlay and stamp sound appear after the configured `750 ms` delay.
- Score stars appear one at a time after the overlay, with `driken5482-retro-coin-4-236671.mp3` played for each star.

Background music uses a slow gameplay fade-out and a faster selection-screen fade-in. Rapid page changes invalidate older playback requests and fade callbacks.
