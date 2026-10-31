# Tutorial Plan

## Goals

- Help a first-time player learn the core interaction by playing, not by reading a long instruction page.
- Keep returning players out of mandatory onboarding.
- Teach new mechanics when they first matter instead of replaying the full tutorial on every stage.
- Let players skip or replay the tutorial at any time.

## First-Run Flow

1. On the first launch, offer or start a short interactive tutorial before regular play. The tutorial should quickly let the player launch the ball, draw a guiding line, and retry or undo a move.
2. Introduce one action at a time. Show a short contextual prompt, wait for the player to try it, then acknowledge the result and continue.
3. Keep a visible `Skip tutorial` control in the top-right corner throughout the tutorial. Skipping exits onboarding and records that the player chose to skip it.
4. After the tutorial is completed or skipped, start future launches on the normal start screen without automatically replaying onboarding.

## Implemented Steps

- Stage 1 shows an animated cursor pointing to and clicking the ball. A real ball click advances the saved tutorial state to Stage 2.
- Stage 2 shows an animated cursor drawing a line between the two platforms. Drawing a valid line whose endpoints reach both platforms completes the tutorial.
- Stage 3 demonstrates a real Space keypress and allows it to launch the ball. It then spotlights the reset button and demonstrates the `R` key. Pointer drawing and ball-click launching are blocked during this step. The tutorial completes when the stage is reset through the retry event or the stage is cleared.
- Stage 5 independently demonstrates drawing a line from inside the rotor box toward the upper left. Its progress is stored separately, and any Stage 5 clear completes the hint regardless of the solving stroke.
- Stage 9 demonstrates that drawing is blocked by the hatched circle. Its tutorial progress is tracked separately from the Stage 1-3 sequence.
- There is no skip button; tutorial progress resumes at the saved step.
- If the player leaves before finishing, the next visit to the relevant stage resumes the pending step. Multiplayer sessions do not show this single-player onboarding.
- Existing in-game stage text remains the instruction; the tutorial overlay only demonstrates the action.

The tutorial currently implements Stages 1, 2, 3, the rotor hint in Stage 5, and the hatched-circle hint in Stage 9. Replay access and broader contextual guidance for later mechanics remain planned.

## Returning After an Interrupted Tutorial

Persist tutorial progress as soon as it changes. If the app is closed before completion, offer a small choice on the next launch:

- `Continue tutorial` resumes at the last saved step.
- `Skip tutorial` exits onboarding and records the skip.

Do not silently restart the tutorial from the beginning on every launch. If reliable step-level resume is unavailable in the first implementation, resume from the beginning of the current tutorial section rather than repeating completed sections.

## Just-in-Time Mechanic Guidance

Do not add a tutorial to every stage. When a player first encounters a mechanic that needs explanation, show a short optional contextual hint in that stage. Track each mechanic hint independently so it is not repeated on every later stage. The full tutorial remains available from Help or Settings.

## Replay Access

Add a `Replay tutorial` action to the existing Help or Settings area. Starting a replay should not erase stage progress, scores, or the record of which mechanic hints were seen. The player can still skip the replay using the same top-right control.

## Progress State

Store onboarding progress locally for the first implementation, with a versioned key so the tutorial can change safely later. Keep the state distinct from stage progress.

Suggested fields:

- `status`: `not_started`, `in_progress`, `completed`, or `skipped`
- `stepId`: the last completed or active tutorial step
- `seenMechanics`: mechanic identifiers whose contextual hints have been shown
- `version`: tutorial content version

Treat a new tutorial version deliberately: preserve completed game progress, and decide whether changed onboarding should be offered again rather than automatically forcing all returning players through it.

## UX Notes

- Keep the tutorial short and focused on the core loop; avoid blocking the player with long text.
- Prompts should appear near the relevant game area without covering the ball, drawing surface, or important controls.
- Support keyboard, mouse, and touch input where the game supports those inputs.
- Make skip and replay actions clear, but keep the normal gameplay path easy to reach.

## Suggested Implementation Order

1. Build the short playable first-run sequence and its step transitions.
2. Add versioned local progress persistence, resume, completion, and skip behavior.
3. Add the top-right skip control and a replay entry in Help or Settings.
4. Add mechanic-specific contextual hints as those mechanics are introduced or revised.
5. Test first launch, completed tutorial, skipped tutorial, interrupted tutorial, replay, and existing save data.
