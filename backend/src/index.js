const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

const ROOM_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const ROOM_CODE_LENGTH = 6;
const MAX_ROOM_PLAYERS = 4;
const MAX_PLAYER_NAME_LENGTH = 20;
const MAX_STROKE_POINTS = 256;
const MIN_STROKE_LEAD_MS = 700;
const MAX_STROKE_LEAD_MS = 3000;

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

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const roomCode = createRoomCode();
      const room = env.MULTIPLAYER_ROOMS.getByName(roomCode);
      const response = await room.fetch("https://room.internal/create", { method: "POST" });
      if (response.status === 201) {
        const { hostToken } = await response.json();
        return jsonResponse({ ok: true, roomCode, hostToken });
      }
      if (response.status !== 409) break;
    }
    return errorResponse("Could not create room. Please try again.", 503);
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
    if (request.method === "POST" && url.pathname === "/create") {
      const existing = await this.state.storage.get("createdAt");
      if (existing) return new Response("Room already exists", { status: 409 });
      const hostToken = crypto.randomUUID();
      await this.state.storage.put("createdAt", Date.now());
      await this.state.storage.put("hostToken", hostToken);
      await this.state.storage.delete("selectedStage");
      await this.state.storage.put("status", "waiting");
      await this.state.storage.put("roomSequence", 0);
      await this.state.storage.put("recentStrokeEvents", []);
      await this.state.storage.put("lastStrokeApplyAt", 0);
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
    if (payload?.type === "stroke-preview") {
      await this.handleStrokePreview(socket, player, payload);
      return;
    }

    if (payload?.type === "stroke-preview-cancel") {
      await this.handleStrokePreviewCancel(player, payload);
      return;
    }

    if (payload?.type === "stroke") {
      await this.handleStrokeMessage(socket, player, payload);
      return;
    }

    if (!player?.isHost) {
      socket.send(JSON.stringify({ type: "error", message: "Only the host can do that." }));
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

    if (payload?.type === "start-game") {
      const stageNumber = payload.stageNumber;
      if (!Number.isInteger(stageNumber) || stageNumber < 1 || stageNumber > 18) {
        socket.send(JSON.stringify({ type: "error", message: "Select a valid stage first." }));
        return;
      }
      await this.state.storage.put("selectedStage", stageNumber);
      const startAt = Date.now() + 2500;
      await this.state.storage.put("roomSequence", 0);
      await this.state.storage.put("recentStrokeEvents", []);
      await this.state.storage.put("lastStrokeApplyAt", 0);
      await this.state.storage.put("previewSequences", {});
      await this.state.storage.put("status", "started");
      await this.state.storage.put("startedAt", startAt);
      this.broadcast({
        type: "room-start",
        stageNumber,
        startAt,
        serverTime: Date.now(),
        players: this.getPlayers(),
      });
      return;
    }

    socket.send(JSON.stringify({ type: "error", message: "Unsupported message type." }));
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
    const previousApplyAt = (await this.state.storage.get("lastStrokeApplyAt")) || 0;
    const applyAt = Math.max(now + leadTimeMs, previousApplyAt + 1);
    const roomSequence = ((await this.state.storage.get("roomSequence")) || 0) + 1;

    await this.state.storage.put("roomSequence", roomSequence);
    await this.state.storage.put("lastStrokeApplyAt", applyAt);
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

async function handleRequest(request, env) {
  const url = new URL(request.url);

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
