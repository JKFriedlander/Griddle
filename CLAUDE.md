# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running Locally

ES modules require a server (browsers block `file://` imports):

```bash
python3 -m http.server 8080
# or
npx serve .
```

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

## Scoring Rules

Every capture increments a live `runScore`; when a move captures nothing, the run commits to `committed[player]` and resets.

| Box type  | Formula                    |
|-----------|----------------------------|
| Normal    | `run = run + 1`            |
| Flat +n   | `run = run + 1 + n`        |
| Multi ×n  | `run = (run + 1) × n`      |

The base `+1` always applies before the bonus. GTO rule: apply multipliers last (ascending if multiple).

## Themes

SVG attributes can't use CSS custom properties, so theme colors live in `THEMES` in `config.js` (not in `styles.css`). `dark`/`light` toggle is stored in `app.dark` and `document.documentElement.dataset.theme`.

**When writing or editing styles:**

- Always use CSS custom properties (`var(--token)`) — never hardcode color values (hex, rgb, rgba, hsl) directly in rules.
- If a needed color isn't covered by an existing token, add it to both `[data-theme="dark"]` and `[data-theme="light"]` in `styles.css` before using it.
- After any style change, scan the full `.css` file being edited for remaining hardcoded color values and replace them with the appropriate variables.
