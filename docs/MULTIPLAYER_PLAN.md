# Multiplayer Plan

## Goal

Allow players on different devices to draw in the same game session and see each other's strokes. A stroke can affect gameplay, so the feature must define when it becomes visible and when it becomes part of collision physics. Matching stroke coordinates alone is not enough to guarantee matching game outcomes.

## Recommended Direction

Use Cloudflare Workers with one Durable Object (DO) per room and a WebSocket connection per player. The DO owns room membership, event ordering, and the shared simulation tick. D1 remains for durable account or game records; it is not used for per-point real-time traffic.

The current backend is a Worker with D1, and the frontend already has a logical coordinate system (`1600 x 900`). Pointer input currently creates a local stroke and physics body. These are the natural integration points; keep networking in a dedicated service/module rather than adding it to bootstrap files.

## Synchronization Model

### Stroke event

For the initial version, only submit a stroke when the player releases the pointer. The client sends a complete logical-coordinate stroke and its drawing properties. The DO validates it, assigns a monotonically increasing room sequence number and a future simulation tick, then broadcasts the accepted event to all room members, including the author.

Suggested event fields:

```json
{
  "type": "stroke",
  "eventId": "client-generated-unique-id",
  "roomSequence": 42,
  "applyTick": 1800,
  "playerId": "room-scoped-id",
  "points": [{ "x": 120, "y": 240 }, { "x": 128, "y": 246 }],
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
- Drawing previews are local-only until the accepted stroke is broadcast. Show a pending state if useful; remove or reconcile it when the server response arrives.
- If strokes must collide while still being drawn, send sequenced point batches during the stroke and schedule each batch on shared ticks. This is a later phase because it increases traffic and requires rules for incomplete or interrupted strokes.
- Use the same stage, game mode, logical canvas dimensions, and initial game seed/state for all room members.
- On join or reconnect, send a room snapshot containing the current tick, sequence number, active strokes, and enough game state to resume consistently.
- Define room capacity, disconnect timeout, host/owner behavior, and what happens when the room creator leaves before implementation.

## Proposed Implementation Phases

1. **Protocol and local seam:** define stroke/event types and convert completed pointer strokes to logical coordinates without changing single-player behavior.
2. **Room transport:** add a Durable Object room, WebSocket join/leave, validation, sequence assignment, and broadcast. Configure the DO binding and migrations in the Worker.
3. **Scheduled stroke activation:** add a fixed multiplayer tick, ping/pong measurements, apply-tick scheduling, duplicate-event handling, and a late-event policy. Keep local previews non-collidable until activation.
4. **Room recovery:** add snapshots, reconnect/resync behavior, room cleanup, and limits for payload size, point count, message rate, and room membership.
5. **Consistency decision:** test across devices and networks. If physics divergence is unacceptable, prototype an authoritative simulation and snapshot interpolation before expanding multiplayer features.

## Implemented Prototype

The current prototype streams visual previews while drawing and retains release-time collision activation:

- Pointer movement sends small, sequenced logical-coordinate preview batches at up to 20 updates per second. These are visual-only and never collidable. The Durable Object validates batch order and coordinates, then relays previews to peers without echoing them to the author. Cancelled previews are removed for everyone.
- On pointer release, the client sends the completed stroke, capped at 256 points. The Durable Object validates the payload, derives player identity from the socket, deduplicates recent event IDs, and assigns the room sequence, stage number, and future `applyAt` server timestamp. The accepted event replaces the matching live preview.
- Clients estimate clock offset and a rolling RTT percentile from ping/pong. The client requests a lead time based on that RTT; the server clamps it to 700-3000 ms and keeps `applyAt` ordered with room sequence.
- Every client displays the live stroke as it is drawn. On release, it keeps the accepted stroke visible as a non-collidable preview until creating its local physics body at `applyAt`. The author does not get an earlier collision than peers under normal delivery conditions.
- Ball launches are room actions too: the server deduplicates each player's event ID, assigns the shared room sequence and an `applyAt` after the last accepted stroke/launch, then broadcasts it. The event describes the launch action rather than device-specific impulse values, so each client applies its locally scaled equivalent at the same scheduled time.
- The host's selected difficulty and Challenge Mode setting are included with the room start and applied by every client for the whole stage. Stage completion is determined by the host and relayed once for the selected stage; participants use the host's event count for the completion score. Next-stage, retry (including the HUD button and R shortcut), and exit actions are host-controlled and broadcast as a room start/lobby transition, so guests cannot locally change stages or leave the shared game accidentally.
- While connected to a room, physics uses 1/60-second steps and retains elapsed-time debt instead of dropping time after a delayed animation frame. It processes at most eight catch-up steps per rendered frame, then drains any remaining debt over subsequent frames. Hidden-tab gameplay retains its multiplayer simulation timestamp; leaving/resetting the stage clears it.

This remains a cooperative prototype, not an authoritative simulation. Host-controlled stage completion avoids a participant advancing ahead when local physics diverges, but a host whose client is frozen may delay completion. Fixed-step catch-up avoids permanently losing simulation time after a short freeze, but a late client temporarily trails the room and independent Planck worlds can still diverge after collisions. It cannot guarantee that late forces are inserted at the exact historical point in a frozen client's physics timeline. To eliminate that remaining difference, make the host (or server) authoritative: periodically publish tick-stamped state snapshots for every dynamic body and accepted event sequence; clients detect a stale tick, stop trusting local physics, restore the latest snapshot, then replay buffered room actions or interpolate to the next snapshot. Host loss/freeze requires authority handoff or a server simulation. Do not claim exact resynchronization until this snapshot/replay path and deterministic body identity are implemented and tested.

## Validation Plan

- Unit-test logical coordinate conversion at different viewport sizes.
- Unit-test event ordering, duplicate IDs, apply-tick selection, and late-message handling.
- Test two browser clients in one local room: strokes render in the same order and become collidable on the assigned tick.
- Test slow/jittery connections, packet delay, disconnect/reconnect, and room-owner departure.
- Compare physics state after simultaneous and near-simultaneous collisions on different devices. Record divergence; do not infer deterministic physics from matching stroke rendering.
- Enforce server-side limits and validate every client-provided room/event field. Never trust client-supplied player identity, sequence number, or apply tick.

## Open Decisions

- Is a stroke allowed to affect the ball only after the pointer is released, or must it affect physics during drawing?
- Is slight physics divergence acceptable for cooperative play, or must every player see the same outcome?
- Should rooms be invite-code-only, public, or tied to authenticated accounts?
- What player and stroke limits are appropriate for the first release?