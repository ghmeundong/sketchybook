import rough from "roughjs";
import { attachRoughFrame } from "../game/ui/roughFrame.js";
import { setActivePage, startStage } from "../game/engine/core/gameController.js";
import { createActionIconCanvas } from "../game/ui/uiIcons.js";
import { dom } from "../game/engine/core/domRefs.js";
import { state } from "../game/engine/core/gameState.js";
import { GOLD, INK, INK_SOFT } from "../theme.js";
import { connectToRoom, createRoom } from "../services/multiplayer.js";

const singleButton = document.querySelector("[data-select-single]");
const multiplayerButton = document.querySelector("[data-select-multiplayer]");
const modeBackButton = document.querySelector("[data-mode-back]");
const startModeBackButton = document.querySelector("[data-start-mode-back]");
const modeStatus = document.querySelector("[data-mode-status]");
const modeScreen = document.querySelector(".mode-screen");
const roomGlobalBackButton = document.querySelector("[data-room-back]");
const roomPanel = document.querySelector("[data-room-panel]");
const roomEntryActions = document.querySelector("[data-room-entry-actions]");
const roomConnectedState = document.querySelector("[data-room-connected]");
const roomStatus = document.querySelector("[data-room-status]");
const roomCreateButton = document.querySelector("[data-room-create]");
const roomJoinForm = document.querySelector("[data-room-join-form]");
const roomCodeInput = document.querySelector("[name=roomCode]");
const roomCodeDisplay = document.querySelector("[data-room-code-display]");
const roomPlayerCount = document.querySelector("[data-room-player-count]");
const roomPlayerList = document.querySelector("[data-room-player-list]");
const roomLeaveButton = document.querySelector("[data-room-leave]");
const roomSelectStageButton = document.querySelector("[data-room-select-stage]");
const guestWaitingMessage = document.querySelector("[data-guest-waiting]");
const roomSelectedStage = document.querySelector("[data-room-selected-stage]");
const selectionStatus = document.querySelector("[data-multiplayer-selection-status]");
const selectionMessage = document.querySelector("[data-multiplayer-selection-message]");
const selectionRoomCode = document.querySelector("[data-selection-room-code]");
const selectionPlayerCount = document.querySelector("[data-selection-player-count]");
const selectionPlayerList = document.querySelector("[data-selection-player-list]");
const selectionLeaveButton = document.querySelector("[data-selection-room-leave]");
const roomCopyLinkButton = document.querySelector("[data-room-copy-link]");
const selectionCopyLinkButton = document.querySelector("[data-selection-copy-link]");
let roomSocket = null;
let isConnecting = false;
let roomRole = "guest";
let selectedRoomStage = null;
let roomStartTimer = null;
let serverClockOffset = 0;
let selfPlayerId = null;
let roomCode = null;
let toastTimer = null;
let toastHideTimer = null;
let roomToast = null;

function drawModeArtwork(canvas, mode) {
  if (!canvas) return;

  const width = 220;
  const height = 128;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = width * pixelRatio;
  canvas.height = height * pixelRatio;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  const roughCanvas = rough.canvas(canvas);
  const lineStyle = { stroke: INK, strokeWidth: 2.4, roughness: 1.8, bowing: 1.4 };

  if (mode === "single") {
    roughCanvas.line(28, 94, 194, 94, { ...lineStyle, strokeWidth: 3 });
    roughCanvas.line(44, 91, 82, 54, lineStyle);
    roughCanvas.line(82, 54, 126, 82, lineStyle);
    roughCanvas.circle(150, 72, 25, {
      ...lineStyle,
      fill: GOLD,
      fillStyle: "hachure",
      hachureGap: 5,
    });
    roughCanvas.line(160, 42, 177, 31, { ...lineStyle, stroke: INK_SOFT });
    roughCanvas.line(168, 51, 190, 48, { ...lineStyle, stroke: INK_SOFT });
  } else {
    roughCanvas.circle(72, 56, 35, {
      ...lineStyle,
      fill: "#dce8d5",
      fillStyle: "hachure",
      hachureGap: 6,
    });
    roughCanvas.circle(148, 56, 35, {
      ...lineStyle,
      fill: "#f0d8c6",
      fillStyle: "hachure",
      hachureGap: 6,
    });
    roughCanvas.arc(72, 111, 48, 46, Math.PI, Math.PI * 2, false, lineStyle);
    roughCanvas.arc(148, 111, 48, 46, Math.PI, Math.PI * 2, false, lineStyle);
    roughCanvas.line(98, 36, 122, 36, { ...lineStyle, stroke: GOLD, strokeWidth: 3 });
    roughCanvas.line(104, 28, 116, 28, { ...lineStyle, stroke: GOLD, strokeWidth: 2 });
  }
}

function initializeArtwork() {
  document.querySelectorAll("[data-mode-art]").forEach((canvas) => {
    drawModeArtwork(canvas, canvas.dataset.modeArt);
  });
}

function initializeModeSelection() {
  if (!singleButton || !multiplayerButton || !dom.modePage || !dom.startPage) return;

  attachRoughFrame(singleButton, { inset: 0, outside: 7, strokeWidth: 2.2, roughness: 1.8 });
  attachRoughFrame(multiplayerButton, { inset: 0, outside: 7, strokeWidth: 2.2, roughness: 1.8 });
  attachRoughFrame(modeBackButton, { inset: 1, outside: 3, strokeWidth: 1.4, roughness: 1.6 });
  attachRoughFrame(roomPanel, { inset: 0, outside: 7, strokeWidth: 2.2, roughness: 1.8 });
  attachRoughFrame(roomCreateButton, { inset: 0, outside: 3, strokeWidth: 1.7, roughness: 1.6 });
  attachRoughFrame(roomJoinForm?.querySelector("button"), {
    inset: 0,
    outside: 3,
    strokeWidth: 1.7,
    roughness: 1.6,
  });
  attachRoughFrame(roomLeaveButton, { inset: 0, outside: 3, strokeWidth: 1.7, roughness: 1.6 });
  attachRoughFrame(roomSelectStageButton, {
    inset: 0,
    outside: 3,
    strokeWidth: 1.7,
    roughness: 1.6,
  });
  roomGlobalBackButton?.appendChild(
    createActionIconCanvas("exit", { w: 60, h: 48, strokeWidth: 2.5 })
  );
  startModeBackButton?.appendChild(
    createActionIconCanvas("exit", { w: 60, h: 48, strokeWidth: 2.5 })
  );
  attachRoughFrame(selectionLeaveButton, {
    inset: 0,
    outside: 3,
    strokeWidth: 1.7,
    roughness: 1.6,
  });
  initializeArtwork();
  roomToast = document.createElement("div");
  roomToast.className = "multiplayer-toast";
  roomToast.setAttribute("role", "status");
  roomToast.setAttribute("aria-live", "polite");
  roomToast.hidden = true;
  document.body.appendChild(roomToast);
  document.addEventListener("pointerdown", (event) => {
    if (!roomToast?.hidden && !roomToast?.contains(event.target)) {
      dismissRoomToast();
    }
  });
  [roomCopyLinkButton, selectionCopyLinkButton].forEach((button) => {
    button?.appendChild(createActionIconCanvas("copy", { w: 24, h: 24, strokeWidth: 2.2 }));
  });

  singleButton.addEventListener("click", () => {
    multiplayerButton.setAttribute("aria-pressed", "false");
    if (modeStatus) modeStatus.textContent = "";
    setActivePage(dom.startPage);
  });

  multiplayerButton.addEventListener("click", () => {
    multiplayerButton.setAttribute("aria-pressed", "true");
    modeScreen?.classList.add("is-room-open");
    if (roomPanel) roomPanel.hidden = false;
    if (roomGlobalBackButton) roomGlobalBackButton.hidden = false;
    if (modeStatus) modeStatus.textContent = "";
    if (!roomSocket || roomSocket.readyState !== WebSocket.OPEN) {
      resetRoomPanel("Create a room or enter a friend's code.");
    } else {
      roomEntryActions.hidden = true;
      roomConnectedState.hidden = false;
    }
  });

  modeBackButton?.addEventListener("click", () => {
    setActivePage(dom.modePage);
  });

  startModeBackButton?.addEventListener("click", () => {
    setActivePage(dom.modePage);
  });

  roomGlobalBackButton?.addEventListener("click", closeRoomPanel);
  roomCopyLinkButton?.addEventListener("click", copyRoomInviteLink);
  selectionCopyLinkButton?.addEventListener("click", copyRoomInviteLink);
  roomCreateButton?.addEventListener("click", async () => {
    await withRoomConnection(async () => {
      const room = await createRoom();
      const socket = await connectToRoom(
        room.roomCode,
        getPlayerName(),
        handleRoomMessage,
        room.hostToken
      );
      return { ...room, socket, isHost: true };
    });
  });

  roomJoinForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const roomCode = roomCodeInput?.value.trim().toUpperCase();
    if (!roomCode || !/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/.test(roomCode)) {
      roomStatus.textContent = "Enter a valid 6-character room code.";
      roomCodeInput?.focus();
      return;
    }
    await withRoomConnection(() => connectToRoom(roomCode, getPlayerName(), handleRoomMessage));
  });

  roomLeaveButton?.addEventListener("click", () => {
    closeRoomPanel();
    setActivePage(dom.modePage);
  });

  roomSelectStageButton?.addEventListener("click", () => {
    if (roomRole !== "host" || !roomSocket || roomSocket.readyState !== WebSocket.OPEN) return;
    showHostStageSelection();
  });

  selectionLeaveButton?.addEventListener("click", leaveRoom);

  window.addEventListener("sketchybook:stage-select", (event) => {
    if (roomRole !== "host" || roomSocket?.readyState !== WebSocket.OPEN) return;
    event.preventDefault();
    selectedRoomStage = event.detail.stageNumber;
    document.querySelectorAll(".page-selection .stage-card").forEach((button) => {
      button.classList.toggle("is-selected", button === event.detail.button);
      button.disabled = true;
    });
    roomSocket.send(
      JSON.stringify({
        type: "start-game",
        stageNumber: selectedRoomStage,
        difficulty: state.currentDifficulty,
        challengeModeEnabled: state.challengeModeEnabled,
      })
    );
    if (selectionMessage) {
      selectionMessage.textContent = `Starting Stage ${selectedRoomStage} together…`;
    }
  });

  window.addEventListener("sketchybook:selection-back", (event) => {
    if (roomRole !== "host" || !roomSocket) return;
    event.preventDefault();
    setActivePage(dom.modePage);
    selectionStatus.hidden = true;
    roomPanel.hidden = false;
    roomEntryActions.hidden = true;
    roomConnectedState.hidden = false;
    modeScreen?.classList.add("is-room-open");
  });

  window.addEventListener("sketchybook:game-exit", (event) => {
    if (!roomSocket || roomSocket.readyState !== WebSocket.OPEN) return;
    event.preventDefault();
    if (roomRole !== "host") {
      roomStatus.textContent = "Only the host can leave the active multiplayer game.";
      return;
    }
    roomStatus.textContent = "Returning everyone to the room…";
    roomSocket.send(JSON.stringify({ type: "return-to-lobby" }));
  });

  window.addEventListener("sketchybook:stage-clear-check", (event) => {
    if (!roomSocket || roomSocket.readyState !== WebSocket.OPEN) return;
    if (roomRole !== "host") {
      event.preventDefault();
      return;
    }
    roomSocket.send(
      JSON.stringify({
        type: "stage-clear",
        stageNumber: event.detail.stageNumber,
        stageEventCount: event.detail.stageEventCount,
      })
    );
  });

  window.addEventListener("sketchybook:stage-next", (event) => {
    handleHostStageTransition(event, "next-stage");
  });

  window.addEventListener("sketchybook:stage-retry", (event) => {
    handleHostStageTransition(event, "retry-stage");
  });

  const inviteCode = new URLSearchParams(window.location.search).get("room")?.trim().toUpperCase();
  if (inviteCode) {
    multiplayerButton.setAttribute("aria-pressed", "true");
    modeScreen?.classList.add("is-room-open");
    if (roomPanel) roomPanel.hidden = false;
    if (roomGlobalBackButton) roomGlobalBackButton.hidden = false;
    if (roomCodeInput) roomCodeInput.value = inviteCode;
    if (!/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/.test(inviteCode)) {
      resetRoomPanel("This invite link has an invalid room code.");
      return;
    }
    void joinRoomByCode(inviteCode);
  }
}

function showRoomToast(message) {
  if (!roomToast) return;
  window.clearTimeout(toastTimer);
  window.clearTimeout(toastHideTimer);
  roomToast.textContent = message;
  roomToast.hidden = false;
  roomToast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => {
    roomToast.classList.remove("is-visible");
    toastHideTimer = window.setTimeout(() => {
      roomToast.hidden = true;
    }, 180);
  }, 1000);
}

function dismissRoomToast() {
  window.clearTimeout(toastTimer);
  window.clearTimeout(toastHideTimer);
  toastTimer = null;
  toastHideTimer = null;
  roomToast?.classList.remove("is-visible");
  if (roomToast) roomToast.hidden = true;
}

function handleHostStageTransition(event, type, stageNumber = event.detail?.stageNumber) {
  if (!roomSocket || roomSocket.readyState !== WebSocket.OPEN) return;
  event.preventDefault();
  if (roomRole !== "host") {
    roomStatus.textContent = "Only the host can change the stage for everyone.";
    return;
  }
  roomSocket.send(JSON.stringify({ type, stageNumber }));
  roomStatus.textContent =
    type === "next-stage"
      ? `Starting Stage ${stageNumber} together…`
      : "Restarting the stage together…";
}

function getPlayerName() {
  let name = sessionStorage.getItem("multiplayerPlayerName");
  if (!name) {
    name = `Player ${Math.floor(1000 + Math.random() * 9000)}`;
    sessionStorage.setItem("multiplayerPlayerName", name);
  }
  return name;
}

async function withRoomConnection(connect) {
  if (isConnecting) return;
  isConnecting = true;
  setRoomControlsDisabled(true);
  roomStatus.textContent = "Connecting…";
  try {
    const connection = await connect();
    roomSocket = connection.socket ?? connection;
    roomCode = connection.roomCode ?? roomCodeInput?.value.trim().toUpperCase();
    roomRole = connection.isHost ? "host" : "guest";
    const currentUrl = new URL(window.location.href);
    if (currentUrl.searchParams.get("room")?.toUpperCase() === roomCode) {
      currentUrl.searchParams.delete("room");
      window.history.replaceState(
        null,
        "",
        `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`
      );
    }
    roomCodeDisplay.textContent = roomCode;
    roomEntryActions.hidden = true;
    roomConnectedState.hidden = false;
    roomStatus.textContent = "Connected. Share this code with a friend.";
    if (roomRole === "host") {
      showHostStageSelection();
    }
  } catch (error) {
    roomStatus.textContent = error.message || "Could not connect to the room.";
    if (error.code === "ROOM_IN_PROGRESS") {
      showRoomToast(error.message);
    }
  } finally {
    isConnecting = false;
    setRoomControlsDisabled(false);
  }
}

async function joinRoomByCode(code) {
  await withRoomConnection(() => connectToRoom(code, getPlayerName(), handleRoomMessage));
}

async function copyRoomInviteLink() {
  if (!roomCode) return;
  const inviteUrl = new URL(window.location.href);
  inviteUrl.searchParams.delete("stage");
  inviteUrl.searchParams.set("room", roomCode);
  const link = inviteUrl.toString();
  try {
    await navigator.clipboard.writeText(link);
  } catch {
    const temporaryInput = document.createElement("textarea");
    temporaryInput.value = link;
    temporaryInput.setAttribute("readonly", "");
    temporaryInput.style.position = "fixed";
    temporaryInput.style.opacity = "0";
    document.body.append(temporaryInput);
    temporaryInput.select();
    const copied = document.execCommand("copy");
    temporaryInput.remove();
    if (!copied) {
      showRoomToast("Could not copy the invite link. Please copy it manually.");
      return;
    }
  }
  roomStatus.textContent = "Invite link copied.";
  if (selectionMessage && dom.selectionPage.classList.contains("is-active")) {
    selectionMessage.textContent = "Invite link copied.";
  }
  showRoomToast("Invite link copied.");
}

function handleRoomMessage(message) {
  if (message.type === "room-state" && Array.isArray(message.players)) {
    if (message.selfPlayerId) selfPlayerId = message.selfPlayerId;
    roomPlayerCount.textContent = `${message.players.length} / 4 players connected`;
    roomPlayerList.replaceChildren(
      ...message.players.map((player) => {
        const item = document.createElement("li");
        item.textContent = player.name;
        return item;
      })
    );
    if (dom.selectionPage.classList.contains("is-active")) {
      selectionPlayerCount.textContent = `${message.players.length} / 4 players connected`;
      selectionPlayerList.replaceChildren(
        ...message.players.map((player) => {
          const item = document.createElement("li");
          item.textContent = player.name;
          return item;
        })
      );
    }
    if (message.selectedStage) {
      selectedRoomStage = message.selectedStage;
      renderSelectedStage(message.selectedStage);
    }
    const host = message.players.find((player) => player.isHost);
    const self = message.players.find((player) => player.playerId === selfPlayerId);
    if (self) roomRole = self.isHost ? "host" : "guest";
    updateRoomRoleUI(host);
    return;
  }

  if (message.type === "pong" && Number.isFinite(message.serverOffset)) {
    serverClockOffset = message.serverOffset;
    return;
  }

  if (message.type === "room-start") {
    clearTimeout(roomStartTimer);
    selectedRoomStage = message.stageNumber;
    window.dispatchEvent(
      new CustomEvent("sketchybook:room-mode", {
        detail: {
          difficulty: message.difficulty,
          challengeModeEnabled: message.challengeModeEnabled,
        },
      })
    );
    const delay = Math.max(0, message.startAt - (Date.now() + serverClockOffset));
    roomStartTimer = window.setTimeout(async () => {
      selectionStatus.hidden = true;
      if (roomPanel) roomPanel.hidden = true;
      if (roomGlobalBackButton) roomGlobalBackButton.hidden = true;
      document.querySelectorAll(".page-selection .stage-card").forEach((button) => {
        button.classList.remove("is-selected");
      });
      await startStage(message.stageNumber);
    }, delay);
    return;
  }

  if (message.type === "stroke") {
    window.dispatchEvent(new CustomEvent("sketchybook:room-stroke", { detail: message }));
    return;
  }

  if (message.type === "ball-launch") {
    window.dispatchEvent(new CustomEvent("sketchybook:room-ball-launch", { detail: message }));
    return;
  }

  if (message.type === "stage-clear") {
    window.dispatchEvent(new CustomEvent("sketchybook:room-stage-clear", { detail: message }));
    return;
  }

  if (message.type === "stroke-preview") {
    window.dispatchEvent(new CustomEvent("sketchybook:room-stroke-preview", { detail: message }));
    return;
  }

  if (message.type === "stroke-preview-end") {
    window.dispatchEvent(
      new CustomEvent("sketchybook:room-stroke-preview-end", { detail: message })
    );
    return;
  }

  if (message.type === "room-lobby") {
    clearTimeout(roomStartTimer);
    window.dispatchEvent(new CustomEvent("sketchybook:room-lobby"));
    selectedRoomStage = null;
    roomSelectedStage.hidden = true;
    document.querySelectorAll(".page-selection .stage-card").forEach((button) => {
      button.classList.remove("is-selected");
      button.disabled = false;
    });
    if (roomRole === "host") {
      returnToRoomLobby("You returned to the room. Select a stage to play again.");
    } else {
      returnToRoomLobby("The host returned everyone to the room.");
    }
    return;
  }

  if (message.type === "room-closed") {
    window.dispatchEvent(new CustomEvent("sketchybook:room-closed"));
    roomSocket = null;
    resetRoomPanel(message.reason || "The host closed the room.");
    return;
  }

  if (message.type === "error") {
    roomStatus.textContent = message.message;
    if (selectionMessage && dom.selectionPage.classList.contains("is-active")) {
      selectionMessage.textContent = message.message;
    }
    return;
  }

  if (message.type === "disconnected") {
    window.dispatchEvent(new CustomEvent("sketchybook:room-closed"));
    if (roomPanel?.hidden) return;
    roomSocket = null;
    resetRoomPanel("Connection lost. Rejoin the room to continue.");
  }
}

function returnToRoomLobby(status) {
  setActivePage(dom.modePage);
  selectionStatus.hidden = true;
  roomPanel.hidden = false;
  roomEntryActions.hidden = true;
  roomConnectedState.hidden = false;
  if (roomGlobalBackButton) roomGlobalBackButton.hidden = false;
  modeScreen?.classList.add("is-room-open");
  roomStatus.textContent = status;
  guestWaitingMessage.hidden = roomRole === "host";
  if (roomRole !== "host") {
    guestWaitingMessage.textContent = "Waiting for the host to choose a stage…";
  }
}

function renderSelectedStage(stageNumber) {
  roomSelectedStage.textContent = `Host selected Stage ${stageNumber}`;
  roomSelectedStage.hidden = roomRole === "host";
  if (selectionMessage && roomRole === "host" && selectedRoomStage === stageNumber) {
    selectionMessage.textContent = `Selected Stage ${stageNumber}. Start when everyone is ready.`;
  }
}

function updateRoomRoleUI(host) {
  guestWaitingMessage.hidden = roomRole === "host";
  roomSelectStageButton.hidden = roomRole !== "host";
  if (roomRole === "host") {
    roomStatus.textContent = "You are the host. Choose a stage from the stage selection screen.";
    return;
  }
  if (host) roomStatus.textContent = `${host.name} is the host.`;
  guestWaitingMessage.textContent = selectedRoomStage
    ? `Host selected Stage ${selectedRoomStage}. Waiting for the host to start…`
    : "Waiting for the host to choose a stage…";
}

function showHostStageSelection() {
  setActivePage(dom.selectionPage);
  roomPanel.hidden = true;
  if (roomGlobalBackButton) roomGlobalBackButton.hidden = true;
  modeScreen?.classList.remove("is-room-open");
  selectionStatus.hidden = false;
  selectionRoomCode.textContent = roomCode;
  selectionMessage.textContent = "Choose a stage to start everyone together.";
  selectionPlayerCount.textContent = `${roomPlayerList.children.length} / 4 players connected`;
  selectionPlayerList.replaceChildren(
    ...Array.from(roomPlayerList.children, (player) => {
      const item = document.createElement("li");
      item.textContent = player.textContent;
      return item;
    })
  );
  document.querySelectorAll(".page-selection .stage-card").forEach((button) => {
    button.classList.remove("is-selected");
    button.disabled = false;
  });
}

function closeRoomSocketOnly(reason) {
  roomSocket?.close(1000, reason);
  roomSocket = null;
}

function leaveRoom() {
  clearTimeout(roomStartTimer);
  closeRoomSocketOnly("Player left the room");
  selectionStatus.hidden = true;
  roomPanel.hidden = false;
  resetRoomPanel("You left the room.");
  roomGlobalBackButton.hidden = false;
  modeScreen?.classList.add("is-room-open");
  multiplayerButton.setAttribute("aria-pressed", "true");
  setActivePage(dom.modePage);
}

function setRoomControlsDisabled(disabled) {
  if (roomCreateButton) roomCreateButton.disabled = disabled;
  if (roomCodeInput) roomCodeInput.disabled = disabled;
  const joinButton = roomJoinForm?.querySelector("button");
  if (joinButton) joinButton.disabled = disabled;
}

function resetRoomPanel(status) {
  if (roomEntryActions) roomEntryActions.hidden = false;
  if (roomConnectedState) roomConnectedState.hidden = true;
  if (roomPlayerCount) roomPlayerCount.textContent = "";
  if (guestWaitingMessage) guestWaitingMessage.hidden = true;
  if (roomSelectedStage) roomSelectedStage.hidden = true;
  if (roomSelectStageButton) roomSelectStageButton.hidden = true;
  roomRole = "guest";
  selectedRoomStage = null;
  roomCode = null;
  selfPlayerId = null;
  serverClockOffset = 0;
  roomPlayerList?.replaceChildren();
  selectionPlayerList?.replaceChildren();
  if (selectionPlayerCount) selectionPlayerCount.textContent = "";
  if (selectionRoomCode) selectionRoomCode.textContent = "";
  document.querySelectorAll(".page-selection .stage-card").forEach((button) => {
    button.classList.remove("is-selected");
  });
  if (roomStatus) roomStatus.textContent = status;
}

function closeRoomPanel() {
  clearTimeout(roomStartTimer);
  closeRoomSocketOnly("Room panel closed");
  selectionStatus.hidden = true;
  roomPanel.hidden = true;
  if (roomGlobalBackButton) roomGlobalBackButton.hidden = true;
  modeScreen?.classList.remove("is-room-open");
  multiplayerButton.setAttribute("aria-pressed", "false");
  resetRoomPanel("");
}

export { initializeModeSelection };
