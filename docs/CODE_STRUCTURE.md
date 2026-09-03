# Code Structure & Contribution Rules

This document exists so `src/game/main.js` never grows back into a 2,000+ line file. Follow
these rules when adding new features.

## Folder map (`src/`)

```
app/        Bootstrap-level glue: page loader, UI click sounds, app-wide settings/state.
services/   External integrations: backend API client, auth, Google sign-in UI.
game/
  main.js         Bootstrap ONLY: imports + a handful of init calls + top-level event wiring.
                  No business logic lives here. If you're tempted to add a function, it
                  belongs in one of the folders below instead.
  engine/
    core/         Shared runtime state (gameState.js), DOM lookups (domRefs.js), page/stage
                  lifecycle + game loop (gameController.js), fullscreen helper, coordinates,
                  geometry.
    config/       Pure config/rules: difficulty levels, challenge mode, input rules.
    physics/      box2d wrapper (physics.js), physics body factory (bodySetup.js), physics
                  state helpers.
    systems/      Resize/layout helpers used during canvas resize.
  render/         Canvas drawing only (strokes, floor texture, stage objects). No game state
                  mutation beyond drawing caches.
  input/          Pointer/keyboard handling, stroke creation, ball launch.
  audio/          Background music, SFX, drawing audio.
  ui/             DOM screens: stage selection, stage-clear overlay, HUD icons.
  stages/         Stage/game-object factories and registry.
  levels/         Stage loading and pagination.
  objects/        Game object classes (Ball, Platform, Rotor, ...).
```

## Rules

1. **`main.js` files are bootstraps, not implementations.** `src/main.js` and
   `src/game/main.js` should only import modules and call their `init*()` functions. If a
   change adds more than a few lines to either file, extract it into a module first.
2. **One shared mutable state object per subsystem.** Game runtime state lives in
   `game/engine/core/gameState.js` (`state`). Don't create a second parallel copy of
   canvas/stage/physics state in a new file — import and mutate `state`.
3. **DOM lookups go through `domRefs.js`.** Don't call `document.querySelector` for an
   existing HUD/screen element in a new file; add it to `dom` in
   `game/engine/core/domRefs.js` once and import it everywhere.
4. **CSS classes shared across unrelated elements must not carry layout/position rules.**
   Before adding `position`/`top`/`left`/`z-index` to a class, grep `index.html` for other
   elements reusing that class name. If a class is reused purely for its look (e.g. an icon
   button style), put positioning in a second, opt-in class instead of the shared one.
5. **Use the color/font variables in `styles/base.css`** (`--ink`, `--ink-soft`, `--paper`,
   `--paper-card`, `--paper-bright`, `--gold`, `--danger`, `--font-display`) instead of new
   hardcoded hex colors or `MyeongjoFont, serif` literals.
6. **No orphaned files.** If you replace a module's logic, delete the old file in the same
   change instead of leaving it behind "just in case" — dead code with broken imports (like
   the old `engine/loop/gameLoop.js`) rots silently until someone wastes time investigating it.
7. **Verify before committing:** `npm run build`, `npm test`, and a quick manual playthrough
   of one stage for anything touching `game/engine`, `game/render`, or `game/input` (canvas/
   physics/audio have no automated coverage).
