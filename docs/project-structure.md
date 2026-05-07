## Project structure

```
grid-game/
├── index.html              # Shell — loads fonts, links CSS, bootstraps JS module
├── server.py               # Dev server: static files + puzzle write API
├── css/
│   └── styles.css          # All styling. CSS custom properties drive dark/light theming.
├── js/
│   ├── config.js           # Constants, blocked-dot positions, bonus definitions, theme colour objects
│   ├── game.js             # Pure game logic — no DOM touches, fully unit-testable
│   ├── puzzle.js           # Fetches the active puzzle JSON from the server
│   ├── renderer.js         # Builds the SVG board as an HTML string — no DOM side effects
│   └── main.js             # App state object, render functions, event wiring, AI loop
├── puzzles/
│   ├── config.json         # Active puzzle pointer: { "active": "puzzle-01" }
│   └── puzzle-01.json      # Puzzle game-state snapshots (full h/v/captured/committed arrays)
└── developer/              # Standalone React tools — CDN React + Babel, no build step
    ├── puzzle-analyzer.html / .jsx    # GTO analysis: enumerate all box orderings
    ├── puzzle-manager.html / .jsx     # Create and switch puzzles via the server API
    └── puzzle-walkthrough.html / .jsx # Step-by-step puzzle explanation
```

### Server API (`server.py`)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/config` | GET | Read `puzzles/config.json` |
| `/api/config` | POST | Write `{ "active": "<id>" }` to `puzzles/config.json` |
| `/api/puzzles` | GET | List metadata from all `puzzles/*.json` files |
| `/api/puzzles/<id>` | POST | Write a puzzle JSON to `puzzles/<id>.json` |
