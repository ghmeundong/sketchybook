import rough from "roughjs";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { dom } from "../game/engine/core/domRefs.js";
import { setActivePage, startMapTest } from "../game/engine/core/gameController.js";
import { attachRoughFrame } from "../game/ui/roughFrame.js";
import { createActionIconCanvas } from "../game/ui/uiIcons.js";
import { GOLD, INK, INK_SOFT } from "../theme.js";
import objectsReference from "../../docs/OBJECTS.md?raw";
import objectsReferenceKo from "../../docs/OBJECTS.ko.md?raw";
import { isKoreanLocale } from "./localization.js";
import { fetchAccountMaps, saveAccountMap } from "../services/accountMaps.js";
import { isUserLoggedIn } from "../services/auth.js";
import { fetchSharedMap, fetchSharedMaps, publishSharedMap } from "../services/sharedMaps.js";

const STORAGE_KEY = "sketchybook.customMaps";
const canvas = document.querySelector("[data-map-canvas]");
const nameInput = document.querySelector("[data-map-name]");
const status = document.querySelector("[data-map-status]");
const undoButton = document.querySelector("[data-map-undo]");
const libraryToggle = document.querySelector("[data-map-library-toggle]");
const myMapsBackdrop = document.querySelector("[data-my-maps-backdrop]");
const myMapsGrid = document.querySelector("[data-my-maps-grid]");
const myMapsStatus = document.querySelector("[data-my-maps-status]");
const myMapsPicker = document.querySelector(".my-maps-picker");
const myMapsCloseButton = document.querySelector("[data-my-maps-close]");
const tools = Array.from(document.querySelectorAll("[data-map-tool]"));
const propertyText = document.querySelector("[data-property-text]");
const propertyTextWrap = document.querySelector("[data-property-text-wrap]");
const propertyRadius = document.querySelector("[data-property-radius]");
const propertyRadiusWrap = document.querySelector("[data-property-radius-wrap]");
const propertyClosed = document.querySelector("[data-property-closed]");
const propertyClosedWrap = document.querySelector("[data-property-closed-wrap]");
const propertySpin = document.querySelector("[data-property-spin]");
const propertySpinWrap = document.querySelector("[data-property-spin-wrap]");
const propertyEmpty = document.querySelector("[data-property-empty]");
const jsonEditor = document.querySelector("[data-map-json]");
const jsonHighlight = document.querySelector("[data-map-json-highlight]");
const jsonStatus = document.querySelector("[data-json-status]");
const jsonWorkspace = document.querySelector("[data-json-workspace]");
const jsonSuggestions = document.querySelector("[data-json-suggestions]");
const viewTabs = Array.from(document.querySelectorAll("[data-editor-view]"));
const toolPalette = document.querySelector(".map-editor-tools");
const propertiesPanel = document.querySelector(".map-editor-properties");
const mapBoardGrid = document.querySelector("[data-map-board-grid]");
const mapBoardStatus = document.querySelector("[data-map-board-status]");
const mapBoardBackButton = document.querySelector("[data-map-board-back]");
const mapBoardRefreshButton = document.querySelector("[data-map-board-refresh]");
const mapCreateButton = document.querySelector("[data-map-create]");
const mapPlayButton = document.querySelector("[data-map-play]");
const mapShareButton = document.querySelector("[data-map-share]");
const referenceButton = document.querySelector("[data-map-reference]");
const referencePanel = document.querySelector("[data-map-reference-panel]");
const referenceContent = document.querySelector("[data-map-reference-content]");
let objects = [];
let history = [];
let activeTool = "select";
let selectedIndex = -1;
let pointerAction = null;
let polygonDraft = null;
let propertySnapshot = null;
let editorView = "canvas";
let jsonSessionSnapshot = null;
let activeSuggestions = [];
let selectedSuggestionIndex = 0;
let currentMapId = createMapId();
let savedMapsCache = [];
let mapToast = null;
let mapToastTimer = null;
let mapToastHideTimer = null;
const objectRenderCache = new WeakMap();
const objectSeeds = new WeakMap();
let nextObjectSeed = 1;

function createMapId() {
  return globalThis.crypto?.randomUUID?.() || `map-${Date.now()}`;
}

function setStatus(message) {
  if (status) status.textContent = message;
}

function showMapToast(message) {
  if (!mapToast) return;
  window.clearTimeout(mapToastTimer);
  window.clearTimeout(mapToastHideTimer);
  mapToast.querySelector(".multiplayer-toast-message").textContent = message;
  mapToast.hidden = false;
  mapToast.classList.add("is-visible");
  mapToastTimer = window.setTimeout(() => {
    mapToast.classList.remove("is-visible");
    mapToastHideTimer = window.setTimeout(() => {
      mapToast.hidden = true;
    }, 180);
  }, 1800);
}

function drawSharedMapPreview(previewCanvas, map) {
  const width = 280;
  const height = 160;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  previewCanvas.width = width * dpr;
  previewCanvas.height = height * dpr;
  const context = previewCanvas.getContext("2d");
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.fillStyle = "#fffdf5";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "rgba(61, 53, 43, 0.08)";
  context.lineWidth = 1;
  for (let x = 20; x < width; x += 20) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
  const rc = rough.canvas(previewCanvas);
  (map.objects || []).forEach((object, index) => {
    let centerX = object.x ?? 0.5;
    let centerY = object.y ?? 0.5;
    if (object.type === "segment") {
      centerX = (object.x1 + object.x2) / 2;
      centerY = (object.y1 + object.y2) / 2;
    } else if (Array.isArray(object.points) && object.points.length) {
      centerX = object.points.reduce((sum, point) => sum + point.x, 0) / object.points.length;
      centerY = object.points.reduce((sum, point) => sum + point.y, 0) / object.points.length;
    }
    const x = centerX * width;
    const y = centerY * height;
    const options = { stroke: INK, strokeWidth: 2, roughness: 1.5, seed: index + 1 };
    if (object.type === "platform") {
      rc.rectangle(
        x - (object.width * width) / 2,
        y - (object.height * height) / 2,
        object.width * width,
        object.height * height,
        options
      );
    } else if (object.type === "star") {
      const radius = Math.max(5, (object.radius || 0.025) * height);
      const points = Array.from({ length: 10 }, (_, pointIndex) => {
        const angle = -Math.PI / 2 + (pointIndex * Math.PI) / 5;
        const size = pointIndex % 2 ? radius * 0.45 : radius;
        return [x + Math.cos(angle) * size, y + Math.sin(angle) * size];
      });
      rc.polygon(points, { ...options, stroke: "#a27a28", fill: GOLD, fillStyle: "solid" });
    } else if (object.type === "segment") {
      rc.line(
        object.x1 * width,
        object.y1 * height,
        object.x2 * width,
        object.y2 * height,
        options
      );
    } else if (["complex", "poly", "rotor"].includes(object.type) && Array.isArray(object.points)) {
      const points = object.points.map((point) => [point.x * width, point.y * height]);
      if (points.length > 2 && object.closed !== false) rc.polygon(points, options);
      else
        for (let pointIndex = 0; pointIndex < points.length - 1; pointIndex += 1) {
          rc.line(...points[pointIndex], ...points[pointIndex + 1], options);
        }
    } else if (object.type === "portal") {
      rc.ellipse(x, y, object.width * width, object.height * height, {
        ...options,
        stroke: object.portalId === "blue" ? "#4387c4" : "#e88936",
      });
    } else if (object.type === "stripedRect") {
      rc.rectangle(
        x - (object.width * width) / 2,
        y - (object.height * height) / 2,
        object.width * width,
        object.height * height,
        { ...options, stroke: "#d84335", fill: "#e74c3c", fillStyle: "hachure", hachureGap: 8 }
      );
    } else {
      rc.circle(x, y, Math.max(8, (object.radius || 0.025) * height * 2), {
        ...options,
        fill: object.type === "circle" ? "#dce8d5" : INK,
        fillStyle: "hachure",
      });
    }
  });
}

function drawMapCreateOutline() {
  const outline = document.querySelector("[data-map-create-outline]");
  if (!outline) return;

  const draw = () => {
    const bounds = outline.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    const width = Math.max(1, bounds.width);
    const height = Math.max(1, bounds.height);
    outline.width = Math.ceil(width * pixelRatio);
    outline.height = Math.ceil(height * pixelRatio);
    const context = outline.getContext("2d");
    if (!context) return;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    rough.canvas(outline).rectangle(5, 5, width - 10, height - 10, {
      stroke: "rgba(79, 59, 36, 0.55)",
      strokeWidth: 1.5,
      roughness: 1.6,
      strokeLineDash: [5, 4],
      fill: "transparent",
    });
  };

  if (typeof ResizeObserver === "function") new ResizeObserver(draw).observe(outline);
  window.requestAnimationFrame(draw);
}

function createSharedMapCard(map) {
  const card = document.createElement("article");
  card.className = "map-shared-card";
  card.dataset.sharedMapCard = map.id;
  const openButton = document.createElement("button");
  openButton.type = "button";
  openButton.className = "map-shared-open";
  openButton.setAttribute("aria-label", `Open ${map.name} by ${map.authorName}`);
  const preview = document.createElement("canvas");
  preview.className = "map-shared-preview";
  preview.setAttribute("aria-hidden", "true");
  const title = document.createElement("span");
  title.className = "map-card-name";
  title.textContent = map.name;
  const author = document.createElement("span");
  author.className = "map-card-author";
  author.textContent = `by ${map.authorName || "Sketchybook player"}`;
  openButton.append(preview, title, author);
  card.appendChild(openButton);
  drawSharedMapPreview(preview, map);
  attachRoughFrame(card, { inset: 0, outside: 3, strokeWidth: 1.5, roughness: 1.6 });
  openButton.addEventListener("click", () => void openSharedMap(map.id));
  const playButton = document.createElement("button");
  playButton.type = "button";
  playButton.className = "map-preview-play";
  playButton.setAttribute("aria-label", `Play ${map.name}`);
  playButton.title = "Play map";
  playButton.appendChild(createActionIconCanvas("next", { w: 24, h: 24, strokeWidth: 2.2 }));
  attachRoughFrame(playButton, { inset: 1, outside: 2, strokeWidth: 1.3, roughness: 1.4 });
  playButton.addEventListener("click", () => void startMapTest(map));
  card.appendChild(playButton);
  return card;
}

function createSavedMapCard(map) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "my-map-card";
  card.setAttribute("aria-label", `Open ${map.name || "Untitled map"}`);
  const preview = document.createElement("canvas");
  preview.className = "my-map-preview";
  preview.setAttribute("aria-hidden", "true");
  const title = document.createElement("span");
  title.className = "map-card-name";
  title.textContent = map.name || "Untitled map";
  card.append(preview, title);
  drawSharedMapPreview(preview, map);
  card.addEventListener("click", () => {
    loadMap(map.id);
    closeMyMapsPicker();
  });
  attachRoughFrame(card, { inset: 0, outside: 3, strokeWidth: 1.5, roughness: 1.6 });
  return card;
}

function renderMyMapsPicker() {
  myMapsGrid.replaceChildren();
  if (!savedMapsCache.length) {
    myMapsStatus.textContent = "No saved maps yet. Create and save a map to see it here.";
    return;
  }
  myMapsStatus.textContent = "";
  savedMapsCache.forEach((map) => myMapsGrid.appendChild(createSavedMapCard(map)));
}

function closeMyMapsPicker() {
  myMapsBackdrop.hidden = true;
  libraryToggle.setAttribute("aria-expanded", "false");
  libraryToggle.focus();
}

async function openMyMapsPicker() {
  myMapsBackdrop.hidden = false;
  libraryToggle.setAttribute("aria-expanded", "true");
  myMapsStatus.textContent = "Loading your maps…";
  await refreshLibrary();
  if (myMapsBackdrop.hidden) return;
  renderMyMapsPicker();
  myMapsCloseButton.focus();
}

async function refreshMapBoard() {
  mapBoardStatus.textContent = "Loading shared maps…";
  mapBoardGrid
    .querySelectorAll("[data-shared-map-card], .map-board-empty")
    .forEach((card) => card.remove());
  try {
    const maps = await fetchSharedMaps();
    maps.forEach((map) => mapBoardGrid.appendChild(createSharedMapCard(map)));
    mapBoardStatus.textContent = `${maps.length} shared map${maps.length === 1 ? "" : "s"}`;
    if (maps.length === 0) {
      const empty = document.createElement("p");
      empty.className = "map-board-empty";
      empty.textContent = "No shared maps yet. Create one and share it with the community.";
      mapBoardGrid.appendChild(empty);
    }
  } catch (error) {
    mapBoardStatus.textContent = error.message || "Could not load shared maps.";
  }
}

async function openSharedMap(mapId) {
  if (!requireMapEditorLogin()) return;
  mapBoardStatus.textContent = "Opening shared map…";
  try {
    const map = await fetchSharedMap(mapId);
    if (!requireMapEditorLogin()) return;
    objects = map.objects.map((object) => ({ ...object }));
    nameInput.value = map.name || "Untitled map";
    currentMapId = createMapId();
    history = [];
    selectedIndex = -1;
    undoButton.disabled = true;
    if (editorView !== "canvas") setEditorView("canvas");
    setActivePage(dom.mapEditorPage);
    render();
    syncProperties();
    setStatus(
      `Opened shared map by ${map.authorName || "Sketchybook player"}. Save to keep your own copy.`
    );
  } catch (error) {
    mapBoardStatus.textContent = error.message || "Could not open this map.";
  }
}

async function shareMap() {
  const hasBall = objects.some((object) => object.type === "ball");
  const hasStar = objects.some((object) => object.type === "star");
  if (!hasBall || !hasStar) {
    const missing = [!hasBall && "ball", !hasStar && "star"].filter(Boolean);
    showMapToast(`Add at least one ${missing.join(" and ")} before sharing.`);
    return;
  }
  mapShareButton.disabled = true;
  try {
    const result = await publishSharedMap(currentMapId, {
      version: 1,
      name: nameInput.value.trim() || "Untitled map",
      objects,
    });
    showMapToast("Map shared with the community.");
    if (result.id) setStatus("Map is now visible on the community board.");
  } catch (error) {
    showMapToast(error.message || "Could not share this map.");
  } finally {
    mapShareButton.disabled = false;
  }
}

const objectFields = {
  platform: ["x", "y", "width", "height"],
  circle: ["x", "y", "radius", "isStatic"],
  ball: ["x", "y", "radius"],
  star: ["x", "y", "radius"],
  stripedRect: ["x", "y", "width", "height"],
  portal: ["x", "y", "width", "height", "portalId"],
  segment: ["x1", "y1", "x2", "y2"],
  complex: ["points", "closed", "isStatic"],
  poly: ["points", "closed", "isStatic"],
  rotor: [
    "points",
    "closed",
    "x",
    "y",
    "radius",
    "axisX",
    "axisY",
    "spinMode",
    "motorSpeed",
    "maxMotorTorque",
    "isStatic",
  ],
  text: ["x", "y", "text", "fontSize", "color", "fontFamily"],
};

function findJsonSuggestions(value, cursor) {
  const before = value.slice(0, cursor);
  const typeMatch = before.match(/"type"\s*:\s*"([^"\n]*)$/);
  if (typeMatch) {
    const types = Object.keys(objectFields);
    return {
      kind: "value",
      start: cursor - typeMatch[1].length,
      query: typeMatch[1],
      items: types.map((type) => ({ label: type, insertText: type })),
    };
  }

  const keyMatch = before.match(/(?:\{|,)\s*"([^"\n]*)$/);
  if (!keyMatch) return null;
  const previousType = before
    .match(/"type"\s*:\s*"([^"]+)"/g)
    ?.at(-1)
    ?.match(/"type"\s*:\s*"([^"]+)"/)?.[1];
  const fields = objectFields[previousType] || [
    "type",
    "x",
    "y",
    "width",
    "height",
    "radius",
    "points",
    "closed",
    "isStatic",
    "text",
  ];
  return {
    kind: "key",
    start: cursor - keyMatch[1].length,
    query: keyMatch[1],
    items: fields.map((field) => ({ label: field, insertText: field })),
  };
}

function positionSuggestionPopup(cursor) {
  const before = jsonEditor.value.slice(0, cursor);
  const lineStart = before.lastIndexOf("\n") + 1;
  const line = before.slice(lineStart);
  const style = getComputedStyle(jsonEditor);
  const measureCanvas = document.createElement("canvas");
  const context = measureCanvas.getContext("2d");
  context.font = style.font;
  const sourceRect = document.querySelector(".map-editor-json-source").getBoundingClientRect();
  const editorRect = jsonEditor.getBoundingClientRect();
  const left =
    editorRect.left -
    sourceRect.left +
    parseFloat(style.paddingLeft) +
    context.measureText(line).width -
    jsonEditor.scrollLeft;
  const lineHeight = parseFloat(style.lineHeight) || 20;
  const top =
    editorRect.top -
    sourceRect.top +
    parseFloat(style.paddingTop) +
    before.split("\n").length * lineHeight -
    jsonEditor.scrollTop;
  jsonSuggestions.style.left = `${Math.max(0, Math.min(sourceRect.width - 210, left))}px`;
  jsonSuggestions.style.top = `${Math.max(0, Math.min(sourceRect.height - 40, top))}px`;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return entities[character];
  });
}

function renderJsonHighlight() {
  if (!jsonHighlight || !jsonEditor) return;
  const source = jsonEditor.value;
  const tokenPattern =
    /("(?:\\.|[^"\\])*"(?=\s*:)|"(?:\\.|[^"\\])*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|\b(?:true|false|null)\b)/g;
  let highlighted = "";
  let previousIndex = 0;
  let match = tokenPattern.exec(source);

  while (match) {
    highlighted += escapeHtml(source.slice(previousIndex, match.index));
    const token = match[0];
    const followingText = source.slice(match.index + token.length);
    const tokenClass = token.startsWith('"')
      ? /^\s*:/.test(followingText)
        ? "key"
        : "string"
      : /^(?:true|false|null)$/.test(token)
        ? "literal"
        : "number";
    highlighted += `<span class="json-token-${tokenClass}">${escapeHtml(token)}</span>`;
    previousIndex = match.index + token.length;
    match = tokenPattern.exec(source);
  }

  jsonHighlight.innerHTML = `${highlighted}${escapeHtml(source.slice(previousIndex))}`;
  syncJsonHighlightScroll();
}

function syncJsonHighlightScroll() {
  if (!jsonHighlight || !jsonEditor) return;
  jsonHighlight.style.transform = `translate(${-jsonEditor.scrollLeft}px, ${-jsonEditor.scrollTop}px)`;
}

function refreshJsonSuggestions() {
  const previousSelection = activeSuggestions[selectedSuggestionIndex]?.label;
  const completion = findJsonSuggestions(jsonEditor.value, jsonEditor.selectionStart);
  if (!completion) {
    jsonSuggestions.hidden = true;
    activeSuggestions = [];
    return;
  }
  const query = completion.query.toLowerCase();
  activeSuggestions = completion.items.filter((item) => item.label.toLowerCase().startsWith(query));
  if (!activeSuggestions.length) {
    jsonSuggestions.hidden = true;
    return;
  }
  const preservedIndex = activeSuggestions.findIndex((item) => item.label === previousSelection);
  selectedSuggestionIndex = preservedIndex >= 0 ? preservedIndex : 0;
  jsonSuggestions.replaceChildren(
    ...activeSuggestions.map((item, index) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "map-json-suggestion";
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", String(index === selectedSuggestionIndex));
      option.textContent = item.label;
      option.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        acceptJsonSuggestion(index);
      });
      return option;
    })
  );
  jsonSuggestions.hidden = false;
  positionSuggestionPopup(jsonEditor.selectionStart);
}

function acceptJsonSuggestion(index = selectedSuggestionIndex) {
  const completion = findJsonSuggestions(jsonEditor.value, jsonEditor.selectionStart);
  const suggestion = activeSuggestions[index];
  if (!completion || !suggestion) return;
  const cursor = jsonEditor.selectionStart;
  let insertion = suggestion.insertText;
  let suffix = "";
  if (completion.kind === "key") {
    if (jsonEditor.value[cursor] !== '"') suffix += '"';
    if (!jsonEditor.value.slice(cursor).match(/^"\s*:/)) suffix += ": ";
  } else if (jsonEditor.value[cursor] !== '"') {
    suffix += '"';
  }
  const nextValue =
    jsonEditor.value.slice(0, completion.start) +
    insertion +
    suffix +
    jsonEditor.value.slice(cursor);
  const nextCursor = completion.start + insertion.length + suffix.length;
  jsonEditor.value = nextValue;
  jsonEditor.setSelectionRange(nextCursor, nextCursor);
  jsonEditor.dispatchEvent(new Event("input", { bubbles: true }));
  jsonEditor.focus();
}

function handleJsonEditorKeydown(event) {
  if (jsonSuggestions.hidden || activeSuggestions.length === 0) return;
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const direction = event.key === "ArrowDown" ? 1 : -1;
    selectedSuggestionIndex =
      (selectedSuggestionIndex + direction + activeSuggestions.length) % activeSuggestions.length;
    jsonSuggestions.querySelectorAll("[role=option]").forEach((option, index) => {
      option.setAttribute("aria-selected", String(index === selectedSuggestionIndex));
    });
  } else if (event.key === "Enter" || event.key === "Tab") {
    event.preventDefault();
    acceptJsonSuggestion();
  } else if (event.key === "Escape") {
    jsonSuggestions.hidden = true;
  }
}

function serializeCurrentMap() {
  return {
    version: 1,
    name: nameInput.value.trim() || "Untitled map",
    objects,
  };
}

function setEditorView(view) {
  if (editorView === "json" && view !== "json") commitJsonSession();
  editorView = view;
  const showJson = view === "json";
  toolPalette.hidden = showJson;
  propertiesPanel.hidden = showJson;
  jsonWorkspace.hidden = !showJson;
  viewTabs.forEach((tab) => {
    tab.setAttribute("aria-selected", String(tab.dataset.editorView === view));
  });
  if (showJson) {
    jsonSessionSnapshot = JSON.stringify(objects);
    jsonEditor.value = JSON.stringify(serializeCurrentMap(), null, 2);
    renderJsonHighlight();
    jsonStatus.textContent = "Changes apply automatically when the JSON is valid.";
    jsonEditor.focus();
  } else {
    requestAnimationFrame(render);
  }
}

function commitJsonSession() {
  if (jsonSessionSnapshot == null) return;
  if (jsonSessionSnapshot !== JSON.stringify(objects)) {
    history.push(jsonSessionSnapshot);
    if (history.length > 50) history.shift();
    undoButton.disabled = false;
  }
  jsonSessionSnapshot = null;
}

function validateMapJson(value) {
  const data = JSON.parse(value);
  const supportedTypes = new Set([
    "platform",
    "circle",
    "ball",
    "star",
    "stripedRect",
    "portal",
    "segment",
    "complex",
    "poly",
    "rotor",
    "text",
  ]);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("The root value must be a map object.");
  }
  if (!Array.isArray(data.objects)) {
    throw new Error('The map must contain an "objects" array.');
  }

  data.objects.forEach((object, index) => {
    if (!object || typeof object !== "object" || Array.isArray(object)) {
      throw new Error(`Object ${index + 1} must be an object.`);
    }
    if (!supportedTypes.has(object.type)) {
      throw new Error(`Object ${index + 1} has an unsupported type.`);
    }
    const isFiniteNumber = (number) => typeof number === "number" && Number.isFinite(number);
    if (object.type === "segment") {
      if (![object.x1, object.y1, object.x2, object.y2].every(isFiniteNumber)) {
        throw new Error(`Line ${index + 1} needs numeric x1, y1, x2, and y2 values.`);
      }
    } else if (["complex", "poly", "rotor"].includes(object.type)) {
      if (
        !Array.isArray(object.points) ||
        object.points.length < 2 ||
        object.points.some(
          (point) => !point || !isFiniteNumber(point.x) || !isFiniteNumber(point.y)
        )
      ) {
        throw new Error(
          `Shape ${index + 1} needs at least two points with numeric x and y values.`
        );
      }
    } else if (![object.x, object.y].every(isFiniteNumber)) {
      throw new Error(`Object ${index + 1} needs numeric x and y positions.`);
    }
    if (
      ["platform", "stripedRect", "portal"].includes(object.type) &&
      (![object.width, object.height].every(isFiniteNumber) ||
        object.width <= 0 ||
        object.height <= 0)
    ) {
      throw new Error(`Object ${index + 1} needs positive numeric width and height values.`);
    }
    if (
      ["circle", "ball", "star"].includes(object.type) &&
      (!isFiniteNumber(object.radius) || object.radius <= 0)
    ) {
      throw new Error(`Object ${index + 1} needs a positive numeric radius.`);
    }
    if (object.type === "text" && typeof object.text !== "string") {
      throw new Error(`Text object ${index + 1} needs a string text value.`);
    }
  });

  return data;
}

function applyMapJson() {
  try {
    const data = validateMapJson(jsonEditor.value);
    const nextObjects = data.objects.map((object) => ({
      ...object,
      type: object.type === "poly" ? "complex" : object.type,
    }));
    objects = nextObjects.map((nextObject, index) => {
      const currentObject = objects[index];
      if (currentObject && JSON.stringify(currentObject) === JSON.stringify(nextObject)) {
        return currentObject;
      }
      const seed = currentObject && objectSeeds.get(currentObject);
      if (seed) objectSeeds.set(nextObject, seed);
      return nextObject;
    });
    if (typeof data.name === "string" && data.name.trim()) nameInput.value = data.name.slice(0, 40);
    selectedIndex = -1;
    syncProperties();
    jsonStatus.textContent = `${objects.length} object${objects.length === 1 ? "" : "s"} applied live.`;
    render();
    setStatus("Valid JSON applied to the canvas.");
  } catch (error) {
    jsonStatus.textContent =
      error instanceof SyntaxError ? `JSON syntax error: ${error.message}` : error.message;
  }
}

function saveHistory() {
  history.push(JSON.stringify(objects));
  if (history.length > 50) history.shift();
  undoButton.disabled = history.length === 0;
}

function capturePropertyHistory() {
  if (propertySnapshot == null) propertySnapshot = JSON.stringify(objects);
}

function commitPropertyHistory() {
  if (propertySnapshot == null) return;
  history.push(propertySnapshot);
  if (history.length > 50) history.shift();
  propertySnapshot = null;
  undoButton.disabled = history.length === 0;
}

function undo() {
  const previous = history.pop();
  if (!previous) return;
  objects = JSON.parse(previous);
  selectedIndex = -1;
  undoButton.disabled = history.length === 0;
  render();
  syncProperties();
  setStatus("Last change undone.");
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(rect.width, event.clientX - rect.left)),
    y: Math.max(0, Math.min(rect.height, event.clientY - rect.top)),
    width: rect.width,
    height: rect.height,
  };
}

function getObjectCenter(object) {
  if (object.type === "segment") {
    return { x: (object.x1 + object.x2) / 2, y: (object.y1 + object.y2) / 2 };
  }
  if (Array.isArray(object.points) && object.points.length) {
    const center = object.points.reduce(
      (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
      { x: 0, y: 0 }
    );
    return { x: center.x / object.points.length, y: center.y / object.points.length };
  }
  return { x: object.x ?? 0.5, y: object.y ?? 0.5 };
}

function distanceToSegment(point, first, second) {
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  const lengthSquared = dx * dx + dy * dy;
  const progress = lengthSquared
    ? Math.max(
        0,
        Math.min(1, ((point.x - first.x) * dx + (point.y - first.y) * dy) / lengthSquared)
      )
    : 0;
  return Math.hypot(point.x - first.x - progress * dx, point.y - first.y - progress * dy);
}

function hitTest(point) {
  const { width, height } = point;
  for (let index = objects.length - 1; index >= 0; index -= 1) {
    const object = objects[index];
    const center = getObjectCenter(object);
    const x = center.x * width;
    const y = center.y * height;
    if (["platform", "stripedRect", "portal"].includes(object.type)) {
      if (
        Math.abs(point.x - x) <= (object.width * width) / 2 + 8 &&
        Math.abs(point.y - y) <= (object.height * height) / 2 + 8
      ) {
        return index;
      }
    } else if (object.type === "segment") {
      const first = { x: object.x1 * width, y: object.y1 * height };
      const second = { x: object.x2 * width, y: object.y2 * height };
      if (distanceToSegment(point, first, second) <= 12) return index;
    } else if (Array.isArray(object.points)) {
      const points = object.points.map((item) => ({ x: item.x * width, y: item.y * height }));
      const minX = Math.min(...points.map((item) => item.x)) - 12;
      const maxX = Math.max(...points.map((item) => item.x)) + 12;
      const minY = Math.min(...points.map((item) => item.y)) - 12;
      const maxY = Math.max(...points.map((item) => item.y)) + 12;
      if (point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY) return index;
    } else if (object.type === "text") {
      if (Math.abs(point.x - x) <= 60 && Math.abs(point.y - y) <= 24) return index;
    } else if (
      Math.hypot(point.x - x, point.y - y) <=
      (object.radius ?? 0.05) * Math.min(width, height) + 12
    ) {
      return index;
    }
  }
  return -1;
}

function removeAt(index) {
  if (index < 0) return;
  saveHistory();
  objects.splice(index, 1);
  selectedIndex = -1;
  render();
  syncProperties();
  setStatus("Object removed.");
}

function syncProperties() {
  const object = objects[selectedIndex];
  const hasSelection = Boolean(object);
  propertyEmpty.hidden = hasSelection;
  propertyTextWrap.hidden = object?.type !== "text";
  propertyRadiusWrap.hidden = !["circle", "ball", "star"].includes(object?.type);
  propertyClosedWrap.hidden = !["complex", "poly", "rotor"].includes(object?.type);
  propertySpinWrap.hidden = object?.type !== "rotor";
  if (!object) return;
  if (object.type === "text") propertyText.value = object.text || "";
  if (["circle", "ball", "star"].includes(object.type)) {
    propertyRadius.value = String(object.radius ?? 0.035);
  }
  if (["complex", "rotor"].includes(object.type)) propertyClosed.checked = object.closed !== false;
  if (object.type === "rotor") propertySpin.value = object.spinMode || "free";
}

function finishPolygon() {
  if (!polygonDraft || polygonDraft.points.length < 2) {
    setStatus("Add at least two points before finishing this shape.");
    return;
  }
  saveHistory();
  const draft = polygonDraft;
  const center = draft.points.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), {
    x: 0,
    y: 0,
  });
  center.x /= draft.points.length;
  center.y /= draft.points.length;
  const object =
    draft.type === "rotor"
      ? {
          type: "rotor",
          points: draft.points,
          closed: false,
          x: center.x,
          y: center.y,
          axisX: center.x,
          axisY: center.y,
          spinMode: "free",
        }
      : { type: "complex", points: draft.points, closed: true, isStatic: true };
  objects.push(object);
  selectedIndex = objects.length - 1;
  polygonDraft = null;
  render();
  syncProperties();
  setStatus(`${object.type === "rotor" ? "Rotor" : "Polygon"} added.`);
}

function onPointerDown(event) {
  if (event.button !== 0) return;
  const point = canvasPoint(event);
  const index = hitTest(point);
  canvas.setPointerCapture(event.pointerId);

  if (activeTool === "erase") {
    removeAt(index);
    return;
  }
  if (activeTool === "complex" || activeTool === "rotor") {
    if (!polygonDraft || polygonDraft.type !== activeTool)
      polygonDraft = { type: activeTool, points: [] };
    polygonDraft.points.push({ x: point.x / point.width, y: point.y / point.height });
    setStatus(
      `${activeTool === "complex" ? "Polygon" : "Rotor"}: ${polygonDraft.points.length} points. Press Enter to finish.`
    );
    render();
    return;
  }
  if (["ball", "star", "circle", "portal", "text"].includes(activeTool)) {
    saveHistory();
    const object = {
      type: activeTool === "complex" ? "complex" : activeTool,
      x: point.x / point.width,
      y: point.y / point.height,
    };
    if (["ball", "star"].includes(activeTool)) object.radius = 0.035;
    if (activeTool === "circle") {
      object.radius = 0.05;
      object.isStatic = true;
    }
    if (activeTool === "portal") {
      const portalCount = objects.filter((item) => item.type === "portal").length;
      object.width = 0.04;
      object.height = 0.1;
      object.portalId = portalCount % 2 === 0 ? "orange" : "blue";
    }
    if (activeTool === "text") object.text = "Text";
    objects.push(object);
    selectedIndex = objects.length - 1;
    render();
    syncProperties();
    setStatus(`${activeTool} added. Select it to edit its properties.`);
    return;
  }
  if (["platform", "stripedRect", "segment"].includes(activeTool)) {
    pointerAction = { kind: "draw", type: activeTool, startX: point.x, startY: point.y, point };
    render();
    return;
  }

  selectedIndex = index;
  syncProperties();
  if (index >= 0) {
    saveHistory();
    pointerAction = { kind: "move", index, previousX: point.x, previousY: point.y };
    setStatus("Drag to move the selected object.");
  } else {
    setStatus("Choose a tool or select an object.");
  }
  render();
}

function onPointerMove(event) {
  if (!pointerAction) return;
  const point = canvasPoint(event);
  if (pointerAction.kind === "draw") {
    pointerAction.endX = point.x;
    pointerAction.endY = point.y;
    render();
    return;
  }

  const object = objects[pointerAction.index];
  const deltaX = (point.x - pointerAction.previousX) / point.width;
  const deltaY = (point.y - pointerAction.previousY) / point.height;
  if (object.type === "segment") {
    object.x1 = Math.max(0, Math.min(1, object.x1 + deltaX));
    object.x2 = Math.max(0, Math.min(1, object.x2 + deltaX));
    object.y1 = Math.max(0, Math.min(1, object.y1 + deltaY));
    object.y2 = Math.max(0, Math.min(1, object.y2 + deltaY));
  } else if (Array.isArray(object.points)) {
    object.points = object.points.map((item) => ({
      x: Math.max(0, Math.min(1, item.x + deltaX)),
      y: Math.max(0, Math.min(1, item.y + deltaY)),
    }));
    if (object.type === "rotor") {
      object.x = Math.max(0, Math.min(1, object.x + deltaX));
      object.y = Math.max(0, Math.min(1, object.y + deltaY));
      object.axisX = Math.max(0, Math.min(1, object.axisX + deltaX));
      object.axisY = Math.max(0, Math.min(1, object.axisY + deltaY));
    }
  } else {
    object.x = Math.max(0, Math.min(1, object.x + deltaX));
    object.y = Math.max(0, Math.min(1, object.y + deltaY));
  }
  pointerAction.previousX = point.x;
  pointerAction.previousY = point.y;
  render();
}

function onPointerUp(event) {
  if (!pointerAction) return;
  if (pointerAction.kind === "draw") {
    const point = canvasPoint(event);
    const startX = pointerAction.startX;
    const startY = pointerAction.startY;
    const width = Math.abs(point.x - startX);
    const height = Math.abs(point.y - startY);
    if (pointerAction.type === "segment" && width + height >= 18) {
      saveHistory();
      objects.push({
        type: "segment",
        x1: startX / point.width,
        y1: startY / point.height,
        x2: point.x / point.width,
        y2: point.y / point.height,
      });
      selectedIndex = objects.length - 1;
      setStatus("Line added.");
    } else if (width >= 18 && height >= 8) {
      saveHistory();
      objects.push({
        type: pointerAction.type,
        x: (startX + point.x) / (2 * point.width),
        y: (startY + point.y) / (2 * point.height),
        width: width / point.width,
        height: height / point.height,
      });
      selectedIndex = objects.length - 1;
      setStatus(pointerAction.type === "platform" ? "Platform added." : "Forbidden Zone added.");
    } else {
      setStatus("Drag to draw a platform.");
    }
  }
  pointerAction = null;
  render();
  syncProperties();
}

function drawObject(rc, context, object, width, height, selected, seed) {
  const center = getObjectCenter(object);
  const x = center.x * width;
  const y = center.y * height;
  const style = {
    stroke: selected ? "#bd6c36" : INK,
    strokeWidth: selected ? 3 : 2.2,
    roughness: 1.5,
    seed,
    fill: "transparent",
  };

  if (["platform", "stripedRect"].includes(object.type)) {
    const options =
      object.type === "stripedRect"
        ? {
            ...style,
            stroke: "#d84335",
            fill: "#e74c3c",
            fillStyle: "hachure",
            hachureGap: 7,
            hachureAngle: -35,
          }
        : style;
    rc.rectangle(
      x - (object.width * width) / 2,
      y - (object.height * height) / 2,
      object.width * width,
      object.height * height,
      options
    );
    return;
  }
  if (object.type === "segment") {
    rc.line(object.x1 * width, object.y1 * height, object.x2 * width, object.y2 * height, style);
    return;
  }
  if (object.type === "portal") {
    const color = { orange: "#e88936", blue: "#4387c4" }[object.portalId] || "#8d63b8";
    rc.ellipse(x, y, object.width * width, object.height * height, {
      ...style,
      stroke: color,
      strokeWidth: selected ? 4 : 3,
    });
    return;
  }
  if (["complex", "rotor"].includes(object.type)) {
    const points = object.points.map((item) => [item.x * width, item.y * height]);
    if (object.type === "complex" && object.closed && points.length > 2) {
      rc.polygon(points, { ...style, fill: "#fff6eb", fillStyle: "solid" });
    } else {
      for (let index = 0; index < points.length - 1; index += 1) {
        rc.line(...points[index], ...points[index + 1], style);
      }
      if (object.closed && points.length > 2) {
        rc.line(...points.at(-1), ...points[0], style);
      }
    }
    if (object.type === "rotor") {
      rc.circle((object.axisX ?? object.x) * width, (object.axisY ?? object.y) * height, 9, {
        stroke: "#c92d39",
        fill: "#e64956",
        fillStyle: "solid",
        roughness: 1.5,
        seed: seed + 1,
      });
    }
    return;
  }
  if (object.type === "text") {
    context.save();
    context.font = "bold 18px serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.lineWidth = selected ? 2 : 1;
    context.strokeStyle = selected ? "#bd6c36" : "#fffdf5";
    context.fillStyle = INK;
    context.strokeText(object.text || "Text", x, y);
    context.fillText(object.text || "Text", x, y);
    context.restore();
    return;
  }

  const radius = (object.radius ?? 0.05) * Math.min(width, height);
  if (object.type === "star") {
    const points = Array.from({ length: 10 }, (_, index) => {
      const angle = -Math.PI / 2 + (index * Math.PI) / 5;
      const pointRadius = index % 2 === 0 ? radius : radius * 0.46;
      return [x + Math.cos(angle) * pointRadius, y + Math.sin(angle) * pointRadius];
    });
    rc.polygon(points, { ...style, fill: GOLD, fillStyle: "hachure", hachureGap: 4 });
    return;
  }
  if (object.type === "circle") {
    rc.circle(x, y, radius * 2, { ...style, fill: "#dce8d5", fillStyle: "hachure", hachureGap: 5 });
    return;
  }
  rc.circle(x, y, radius * 2, { ...style, fill: INK, fillStyle: "hachure", hachureGap: 4 });
}

function getObjectBounds(object, width, height) {
  const center = getObjectCenter(object);
  const x = center.x * width;
  const y = center.y * height;
  if (["platform", "stripedRect", "portal"].includes(object.type)) {
    return {
      left: x - (object.width * width) / 2,
      top: y - (object.height * height) / 2,
      right: x + (object.width * width) / 2,
      bottom: y + (object.height * height) / 2,
    };
  }
  if (object.type === "segment") {
    return {
      left: Math.min(object.x1, object.x2) * width,
      top: Math.min(object.y1, object.y2) * height,
      right: Math.max(object.x1, object.x2) * width,
      bottom: Math.max(object.y1, object.y2) * height,
    };
  }
  if (Array.isArray(object.points) && object.points.length) {
    const xs = object.points.map((point) => point.x * width);
    const ys = object.points.map((point) => point.y * height);
    return {
      left: Math.min(...xs),
      top: Math.min(...ys),
      right: Math.max(...xs),
      bottom: Math.max(...ys),
    };
  }
  if (object.type === "text") {
    return { left: x - 72, top: y - 24, right: x + 72, bottom: y + 24 };
  }
  const radius = (object.radius ?? 0.05) * Math.min(width, height);
  return { left: x - radius, top: y - radius, right: x + radius, bottom: y + radius };
}

function getCachedObject(object, index, width, height, dpr) {
  const selected = index === selectedIndex;
  const signature = JSON.stringify([object, width, height, dpr, selected]);
  const cached = objectRenderCache.get(object);
  if (cached?.signature === signature) return cached;

  const bounds = getObjectBounds(object, width, height);
  const padding = 14;
  const left = Math.max(0, Math.floor(bounds.left - padding));
  const top = Math.max(0, Math.floor(bounds.top - padding));
  const right = Math.min(width, Math.ceil(bounds.right + padding));
  const bottom = Math.min(height, Math.ceil(bounds.bottom + padding));
  const cacheCanvas = document.createElement("canvas");
  cacheCanvas.width = Math.max(1, Math.ceil((right - left) * dpr));
  cacheCanvas.height = Math.max(1, Math.ceil((bottom - top) * dpr));
  const cacheContext = cacheCanvas.getContext("2d");
  cacheContext.setTransform(dpr, 0, 0, dpr, -left * dpr, -top * dpr);

  let seed = objectSeeds.get(object);
  if (!seed) {
    seed = nextObjectSeed;
    nextObjectSeed += 1;
    objectSeeds.set(object, seed);
  }
  const roughCanvas = rough.canvas(cacheCanvas);
  drawObject(roughCanvas, cacheContext, object, width, height, selected, seed);

  const nextCache = {
    signature,
    canvas: cacheCanvas,
    left,
    top,
    width: right - left,
    height: bottom - top,
  };
  objectRenderCache.set(object, nextCache);
  return nextCache;
}

function render() {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const context = canvas.getContext("2d");
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, rect.width, rect.height);
  context.fillStyle = "#fffdf5";
  context.fillRect(0, 0, rect.width, rect.height);
  context.strokeStyle = "rgba(61, 53, 43, 0.08)";
  context.lineWidth = 1;
  for (let x = 24; x < rect.width; x += 24) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, rect.height);
    context.stroke();
  }
  for (let y = 24; y < rect.height; y += 24) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(rect.width, y);
    context.stroke();
  }

  objects.forEach((object, index) => {
    const cached = getCachedObject(object, index, rect.width, rect.height, dpr);
    context.drawImage(cached.canvas, cached.left, cached.top, cached.width, cached.height);
  });
  const rc = rough.canvas(canvas);
  if (polygonDraft) {
    const draftPoints = polygonDraft.points.map((item) => [
      item.x * rect.width,
      item.y * rect.height,
    ]);
    draftPoints.forEach(([x, y]) =>
      rc.circle(x, y, 7, { stroke: "#bd6c36", fill: "#f1d58a", fillStyle: "solid" })
    );
    for (let index = 0; index < draftPoints.length - 1; index += 1) {
      rc.line(...draftPoints[index], ...draftPoints[index + 1], {
        stroke: "#bd6c36",
        strokeWidth: 2,
        roughness: 1.4,
      });
    }
    if (polygonDraft.type === "complex" && draftPoints.length > 2) {
      rc.line(...draftPoints.at(-1), ...draftPoints[0], {
        stroke: "#bd6c36",
        strokeWidth: 1.5,
        roughness: 1.4,
        strokeLineDash: [4, 4],
      });
    }
  }
  if (pointerAction?.kind === "draw") {
    const endX = pointerAction.endX ?? pointerAction.startX;
    const endY = pointerAction.endY ?? pointerAction.startY;
    if (pointerAction.type === "segment") {
      rc.line(pointerAction.startX, pointerAction.startY, endX, endY, {
        stroke: INK_SOFT,
        strokeWidth: 2,
        roughness: 1.5,
        strokeLineDash: [5, 4],
      });
    } else {
      rc.rectangle(
        Math.min(pointerAction.startX, endX),
        Math.min(pointerAction.startY, endY),
        Math.abs(endX - pointerAction.startX),
        Math.abs(endY - pointerAction.startY),
        {
          stroke: INK_SOFT,
          strokeWidth: 2,
          roughness: 1.5,
          fill: "transparent",
          strokeLineDash: [5, 4],
        }
      );
    }
  }
}

function readSavedMaps() {
  try {
    const maps = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(maps) ? maps : [];
  } catch {
    return [];
  }
}

function requireMapEditorLogin() {
  if (isUserLoggedIn()) return true;
  mapBoardStatus.textContent = "Log in to create or edit maps.";
  return false;
}

async function refreshLibrary() {
  let maps;
  if (isUserLoggedIn()) {
    try {
      maps = await fetchAccountMaps();
      const accountMapIds = new Set(maps.map((map) => map.id));
      const legacyMaps = readSavedMaps().filter((map) => !accountMapIds.has(map.id));
      for (const map of legacyMaps) {
        try {
          await saveAccountMap(map.id, map);
          accountMapIds.add(map.id);
        } catch (error) {
          console.warn("Could not migrate a locally saved map:", error);
        }
      }
      if (legacyMaps.length) maps = await fetchAccountMaps();
    } catch (error) {
      setStatus(error.message || "Could not load your account maps.");
      maps = readSavedMaps();
    }
  } else {
    maps = readSavedMaps();
  }
  savedMapsCache = [...maps].sort((first, second) =>
    String(second.updatedAt || "").localeCompare(String(first.updatedAt || ""))
  );
  if (myMapsBackdrop && !myMapsBackdrop.hidden) renderMyMapsPicker();
}

function loadMap(mapId) {
  const map = savedMapsCache.find((savedMap) => savedMap.id === mapId);
  if (!map) return;
  currentMapId = map.id;
  nameInput.value = map.name || "Untitled map";
  objects = Array.isArray(map.objects) ? map.objects : [];
  history = [];
  selectedIndex = -1;
  undoButton.disabled = true;
  if (editorView === "json") setEditorView("canvas");
  render();
  syncProperties();
  setStatus(`Opened “${nameInput.value}”.`);
}

function startNewMap() {
  currentMapId = createMapId();
  objects = [];
  history = [];
  selectedIndex = -1;
  nameInput.value = "Untitled map";
  undoButton.disabled = true;
  if (editorView === "json") setEditorView("canvas");
  render();
  syncProperties();
  setStatus("New map ready.");
}

async function saveMap() {
  if (!isUserLoggedIn()) {
    showMapToast("Sign in to save maps to your account.");
    return;
  }

  const hasBall = objects.some((object) => object.type === "ball");
  const hasStar = objects.some((object) => object.type === "star");
  if (!hasBall || !hasStar) {
    const missing = [!hasBall && "ball", !hasStar && "star"].filter(Boolean);
    showMapToast(`Add at least one ${missing.join(" and ")} before saving.`);
    return;
  }

  const map = {
    id: currentMapId,
    name: nameInput.value.trim() || "Untitled map",
    version: 1,
    objects,
    updatedAt: new Date().toISOString(),
  };
  try {
    await saveAccountMap(currentMapId, map);
    await refreshLibrary();
    setStatus(`Saved “${map.name}” to your account.`);
    showMapToast(`Saved “${map.name}” to My Maps.`);
  } catch (error) {
    showMapToast(error.message || "Could not save map to your account.");
  }
}

function exportMap() {
  const map = {
    version: 1,
    name: nameInput.value.trim() || "Untitled map",
    objects,
  };
  const blob = new Blob([JSON.stringify(map, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${map.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "map"}.json`;
  link.click();
  URL.revokeObjectURL(url);
  setStatus("Map JSON exported. Share the file with other players.");
}

function initializeMapEditor() {
  if (!canvas || !dom.mapEditorPage) return;
  const backButton = document.querySelector("[data-map-editor-back]");
  document.body.appendChild(myMapsBackdrop);
  mapToast = document.createElement("div");
  mapToast.className = "multiplayer-toast map-editor-toast";
  mapToast.setAttribute("role", "status");
  mapToast.setAttribute("aria-live", "polite");
  mapToast.hidden = true;
  const mapToastMessage = document.createElement("span");
  mapToastMessage.className = "multiplayer-toast-message";
  mapToast.appendChild(mapToastMessage);
  document.body.appendChild(mapToast);
  attachRoughFrame(mapToast, {
    inset: 4,
    outside: 0,
    strokeWidth: 2,
    roughness: 2,
    fill: "rgba(250, 244, 216, 0.96)",
  });
  const framedControls = [
    ...document.querySelectorAll(".map-editor-button, .map-editor-tool"),
    ...viewTabs,
    mapCreateButton,
    mapPlayButton,
    mapShareButton,
    libraryToggle,
    myMapsPicker,
    document.querySelector(".map-editor-canvas-wrap"),
    document.querySelector(".map-editor-json-source"),
    document.querySelector(".map-property-range-frame"),
    document.querySelector(".map-reference-content"),
  ];

  framedControls.forEach((control) => {
    attachRoughFrame(control, {
      inset: 1,
      outside: 2,
      strokeWidth: 1.3,
      roughness: 1.5,
    });
  });
  backButton.appendChild(createActionIconCanvas("exit", { w: 56, h: 40, strokeWidth: 2.4 }));
  mapBoardBackButton.appendChild(
    createActionIconCanvas("exit", { w: 56, h: 40, strokeWidth: 2.4 })
  );
  mapBoardRefreshButton.appendChild(
    createActionIconCanvas("retry", { w: 48, h: 40, strokeWidth: 2.5 })
  );
  drawMapCreateOutline();
  const closeReference = () => {
    referencePanel.hidden = true;
    referenceButton.setAttribute("aria-expanded", "false");
    backButton.setAttribute("aria-label", "Back to map board");
    backButton.dataset.tooltip = "Back to map board";
    backButton.focus();
  };
  backButton.addEventListener("click", () => {
    if (!referencePanel.hidden) {
      closeReference();
      return;
    }
    setActivePage(dom.mapBoardPage);
    void refreshMapBoard();
  });
  document.querySelector("[data-map-save]").addEventListener("click", saveMap);
  mapPlayButton.addEventListener("click", () => {
    void startMapTest({ name: nameInput.value, objects });
  });
  mapShareButton.addEventListener("click", () => void shareMap());
  document.querySelector("[data-map-export]").addEventListener("click", exportMap);
  document.querySelector("[data-map-new]").addEventListener("click", startNewMap);
  mapBoardBackButton.addEventListener("click", () => setActivePage(dom.modePage));
  mapBoardRefreshButton.addEventListener("click", () => void refreshMapBoard());
  mapCreateButton.addEventListener("click", () => {
    if (!requireMapEditorLogin()) return;
    startNewMap();
    setActivePage(dom.mapEditorPage);
  });
  void refreshMapBoard();
  window.addEventListener("sketchybook:map-board-open", () => void refreshMapBoard());
  window.addEventListener("sketchybook:map-board-open", () => {
    void refreshLibrary();
  });
  const reference = isKoreanLocale() ? objectsReferenceKo : objectsReference;
  referenceContent.innerHTML = DOMPurify.sanitize(marked.parse(reference));
  referenceButton.addEventListener("click", () => {
    referencePanel.hidden = false;
    referenceButton.setAttribute("aria-expanded", "true");
    backButton.setAttribute("aria-label", "Close JSON Guide");
    backButton.dataset.tooltip = "Close JSON Guide";
    backButton.focus();
  });
  libraryToggle.addEventListener("click", () => {
    if (myMapsBackdrop.hidden) void openMyMapsPicker();
    else closeMyMapsPicker();
  });
  myMapsCloseButton.addEventListener("click", closeMyMapsPicker);
  myMapsBackdrop.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.target === myMapsBackdrop) closeMyMapsPicker();
  });
  viewTabs.forEach((tab) => {
    tab.addEventListener("click", () => setEditorView(tab.dataset.editorView));
  });
  undoButton.addEventListener("click", undo);
  undoButton.disabled = true;

  tools.forEach((button) => {
    button.addEventListener("click", () => {
      if (polygonDraft) {
        polygonDraft = null;
        render();
      }
      activeTool = button.dataset.mapTool;
      tools.forEach((tool) => tool.setAttribute("aria-pressed", String(tool === button)));
      canvas.dataset.tool = activeTool;
      setStatus(`${button.textContent.trim()} tool selected.`);
    });
  });

  propertyText.addEventListener("focus", capturePropertyHistory);
  propertyText.addEventListener("input", () => {
    capturePropertyHistory();
    const object = objects[selectedIndex];
    if (object?.type !== "text") return;
    object.text = propertyText.value;
    render();
  });
  propertyText.addEventListener("change", commitPropertyHistory);
  propertyText.addEventListener("blur", commitPropertyHistory);
  propertyRadius.addEventListener("focus", capturePropertyHistory);
  propertyRadius.addEventListener("input", () => {
    capturePropertyHistory();
    const object = objects[selectedIndex];
    if (!object || !["circle", "ball", "star"].includes(object.type)) return;
    object.radius = Number(propertyRadius.value);
    render();
  });
  propertyRadius.addEventListener("change", commitPropertyHistory);
  propertyRadius.addEventListener("blur", commitPropertyHistory);
  propertyClosed.addEventListener("change", () => {
    const object = objects[selectedIndex];
    if (!object || !["complex", "rotor"].includes(object.type)) return;
    saveHistory();
    object.closed = propertyClosed.checked;
    render();
  });
  propertySpin.addEventListener("change", () => {
    const object = objects[selectedIndex];
    if (object?.type !== "rotor") return;
    saveHistory();
    object.spinMode = propertySpin.value;
    object.motorSpeed = object.spinMode === "auto" ? 1.5 : 0;
  });

  jsonEditor.addEventListener("input", () => {
    renderJsonHighlight();
    refreshJsonSuggestions();
    applyMapJson();
  });
  jsonEditor.addEventListener("click", refreshJsonSuggestions);
  jsonEditor.addEventListener("keyup", refreshJsonSuggestions);
  jsonEditor.addEventListener("keydown", handleJsonEditorKeydown);
  jsonEditor.addEventListener("scroll", () => {
    syncJsonHighlightScroll();
    if (!jsonSuggestions.hidden) positionSuggestionPopup(jsonEditor.selectionStart);
  });

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.dataset.tool = activeTool;
  window.addEventListener("resize", render);
  window.addEventListener("keydown", (event) => {
    if (!dom.mapEditorPage.classList.contains("is-active")) return;
    if (event.key === "Escape" && !myMapsBackdrop.hidden) {
      closeMyMapsPicker();
    } else if (event.key === "Escape" && !referencePanel.hidden) {
      closeReference();
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      undo();
    } else if (event.key === "Enter" && polygonDraft) {
      event.preventDefault();
      finishPolygon();
    } else if (event.key === "Escape" && polygonDraft) {
      polygonDraft = null;
      render();
      setStatus("Shape drawing cancelled.");
    } else if (event.key === "Delete" && selectedIndex >= 0) {
      removeAt(selectedIndex);
    }
  });

  if (typeof ResizeObserver === "function")
    new ResizeObserver(render).observe(canvas.parentElement);
  void refreshLibrary().then(() => {
    if (savedMapsCache.length) {
      loadMap(savedMapsCache[0].id);
    }
  });
  requestAnimationFrame(render);
}

export { initializeMapEditor };
