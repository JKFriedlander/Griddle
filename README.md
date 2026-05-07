# GRID — Dots & Boxes Reimagined

A strategic puzzle game built with vanilla HTML, CSS, and JavaScript (ES modules).

## Features

- **Three modes** — Two Players, VS Computer, Puzzle Mode
- **Dark / Light theme** — toggle in the top-right corner
- **Run-based scoring** — score builds during your turn; multipliers compound
- **Bonus squares** — flat bonuses (+1/+2/+3) and run multipliers (×2/×3)
- **Blocked nodes** — permanent walls that reshape the board
- **Last-move glow** — pulsing highlight shows the most recent edge drawn
- **Puzzle Mode** — server-driven endgame puzzles with game-theory optimal solutions

## Scoring Rules

Each turn you draw edges until you fail to capture a box.

| Box type    | Effect on run score                   |
|-------------|---------------------------------------|
| Normal      | `run = run + 1`                       |
| Flat (+n)   | `run = run + 1 + n`  (base first)     |
| Multi (×n)  | `run = (run + 1) × n` (base first)    |

When your turn ends your run is banked. The key insight: always apply
multipliers **last** — they multiply everything built up before them.

## Running Locally

ES modules require a web server, and Puzzle Mode needs the custom server API.

```bash
cd grid-game
python3 server.py
# open http://localhost:8080
```

`server.py` serves static files and exposes a small write API for puzzle management. Do **not** use `python3 -m http.server` — it won't serve the puzzle API.

## Project Structure

```
grid-game/
├── index.html              # HTML shell (single page)
├── server.py               # Dev server: static files + puzzle API
├── css/
│   └── styles.css          # All styles; CSS custom properties for theming
├── js/
│   ├── config.js           # Constants, blocked dots, bonus defs, theme colours
│   ├── game.js             # Pure game logic (no DOM)
│   ├── puzzle.js           # Fetches active puzzle from server
│   ├── renderer.js         # SVG string builder (no DOM side-effects)
│   └── main.js             # App state, rendering, event handling
├── puzzles/
│   ├── config.json         # Points to the active puzzle: { "active": "puzzle-01" }
│   └── puzzle-01.json      # Puzzle game-state snapshots
├── developer/              # Standalone React tools (CDN React, no build)
│   ├── puzzle-analyzer.jsx # GTO analysis — enumerates all box orderings
│   ├── puzzle-manager.jsx  # Create / switch puzzles via the server API
│   └── puzzle-walkthrough.jsx  # Step-by-step puzzle explanation
└── docs/
    ├── game-rules.md       # Scoring system deep-dive
    └── project-structure.md
```

## Browser Support

Any modern browser (Chrome 80+, Firefox 75+, Safari 14+, Edge 80+).
Requires: ES modules, CSS custom properties, `AbortController`.
