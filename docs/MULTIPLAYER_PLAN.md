# Multiplayer Plan

## Goal

Allow players on different devices to draw in the same game session and see each other's strokes. A stroke can affect gameplay, so the feature must define when it becomes visible and when it becomes part of collision physics. Matching stroke coordinates alone is not enough to guarantee matching game outcomes.

## Recommended Direction

Use Cloudflare Workers with one Durable Object (DO) per room and a WebSocket connection per player. The DO owns room membership, event ordering, and the shared simulation tick. D1 remains for durable account or game records; it is not used for per-point real-time traffic.

The current backend is a Worker with D1, and the frontend already has a logical coordinate system (`1600 x 900`). Pointer input currently creates a local stroke and physics body. These are the natural integration points; keep networking in a dedicated service/module rather than adding it to bootstrap files.

## Synchronization Model

### Stroke event

Submit the physics-affecting stroke when the player releases the pointer. The client sends a complete logical-coordinate stroke and its drawing properties. The DO validates it, assigns a monotonically increasing room sequence number and a future activation time, then broadcasts the accepted event to all room members, including the author. The current prototype also streams separate visual-only preview batches during drawing; previews never affect collision physics.

Suggested event fields:

```json
{
  "type": "stroke",
  "eventId": "client-generated-unique-id",
  "roomSequence": 42,
  "applyTick": 1800,
  "playerId": "room-scoped-id",
  "points": [
    { "x": 120, "y": 240 },
    { "x": 128, "y": 246 }
  ],
  "width": 8,
  "color": "#222222"
}
```

Coordinates use the shared logical canvas, never device pixels or viewport dimensions. Each client maps logical points onto its own canvas for rendering. Points come from pointer input events, not from sampling once per animation frame.

### Delayed activation

The author may render a local preview immediately, but that preview is not collidable. All clients activate the accepted stroke and create its physics body at `applyTick`. This prevents the author from getting an earlier collision simply because their local input arrived first.

Use a fixed simulation step and tick counter for multiplayer. The DO chooses an apply tick sufficiently far in the future using observed round-trip time and jitter (prefer a measured high percentile plus a safety margin, not a guessed fixed number of frames). Periodic ping/pong messages can estimate server-clock offset and connection quality. Wall-clock synchronization alone is not a substitute for ordered ticks.

If an event arrives after its apply tick, clients must not silently apply it at different times. The room protocol needs one explicit late-event policy. Initial recommendation: the DO assigns a new future tick before broadcasting if the original target is no longer safe; once broadcast, the tick is immutable. Disconnecting or severely delayed clients may be resynchronized from a room snapshot or asked to rejoin.

## Important Consistency Limit

The DO can provide a common event order and activation tick, but this alone does **not** guarantee identical physics. Clients still run the current browser-side physics engine independently; frame timing, floating-point behavior, and engine determinism can cause their worlds to diverge, especially after collisions.

For a first cooperative prototype, accept small physics divergence and use periodic snapshots to detect or correct it if practical. If identical outcomes are a product requirement, move authoritative physics to one simulation authority (the DO or a designated host) and broadcast timestamped state snapshots. Clients then render/interpolate that state instead of treating their local physics as authoritative. Validate CPU limits and snapshot cadence before committing to simulation inside a DO.

## MVP Rules and Scope

- A stroke is shared and becomes collidable only after pointer release and the assigned apply tick.
- The current prototype streams visual-only previews to peers while drawing. On release, the accepted stroke replaces its preview and remains non-collidable until its assigned activation time.
- If strokes must collide while still being drawn, send sequenced point batches during the stroke and schedule each batch on shared ticks. This is a later phase because it increases traffic and requires rules for incomplete or interrupted strokes.
- Use the same stage, game mode, logical canvas dimensions, and initial game seed/state for all room members.
- The Worker currently limits a room to four connected players and uses a six-character room code.
- Initial room state is sent to joining clients, but replaying missed actions after a disconnect is not implemented. Snapshot and event-log recovery remain planned.
- The room creator is the host for room settings and stage flow. Host handoff after departure or a frozen host remains unresolved.

## Implementation Phases and Status

1. **Implemented:** completed strokes use logical coordinates and a dedicated multiplayer event flow without changing single-player input.
2. **Implemented prototype:** a Durable Object room handles WebSocket membership, validation, sequence assignment, and broadcast.
3. **Partially implemented:** release-time activation uses server timestamps, ping/pong estimates, ordered events, and fixed-step local physics. A shared room tick and complete late-event/replay policy remain planned.
4. **Partially implemented:** rooms have membership and payload limits, and joining clients receive room state. Snapshot-based reconnect and missing-event replay are not implemented.
5. **Open:** validate physics divergence across devices and decide whether host-authoritative simulation or snapshot correction is needed.

## Implemented Prototype

The current prototype streams visual previews while drawing and retains release-time collision activation:

- Pointer movement sends small, sequenced logical-coordinate preview batches at up to 20 updates per second. These are visual-only and never collidable. The Durable Object validates batch order and coordinates, then relays previews to peers without echoing them to the author. Cancelled previews are removed for everyone.
- On pointer release, the client sends the completed stroke, capped at 256 points. The Durable Object validates the payload, derives player identity from the socket, deduplicates recent event IDs, and assigns the room sequence, stage number, and future `applyAt` server timestamp. The accepted event replaces the matching live preview.
- Clients estimate clock offset and a rolling RTT percentile from ping/pong. The client requests a lead time based on estimated one-way latency plus a 100 ms safety margin; the server clamps it to 150-1000 ms and keeps `applyAt` ordered with room sequence. Room starts and stage transitions are scheduled 500 ms ahead.
- Every client displays the live stroke as it is drawn. On release, it keeps the accepted stroke visible as a non-collidable preview until creating its local physics body at `applyAt`. The author does not get an earlier collision than peers under normal delivery conditions.
- Ball launches are room actions too: the server deduplicates each player's event ID, assigns the shared room sequence and an `applyAt` after the last accepted stroke/launch, then broadcasts it. The event describes the launch action rather than device-specific impulse values, so each client applies its locally scaled equivalent at the same scheduled time.
- A new room inherits the host's globally selected difficulty (with Normal as fallback when no valid selection exists). The host can change the room difficulty in the lobby; the Durable Object persists and broadcasts the selection, and only the host may change it. The selected difficulty and applicable Challenge Mode setting are included with the room start and applied by every client for the whole stage. Stage completion is determined by the host and relayed once for the selected stage; participants use the host's event count for the completion score. Next-stage, retry (including the HUD button and R shortcut), and exit actions are host-controlled and broadcast as a room start/lobby transition, so guests cannot locally change stages or leave the shared game accidentally.
- While connected to a room, physics uses 1/60-second steps and retains elapsed-time debt instead of dropping time after a delayed animation frame. It processes at most eight catch-up steps per rendered frame, then drains any remaining debt over subsequent frames. On window blur or tab hiding, the local simulation pauses but preserves its last simulation timestamp. On focus return, the client requests the current server time and room sequence, blocks game input, and replays queued room actions while advancing up to 120 fixed steps per rendered frame. It requests a fresh clock sample if it remains more than 100 ms behind, then unlocks input when close to the latest room time. This requires the existing WebSocket to remain connected; reconnect replay is not implemented.

This remains a cooperative prototype, not an authoritative simulation. Host-controlled stage completion avoids a participant advancing ahead when local physics diverges, but a host whose client is frozen may delay completion. Focus-resume catch-up replays timestamped room actions only when the WebSocket remained connected and those messages were delivered; independent Planck worlds can still diverge after collisions, and a disconnected client cannot recover missed actions yet. It cannot guarantee that late forces are inserted at the exact historical point in a frozen client's physics timeline. To eliminate that remaining difference, make the host (or server) authoritative: periodically publish tick-stamped state snapshots for every dynamic body and accepted event sequence; clients detect a stale tick, stop trusting local physics, restore the latest snapshot, then replay buffered room actions or interpolate to the next snapshot. Host loss/freeze requires authority handoff or a server simulation. Do not claim exact resynchronization until this snapshot/replay path and deterministic body identity are implemented and tested.

## Practical Synchronization Recovery Without Server Physics

Server-side Planck simulation is not required for a reliable cooperative multiplayer prototype. A more practical goal is to establish a common event timeline, recover missed events, and periodically realign clients to a known host state. This is eventually consistent synchronization, not a promise that every independently simulated frame will always be identical.

### 1. Use room tick and event sequence as the primary timeline

Define a monotonically increasing `roomTick` for each room, driven from the room start time and a fixed simulation step. Use `roomSequence` as the order of accepted room actions, while `applyTick` is the fixed tick at which those actions take effect.

Every accepted `stroke`, `launch`, preview cancellation, and later gameplay action should include both values:

```json
{
  "roomSequence": 42,
  "applyTick": 1800
}
```

The Durable Object remains a thin ordering authority. It validates input, assigns sequence and tick values, deduplicates event IDs, and broadcasts the immutable accepted action. It should not calculate the physics outcome. The millisecond `applyAt` clock remains useful as an estimation mechanism, but clients must key action replay and state recovery by tick and sequence.

All clients must use the same fixed physics step and apply accepted actions in sequence order. If a room action is received after its apply tick, the server and client must follow a documented late-event policy: reserve a future tick, make the rescheduled tick immutable once accepted, and preserve the original action data without creating device-local timing differences.

### 2. Retain recent authoritative room events for replay

The Durable Object should retain a bounded event log containing accepted actions after a replay cursor. The log must support lookup by `roomSequence`, such as “events after sequence N,” and must retain enough entries to cover reconnect latency and the snapshot cadence.

A recovery request should be explicit:

```json
{
  "type": "room_resync_request",
  "lastRoomSequence": 41,
  "lastRoomTick": 1790
}
```

The Durable Object replies with a snapshot and the accepted events missing since the requested sequence, in ascending order. Clients insert the events into the same fixed-tick queue and replay them only when the base state and tick are valid. Do not rebuild state by applying actions based solely on delivery time.

Recommended event-log rules:

- Deduplicate by the immutable `eventId`.
- Store immutable accepted strokes, launches, stage actions, and cancellations.
- Enforce a maximum room age and entry count so the log is bounded.
- Advance the replay cursor only after a snapshot covers the corresponding tick.
- Prune events only after their replay window and snapshot dependencies are obsolete.
- Rejoin from the snapshot when the requested sequence has already been pruned.

This also addresses reconnects and temporary WebSocket stalls. Receiving the current clock is insufficient when one or more accepted actions were never delivered.

### 3. Use periodic host snapshots as a common recovery state

The room host periodically publishes a physics snapshot rather than continually requiring the server to simulate physics. The snapshot should contain at least:

- host player ID and room identifier;
- snapshot tick and the latest accepted room sequence;
- all dynamic body states; and
- gameplay state needed to restore the room, such as collected stars, active drawing segments, stage state, scores, and completed actions.

Dynamic and collidable objects must have stable, deterministic IDs across every client. Snapshot fields should be normalized and serialized in a consistent body-ID order. A possible payload is:

```json
{
  "type": "host_snapshot",
  "roomSequence": 42,
  "roomTick": 1800,
  "bodies": {
    "ball:0": { "x": 800, "y": 450, "vx": 2.1, "vy": -0.4, "angle": 0.2, "angularVelocity": 0.1 }
  },
  "starsCollected": ["star-1"],
  "activeStrokes": ["stroke-18"]
}

```

The host snapshot must be validated and relayed by the Durable Object, which keeps only the latest safe snapshot. Clients restore the snapshot, reset or reconstruct known bodies, clear queued replay outside the snapshot scope, and replay accepted events whose sequence is newer than the snapshot sequence. Until replay is complete, multiplayer input should remain locked to prevent a second local timeline from being introduced.

This retains local physics simulation, avoids running Planck in the Durable Object, and repairs long-running drift or a client that was paused for an extended period. Exact parity is still not guaranteed, because independent clients may execute different engine versions or floating-point behavior.

### 4. Separate render correction from simulation correction

When local state differs only slightly from the host snapshot, render interpolation is preferred. Clients should smooth visual position and velocity toward the received state rather than modifying the physics world every frame. This keeps collision trajectories from receiving additional, frame-dependent perturbations.

Use a larger correction threshold for the physics simulation:

1. Below the small-error threshold: interpolate rendered state only.
2. Between the small-error and resynchronization thresholds: reduce render interpolation latency and record a divergence warning.
3. Above the resynchronization threshold: lock multiplayer input, restore the latest snapshot, and replay events after the snapshot sequence.

A teleport-type correction is appropriate after a long freeze, a missing snapshot, or a state topology mismatch such as a missing object. It should not be used for every small frame-to-frame difference.

### 5. Detect divergence with normalized checksums

The client can periodically calculate a lightweight state checksum from:

- normalized `roomTick` and latest applied `roomSequence`;
- sorted stable body IDs; and
- quantized position, velocity, and angle values.

The checksum does not repair physics and should not become authoritative evidence. It is used to detect persistent disagreement and to help isolate which tick first diverged. Preserve an optional diagnostic state sample with previous applied actions so network testing can identify collisions that require deterministic fixes or tighter snapshot cadence.

### Recovery model

For routine corrections, the preferred sequence is:

1. restore the latest host snapshot;
2. discard client state after that snapshot;
3. replay the Durable Object event log for sequences newer than the snapshot;
4. advance fixed ticks to the current authorized tick; and
5. resume local physics and smooth minor rendering differences.

On focus return, a client should request clock information only as an additional hint. Its primary synchronization check is the latest snapshot, current room sequence, and missing-event range.

## Recommended Multiplayer Priority

For the no-server-physics design, implement in this order:

1. Replace `applyAt`-only replay with shared `roomTick` plus immutable `applyTick` scheduling based on accepted room sequence.
2. Add bounded Durable Object event retention and `roomSequence`-based event resending.
3. Add host snapshots with stable object IDs, validation, relay, latest snapshot retention, snapshot replay, and host handoff policy.
4. Add small-error interpolation, large-error snapshot reset, and periodic checksum diagnostics.
5. Measure actual divergence under focused tests before introducing server authority or Planck into the Durable Object.

This ordering keeps the Durable Object as a sequence coordinator and snapshot relay rather than an authoritative physics simulator. It also defines a host authority boundary that must be handled separately: host departure or permanent host freeze requires host promotion or a client-controlled pause, and it should not silently leave guests running incompatible timelines.

## Validation Plan

- Unit-test logical coordinate conversion at different viewport sizes.
- Unit-test event ordering, duplicate IDs, apply-tick selection, and late-message handling.
- Test two browser clients in one local room: strokes render in the same order and become collidable on the assigned tick.
- Test slow/jittery connections, packet delay, disconnect/reconnect, and room-owner departure.
- Compare physics state after simultaneous and near-simultaneous collisions on different devices. Record divergence; do not infer deterministic physics from matching stroke rendering.
- Enforce server-side limits and validate every client-provided room/event field. Never trust client-supplied player identity, sequence number, or apply tick.

## Open Decisions

- What amount of physics divergence between independently simulated clients is acceptable for cooperative play?
- Should a disconnected client be allowed to rejoin after an event replay window expires, and what recovery state is required?
- Should host departure end the session, pause it, or transfer authority to another player?

The current prototype streams visual stroke previews while drawing and activates collision only after release at the server-assigned time. Rooms are joined with a six-character code and are capped at four connected players. These are current implementation choices, not open decisions.
