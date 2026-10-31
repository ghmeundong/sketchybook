<div align="center">

# Sketchybook

### Draw a path. Set the ball in motion. Collect every star.

An interactive physics puzzle book, drawn one line at a time.

![MIT License](https://img.shields.io/badge/license-MIT-526b52?style=flat-square)
![Vite](https://img.shields.io/badge/Vite-8.1.0-646CFF?logo=vite&logoColor=white&style=flat-square)
![JavaScript](https://img.shields.io/badge/JavaScript-ES2024-F7DF1E?logo=javascript&logoColor=222&style=flat-square)
![18 stages](https://img.shields.io/badge/stages-18-8B5E3C?style=flat-square)
![Cloudflare Workers](https://img.shields.io/badge/backend-Cloudflare%20Workers-f38020?logo=cloudflare&logoColor=white&style=flat-square)

<br>

<img src="docs/img/readme-play.gif" alt="Drawing a path to guide the ball toward a star" width="800">

<br>

[Gameplay](#gameplay) · [Features](#inside-the-sketchbook) · [Developer guide](#for-developers) · [Documentation](#documentation)

</div>

---

## Gameplay

Every stage is a small physics puzzle: study the scene, sketch a route, then launch the ball and see what happens. Collect the star, learn from a failed attempt, and redraw your solution.

<p align="center">
	<img src="docs/img/readme-gameplay.webp" alt="A custom-drawn route guiding the ball through a physics puzzle" width="800">
</p>

1. **Sketch** a line to connect platforms or shape a route.
2. **Launch** the ball and let physics take over.
3. **Collect** the star and clear the stage.

## Inside the sketchbook

- **Solo play** across 18 hand-drawn stages.
- **Four difficulty levels**, with different drawing rules and constraints.
- **Challenge mode** for an extra layer of difficulty where available.
- **Multiplayer** for drawing together from different devices.
- **Map Maker** to build, save, share, and play custom maps.
- **Desktop and mobile-friendly controls** for mouse, touch, and keyboard.

<table>
	<tr>
		<td align="center" width="50%">
			<img src="docs/img/readme-modes.webp" alt="Sketchybook mode selection screen" width="100%"><br>
			<strong>Three ways to play</strong><br>
			Solo puzzles, multiplayer drawing, or make your own map.
		</td>
		<td align="center" width="50%">
			<img src="docs/img/readme-map-editor.webp" alt="Map Maker editor with object tools and a custom puzzle" width="100%"><br>
			<strong>Make a map</strong><br>
			Place objects, shape a puzzle, then save or share it.
		</td>
	</tr>
</table>

## Controls

| Action | Desktop | Touch |
| --- | --- | --- |
| Draw a guide line | Click and drag | Drag |
| Launch the ball | Click / tap the ball, or press `Space` | Tap the ball or launch button |
| Retry the stage | Press `R` | Use the retry button |

## Difficulty

| Level | What changes |
| --- | --- |
| Easy | A forgiving introduction with fewer drawing restrictions. |
| Normal | The balanced default ruleset. |
| Hard | Tighter drawing limits and additional constraints. |
| Insane | The strictest rules and most demanding puzzles. |

Challenge mode adds extra constraints on supported difficulties.

## For developers

Setting up the project, running tests, or building the desktop app? Start with the [Developer Guide](docs/DEVELOPER_GUIDE.md).

## Built with

**Vite** · **JavaScript** · **Matter.js** · **Planck.js** · **Rough.js** · **Cloudflare Workers**

## Documentation

- [Developer guide](docs/DEVELOPER_GUIDE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Code structure](docs/CODE_STRUCTURE.md)
- [Development notes](docs/DEVELOPMENT.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Game objects](docs/OBJECTS.md)
- [Difficulty system](docs/DIFFICULTY_SYSTEM_BRIEFING.md)
- [Project todo](docs/todo.txt)

## License

MIT
