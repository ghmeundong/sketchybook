# Sketchybook

![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)
![Vite](https://img.shields.io/badge/Vite-8.1.0-646CFF?logo=vite)
![JavaScript](https://img.shields.io/badge/JavaScript-ES2024-F7DF1E?logo=javascript)
![Stages](https://img.shields.io/badge/stages-18-8B5E3C)
![Backend](https://img.shields.io/badge/backend-Cloudflare%20Workers-f38020)

A hand-drawn physics puzzle game where you draw a route, launch a ball, and solve each stage by adjusting the line and reaction timing.

## Overview

Sketchybook is a stage-based puzzle game built around simple physics and player-drawn guidance. Each level asks the player to shape a path, launch the ball, and complete the objective while accounting for movement, collision, and environmental constraints.

## Gameplay

- Draw a path to guide the ball
- Launch the ball into motion
- Collect stars and finish the stage objective
- Retry when the route needs adjustment
- Progress through increasing difficulty and stage complexity

## Features

- Hand-drawn paper-style presentation
- Physics-driven ball movement and collision behavior
- Stage progression with multiple difficulty levels
- Challenge mode on higher difficulties
- Responsive layout for desktop and mobile-friendly play

## Controls

- Drag: draw a guide line
- Click / tap: launch the ball
- Space: launch the ball
- R: retry the current stage

## Difficulty system

- Easy: forgiving and beginner-friendly
- Normal: balanced default experience
- Hard: tighter constraints and reduced flexibility
- Insane: more demanding puzzles with stricter rules

Challenge mode can also be enabled on higher difficulties for extra constraints.

## Quick start

### Install dependencies

```bash
npm install
```

### Start the frontend

```bash
npm run dev
```

### Start the backend

```bash
cd backend
npm install
npm run dev
```

### Run both together

```bash
npm run dev:full
```

### Build for production

```bash
npm run build
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Development](docs/DEVELOPMENT.md)
- [Objects](docs/OBJECTS.md)
- [Difficulty system briefing](docs/DIFFICULTY_SYSTEM_BRIEFING.md)
- [Todo](docs/todo.txt)

## License

MIT
