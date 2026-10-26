const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

const ROOM_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const ROOM_CODE_LENGTH = 6;
const MAX_ROOM_PLAYERS = 4;
const ROOM_SOCKET_OPEN = 1;
const MAX_PLAYER_NAME_LENGTH = 20;
const MAX_STROKE_POINTS = 256;
const MIN_STROKE_LEAD_MS = 150;
const MAX_STROKE_LEAD_MS = 1000;
const MAX_SHARED_MAP_BYTES = 64 * 1024;
const MAX_SHARED_MAP_OBJECTS = 100;
const ROOM_START_DELAY_MS = 500;
const VALID_DIFFICULTIES = new Set(["easy", "normal", "hard", "insane"]);

function createRoomCode(randomBytes = crypto.getRandomValues(new Uint8Array(ROOM_CODE_LENGTH))) {
  return Array.from(
    randomBytes,
    (byte) => ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length]
  ).join("");
}

function normalizeRoomCode(value) {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`).test(code) ? code : null;
}

function normalizePlayerName(value) {
  if (typeof value !== "string") return "Player";
  const name = value
    .replace(/[<>\p{Cc}]/gu, "")
    .trim()
    .slice(0, MAX_PLAYER_NAME_LENGTH);
  return name || "Player";
}

async function handleRoomRequest(request, env) {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);

  if (parts.length === 2 && parts[1] === "rooms" && request.method === "POST") {
    const body = await request.json().catch(() => null);
    if (body?.action !== "create") return errorResponse("Unsupported room action.", 400);
    const difficulty = body.difficulty ?? "normal";
    if (
      !VALID_DIFFICULTIES.has(difficulty) ||
      (body.challengeModeEnabled != null && typeof body.challengeModeEnabled !== "boolean")
    ) {
      return errorResponse("Invalid room game mode.", 400);
    }
    const challengeModeEnabled =
      difficulty === "insane" || (difficulty === "hard" && Boolean(body.challengeModeEnabled));

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const roomCode = createRoomCode();
      const room = env.MULTIPLAYER_ROOMS.getByName(roomCode);
      const response = await room.fetch("https://room.internal/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ difficulty, challengeModeEnabled }),
      });
      if (response.status === 201) {
        const { hostToken } = await response.json();
        return jsonResponse({ ok: true, roomCode, hostToken });
      }
      if (response.status !== 409) break;
    }
    return errorResponse("Could not create room. Please try again.", 503);
  }

  if (
    parts.length === 4 &&
    parts[1] === "rooms" &&
    parts[3] === "status" &&
    request.method === "GET"
  ) {
    const roomCode = normalizeRoomCode(parts[2]);
    if (!roomCode) return errorResponse("Invalid room code.", 400);
    const room = env.MULTIPLAYER_ROOMS.getByName(roomCode);
    const response = await room.fetch("https://room.internal/status");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        ...Object.fromEntries(response.headers),
        ...CORS_HEADERS,
      },
    });
  }

  if (parts.length === 3 && parts[1] === "rooms" && request.method === "GET") {
    const roomCode = normalizeRoomCode(parts[2]);
    if (!roomCode) return errorResponse("Invalid room code.", 400);
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return errorResponse("WebSocket upgrade required.", 426);
    }
    const room = env.MULTIPLAYER_ROOMS.getByName(roomCode);
    return room.fetch(request);
  }

  return errorResponse("Room endpoint not found.", 404);
}

export class MultiplayerRoom {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/status") {
      const status = await this.state.storage.get("status");
      if (!(await this.state.storage.get("createdAt"))) {
        return Response.json({ error: "Room not found." }, { status: 404 });
      }
      return Response.json({ status });
    }

    if (request.method === "POST" && url.pathname === "/create") {
      const existing = await this.state.storage.get("createdAt");
      if (existing) return new Response("Room already exists", { status: 409 });
      const body = await request.json().catch(() => null);
      const difficulty = VALID_DIFFICULTIES.has(body?.difficulty) ? body.difficulty : "normal";
      const challengeModeEnabled =
        difficulty === "insane" || (difficulty === "hard" && body?.challengeModeEnabled === true);
      const hostToken = crypto.randomUUID();
      await this.state.storage.put("createdAt", Date.now());
      await this.state.storage.put("hostToken", hostToken);
      await this.state.storage.delete("selectedStage");
      await this.state.storage.put("selectedDifficulty", difficulty);
      await this.state.storage.put("challengeModeEnabled", challengeModeEnabled);
      await this.state.storage.put("status", "waiting");
      await this.state.storage.put("roomSequence", 0);
      await this.state.storage.put("recentStrokeEvents", []);
      await this.state.storage.put("lastStrokeApplyAt", 0);
      await this.state.storage.put("lastRoomActionApplyAt", 0);
      await this.state.storage.put("recentBallLaunchEvents", []);
      await this.state.storage.delete("stageClearStage");
      await this.state.storage.put("previewSequences", {});
      await this.state.storage.setAlarm(Date.now() + 2 * 60 * 60 * 1000);
      return Response.json({ hostToken }, { status: 201 });
    }

    if (request.method !== "GET" || request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket upgrade required", { status: 426 });
    }
    if (!(await this.state.storage.get("createdAt"))) {
      return new Response("Room not found", { status: 404 });
    }
    if ((await this.state.storage.get("status")) !== "waiting") {
      return new Response("Room has already started", { status: 409 });
    }

    const sockets = this.state.getWebSockets();
    if (sockets.length >= MAX_ROOM_PLAYERS) {
      return new Response("Room is full", { status: 409 });
    }

    const isHost = url.searchParams.get("host") === (await this.state.storage.get("hostToken"));
    if (isHost && sockets.some((socket) => socket.deserializeAttachment()?.isHost)) {
      return new Response("Host is already connected", { status: 409 });
    }

    const pair = new globalThis.WebSocketPair();
    const [client, server] = Object.values(pair);
    const player = {
      playerId: crypto.randomUUID(),
      name: normalizePlayerName(url.searchParams.get("name")),
      isHost,
    };
    this.state.acceptWebSocket(server);
    server.serializeAttachment(player);
    await this.state.storage.setAlarm(Date.now() + 2 * 60 * 60 * 1000);
    await this.sendRoomState(server, player.playerId);
    await this.broadcastRoomState();

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket, message) {
    if (typeof message !== "string" || message.length > 32768) {
      socket.close(1009, "Message too large");
      return;
    }

    let payload;
    try {
      payload = JSON.parse(message);
    } catch {
      socket.send(JSON.stringify({ type: "error", message: "Invalid message." }));
      return;
    }

    if (payload?.type === "ping") {
      socket.send(
        JSON.stringify({
          type: "pong",
          clientTime: Number(payload.clientTime) || null,
          serverTime: Date.now(),
        })
      );
      return;
    }

    const player = socket.deserializeAttachment();
    if (payload?.type === "stage-clear") {
      if (!player?.isHost) {
        socket.send(
          JSON.stringify({ type: "error", message: "Only the host can clear the stage." })
        );
        return;
      }
      if (
        !(await this.isGameplayReady()) ||
        !Number.isInteger(payload.stageNumber) ||
        payload.stageNumber !== (await this.state.storage.get("selectedStage")) ||
        !Number.isInteger(payload.stageEventCount) ||
        payload.stageEventCount < 0 ||
        payload.stageEventCount > 100000
      ) {
        socket.send(JSON.stringify({ type: "error", message: "Invalid stage clear." }));
        return;
      }
      if ((await this.state.storage.get("stageClearStage")) === payload.stageNumber) return;
      await this.state.storage.put("stageClearStage", payload.stageNumber);
      this.broadcast({
        type: "stage-clear",
        stageNumber: payload.stageNumber,
        stageEventCount: payload.stageEventCount,
      });
      return;
    }

    if (payload?.type === "stroke-preview") {
      if (!(await this.isGameplayReady())) {
        socket.send(
          JSON.stringify({ type: "error", message: "The room is not ready for gameplay." })
        );
        return;
      }
      await this.handleStrokePreview(socket, player, payload);
      return;
    }

    if (payload?.type === "stroke-preview-cancel") {
      await this.handleStrokePreviewCancel(player, payload);
      return;
    }

    if (payload?.type === "stroke") {
      if (!(await this.isGameplayReady())) {
        socket.send(
          JSON.stringify({ type: "error", message: "The room is not ready for gameplay." })
        );
        return;
      }
      await this.handleStrokeMessage(socket, player, payload);
      return;
    }

    if (payload?.type === "ball-launch") {
      if (!(await this.isGameplayReady())) {
        socket.send(
          JSON.stringify({ type: "error", message: "The room is not ready for gameplay." })
        );
        return;
      }
      await this.handleBallLaunchMessage(socket, player, payload);
      return;
    }

    if (!player?.isHost) {
      socket.send(JSON.stringify({ type: "error", message: "Only the host can do that." }));
      return;
    }

    if (payload?.type === "next-stage" || payload?.type === "retry-stage") {
      if ((await this.state.storage.get("status")) !== "started") {
        socket.send(JSON.stringify({ type: "error", message: "The room is not in a game." }));
        return;
      }

      const now = Date.now();
      const pendingStartAt = (await this.state.storage.get("startedAt")) || 0;
      if (pendingStartAt > now) {
        socket.send(
          JSON.stringify({ type: "error", message: "A stage transition is already pending." })
        );
        return;
      }

      const currentStage = await this.state.storage.get("selectedStage");
      const requestedStage =
        payload.type === "next-stage" ? Math.min(currentStage + 1, 18) : currentStage;
      if (
        !Number.isInteger(currentStage) ||
        !Number.isInteger(payload.stageNumber) ||
        payload.stageNumber !== requestedStage
      ) {
        socket.send(JSON.stringify({ type: "error", message: "Invalid stage transition." }));
        return;
      }

      const startAt = now + ROOM_START_DELAY_MS;
      await this.state.storage.put("selectedStage", requestedStage);
      await this.state.storage.put("startedAt", startAt);
      await this.state.storage.put("roomSequence", 0);
      await this.state.storage.put("recentStrokeEvents", []);
      await this.state.storage.put("lastStrokeApplyAt", 0);
      await this.state.storage.put("lastRoomActionApplyAt", 0);
      await this.state.storage.put("recentBallLaunchEvents", []);
      await this.state.storage.delete("stageClearStage");
      await this.state.storage.put("previewSequences", {});
      this.broadcast({
        type: "room-start",
        stageNumber: requestedStage,
        startAt,
        serverTime: now,
        difficulty: await this.state.storage.get("selectedDifficulty"),
        challengeModeEnabled: await this.state.storage.get("challengeModeEnabled"),
        players: this.getPlayers(),
      });
      return;
    }

    if (payload?.type === "return-to-lobby") {
      if ((await this.state.storage.get("status")) !== "started") {
        socket.send(JSON.stringify({ type: "error", message: "The room is not in a game." }));
        return;
      }
      await this.state.storage.put("status", "waiting");
      await this.state.storage.delete("startedAt");
      await this.state.storage.delete("selectedStage");
      await this.state.storage.put("roomSequence", 0);
      await this.state.storage.put("recentStrokeEvents", []);
      await this.state.storage.put("lastStrokeApplyAt", 0);
      await this.state.storage.put("lastRoomActionApplyAt", 0);
      await this.state.storage.put("recentBallLaunchEvents", []);
      await this.state.storage.delete("stageClearStage");
      await this.state.storage.put("previewSequences", {});
      await this.broadcastRoomState();
      this.broadcast({ type: "room-lobby", serverTime: Date.now() });
      return;
    }

    if ((await this.state.storage.get("status")) !== "waiting") {
      socket.send(JSON.stringify({ type: "error", message: "The room has already started." }));
      return;
    }

    if (payload?.type === "select-stage") {
      const stageNumber = payload.stageNumber;
      if (!Number.isInteger(stageNumber) || stageNumber < 1 || stageNumber > 18) {
        socket.send(JSON.stringify({ type: "error", message: "Invalid stage selection." }));
        return;
      }
      await this.state.storage.put("selectedStage", stageNumber);
      await this.broadcastRoomState();
      return;
    }

    if (payload?.type === "select-difficulty") {
      if (
        !VALID_DIFFICULTIES.has(payload.difficulty) ||
        (payload.challengeModeEnabled != null && typeof payload.challengeModeEnabled !== "boolean")
      ) {
        socket.send(JSON.stringify({ type: "error", message: "Invalid room difficulty." }));
        return;
      }
      await this.state.storage.put("selectedDifficulty", payload.difficulty);
      await this.state.storage.put(
        "challengeModeEnabled",
        payload.difficulty === "insane" ||
          (payload.difficulty === "hard" && Boolean(payload.challengeModeEnabled))
      );
      await this.broadcastRoomState();
      return;
    }

    if (payload?.type === "start-game") {
      const stageNumber = payload.stageNumber;
      if (!Number.isInteger(stageNumber) || stageNumber < 1 || stageNumber > 18) {
        socket.send(JSON.stringify({ type: "error", message: "Select a valid stage first." }));
        return;
      }
      const storedDifficulty = await this.state.storage.get("selectedDifficulty");
      const difficulty = VALID_DIFFICULTIES.has(storedDifficulty)
        ? storedDifficulty
        : (payload.difficulty ?? "normal");
      const storedChallengeMode = await this.state.storage.get("challengeModeEnabled");
      if (
        !VALID_DIFFICULTIES.has(difficulty) ||
        (payload.challengeModeEnabled != null &&
          typeof payload.challengeModeEnabled !== "boolean") ||
        (storedChallengeMode != null && typeof storedChallengeMode !== "boolean")
      ) {
        socket.send(JSON.stringify({ type: "error", message: "Invalid room game mode." }));
        return;
      }
      const challengeModeEnabled =
        difficulty === "insane" ||
        (difficulty === "hard" && Boolean(storedChallengeMode ?? payload.challengeModeEnabled));
      await this.state.storage.put("selectedStage", stageNumber);
      await this.state.storage.put("selectedDifficulty", difficulty);
      await this.state.storage.put("challengeModeEnabled", challengeModeEnabled);
      const startAt = Date.now() + ROOM_START_DELAY_MS;
      await this.state.storage.put("roomSequence", 0);
      await this.state.storage.put("recentStrokeEvents", []);
      await this.state.storage.put("lastStrokeApplyAt", 0);
      await this.state.storage.put("lastRoomActionApplyAt", 0);
      await this.state.storage.put("recentBallLaunchEvents", []);
      await this.state.storage.delete("stageClearStage");
      await this.state.storage.put("previewSequences", {});
      await this.state.storage.put("status", "started");
      await this.state.storage.put("startedAt", startAt);
      this.broadcast({
        type: "room-start",
        stageNumber,
        startAt,
        serverTime: Date.now(),
        difficulty,
        challengeModeEnabled,
        players: this.getPlayers(),
      });
      return;
    }

    socket.send(JSON.stringify({ type: "error", message: "Unsupported message type." }));
  }

  async isGameplayReady() {
    return (
      (await this.state.storage.get("status")) === "started" &&
      ((await this.state.storage.get("startedAt")) || 0) <= Date.now()
    );
  }

  async handleStrokeMessage(socket, player, payload) {
    if (!player?.playerId || (await this.state.storage.get("status")) !== "started") {
      socket.send(JSON.stringify({ type: "error", message: "The room is not in a game." }));
      return;
    }

    const { eventId, points, width, color } = payload;
    const validStroke =
      typeof eventId === "string" &&
      /^[\da-f-]{8,64}$/i.test(eventId) &&
      Array.isArray(points) &&
      points.length >= 2 &&
      points.length <= MAX_STROKE_POINTS &&
      points.every(
        (point) =>
          point &&
          Number.isFinite(point.x) &&
          Number.isFinite(point.y) &&
          point.x >= 0 &&
          point.x <= 1600 &&
          point.y >= 0 &&
          point.y <= 900
      ) &&
      Number.isFinite(width) &&
      width >= 1 &&
      width <= 24 &&
      typeof color === "string" &&
      /^#[\da-f]{6}$/i.test(color);

    if (!validStroke) {
      socket.send(JSON.stringify({ type: "error", message: "Invalid stroke." }));
      return;
    }

    const eventKey = `${player.playerId}:${eventId}`;
    const recentEvents = (await this.state.storage.get("recentStrokeEvents")) || [];
    if (recentEvents.includes(eventKey)) {
      socket.send(JSON.stringify({ type: "stroke-duplicate", eventId }));
      return;
    }

    const now = Date.now();
    const requestedLead = Number.isFinite(payload.leadTimeMs) ? payload.leadTimeMs : 1000;
    const leadTimeMs = Math.min(MAX_STROKE_LEAD_MS, Math.max(MIN_STROKE_LEAD_MS, requestedLead));
    const previousApplyAt =
      (await this.state.storage.get("lastRoomActionApplyAt")) ||
      (await this.state.storage.get("lastStrokeApplyAt")) ||
      0;
    const applyAt = Math.max(now + leadTimeMs, previousApplyAt + 1);
    const roomSequence = ((await this.state.storage.get("roomSequence")) || 0) + 1;

    await this.state.storage.put("roomSequence", roomSequence);
    await this.state.storage.put("lastStrokeApplyAt", applyAt);
    await this.state.storage.put("lastRoomActionApplyAt", applyAt);
    await this.state.storage.put("recentStrokeEvents", [...recentEvents, eventKey].slice(-512));
    if (typeof payload.strokeId === "string") {
      const previewSequences = (await this.state.storage.get("previewSequences")) || {};
      delete previewSequences[`${player.playerId}:${payload.strokeId}`];
      await this.state.storage.put("previewSequences", previewSequences);
    }
    this.broadcast({
      type: "stroke",
      eventId,
      strokeId: typeof payload.strokeId === "string" ? payload.strokeId : null,
      roomSequence,
      applyAt,
      serverTime: now,
      stageNumber: await this.state.storage.get("selectedStage"),
      playerId: player.playerId,
      playerName: player.name,
      points,
      width,
      color,
    });
  }

  async handleBallLaunchMessage(socket, player, payload) {
    if (!player?.playerId || (await this.state.storage.get("status")) !== "started") {
      socket.send(JSON.stringify({ type: "error", message: "The room is not in a game." }));
      return;
    }

    const { eventId } = payload;
    if (typeof eventId !== "string" || !/^[\da-f-]{8,64}$/i.test(eventId)) {
      socket.send(JSON.stringify({ type: "error", message: "Invalid ball launch." }));
      return;
    }

    const eventKey = `${player.playerId}:${eventId}`;
    const recentEvents = (await this.state.storage.get("recentBallLaunchEvents")) || [];
    if (recentEvents.includes(eventKey)) {
      socket.send(JSON.stringify({ type: "ball-launch-duplicate", eventId }));
      return;
    }

    const now = Date.now();
    const requestedLead = Number.isFinite(payload.leadTimeMs) ? payload.leadTimeMs : 1000;
    const leadTimeMs = Math.min(MAX_STROKE_LEAD_MS, Math.max(MIN_STROKE_LEAD_MS, requestedLead));
    const previousApplyAt =
      (await this.state.storage.get("lastRoomActionApplyAt")) ||
      (await this.state.storage.get("lastStrokeApplyAt")) ||
      0;
    const applyAt = Math.max(now + leadTimeMs, previousApplyAt + 1);
    const roomSequence = ((await this.state.storage.get("roomSequence")) || 0) + 1;

    await this.state.storage.put("roomSequence", roomSequence);
    await this.state.storage.put("lastRoomActionApplyAt", applyAt);
    await this.state.storage.put("recentBallLaunchEvents", [...recentEvents, eventKey].slice(-512));
    this.broadcast({
      type: "ball-launch",
      eventId,
      roomSequence,
      applyAt,
      serverTime: now,
      stageNumber: await this.state.storage.get("selectedStage"),
      playerId: player.playerId,
      playerName: player.name,
    });
  }

  async handleStrokePreview(socket, player, payload) {
    if (!player?.playerId || (await this.state.storage.get("status")) !== "started") {
      socket.send(JSON.stringify({ type: "error", message: "The room is not in a game." }));
      return;
    }

    const { strokeId, sequence, points } = payload;
    const validPreview =
      typeof strokeId === "string" &&
      /^[\da-f-]{8,64}$/i.test(strokeId) &&
      Number.isInteger(sequence) &&
      sequence >= 0 &&
      Array.isArray(points) &&
      points.length >= 1 &&
      points.length <= 32 &&
      points.every(
        (point) =>
          point &&
          Number.isFinite(point.x) &&
          Number.isFinite(point.y) &&
          point.x >= 0 &&
          point.x <= 1600 &&
          point.y >= 0 &&
          point.y <= 900
      );

    if (!validPreview) {
      socket.send(JSON.stringify({ type: "error", message: "Invalid stroke preview." }));
      return;
    }

    const previewSequences = (await this.state.storage.get("previewSequences")) || {};
    const previewKey = `${player.playerId}:${strokeId}`;
    const previousSequence = previewSequences[previewKey] ?? -1;
    if (sequence !== previousSequence + 1) {
      socket.send(JSON.stringify({ type: "error", message: "Out-of-order stroke preview." }));
      return;
    }

    previewSequences[previewKey] = sequence;
    const activePreviewKeys = Object.keys(previewSequences);
    if (activePreviewKeys.length > 128) {
      for (const staleKey of activePreviewKeys.slice(0, activePreviewKeys.length - 128)) {
        delete previewSequences[staleKey];
      }
    }
    await this.state.storage.put("previewSequences", previewSequences);
    this.broadcast(
      {
        type: "stroke-preview",
        strokeId,
        sequence,
        playerId: player.playerId,
        points,
      },
      socket
    );
  }

  async handleStrokePreviewCancel(player, payload) {
    if (!player?.playerId || typeof payload.strokeId !== "string") return;

    const previewSequences = (await this.state.storage.get("previewSequences")) || {};
    const previewKey = `${player.playerId}:${payload.strokeId}`;
    if (!(previewKey in previewSequences)) return;

    delete previewSequences[previewKey];
    await this.state.storage.put("previewSequences", previewSequences);
    this.broadcast({
      type: "stroke-preview-end",
      strokeId: payload.strokeId,
      playerId: player.playerId,
    });
  }

  async webSocketClose(socket) {
    if (socket.deserializeAttachment()?.isHost) {
      if ((await this.state.storage.get("status")) === "started") return;
      await this.closeRoom("The host left the room.");
      return;
    }
    await this.broadcastRoomState();
  }

  async webSocketError(socket) {
    if (socket.deserializeAttachment()?.isHost) {
      if ((await this.state.storage.get("status")) === "started") return;
      await this.closeRoom("The host disconnected.");
      return;
    }
    await this.broadcastRoomState();
  }

  async alarm() {
    if (this.state.getWebSockets().length > 0) {
      await this.state.storage.setAlarm(Date.now() + 2 * 60 * 60 * 1000);
      return;
    }
    await this.state.storage.delete("createdAt");
  }

  getPlayers() {
    return this.state
      .getWebSockets()
      .filter((connection) => connection.readyState === ROOM_SOCKET_OPEN)
      .map((connection) => connection.deserializeAttachment())
      .filter(Boolean);
  }

  async sendRoomState(socket, selfPlayerId) {
    socket.send(
      JSON.stringify({
        type: "room-state",
        players: this.getPlayers(),
        selfPlayerId,
        selectedStage: await this.state.storage.get("selectedStage"),
        selectedDifficulty: (await this.state.storage.get("selectedDifficulty")) || "normal",
        challengeModeEnabled: Boolean(await this.state.storage.get("challengeModeEnabled")),
        status: await this.state.storage.get("status"),
        serverTime: Date.now(),
      })
    );
  }

  async broadcastRoomState() {
    this.broadcast({
      type: "room-state",
      players: this.getPlayers(),
      selectedStage: await this.state.storage.get("selectedStage"),
      selectedDifficulty: (await this.state.storage.get("selectedDifficulty")) || "normal",
      challengeModeEnabled: Boolean(await this.state.storage.get("challengeModeEnabled")),
      status: await this.state.storage.get("status"),
      serverTime: Date.now(),
    });
  }

  broadcast(payload, excludedSocket = null) {
    const message = JSON.stringify(payload);
    for (const socket of this.state.getWebSockets()) {
      if (socket === excludedSocket) continue;
      try {
        socket.send(message);
      } catch {
        socket.close(1011, "Could not update room state");
      }
    }
  }

  async closeRoom(reason) {
    await this.state.storage.put("status", "closed");
    this.broadcast({ type: "room-closed", reason });
    for (const socket of this.state.getWebSockets()) {
      socket.close(1000, reason);
    }
  }
}

// 스케치북 컨셉에 맞춘 인메모리 저장소
let sketchbookMemory = {
  imageData: null,
  vector: null,
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      ...CORS_HEADERS,
    },
  });
}

function errorResponse(message, status = 500) {
  return jsonResponse({ error: message }, status);
}

async function fetchSketchbook() {
  return sketchbookMemory;
}

async function saveSketchbook(payload) {
  if (payload.imageData && typeof payload.imageData === "string") {
    sketchbookMemory.imageData = payload.imageData;
  }
  if (Array.isArray(payload.vector)) {
    sketchbookMemory.vector = payload.vector;
  }
  return { ok: true };
}

// 1. 스케치 전용 핸들러 (env 매개변수 추가로 싱크 매칭)
async function handleSketchRequest(request, env) {
  if (request.method === "GET") {
    const book = await fetchSketchbook();
    return jsonResponse({ imageData: book.imageData, vector: book.vector });
  }

  if (request.method === "POST") {
    const body = await request.json().catch(() => null);
    if (!body || (typeof body.imageData !== "string" && !Array.isArray(body.vector))) {
      return errorResponse("Request body must include imageData string or vector array.", 400);
    }

    await saveSketchbook({ imageData: body.imageData, vector: body.vector });
    return jsonResponse({ ok: true });
  }

  return new Response(null, {
    status: 405,
    headers: CORS_HEADERS,
  });
}

function getBearerToken(request) {
  const authHeader = request.headers.get("Authorization") || request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7).trim();
}

// 2. 진행도 및 베스트 스코어 핸들러 (병합 최적화 로직 포함)
async function handleProgressRequest(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }

  const idToken = getBearerToken(request);
  if (!idToken) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let payload;
  try {
    payload = await verifyIdToken(idToken, env);
  } catch (error) {
    return jsonResponse({ error: "Invalid auth token." }, 401);
  }

  const userSub = payload.sub;
  if (!userSub) {
    return jsonResponse({ error: "Invalid token payload." }, 401);
  }

  const url = new URL(request.url);
  const rawMode = (url.searchParams.get("mode") || "normal").trim().toLowerCase();
  const validModes = ["easy", "normal", "hard", "insane"];
  const mode = validModes.includes(rawMode) ? rawMode : "normal";

  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_sub TEXT,
      mode TEXT,
      progress INTEGER,
      scores TEXT,
      updated_at TEXT,
      UNIQUE(user_sub, mode)
    )`
  ).run();

  if (request.method === "GET") {
    const row = await env.DB.prepare(
      "SELECT progress, scores FROM progress WHERE user_sub = ? AND mode = ?"
    )
      .bind(userSub, mode)
      .first();

    return jsonResponse({
      ok: true,
      mode,
      progress: row?.progress ?? null,
      scores: row?.scores ? JSON.parse(row.scores) : {},
    });
  }

  if (request.method !== "POST") {
    return new Response(null, {
      status: 405,
      headers: CORS_HEADERS,
    });
  }

  const body = await request.json().catch(() => null);
  if (
    !body ||
    typeof body.progress !== "number" ||
    typeof body.scores !== "object" ||
    body.scores === null
  ) {
    return errorResponse("Request body must include progress number and scores object.", 400);
  }

  // 기존 DB 데이터 조회 및 베스트 스코어 비교 병합
  const existingRow = await env.DB.prepare(
    "SELECT progress, scores FROM progress WHERE user_sub = ? AND mode = ?"
  )
    .bind(userSub, mode)
    .first();

  let finalProgress = Math.min(18, Math.max(1, Math.floor(body.progress) || 1));
  let finalScores = body.scores || {};

  if (existingRow) {
    finalProgress = Math.max(finalProgress, existingRow.progress || 1);

    let existingScores = {};
    try {
      existingScores = JSON.parse(existingRow.scores || "{}");
    } catch (error) {
      console.error("[backend] JSON parse error:", error);
    }

    const allStageKeys = new Set([...Object.keys(existingScores), ...Object.keys(finalScores)]);
    const mergedScores = {};

    for (const stage of allStageKeys) {
      const oldScore = existingScores[stage];
      const newScore = finalScores[stage];

      if (oldScore !== undefined && newScore !== undefined) {
        mergedScores[stage] = Math.min(oldScore, newScore);
      } else {
        mergedScores[stage] = oldScore !== undefined ? oldScore : newScore;
      }
    }
    finalScores = mergedScores;
  }

  const scoresJson = JSON.stringify(finalScores);
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO progress (user_sub, mode, progress, scores, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_sub, mode) DO UPDATE SET
       progress = excluded.progress,
       scores = excluded.scores,
       updated_at = excluded.updated_at`
  )
    .bind(userSub, mode, finalProgress, scoresJson, now)
    .run();

  return jsonResponse({ ok: true, mode });
}

function validateSharedMap(map) {
  if (!map || typeof map !== "object" || Array.isArray(map)) return "Map data must be an object.";
  if (typeof map.name !== "string" || !map.name.trim() || map.name.length > 40) {
    return "Map name must be between 1 and 40 characters.";
  }
  if (!Array.isArray(map.objects) || map.objects.length > MAX_SHARED_MAP_OBJECTS) {
    return `Map must contain no more than ${MAX_SHARED_MAP_OBJECTS} objects.`;
  }
  const validTypes = new Set([
    "platform", "circle", "ball", "star", "stripedRect", "portal", "segment", "complex", "poly", "rotor", "text",
  ]);
  let hasBall = false;
  let hasStar = false;
  for (const [index, object] of map.objects.entries()) {
    if (!object || typeof object !== "object" || !validTypes.has(object.type)) {
      return `Object ${index + 1} has an unsupported type.`;
    }
    hasBall ||= object.type === "ball";
    hasStar ||= object.type === "star";
    const isNumber = (value) => typeof value === "number" && Number.isFinite(value);
    const hasNormalizedPosition = (x, y) => isNumber(x) && isNumber(y) && x >= 0 && x <= 1 && y >= 0 && y <= 1;
    if (object.type === "segment") {
      if (!hasNormalizedPosition(object.x1, object.y1) || !hasNormalizedPosition(object.x2, object.y2)) {
        return `Line ${index + 1} needs normalized endpoints.`;
      }
    } else if (["complex", "poly", "rotor"].includes(object.type)) {
      if (!Array.isArray(object.points) || object.points.length < 2 || object.points.length > 128 ||
        object.points.some((point) => !point || !hasNormalizedPosition(point.x, point.y))) {
        return `Shape ${index + 1} needs 2 to 128 normalized points.`;
      }
    } else if (!hasNormalizedPosition(object.x, object.y)) {
      return `Object ${index + 1} needs a normalized x and y position.`;
    }
    if (["platform", "stripedRect", "portal"].includes(object.type) &&
      (!isNumber(object.width) || object.width <= 0 || !isNumber(object.height) || object.height <= 0)) {
      return `Object ${index + 1} needs positive width and height values.`;
    }
    if (["ball", "circle", "star"].includes(object.type) && (!isNumber(object.radius) || object.radius <= 0)) {
      return `Object ${index + 1} needs a positive radius.`;
    }
    if (object.type === "text" && (typeof object.text !== "string" || object.text.length > 200)) {
      return `Text object ${index + 1} needs text with at most 200 characters.`;
    }
  }
  if (!hasBall || !hasStar) return "Shared maps need at least one ball and one star.";
  return null;
}

async function handleSharedMapsRequest(request, env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS shared_maps (
      id TEXT PRIMARY KEY,
      owner_sub TEXT NOT NULL,
      source_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      name TEXT NOT NULL,
      map_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(owner_sub, source_id)
    )`
  ).run();

  const url = new URL(request.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  if (request.method === "GET" && pathParts.length === 2) {
    const result = await env.DB.prepare(
      "SELECT id, name, author_name, map_json, created_at, updated_at FROM shared_maps ORDER BY updated_at DESC LIMIT 100"
    ).all();
    const maps = (result.results || []).map((row) => ({
      id: row.id,
      name: row.name,
      authorName: row.author_name,
      objects: JSON.parse(row.map_json).objects,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    return jsonResponse({ ok: true, maps });
  }

  if (request.method === "GET" && pathParts.length === 3) {
    const mapId = pathParts[2];
    if (!/^[\da-f-]{36}$/i.test(mapId)) return errorResponse("Invalid shared map ID.", 400);
    const row = await env.DB.prepare(
      "SELECT id, name, author_name, map_json, created_at FROM shared_maps WHERE id = ?"
    ).bind(mapId).first();
    if (!row) return errorResponse("Shared map not found.", 404);
    const map = JSON.parse(row.map_json);
    return jsonResponse({
      ok: true,
      map: { id: row.id, name: row.name, authorName: row.author_name, objects: map.objects, createdAt: row.created_at },
    });
  }

  if (request.method !== "POST" || pathParts.length !== 2) {
    return new Response(null, { status: 405, headers: CORS_HEADERS });
  }
  const idToken = getBearerToken(request);
  if (!idToken) return errorResponse("Sign in to share a map.", 401);
  let tokenPayload;
  try {
    tokenPayload = await verifyIdToken(idToken, env);
  } catch {
    return errorResponse("Invalid auth token.", 401);
  }
  if (!tokenPayload.sub) return errorResponse("Invalid token payload.", 401);

  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > MAX_SHARED_MAP_BYTES) return errorResponse("Map data is too large.", 413);
  const body = await request.json().catch(() => null);
  if (!body || typeof body.sourceId !== "string" || body.sourceId.length > 80) {
    return errorResponse("Request must include a valid sourceId.", 400);
  }
  const map = body.map;
  const validationError = validateSharedMap(map);
  if (validationError) return errorResponse(validationError, 400);
  const mapJson = JSON.stringify({ version: 1, name: map.name.trim(), objects: map.objects });
  if (new TextEncoder().encode(mapJson).byteLength > MAX_SHARED_MAP_BYTES) {
    return errorResponse("Map data is too large.", 413);
  }
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const authorName = String(tokenPayload.name || tokenPayload.email || "Sketchybook player")
    .replace(/[<>\p{Cc}]/gu, "")
    .slice(0, 40) || "Sketchybook player";
  await env.DB.prepare(
    `INSERT INTO shared_maps (id, owner_sub, source_id, author_name, name, map_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(owner_sub, source_id) DO UPDATE SET
       author_name = excluded.author_name,
       name = excluded.name,
       map_json = excluded.map_json,
       updated_at = excluded.updated_at`
  ).bind(id, tokenPayload.sub, body.sourceId, authorName, map.name.trim(), mapJson, now, now).run();
  const saved = await env.DB.prepare(
    "SELECT id, updated_at FROM shared_maps WHERE owner_sub = ? AND source_id = ?"
  ).bind(tokenPayload.sub, body.sourceId).first();
  return jsonResponse({ ok: true, id: saved.id, updatedAt: saved.updated_at });
}

async function handleAccountMapsRequest(request, env) {
  const idToken = getBearerToken(request);
  if (!idToken) return errorResponse("Sign in to save maps to your account.", 401);

  let tokenPayload;
  try {
    tokenPayload = await verifyIdToken(idToken, env);
  } catch {
    return errorResponse("Invalid auth token.", 401);
  }
  if (!tokenPayload.sub) return errorResponse("Invalid token payload.", 401);

  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS account_maps (
      owner_sub TEXT NOT NULL,
      source_id TEXT NOT NULL,
      name TEXT NOT NULL,
      map_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY(owner_sub, source_id)
    )`
  ).run();

  if (request.method === "GET") {
    const result = await env.DB.prepare(
      "SELECT source_id, name, map_json, updated_at FROM account_maps WHERE owner_sub = ? ORDER BY updated_at DESC"
    )
      .bind(tokenPayload.sub)
      .all();
    const maps = (result.results || []).map((row) => ({
      id: row.source_id,
      name: row.name,
      objects: JSON.parse(row.map_json).objects,
      updatedAt: row.updated_at,
    }));
    return jsonResponse({ ok: true, maps });
  }

  if (request.method !== "POST") {
    return new Response(null, { status: 405, headers: CORS_HEADERS });
  }

  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > MAX_SHARED_MAP_BYTES) return errorResponse("Map data is too large.", 413);
  const body = await request.json().catch(() => null);
  if (!body || typeof body.sourceId !== "string" || body.sourceId.length > 80) {
    return errorResponse("Request must include a valid map ID.", 400);
  }
  const validationError = validateSharedMap(body.map);
  if (validationError) return errorResponse(validationError, 400);

  const mapJson = JSON.stringify({
    version: 1,
    name: body.map.name.trim(),
    objects: body.map.objects,
  });
  if (new TextEncoder().encode(mapJson).byteLength > MAX_SHARED_MAP_BYTES) {
    return errorResponse("Map data is too large.", 413);
  }
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO account_maps (owner_sub, source_id, name, map_json, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(owner_sub, source_id) DO UPDATE SET
       name = excluded.name,
       map_json = excluded.map_json,
       updated_at = excluded.updated_at`
  )
    .bind(tokenPayload.sub, body.sourceId, body.map.name.trim(), mapJson, now)
    .run();
  return jsonResponse({ ok: true, id: body.sourceId, updatedAt: now });
}

async function handleRequest(request, env) {
  const url = new URL(request.url);

  if (url.pathname === "/api/user/maps") {
    try {
      return await handleAccountMapsRequest(request, env);
    } catch (error) {
      console.error("[backend] handleAccountMapsRequest error:", error);
      return errorResponse(error.message || "Failed to handle account maps.");
    }
  }

  if (url.pathname === "/api/maps" || url.pathname.startsWith("/api/maps/")) {
    try {
      return await handleSharedMapsRequest(request, env);
    } catch (error) {
      console.error("[backend] handleSharedMapsRequest error:", error);
      return errorResponse(error.message || "Failed to handle shared maps.");
    }
  }

  if (url.pathname === "/api/rooms" || url.pathname.startsWith("/api/rooms/")) {
    try {
      return await handleRoomRequest(request, env);
    } catch (error) {
      console.error("[backend] handleRoomRequest error:", error);
      return errorResponse(error.message || "Failed to handle room request.");
    }
  }

  if (url.pathname === "/api/health") {
    return jsonResponse({
      ok: true,
      scope: "sketchybook-api",
      timestamp: new Date().toISOString(),
    });
  }

  if (url.pathname === "/api/sketch") {
    try {
      return await handleSketchRequest(request, env);
    } catch (error) {
      console.error("[backend] handleSketchRequest error:", error);
      return errorResponse(error.message || "Failed to handle sketchybook request.");
    }
  }

  if (url.pathname === "/api/progress") {
    try {
      return await handleProgressRequest(request, env);
    } catch (error) {
      console.error("[backend] handleProgressRequest error:", error);
      return errorResponse(error.message || "Failed to handle progress request.");
    }
  }

  if (url.pathname === "/api/auth/google") {
    try {
      return await handleAuthRequest(request, env);
    } catch (error) {
      console.error("[backend] handleAuthRequest error:", error);
      return errorResponse(error.message || "Failed to handle auth request.");
    }
  }

  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      ...CORS_HEADERS,
    },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }
    return handleRequest(request, env);
  },
};

function getGoogleClientId(env) {
  return env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || null;
}

function getGoogleClientSecret(env) {
  return env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || null;
}

async function handleAuthRequest(request, env) {
  if (request.method !== "POST") {
    return new Response(null, { status: 405, headers: CORS_HEADERS });
  }

  const body = await request.json().catch(() => null);
  console.log("[backend] handleAuthRequest body:", body);
  if (!body || (typeof body.code !== "string" && typeof body.id_token !== "string")) {
    return errorResponse("Request body must include code or id_token string.", 400);
  }

  let idToken;
  if (typeof body.code === "string") {
    idToken = await exchangeCodeForIdToken(body.code, env);
  } else {
    idToken = body.id_token;
  }

  const payload = await verifyIdToken(idToken, env);
  const sub = payload.sub;
  const email = payload.email || null;
  const name = payload.name || null;

  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, sub TEXT UNIQUE, email TEXT, name TEXT)`
  ).run();

  const existing = await env.DB.prepare("SELECT id, sub, email, name FROM users WHERE sub = ?")
    .bind(sub)
    .all();
  let user;
  if (existing && existing.results && existing.results.length) {
    user = existing.results[0];
    if ((email && user.email !== email) || (name && user.name !== name)) {
      await env.DB.prepare("UPDATE users SET email = ?, name = ? WHERE sub = ?")
        .bind(email, name, sub)
        .run();
    }
  } else {
    const insert = await env.DB.prepare("INSERT INTO users (sub, email, name) VALUES (?, ?, ?)")
      .bind(sub, email, name)
      .run();
    const id = insert && insert.lastInsertRowId ? insert.lastInsertRowId : null;
    user = { id, sub, email, name };
  }

  return jsonResponse({ ok: true, user, id_token: idToken });
}

async function exchangeCodeForIdToken(code, env) {
  const clientId = getGoogleClientId(env);
  const clientSecret = getGoogleClientSecret(env);
  if (!clientId) {
    throw new Error("Missing GOOGLE_CLIENT_ID in backend environment.");
  }

  const tokenParams = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    redirect_uri: "postmessage",
  });
  if (clientSecret) {
    tokenParams.set("client_secret", clientSecret);
  }

  const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: tokenParams.toString(),
  });

  if (!tokenResp.ok) {
    const errorPayload = await tokenResp.text().catch(() => "");
    throw new Error(`Authorization code exchange failed: ${errorPayload}`);
  }

  const tokenData = await tokenResp.json();
  if (!tokenData.id_token) {
    throw new Error("Token exchange did not return an id_token.");
  }

  return tokenData.id_token;
}

async function verifyIdToken(idToken, env) {
  const tokenResp = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
  );
  if (!tokenResp.ok) {
    throw new Error("Invalid id_token.");
  }

  const payload = await tokenResp.json();
  const expectedAud = getGoogleClientId(env);
  if (expectedAud && payload.aud !== expectedAud) {
    throw new Error(`Token audience mismatch. Expected ${expectedAud}, got ${payload.aud}`);
  }

  return payload;
}
