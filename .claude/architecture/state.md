## Game state shape

```js
{
  h:         (null|'wall'|'pre'|0|1)[][],  // horizontal edges [ROWS+1][COLS]
  v:         (null|'wall'|'pre'|0|1)[][],  // vertical edges   [ROWS][COLS+1]
  captured:  (null|0|1)[][],               // box ownership    [ROWS][COLS]
  committed: [number, number],             // banked scores    [p0, p1]
  runScore:  number,                       // live run accumulator (active player only)
  player:    0 | 1,
  over:      boolean,
  lastMove:  { t: 'h'|'v', r: number, c: number, p: 0|1 } | null,
  scored:    boolean,  // transient — true if the last move captured ≥ 1 box
}
```

`scored` is a transient field set by `applyMove` and immediately consumed by `main.js` to decide whether the turn passes. Do not treat it as reliable persistent state.

### `applyMove` — immutability and player

`applyMove(type, r, c, player, state, bmap)` is **pure** — it returns a new state object and never mutates in place.

**It does not set `player` in its return value.** The caller (`main.js`) derives the next player from `scored` and writes it back:

```js
// main.js — handleEdge
const res  = applyMove(type, r, c, app.game.player, app.game, bm);
const next = res.scored ? app.game.player : 1 - app.game.player;
app.game   = { ...res, player: next, over };
```

### `initGameState` and `initWalls`

`game.js` exports both:

- `initGameState(blocked)` — full blank game state; calls `initWalls` internally.
- `initWalls(blocked)` — returns just `{ h, v }` with walls applied. Use this when you need the edge layout without a full game state (e.g. custom board initialisers).

---

## App state (`main.js`)

`main.js` owns a single mutable `app` object:

```js
const app = {
  dark:       boolean,
  mode:       '2P' | 'AI' | 'SOLO' | 'HTP' | null,  // SOLO = Puzzle Mode, HTP = How To Play
  game:       GameState | null,
  aiRunning:  boolean,
  hov:        { t, r, c } | null,    // hovered edge
  hovKey:     string | null,          // serialized hov for fast change-detection
  boardCtrl:  AbortController | null, // board event listener cleanup
  demoStep:   number,                 // 0–3 — active step in the menu demo
};
```

`mode === 'HTP'` renders the How To Play screen (`renderHowToPlay()`). `demoStep` is reset to 0 when returning to the menu via `goToMenu()`.

### Render strategy

| Trigger | Function | What updates |
|---------|----------|--------------|
| Mode change, move made, theme toggle | `renderGame()` | Full `#app` innerHTML |
| Hover over edge | `updateBoardOnly()` | Only `#board-container` innerHTML |
| Menu demo navigation | `renderMenu()` | Full `#app` innerHTML |
| How To Play navigation | `renderHowToPlay()` | Full `#app` innerHTML |

**Board events use event delegation**: listeners attach to `#board-container` (the stable container), not to individual SVG child elements. This means `#board-container.innerHTML` can be replaced freely without losing the event listeners. Listeners are managed with `AbortController` — call `app.boardCtrl.abort()` before re-attaching.

```js
// Hover detection in onBoardMousemove:
const hovKey = g ? `${g.dataset.t}|${g.dataset.r}|${g.dataset.c}` : null;
if (hovKey !== app.hovKey) { … updateBoardOnly(); }
```
