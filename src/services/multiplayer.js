import { buildApiUrl } from "./api.js";

let activeSocket = null;
let serverClockOffset = 0;
const roundTripSamples = [];

function getRoomSocketUrl(roomCode, playerName) {
  const url = new URL(buildApiUrl(`/api/rooms/${encodeURIComponent(roomCode)}`));
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("name", playerName);
  return url.toString();
}

export async function createRoom() {
  let response;
  try {
    response = await fetch(buildApiUrl("/api/rooms"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create" }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    if (error.name === "TimeoutError") {
      throw new Error("Room creation timed out. Check the local multiplayer server.", {
        cause: error,
      });
    }
    throw error;
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Could not create a room.");
  return payload;
}

export function connectToRoom(
  roomCode,
  playerName = "Player",
  onMessage = () => {},
  hostToken = null
) {
  return checkRoomJoinable(roomCode).then(
    () =>
      new Promise((resolve, reject) => {
        const url = new URL(getRoomSocketUrl(roomCode, playerName));
        if (hostToken) url.searchParams.set("host", hostToken);
        const socket = new WebSocket(url.toString());
        let connected = false;
        let failureHandled = false;
        let pingInterval = null;
        const timeoutId = window.setTimeout(() => {
          if (!connected) {
            socket.close();
            void rejectConnection(new Error("The room connection timed out. Please try again."));
          }
        }, 10000);

        const rejectConnection = async (fallbackError) => {
          if (failureHandled) return;
          failureHandled = true;
          window.clearTimeout(timeoutId);
          let connectionError = fallbackError;
          try {
            await checkRoomJoinable(roomCode);
          } catch (statusError) {
            connectionError = statusError;
          }
          reject(connectionError);
        };

        socket.addEventListener("message", (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === "pong" && Number.isFinite(message.clientTime)) {
              const roundTrip = Date.now() - message.clientTime;
              message.serverOffset = message.serverTime - (message.clientTime + roundTrip / 2);
              serverClockOffset = message.serverOffset;
              roundTripSamples.push(roundTrip);
              if (roundTripSamples.length > 12) roundTripSamples.shift();
            }
            onMessage(message);
          } catch {
            onMessage({ type: "error", message: "Received an invalid room update." });
          }
        });
        socket.addEventListener("open", () => {
          connected = true;
          activeSocket = socket;
          window.clearTimeout(timeoutId);
          const sendPing = () => {
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({ type: "ping", clientTime: Date.now() }));
            }
          };
          sendPing();
          pingInterval = window.setInterval(sendPing, 2000);
          resolve(socket);
        });
        socket.addEventListener("error", () => {
          if (connected) return;
          void rejectConnection(
            new Error("Could not connect to that room. Check the code and try again.")
          );
        });
        socket.addEventListener("close", (event) => {
          if (activeSocket === socket) activeSocket = null;
          if (pingInterval) window.clearInterval(pingInterval);
          if (!connected) {
            void rejectConnection(
              new Error(
                event.code === 1006
                  ? "Could not connect to the multiplayer server."
                  : event.reason || "The room connection was closed."
              )
            );
            return;
          }
          if (event.code === 1000) return;
          onMessage({ type: "disconnected", reason: event.reason });
        });
      })
  );
}

async function checkRoomJoinable(roomCode) {
  let response;
  try {
    response = await fetch(buildApiUrl(`/api/rooms/${encodeURIComponent(roomCode)}/status`), {
      signal: AbortSignal.timeout(5000),
    });
  } catch (error) {
    if (error.name === "TimeoutError") {
      throw new Error("Checking the room status timed out. Please try again.", { cause: error });
    }
    throw error;
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Could not check the room status.");
  if (payload.status === "started") {
    const error = new Error("This room is already in a game. Ask the host to return to the lobby.");
    error.code = "ROOM_IN_PROGRESS";
    throw error;
  }
  if (payload.status !== "waiting") {
    throw new Error("This room is not available to join.");
  }
}

export function isRoomConnected() {
  return activeSocket?.readyState === WebSocket.OPEN;
}

export function getServerTime() {
  return Date.now() + serverClockOffset;
}

export function sendRoomStrokePreview(strokeId, sequence, points) {
  if (!isRoomConnected() || !strokeId || !Array.isArray(points) || points.length < 1) {
    return false;
  }

  try {
    activeSocket.send(JSON.stringify({ type: "stroke-preview", strokeId, sequence, points }));
    return true;
  } catch {
    return false;
  }
}

export function cancelRoomStrokePreview(strokeId) {
  if (!isRoomConnected() || !strokeId) return false;
  try {
    activeSocket.send(JSON.stringify({ type: "stroke-preview-cancel", strokeId }));
    return true;
  } catch {
    return false;
  }
}

export function sendRoomStroke(points, { width = 8, color = "#222222", strokeId } = {}) {
  if (!isRoomConnected() || !Array.isArray(points) || points.length < 2) return false;

  const leadTimeMs = getRoomActionLeadTime();
  try {
    activeSocket.send(
      JSON.stringify({
        type: "stroke",
        eventId: crypto.randomUUID(),
        strokeId,
        points,
        width,
        color,
        leadTimeMs,
      })
    );
    return true;
  } catch {
    return false;
  }
}

export function sendRoomBallLaunch() {
  if (!isRoomConnected()) return false;

  const eventId = crypto.randomUUID();
  try {
    activeSocket.send(
      JSON.stringify({
        type: "ball-launch",
        eventId,
        leadTimeMs: getRoomActionLeadTime(),
      })
    );
    return eventId;
  } catch {
    return false;
  }
}

function getRoomActionLeadTime() {
  const sortedSamples = [...roundTripSamples].sort((first, second) => first - second);
  const p90RoundTrip = sortedSamples.length
    ? sortedSamples[Math.ceil(sortedSamples.length * 0.9) - 1]
    : 300;
  return Math.min(3000, Math.max(700, Math.ceil(p90RoundTrip * 2 + 500)));
}
