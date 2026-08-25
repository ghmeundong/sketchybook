# 🎮 Sketchybook

> A hand-drawn style puzzle game - Draw lines to guide the ball and collect stars!

## Version 1

Sketchybook V1 is complete through Stage 18. Future major design changes and stage expansion will be developed separately in Sketchybook2.

## 🎯 Game Concept

**Core Mechanic**: Draw lines on screen to guide a rolling ball through the path and collect all the stars in this casual puzzle game.

---

## 🛠️ Tech Stack

| Category | Technology |
|----------|-----------|
| **Frontend** | Vite, Vanilla JS, Rough.js (sketchy UI) |
| **Physics Engine** | Planck.js (lightweight 2D simulation) |
| **Backend** | Cloudflare Workers (serverless) |
| **Deployment** | GitHub Pages (static site) |
| **Testing** | Vitest |
| **Linting** | ESLint, Prettier, Stylelint |

---

## 🚀 Quick Start

### Requirements
- Node.js 16+
- npm or yarn

### Frontend Development
```bash
npm install
npm run dev
# → Open http://localhost:5173
```

### Backend Development
```bash
cd backend
npm install
npm run dev
# → Runs on http://localhost:8787
```

### Run Both Simultaneously (Recommended)
```bash
npm run dev:full
# Starts frontend + backend together
```

---

## 📁 Project Structure

```
sketchybook/
├── src/                    # Frontend source code
│   ├── game/              # Game logic
│   │   ├── physics.js     # Planck.js physics engine
│   │   ├── gameLoop.js    # Rendering + simulation loop
│   │   ├── coordinates.js # Coordinate system transformation
│   │   ├── inputRules.js  # Input validation
│   │   └── objects/       # Game objects (ball, platform, stars, etc.)
│   ├── services/          # API services
│   └── styles/            # CSS stylesheets
├── backend/               # Cloudflare Workers
│   ├── src/
│   │   └── index.js       # Worker entry point
│   └── wrangler.toml      # Workers configuration
├── test/                  # Unit tests
├── public/                # Static assets (fonts, images)
└── docs/                  # Documentation
```

---

## 🧪 Testing

```bash
# Run once
npm run test

# Watch mode (during development)
npm run test:watch
```

---

## 📋 Code Quality

### Linting & Formatting
```bash
# Check for issues
npm run lint

# Auto-fix issues
npm run lint -- --fix
```

### Pre-commit Hooks
Husky + lint-staged automatically format and lint your code before committing.

---

## 🌐 Deployment

### Frontend (GitHub Pages)
```bash
npm run build    # Generate dist/
npm run deploy   # Deploy to GitHub Pages
```

### Backend (Cloudflare Workers)
```bash
cd backend
npm run deploy   # Deploy to Workers
```

### API Testing (Browser Console)
```javascript
fetch('/api/health')
  .then(r => r.json())
  .then(j => console.log('API:', j))
  .catch(e => console.error('API error:', e));
```

---

## 📚 Development Scripts

```bash
npm run dev              # Frontend dev server
npm run dev:backend     # Backend dev server
npm run dev:full        # Run both frontend & backend
npm run build           # Build frontend
npm run preview         # Preview build output
npm run test            # Run tests
npm run test:watch      # Watch mode testing
npm run lint            # Run linter
npm run format          # Format code
npm run deploy          # Deploy to GitHub Pages
```

---

## 📖 Documentation

- [**Architecture**](docs/ARCHITECTURE.md) - System structure overview
- [**Deployment Guide**](docs/DEPLOYMENT.md) - How to deploy
- [**Development Guide**](docs/DEVELOPMENT.md) - Dev environment setup
- [**Game Objects**](docs/OBJECTS.md) - Game object documentation

---

## 🎨 Design

- **Sketchy UI**: Hand-drawn style using Rough.js for casual aesthetics
- **Paper Texture**: Natural paper feel through background imagery
- **Responsive**: Supports desktop, tablet, and mobile devices
- **Logical Coordinate System**: 1600×900 base ensures consistent aspect ratio across all devices

---

## 🐛 Known Issues & TODO

- [View development progress](docs/todo.txt)

---

## 📝 License

MIT License - Free to use, modify, and distribute

---

## 🤝 Contributing

Bug reports and feature suggestions are always welcome!

---

**Play the Game**: [🎮 Play Sketchybook](https://github.io/sketchybook/)
