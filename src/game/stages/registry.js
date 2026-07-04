import { createStageTemplate } from "./stageTemplate.js";

const stageDefinitions = {
  1: {
    id: 1,
    title: "Stage 1",
    minEvents: 1,
    objects: [
      { type: "text", x: 0.3, y: 0.3, text: "click a ball to move it" },
      { type: "ball", x: 0.3, y: 0.4 },
      { type: "platform", x: 0.3, y: 0.45 },
      { type: "platform", x: 0.7, y: 0.55 },
      { type: "segment", x1: 0.35, y1: 0.425, x2: 0.65, y2: 0.525 },
      { type: "star", x: 0.7, y: 0.5 },
    ],
  },
  2: {
    id: 2,
    title: "Stage 2",
    minEvents: 2,
    objects: [
      { type: "text", x: 0.3, y: 0.3, text: "draw a line to connect the platforms" },
      { type: "ball", x: 0.3, y: 0.4 },
      { type: "platform", x: 0.3, y: 0.45 },
      { type: "platform", x: 0.7, y: 0.55 },
      { type: "star", x: 0.7, y: 0.5 },
    ],
  },
  3: {
    id: 3,
    title: "Stage 3",
    minEvents: 2,
    objects: [
      { type: "text", x: 0.7, y: 0.2, text: "that's all! click and draw, enjoy it!" },
      { type: "ball", x: 0.7, y: 0.3 },
      { type: "platform", x: 0.3, y: 0.65 },
      { type: "platform", x: 0.7, y: 0.35 },
      { type: "star", x: 0.3, y: 0.6 },
    ],
  },
  4: {
    id: 4,
    title: "Stage 4",
    minEvents: 1,
    objects: [
      { type: "text", x: 0.5, y: 0.3, text: "It looks like a see-saw, right?" },
      { type: "ball", x: 0.35, y: 0.5 },
      { type: "star", x: 0.65, y: 0.4 },
      {
        type: "rotor",
        points: [
          { x: 0.3, y: 0.53 },
          { x: 0.3, y: 0.55 },
          { x: 0.7, y: 0.55 },
          { x: 0.7, y: 0.53 },
        ],
        closed: false,
        axisX: 0.5,
        axisY: 0.55,
        spinMode: "free",
      },
      {
        type: "complex",
        points: [
          { x: 0.4, y: 0.6 },
          { x: 0.5, y: 0.56 },
          { x: 0.6, y: 0.6 },
        ],
        closed: true,
        isStatic: true,
      },
    ],
  },
  5: {
    id: 5,
    title: "Stage 5",
    minEvents: 1,
    objects: [
      { type: "text", x: 0.3, y: 0.5, text: "A red dot is a axis" },
      {
        type: "rotor",
        points: [
          { x: 0.25, y: 0.25 },
          { x: 0.35, y: 0.25 },
          { x: 0.35, y: 0.35 },
          { x: 0.25, y: 0.35 },
        ],
        closed: true,
        axisX: 0.3,
        axisY: 0.3,
        spinMode: "free",
      },
      { type: "ball", x: 0.3, y: 0.6 },
      { type: "platform", x: 0.3, y: 0.65 },
      { type: "platform", x: 0.7, y: 0.75 },
      { type: "star", x: 0.7, y: 0.7 },
    ],
  },
  6: {
    id: 6,
    title: "Stage 6",
    minEvents: 1,
    objects: [
      { type: "text", x: 0.3, y: 0.5, text: "this is a bonus" },
      {
        type: "rotor",
        points: [
          { x: 0.25, y: 0.25 },
          { x: 0.35, y: 0.25 },
          { x: 0.35, y: 0.35 },
          { x: 0.25, y: 0.35 },
        ],
        closed: true,
        axisX: 0.3,
        axisY: 0.3,
        spinMode: "auto",
        motorSpeed: -9,
        maxMotorTorque: 999999999,
      },
      { type: "ball", x: 0.3, y: 0.6 },
      { type: "platform", x: 0.3, y: 0.65 },
      { type: "platform", x: 0.7, y: 0.75 },
      { type: "star", x: 0.7, y: 0.7 },
    ],
  },
  7: {
    id: 7,
    title: "Stage 7",
    minEvents: 1,
    objects: [
      { type: "text", x: 0.5, y: 0.2, text: "follow the trail" },
      { type: "ball", x: 0.25, y: 0.42 },
      { type: "platform", x: 0.5, y: 0.58 },
      { type: "star", x: 0.75, y: 0.42 },
    ],
  },
  8: {
    id: 8,
    title: "Stage 8",
    minEvents: 1,
    objects: [
      { type: "text", x: 0.5, y: 0.2, text: "balance the bridge" },
      { type: "ball", x: 0.3, y: 0.45 },
      { type: "platform", x: 0.5, y: 0.55 },
      { type: "segment", x1: 0.35, y1: 0.48, x2: 0.65, y2: 0.58 },
      { type: "star", x: 0.74, y: 0.42 },
    ],
  },
  9: {
    id: 9,
    title: "Stage 9",
    minEvents: 1,
    objects: [
      { type: "text", x: 0.5, y: 0.2, text: "guide the orbit" },
      { type: "ball", x: 0.25, y: 0.4 },
      { type: "platform", x: 0.6, y: 0.55 },
      { type: "star", x: 0.75, y: 0.4 },
    ],
  },
  10: {
    id: 10,
    title: "Stage 10",
    minEvents: 1,
    objects: [
      { type: "text", x: 0.5, y: 0.2, text: "steady hands" },
      { type: "ball", x: 0.3, y: 0.4 },
      { type: "segment", x1: 0.38, y1: 0.48, x2: 0.72, y2: 0.52 },
      { type: "star", x: 0.72, y: 0.38 },
    ],
  },
  11: {
    id: 11,
    title: "Stage 11",
    minEvents: 1,
    objects: [
      { type: "text", x: 0.5, y: 0.2, text: "link the path" },
      { type: "ball", x: 0.25, y: 0.48 },
      { type: "platform", x: 0.5, y: 0.56 },
      { type: "star", x: 0.75, y: 0.5 },
    ],
  },
  12: {
    id: 12,
    title: "Stage 12",
    minEvents: 1,
    objects: [
      { type: "text", x: 0.5, y: 0.2, text: "find the finish" },
      { type: "ball", x: 0.3, y: 0.42 },
      { type: "platform", x: 0.55, y: 0.48 },
      { type: "star", x: 0.75, y: 0.42 },
    ],
  },
  13: {
    id: 13,
    title: "Stage 13",
    minEvents: 1,
    objects: [
      { type: "text", x: 0.5, y: 0.2, text: "keep the motion" },
      { type: "ball", x: 0.25, y: 0.42 },
      { type: "segment", x1: 0.35, y1: 0.5, x2: 0.65, y2: 0.5 },
      { type: "star", x: 0.75, y: 0.4 },
    ],
  },
  14: {
    id: 14,
    title: "Stage 14",
    minEvents: 1,
    objects: [
      { type: "text", x: 0.5, y: 0.2, text: "edge the turn" },
      { type: "ball", x: 0.2, y: 0.45 },
      { type: "platform", x: 0.5, y: 0.6 },
      { type: "star", x: 0.75, y: 0.42 },
    ],
  },
  15: {
    id: 15,
    title: "Stage 15",
    minEvents: 1,
    objects: [
      { type: "text", x: 0.5, y: 0.2, text: "steady arc" },
      { type: "ball", x: 0.28, y: 0.4 },
      { type: "segment", x1: 0.38, y1: 0.48, x2: 0.72, y2: 0.58 },
      { type: "star", x: 0.75, y: 0.42 },
    ],
  },
  16: {
    id: 16,
    title: "Stage 16",
    minEvents: 1,
    objects: [
      { type: "text", x: 0.5, y: 0.2, text: "push through" },
      { type: "ball", x: 0.25, y: 0.4 },
      { type: "platform", x: 0.52, y: 0.55 },
      { type: "star", x: 0.75, y: 0.42 },
    ],
  },
  17: {
    id: 17,
    title: "Stage 17",
    minEvents: 1,
    objects: [
      { type: "text", x: 0.5, y: 0.2, text: "tight route" },
      { type: "ball", x: 0.3, y: 0.45 },
      { type: "platform", x: 0.6, y: 0.54 },
      { type: "star", x: 0.76, y: 0.38 },
    ],
  },
  18: {
    id: 18,
    title: "Stage 18",
    minEvents: 1,
    objects: [
      { type: "text", x: 0.5, y: 0.2, text: "final draft" },
      { type: "ball", x: 0.26, y: 0.4 },
      { type: "platform", x: 0.5, y: 0.56 },
      { type: "star", x: 0.75, y: 0.42 },
    ],
  },
};

export function getStageDefinition(stageNumber) {
  const parsed = Number(stageNumber);
  if (!Number.isInteger(parsed)) {
    return null;
  }
  return stageDefinitions[parsed] ?? null;
}

export function createStageFromDefinition(stageNumber, canvas, board) {
  const definition = getStageDefinition(stageNumber);
  if (!definition) {
    return null;
  }

  return createStageTemplate(
    {
      stageNumber: definition.id,
      title: definition.title,
      minEvents: definition.minEvents,
      objects: definition.objects,
    },
    canvas,
    board
  );
}
