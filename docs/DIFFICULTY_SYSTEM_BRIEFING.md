# Difficulty System

This document describes the current difficulty rules. The source of truth is [`difficultyLevels.js`](../src/game/engine/config/difficultyLevels.js); stage-specific object filtering and Insane platform restrictions are applied in [`registry.js`](../src/game/stages/registry.js).

## Current rules

| Difficulty | Floor | Draw on ball | Maximum line length | Challenge Mode | Additional rule |
| --- | --- | --- | ---: | --- | --- |
| Easy | On | Allowed | No limit | Unavailable | Learning rules |
| Normal | On | Allowed | 5,000 px | Unavailable | Standard rules |
| Hard | Off | Blocked | 2,500 px | Optional | No floor safety net |
| Insane | Off | Blocked | 1,250 px | Forced | Platforms also receive no-draw striped areas |

Line length is measured in canvas pixels. Difficulty-specific objects can declare a `levels` value (a difficulty string or array); objects without it are shared across difficulties. Insane mode adds striped no-draw regions over platform objects.

The selected difficulty is passed between pages through the URL and session storage. Invalid or missing values fall back to Normal. Challenge Mode is unavailable on Easy and Normal, optional on Hard, and forced on Insane.

## Implementation map

- `src/game/engine/config/difficultyLevels.js`: difficulty identifiers, rules, and navigation.
- `src/game/engine/core/gameController.js`: selected difficulty, line-limit state, and Challenge Mode behavior.
- `src/game/input/drawingPolicy.js` and `src/game/input/pointerInput.js`: drawing restrictions.
- `src/game/stages/stageTemplate.js`: filtering objects by difficulty.
- `src/game/stages/registry.js`: stage definitions and Insane platform restrictions.

## Verification

Run the relevant tests with:

```bash
npx vitest run test/challengeMode.test.js test/inputRules.test.js
```

See the [Developer Guide](DEVELOPER_GUIDE.md) for the full test and build workflow.
