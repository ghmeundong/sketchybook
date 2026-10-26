import { describe, expect, it } from "vitest";
import backend, { MultiplayerRoom } from "../backend/src/index.js";

describe("backend CORS handling", () => {
  it("allows the Authorization header on progress preflight requests", async () => {
    const request = new Request("http://example.com/api/progress", {
      method: "OPTIONS",
    });

    const response = await backend.fetch(request, {});

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-headers") || "").toContain("Authorization");
  });

  it("rejects malformed room codes before accessing the room namespace", async () => {
    const request = new Request("http://example.com/api/rooms/invalid", {
      headers: { Upgrade: "websocket" },
    });

    const response = await backend.fetch(request, {});

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid room code." });
  });

  it("requires a WebSocket upgrade to join a valid room", async () => {
    const request = new Request("http://example.com/api/rooms/ABC234");
    const namespace = {
      getByName: () => ({
        fetch: () => {
          throw new Error("Room namespace should not be accessed without an upgrade.");
        },
      }),
    };

    const response = await backend.fetch(request, { MULTIPLAYER_ROOMS: namespace });

    expect(response.status).toBe(426);
    await expect(response.json()).resolves.toEqual({ error: "WebSocket upgrade required." });
  });

  it("returns room status for the join preflight", async () => {
    const namespace = {
      getByName: (name) => ({
        fetch: async (url) => {
          expect(name).toBe("ABC234");
          expect(url).toBe("https://room.internal/status");
          return Response.json({ status: "started" });
        },
      }),
    };
    const response = await backend.fetch(
      new Request("http://example.com/api/rooms/ABC234/status"),
      { MULTIPLAYER_ROOMS: namespace }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    await expect(response.json()).resolves.toEqual({ status: "started" });
  });

  it("reports status only for an existing room", async () => {
    const room = new MultiplayerRoom({
      storage: createTestStorage({ createdAt: Date.now(), status: "waiting" }),
      getWebSockets: () => [],
    });

    const response = await room.fetch(new Request("https://room.internal/status"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "waiting" });
  });

  it("creates a room and returns a valid share code", async () => {
    const request = new Request("http://example.com/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create" }),
    });
    const namespace = {
      getByName: (name) => ({
        fetch: async () => {
          expect(name).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
          return Response.json({ hostToken: "host-token" }, { status: 201 });
        },
      }),
    };

    const response = await backend.fetch(request, { MULTIPLAYER_ROOMS: namespace });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      roomCode: expect.stringMatching(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/),
      hostToken: "host-token",
    });
  });

  it("lets only the host select a stage and start the room", async () => {
    const host = createTestSocket({ isHost: true, playerId: "host" });
    const guest = createTestSocket({ isHost: false, playerId: "guest" });
    const storage = createTestStorage({ selectedStage: 1, status: "waiting" });
    const room = new MultiplayerRoom({ storage, getWebSockets: () => [host, guest] });

    await room.webSocketMessage(guest, JSON.stringify({ type: "select-stage", stageNumber: 8 }));
    expect(storage.values.get("selectedStage")).toBe(1);
    expect(guest.sent.at(-1)).toMatchObject({ type: "error" });

    await room.webSocketMessage(host, JSON.stringify({ type: "select-stage", stageNumber: 8 }));
    expect(storage.values.get("selectedStage")).toBe(8);
    expect(host.sent.at(-1)).toMatchObject({ type: "room-state", selectedStage: 8 });

    await room.webSocketMessage(
      host,
      JSON.stringify({
        type: "start-game",
        stageNumber: 8,
        difficulty: "hard",
        challengeModeEnabled: true,
      })
    );
    expect(storage.values.get("status")).toBe("started");
    expect(storage.values.get("selectedDifficulty")).toBe("hard");
    expect(storage.values.get("challengeModeEnabled")).toBe(true);
    expect(host.sent.at(-1)).toMatchObject({
      type: "room-start",
      stageNumber: 8,
      difficulty: "hard",
      challengeModeEnabled: true,
    });
    expect(guest.sent.at(-1)).toMatchObject({ type: "room-start", stageNumber: 8 });
  });

  it("rejects a start request with an invalid stage", async () => {
    const host = createTestSocket({ isHost: true });
    const storage = createTestStorage({ selectedStage: 1, status: "waiting" });
    const room = new MultiplayerRoom({ storage, getWebSockets: () => [host] });

    await room.webSocketMessage(host, JSON.stringify({ type: "start-game", stageNumber: 0 }));

    expect(storage.values.get("status")).toBe("waiting");
    expect(host.sent.at(-1)).toMatchObject({ type: "error" });
  });

  it("starts the next stage for everyone when the host advances", async () => {
    const host = createTestSocket({ isHost: true, playerId: "host" });
    const guest = createTestSocket({ isHost: false, playerId: "guest" });
    const storage = createTestStorage({
      status: "started",
      selectedStage: 4,
      selectedDifficulty: "insane",
      challengeModeEnabled: true,
      startedAt: 0,
    });
    const room = new MultiplayerRoom({ storage, getWebSockets: () => [host, guest] });

    await room.webSocketMessage(host, JSON.stringify({ type: "next-stage", stageNumber: 5 }));

    expect(storage.values.get("selectedStage")).toBe(5);
    expect(host.sent.at(-1)).toMatchObject({
      type: "room-start",
      stageNumber: 5,
      difficulty: "insane",
      challengeModeEnabled: true,
    });
    expect(guest.sent.at(-1)).toEqual(host.sent.at(-1));
    expect(host.sent.at(-1).startAt - host.sent.at(-1).serverTime).toBe(2500);
  });

  it("allows only the host to retry the current stage and rejects duplicate transitions", async () => {
    const host = createTestSocket({ isHost: true, playerId: "host" });
    const guest = createTestSocket({ isHost: false, playerId: "guest" });
    const storage = createTestStorage({ status: "started", selectedStage: 4, startedAt: 0 });
    const room = new MultiplayerRoom({ storage, getWebSockets: () => [host, guest] });

    await room.webSocketMessage(guest, JSON.stringify({ type: "retry-stage", stageNumber: 4 }));
    expect(guest.sent.at(-1)).toMatchObject({ type: "error" });
    expect(host.sent).toHaveLength(0);

    await room.webSocketMessage(host, JSON.stringify({ type: "retry-stage", stageNumber: 4 }));
    const acceptedRetry = host.sent.at(-1);
    expect(acceptedRetry).toMatchObject({ type: "room-start", stageNumber: 4 });

    await room.webSocketMessage(host, JSON.stringify({ type: "next-stage", stageNumber: 5 }));
    expect(host.sent.at(-1)).toMatchObject({
      type: "error",
      message: "A stage transition is already pending.",
    });
    expect(guest.sent.at(-1)).toEqual(acceptedRetry);
  });

  it("broadcasts a host-validated stage clear once to every room member", async () => {
    const host = createTestSocket({ isHost: true, playerId: "host" });
    const guest = createTestSocket({ isHost: false, playerId: "guest" });
    const storage = createTestStorage({ status: "started", selectedStage: 4, startedAt: 0 });
    const room = new MultiplayerRoom({ storage, getWebSockets: () => [host, guest] });
    const stageClear = {
      type: "stage-clear",
      stageNumber: 4,
      stageEventCount: 6,
    };

    await room.webSocketMessage(guest, JSON.stringify(stageClear));
    expect(guest.sent.at(-1)).toMatchObject({ type: "error" });
    expect(host.sent).toHaveLength(0);

    await room.webSocketMessage(host, JSON.stringify(stageClear));
    expect(host.sent.at(-1)).toEqual(stageClear);
    expect(guest.sent.at(-1)).toEqual(stageClear);
    expect(guest.sent.filter((message) => message.type === "stage-clear")).toHaveLength(1);

    await room.webSocketMessage(host, JSON.stringify(stageClear));
    expect(host.sent).toHaveLength(1);
    expect(guest.sent.filter((message) => message.type === "stage-clear")).toHaveLength(1);
  });

  it("rejects gameplay messages while a stage transition is waiting to start", async () => {
    const guest = createTestSocket({ isHost: false, playerId: "guest" });
    const storage = createTestStorage({
      status: "started",
      selectedStage: 5,
      startedAt: Date.now() + 5000,
    });
    const room = new MultiplayerRoom({ storage, getWebSockets: () => [guest] });

    await room.webSocketMessage(
      guest,
      JSON.stringify({
        type: "stroke",
        eventId: "deadbeef-0006",
        points: [
          { x: 100, y: 120 },
          { x: 240, y: 280 },
        ],
        width: 8,
        color: "#4f3b24",
      })
    );

    expect(guest.sent.at(-1)).toMatchObject({
      type: "error",
      message: "The room is not ready for gameplay.",
    });
  });

  it("accepts player strokes with server-assigned order and activation time", async () => {
    const host = createTestSocket({ isHost: true, playerId: "host", name: "Host" });
    const guest = createTestSocket({ isHost: false, playerId: "guest", name: "Guest" });
    const storage = createTestStorage({ status: "started", selectedStage: 4 });
    const room = new MultiplayerRoom({ storage, getWebSockets: () => [host, guest] });

    await room.webSocketMessage(
      guest,
      JSON.stringify({
        type: "stroke",
        eventId: "deadbeef-0001",
        roomSequence: 900,
        applyAt: 1,
        playerId: "spoofed-player",
        points: [
          { x: 100, y: 120 },
          { x: 240, y: 280 },
        ],
        width: 8,
        color: "#4f3b24",
        leadTimeMs: 700,
      })
    );

    const acceptedStroke = host.sent.at(-1);
    expect(acceptedStroke).toMatchObject({
      type: "stroke",
      eventId: "deadbeef-0001",
      roomSequence: 1,
      stageNumber: 4,
      playerId: "guest",
      playerName: "Guest",
    });
    expect(acceptedStroke.applyAt - acceptedStroke.serverTime).toBeGreaterThanOrEqual(700);
    expect(guest.sent.at(-1)).toEqual(acceptedStroke);
  });

  it("deduplicates stroke event IDs and rejects invalid logical coordinates", async () => {
    const host = createTestSocket({ isHost: true, playerId: "host" });
    const guest = createTestSocket({ isHost: false, playerId: "guest" });
    const storage = createTestStorage({ status: "started", selectedStage: 2 });
    const room = new MultiplayerRoom({ storage, getWebSockets: () => [host, guest] });
    const stroke = {
      type: "stroke",
      eventId: "deadbeef-0002",
      points: [
        { x: 10, y: 20 },
        { x: 40, y: 50 },
      ],
      width: 8,
      color: "#4f3b24",
    };

    await room.webSocketMessage(guest, JSON.stringify(stroke));
    await room.webSocketMessage(guest, JSON.stringify(stroke));
    expect(host.sent.filter((message) => message.type === "stroke")).toHaveLength(1);
    expect(guest.sent.at(-1)).toMatchObject({ type: "stroke-duplicate", eventId: "deadbeef-0002" });

    await room.webSocketMessage(
      guest,
      JSON.stringify({
        ...stroke,
        eventId: "deadbeef-0003",
        points: [
          { x: 1601, y: 20 },
          { x: 40, y: 50 },
        ],
      })
    );
    expect(host.sent.filter((message) => message.type === "stroke")).toHaveLength(1);
    expect(guest.sent.at(-1)).toMatchObject({ type: "error", message: "Invalid stroke." });
  });

  it("broadcasts deduplicated ball launches in the same room action order as strokes", async () => {
    const host = createTestSocket({ isHost: true, playerId: "host", name: "Host" });
    const guest = createTestSocket({ isHost: false, playerId: "guest", name: "Guest" });
    const storage = createTestStorage({
      status: "started",
      selectedStage: 4,
      roomSequence: 3,
      lastRoomActionApplyAt: Date.now() + 900,
    });
    const previousApplyAt = storage.values.get("lastRoomActionApplyAt");
    const room = new MultiplayerRoom({ storage, getWebSockets: () => [host, guest] });
    const launch = {
      type: "ball-launch",
      eventId: "deadbeef-0005",
      leadTimeMs: 700,
    };

    await room.webSocketMessage(guest, JSON.stringify(launch));
    const acceptedLaunch = host.sent.at(-1);
    expect(acceptedLaunch).toMatchObject({
      type: "ball-launch",
      eventId: launch.eventId,
      roomSequence: 4,
      stageNumber: 4,
      playerId: "guest",
      playerName: "Guest",
    });
    expect(acceptedLaunch.applyAt).toBeGreaterThan(previousApplyAt);
    expect(acceptedLaunch.applyAt - acceptedLaunch.serverTime).toBeGreaterThanOrEqual(700);
    expect(guest.sent.at(-1)).toEqual(acceptedLaunch);

    await room.webSocketMessage(guest, JSON.stringify(launch));
    expect(host.sent.filter((message) => message.type === "ball-launch")).toHaveLength(1);
    expect(guest.sent.at(-1)).toMatchObject({
      type: "ball-launch-duplicate",
      eventId: launch.eventId,
    });
  });

  it("relays ordered live stroke previews to peers and broadcasts cancellation", async () => {
    const host = createTestSocket({ isHost: true, playerId: "host" });
    const guest = createTestSocket({ isHost: false, playerId: "guest" });
    const storage = createTestStorage({ status: "started", previewSequences: {} });
    const room = new MultiplayerRoom({ storage, getWebSockets: () => [host, guest] });
    const preview = {
      type: "stroke-preview",
      strokeId: "deadbeef-0004",
      sequence: 0,
      points: [
        { x: 100, y: 110 },
        { x: 130, y: 140 },
      ],
    };

    await room.webSocketMessage(guest, JSON.stringify(preview));
    expect(host.sent.at(-1)).toMatchObject({
      type: "stroke-preview",
      strokeId: preview.strokeId,
      sequence: 0,
      playerId: "guest",
      points: preview.points,
    });
    expect(guest.sent).toHaveLength(0);

    await room.webSocketMessage(guest, JSON.stringify({ ...preview, sequence: 2 }));
    expect(guest.sent.at(-1)).toMatchObject({
      type: "error",
      message: "Out-of-order stroke preview.",
    });

    await room.webSocketMessage(
      guest,
      JSON.stringify({ type: "stroke-preview-cancel", strokeId: preview.strokeId })
    );
    expect(host.sent.at(-1)).toMatchObject({
      type: "stroke-preview-end",
      strokeId: preview.strokeId,
      playerId: "guest",
    });
    expect(storage.values.get("previewSequences")).toEqual({});
  });

  it("returns a started room to the lobby so the host can start another stage", async () => {
    const host = createTestSocket({ isHost: true, playerId: "host" });
    const guest = createTestSocket({ isHost: false, playerId: "guest" });
    const storage = createTestStorage({
      selectedStage: 5,
      status: "started",
      startedAt: 12345,
    });
    const room = new MultiplayerRoom({ storage, getWebSockets: () => [host, guest] });

    await room.webSocketMessage(host, JSON.stringify({ type: "return-to-lobby" }));

    expect(storage.values.get("status")).toBe("waiting");
    expect(storage.values.has("startedAt")).toBe(false);
    expect(host.sent.at(-1)).toMatchObject({ type: "room-lobby" });
    expect(guest.sent.at(-1)).toMatchObject({ type: "room-lobby" });

    await room.webSocketMessage(host, JSON.stringify({ type: "start-game", stageNumber: 2 }));
    expect(storage.values.get("status")).toBe("started");
    expect(storage.values.get("selectedStage")).toBe(2);
    expect(host.sent.at(-1)).toMatchObject({ type: "room-start", stageNumber: 2 });
    expect(guest.sent.at(-1)).toMatchObject({ type: "room-start", stageNumber: 2 });
  });

  it("rejects invalid stage numbers and prevents stage changes after start", async () => {
    const host = createTestSocket({ isHost: true });
    const storage = createTestStorage({ selectedStage: 1, status: "waiting" });
    const room = new MultiplayerRoom({ storage, getWebSockets: () => [host] });

    await room.webSocketMessage(host, JSON.stringify({ type: "select-stage", stageNumber: 19 }));
    expect(storage.values.get("selectedStage")).toBe(1);
    expect(host.sent.at(-1)).toMatchObject({ type: "error" });

    storage.values.set("status", "started");
    await room.webSocketMessage(host, JSON.stringify({ type: "select-stage", stageNumber: 4 }));
    expect(storage.values.get("selectedStage")).toBe(1);
    expect(host.sent.at(-1)).toMatchObject({ type: "error" });
  });
});

function createTestSocket(attachment) {
  return {
    sent: [],
    deserializeAttachment: () => attachment,
    send(message) {
      this.sent.push(JSON.parse(message));
    },
    close() {},
  };
}

function createTestStorage(initialValues = {}) {
  return {
    values: new Map(Object.entries(initialValues)),
    async get(key) {
      return this.values.get(key);
    },
    async put(key, value) {
      this.values.set(key, value);
    },
    async delete(key) {
      return this.values.delete(key);
    },
  };
}
