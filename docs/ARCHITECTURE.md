# Architecture

This template separates frontend and backend responsibilities:

- `src/`: frontend application code
- `public/`: static assets
- `backend/`: optional serverless backend, deployable with Cloudflare Workers
- `docs/`: documentation and setup guides

## Audio

Drawing audio is split into an offline preparation step and a small runtime controller:

- `tools/normalize-drawing-audio.mjs` analyzes the source WAV and writes the normalized runtime asset.
- `src/assets/sounds/` stores both the source recording and the generated WAV used by the client.
- `src/game/main.js` owns pointer-driven playback, loop timing, speed-based volume, and immediate stop behavior.

The runtime intentionally uses one audio element. This avoids overlapping playback and crossfade buildup, which can produce a humming or buzzing sound during long strokes. Audio is paused when pointer movement becomes idle and is reset when drawing ends.
