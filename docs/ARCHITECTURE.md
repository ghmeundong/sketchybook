# Architecture

The application separates frontend and backend responsibilities:

- `src/`: frontend application code
- `public/`: static assets
- `backend/`: optional serverless backend, deployable with Cloudflare Workers
- `docs/`: documentation and setup guides

## Audio

Audio is split into background music, interface feedback, and drawing audio:

- `src/audioSettings.js` stores Music and SFX levels in `localStorage` and broadcasts changes.
- `src/game/main.js` owns looping background music, page-transition fades, stage feedback sounds, and drawing audio.
- `src/main.js` owns generic button and stage-selection feedback sounds.
- `src/assets/audio/` contains background music; `src/assets/sounds/` contains UI and gameplay sounds.

Background music loops on the start and selection pages, fades out when gameplay begins, and fades back in when gameplay ends. Playback requests are guarded with transition and page checks so rapid stage changes cannot revive music during gameplay.

The settings panel controls Music and SFX independently. Slider changes apply immediately, while clicking an audio icon toggles mute and restores the previous non-zero level. SFX includes button, drawing, star-collection, stage-clear, and score-star feedback.

Drawing audio starts when a stroke begins, loops over its selected range, responds to drawing speed, and stops when the pointer becomes idle or the stroke ends.
