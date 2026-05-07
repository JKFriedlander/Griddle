# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

**GRID** is a browser-based Dots & Boxes variant with Scrabble-style run scoring, blocked nodes that create permanent walls, and three game modes (Two Players, VS Computer, Puzzle Mode). It is a pure vanilla web project — no framework, no build step, no bundler. Every feature is implemented in plain HTML, CSS, and JavaScript ES modules.

There is also a companion **Puzzle Analyzer** (a standalone React JSX artifact) that enumerates all orderings of a puzzle's free boxes, computes game-theory optimal play, and explains the mathematics behind the GTO solution.

---

## Running Locally

All JS files use `export`/`import` (ES modules). `index.html` loads `main.js` with `type="module"`. **Requires a local web server** — `file://` protocol blocks module imports.

ES modules require a server (browsers block `file://` imports):

```bash
python3 -m http.server 8080
# or
npx serve .
```

```bash
# Python (no install needed)
cd grid-game && python3 -m http.server 8080
# → open http://localhost:8080

# Node.js
cd grid-game && npx serve .
```

---

No build step, no npm install, no test suite.

## Architecture

**Vanilla ES modules.** Single HTML page (`index.html`) with a `<div id="app">` that gets fully replaced on every render. No framework, no virtual DOM.

**Module responsibilities:**

- [js/config.js](js/config.js) — All constants: board geometry (`ROWS`, `COLS`, `DS=72`, `PAD=46`), blocked dots (`BLOCKED`/`BSET`), bonus definitions (`BONUS_DEF`/`BMAP` for regular play, `SOLO_BONUS_DEF`/`SOLO_BMAP` for puzzle mode), and theme color palettes (`THEMES`). Change anything structural here first.

- [js/game.js](js/game.js) — Pure logic, no DOM. Key functions: `initGameState()`, `applyMove()` (returns next state immutably), `applyRunScore()` (scoring formula), `aiMove()` (greedy: capture > safe > random).

- [js/renderer.js](js/renderer.js) — Builds the board as an SVG string (`buildBoardSVG()`). No side effects; called by `main.js` and injected via `innerHTML`.

- [js/puzzle.js](js/puzzle.js) — Constructs the solo puzzle initial state (`buildSoloPuzzle()`): a hand-crafted endgame with pre-drawn edges.

- [js/main.js](js/main.js) — App state (`app` object), event handling, and rendering. Two render paths: `renderGame()` (full re-render) and `updateBoardOnly()` (fast SVG swap used on hover). Board events use a single delegated listener on `#board-container` with an `AbortController` that gets replaced on each `renderGame()` call.

**React tools** ([puzzle-walkthrough.jsx](puzzle-walkthrough.jsx), [puzzle-analyzer.jsx](puzzle-analyzer.jsx)) use CDN React + `@babel/standalone` — no build step, edit JSX and refresh. These are standalone teaching/analysis tools, not part of the main game.

## What to avoid

- **Do not** add `localStorage` — not supported in the artifact environment
- **Do not** set SVG presentation attributes to `var(--color)` — CSS custom properties don't work in SVG attributes; use the JS `THEMES` object instead
- **Do not** add event listeners to individual SVG child elements — always delegate from `#board-container`
- **Do not** call `renderGame()` from inside the AI `setTimeout` loop body — only call it after the loop completes
- **Do not** mutate the `app.game` state object in place — always replace it with a new object returned by `applyMove`
- **Do not** import from `main.js` — it is the entry point only. All shared logic lives in `config.js`, `game.js`, `puzzle.js`, or `renderer.js`
- **Do not** add a build step — the project must remain runnable with just `python3 -m http.server`

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
4. Update `buildExplanation()` in `puzzle-analyzer.jsx` for the theory text

### Adding a new puzzle
1. Write a builder function in `puzzle.js` following the pattern of `buildSoloPuzzle()`
2. Create a matching `SOLO_BONUS_DEF`-style array in `config.js`
3. Verify the GTO solution by hand before shipping (enumerate all permutations)
4. Add the mode selector in `main.js`