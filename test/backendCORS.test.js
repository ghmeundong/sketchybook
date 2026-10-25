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

    await room.webSocketMessage(host, JSON.stringify({ type: "start-game", stageNumber: 8 }));
    expect(storage.values.get("status")).toBe("started");
    expect(host.sent.at(-1)).toMatchObject({ type: "room-start", stageNumber: 8 });
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
