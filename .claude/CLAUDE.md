# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Before you start

Consult `.claude/context-map.md` to find which documentation files are relevant to your current task, then read them before proceeding. This keeps context focused — only load what the task actually needs.

## Documentation structure

- `.claude/` — Internal development documentation for Claude. Implementation details, architectural constraints, invariants, and patterns not obvious from reading the code. Organised into subdirectories:
  - `architecture/` — board geometry, game/app state, SVG renderer, styles and theming
  - `game-mechanics/` — scoring theory, GTO ordering
  - `game-modes/` — per-mode implementation notes (AI, Solo Puzzle)
  - `developer-tools/` — standalone React tools in `developer/`
- `docs/` — Public documentation for users and contributors: game rules, project structure, running and extending the project.

**Keep documentation current.** After any change that affects architecture, module responsibilities, file locations, APIs, game mechanics, or extension patterns — update the relevant `.claude/` and/or `docs/` files in the same commit.

**Documentation conflicts.** If a requested change contradicts a `.claude/` doc, flag it, update the doc to reflect the new decision, and align before writing code. Do not silently deviate from documented constraints.

## What this project is

**GRID** is a browser-based Dots & Boxes variant with Scrabble-style run scoring, blocked nodes that create permanent walls, and three game modes (Two Players, VS Computer, Puzzle Mode). It is a pure vanilla web project — no framework, no build step, no bundler. Every feature is implemented in plain HTML, CSS, and JavaScript ES modules.

There is also a companion **Puzzle Analyzer** (a standalone React JSX tool in `developer/`) that enumerates all orderings of a puzzle's free boxes, computes game-theory optimal play, and explains the mathematics behind the GTO solution.

---

## Running Locally

All JS files use `export`/`import` (ES modules). `index.html` loads `main.js` with `type="module"`. **Requires `py/server.py`** — `file://` protocol blocks module imports, and the puzzle API needs the custom server.

```bash
cd grid-game
python3 py/server.py
# → open http://localhost:8080
```

`py/server.py` serves static files and provides a small write API for the puzzle admin panel (see [Puzzle system](#puzzle-system) below).

---

No build step, no npm install, no test suite.

## Architecture

**Vanilla ES modules.** Single HTML page (`index.html`) with a `<div id="app">` that gets fully replaced on every render. No framework, no virtual DOM.

**Module responsibilities:**

- [js/config.js](js/config.js) — All constants: board geometry (`ROWS`, `COLS`, `DS=72`, `PAD=46`), blocked dots (`BLOCKED`/`BSET`), bonus definitions (`BONUS_DEF`/`BMAP` for regular play, `SOLO_BONUS_DEF`/`SOLO_BMAP` for puzzle mode), and theme color palettes (`THEMES`). Change anything structural here first.

- [js/game.js](js/game.js) — Pure logic, no DOM. Key exports: `initGameState()`, `initWalls()`, `applyMove()` (returns next state immutably), `applyRunScore()` (scoring formula), `aiMove()` (greedy: capture > safe > random).

- [js/renderer.js](js/renderer.js) — Builds the board as an SVG string (`buildBoardSVG()`). No side effects; called by `main.js` and injected via `innerHTML`.

- [js/puzzle.js](js/puzzle.js) — Exports `loadActivePuzzle()`: fetches `puzzles/config.json` to find the active puzzle ID, then fetches the matching `puzzles/<id>.json` and returns it as the initial game state.

- [js/main.js](js/main.js) — App state (`app` object), event handling, and rendering. Two render paths: `renderGame()` (full re-render) and `updateBoardOnly()` (fast SVG swap used on hover). Board events use a single delegated listener on `#board-container` with an `AbortController` that gets replaced on each `renderGame()` call.

**Developer tools** in [developer/](developer/) use CDN React + `@babel/standalone` — no build step, edit JSX and refresh. These are standalone teaching/analysis tools, not part of the main game:
- `puzzle-analyzer.jsx` / `puzzle-analyzer.html` — GTO analysis and theory
- `puzzle-manager.jsx` / `puzzle-manager.html` — create and manage puzzle JSON files via the server API
- `puzzle-walkthrough.jsx` / `puzzle-walkthrough.html` — step-by-step puzzle explanation

## Puzzle system

Puzzles are stored as JSON files in [puzzles/](puzzles/). `puzzles/config.json` points to the active puzzle by ID:

```json
{ "active": "puzzle-01" }
```

Each puzzle JSON is a complete `GameState` snapshot (full `h`/`v`/`captured`/`committed` arrays). `py/server.py` exposes:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/config` | GET | Read active puzzle ID |
| `/api/config` | POST | Set active puzzle ID |
| `/api/puzzles` | GET | List all puzzle metadata |
| `/api/puzzles/<id>` | POST | Write a puzzle JSON file |

The **Puzzle Manager** at `developer/puzzle-manager.html` provides a UI for creating and switching puzzles without editing JSON by hand.

## What to avoid

- **Do not** add `localStorage` — avoid for portability; the game must run without persistent client state
- **Do not** set SVG presentation attributes to `var(--color)` — CSS custom properties don't work in SVG attributes; use the JS `THEMES` object instead
- **Do not** add event listeners to individual SVG child elements — always delegate from `#board-container`
- **Do not** call `renderGame()` from inside the AI `setTimeout` loop body — only call it after the loop completes
- **Do not** mutate the `app.game` state object in place — always replace it with a new object returned by `applyMove`
- **Do not** import from `main.js` — it is the entry point only. All shared logic lives in `config.js`, `game.js`, `puzzle.js`, or `renderer.js`
- **Do not** add a build step — the project must remain runnable with just `python3 py/server.py`
- **Do not** use `python3 -m http.server` — the puzzle API requires `py/server.py`

## Common extension patterns

### Adding a new game mode
1. Add the mode string to the union in `main.js` `app.mode`
2. Create a board initialiser in `puzzle.js` (or inline in `main.js` if simple)
3. Add a menu button in `renderMenu()`
4. Handle the new mode in `handleEdge()` AI-trigger condition and `getBmap()` / `getBonusDef()` selectors

### Adding a new bonus type
1. Add entries to `BONUS_DEF` in `config.js`
2. Update `applyRunScore()` in `game.js` if a new `op` value is needed
3. Update `buildBonusIcon()` in `renderer.js` for the visual shape/colour
4. Update `buildExplanation()` in `developer/puzzle-analyzer.jsx` for the theory text

### Adding a new puzzle
1. Open `developer/puzzle-manager.html` (requires `py/server.py` running) and use the UI to create the puzzle JSON, or write `puzzles/<id>.json` by hand following the shape of `puzzles/puzzle-01.json`
2. Set `"active"` in `puzzles/config.json` to the new ID (or use the Puzzle Manager UI)
3. Verify the GTO solution using `developer/puzzle-analyzer.html` before shipping
