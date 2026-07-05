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
      { type: "text", x: 0.7, y: 0.2, text: "that's all! click and draw!" },
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
    minEvents: 2,
    objects: [
      { type: "ball", x: 0.5, y: 0.45 },
      { type: "platform", x: 0.5, y: 0.5 },
      { type: "star", x: 0.5, y: 0.6 },
    ],
  },
  8: {
    id: 8,
    title: "Stage 8",
    minEvents: 2,
    objects: [
      { type: "ball", x: 0.3, y: 0.45 },
      { type: "platform", x: 0.3, y: 0.5 },
      {
        type: "complex",
        points: [
          { x: 0.38, y: 0.5 },
          { x: 0.62, y: 0.5 },
          { x: 0.5, y: 0.6 },
        ],
        closed: true,
        isStatic: false,
      },
      { type: "platform", x: 0.5, y: 0.65 },
      { type: "star", x: 0.7, y: 0.6 },
    ],
  },
  9: {
    id: 9,
    title: "Stage 9",
    minEvents: 1,
    objects: [
      { type: "text", x: 0.3, y: 0.3, text: "you cannot draw on striped area" },
      { type: "ball", x: 0.3, y: 0.4 },
      { type: "platform", x: 0.3, y: 0.45 },
      { type: "circle", x: 0.5, y: 0.6, radius: 0.05, isStatic: true },
      { type: "star", x: 0.7, y: 0.4 },
    ],
  },
  10: {
    id: 10,
    title: "Stage 10",
    minEvents: 1,
    objects: [
      { type: "ball", x: 0.4, y: 0.4 },
      { type: "platform", x: 0.4, y: 0.55 },
      { type: "platform", x: 0.5, y: 0.55, width: 0.02, height: 0.2 },
      { type: "star", x: 0.6, y: 0.5 },
    ],
  },
  11: {
    id: 11,
    title: "Stage 11",
    minEvents: 1,
    objects: [
      { type: "ball", x: 0.3, y: 0.5 },
      { type: "platform", x: 0.3, y: 0.55 },
      { type: "stripedRect", x: 0.6, y: 0.5, width: 0.05, height: 1 },
      { type: "platform", x: 0.7, y: 0.55 },
      { type: "star", x: 0.7, y: 0.5 },
    ],
  },
  12: {
    id: 12,
    title: "Stage 12",
    minEvents: 2,
    objects: [
      { type: "ball", x: 0.3, y: 0.5 },
      { type: "platform", x: 0.3, y: 0.55 },
      { type: "stripedRect", x: 0.3, y: 0.55, width: 0.1, height: 0.05 },
      { type: "star", x: 0.7, y: 0.5 },
    ],
  },
  13: {
    id: 13,
    title: "Stage 13",
    minEvents: 1,
    objects: [
      { type: "star", x: 0.5, y: 0.5 },
      { type: "text", x: 0.5, y: 0.4, text: "in update..." },
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
  19: {
    id: 19,
    title: "Stage 19",
    minEvents: 1,
    objects: [
      { type: "text", x: 0.5, y: 0.2, text: "swing wide" },
      { type: "ball", x: 0.25, y: 0.42 },
      { type: "platform", x: 0.5, y: 0.58 },
      { type: "star", x: 0.78, y: 0.4 },
    ],
  },
  20: {
    id: 20,
    title: "Stage 20",
    minEvents: 1,
    objects: [
      { type: "text", x: 0.5, y: 0.2, text: "follow the curve" },
      { type: "ball", x: 0.28, y: 0.42 },
      { type: "segment", x1: 0.42, y1: 0.5, x2: 0.72, y2: 0.6 },
      { type: "star", x: 0.78, y: 0.4 },
    ],
  },
  21: {
    id: 21,
    title: "Stage 21",
    minEvents: 1,
    objects: [
      { type: "text", x: 0.5, y: 0.2, text: "small nudge" },
      { type: "ball", x: 0.3, y: 0.44 },
      { type: "platform", x: 0.55, y: 0.54 },
      { type: "star", x: 0.74, y: 0.44 },
    ],
  },
  22: {
    id: 22,
    title: "Stage 22",
    minEvents: 1,
    objects: [
      { type: "text", x: 0.5, y: 0.2, text: "keep it rolling" },
      { type: "ball", x: 0.24, y: 0.42 },
      { type: "platform", x: 0.48, y: 0.56 },
      { type: "star", x: 0.76, y: 0.4 },
    ],
  },
  23: {
    id: 23,
    title: "Stage 23",
    minEvents: 1,
    objects: [
      { type: "text", x: 0.5, y: 0.2, text: "bridge the gap" },
      { type: "ball", x: 0.2, y: 0.42 },
      { type: "platform", x: 0.5, y: 0.58 },
      { type: "star", x: 0.8, y: 0.42 },
    ],
  },
  24: {
    id: 24,
    title: "Stage 24",
    minEvents: 1,
    objects: [
      { type: "text", x: 0.5, y: 0.2, text: "light touch" },
      { type: "ball", x: 0.26, y: 0.44 },
      { type: "segment", x1: 0.38, y1: 0.5, x2: 0.7, y2: 0.54 },
      { type: "star", x: 0.76, y: 0.4 },
    ],
  },
  25: {
    id: 25,
    title: "Stage 25",
    minEvents: 1,
    objects: [
      { type: "text", x: 0.5, y: 0.2, text: "steady rhythm" },
      { type: "ball", x: 0.28, y: 0.42 },
      { type: "platform", x: 0.54, y: 0.56 },
      { type: "star", x: 0.76, y: 0.42 },
    ],
  },
  26: {
    id: 26,
    title: "Stage 26",
    minEvents: 1,
    objects: [
      { type: "text", x: 0.5, y: 0.2, text: "turn the corner" },
      { type: "ball", x: 0.22, y: 0.42 },
      { type: "platform", x: 0.52, y: 0.58 },
      { type: "star", x: 0.8, y: 0.4 },
    ],
  },
  27: {
    id: 27,
    title: "Stage 27",
    minEvents: 1,
    objects: [
      { type: "text", x: 0.5, y: 0.2, text: "trick shot" },
      { type: "ball", x: 0.24, y: 0.42 },
      { type: "segment", x1: 0.4, y1: 0.5, x2: 0.7, y2: 0.58 },
      { type: "star", x: 0.78, y: 0.4 },
    ],
  },
  28: {
    id: 28,
    title: "Stage 28",
    minEvents: 1,
    objects: [
      { type: "text", x: 0.5, y: 0.2, text: "aim for the peak" },
      { type: "ball", x: 0.3, y: 0.44 },
      { type: "platform", x: 0.54, y: 0.58 },
      { type: "star", x: 0.78, y: 0.4 },
    ],
  },
  29: {
    id: 29,
    title: "Stage 29",
    minEvents: 1,
    objects: [
      { type: "text", x: 0.5, y: 0.2, text: "steady climb" },
      { type: "ball", x: 0.26, y: 0.42 },
      { type: "segment", x1: 0.4, y1: 0.5, x2: 0.72, y2: 0.56 },
      { type: "star", x: 0.8, y: 0.4 },
    ],
  },
  30: {
    id: 30,
    title: "Stage 30",
    minEvents: 1,
    objects: [
      { type: "text", x: 0.5, y: 0.2, text: "final flourish" },
      { type: "ball", x: 0.24, y: 0.42 },
      { type: "platform", x: 0.54, y: 0.56 },
      { type: "star", x: 0.8, y: 0.4 },
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
