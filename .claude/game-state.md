## Game state shape

```js
{
  h:         number[][],   // horizontal edges [ROWS+1][COLS]
  v:         number[][],   // vertical edges   [ROWS][COLS+1]
  captured:  (null|0|1)[][],  // box ownership [ROWS][COLS]
  committed: [number, number], // banked scores [p0, p1]
  runScore:  number,       // live run accumulator (active player only)
  player:    0 | 1,
  over:      boolean,
  lastMove:  { t: 'h'|'v', r: number, c: number, p: 0|1 } | null,
}
```

`applyMove` is **pure** — it receives state and returns a new state object. It never mutates in place.

---

## App state and rendering (main.js)

`main.js` owns a single mutable `app` object:

```js
const app = {
  dark:      boolean,
  mode:      '2P' | 'AI' | 'SOLO' | null,
  game:      GameState | null,
  aiRunning: boolean,
  hov:       { t, r, c } | null,   // hovered edge
  hovKey:    string | null,          // serialized hov for fast comparison
  boardCtrl: AbortController | null, // board event listeners cleanup
};
```

### Render strategy

| Trigger | Function | What updates |
|---------|----------|--------------|
| Mode change, move made, theme toggle | `renderGame()` | Full `#app` innerHTML |
| Hover over edge | `updateBoardOnly()` | Only `#board-container` innerHTML |

**Board events use event delegation**: listeners attach to `#board-container` (the stable container), not to individual SVG child elements. This means `#board-container.innerHTML` can be replaced freely without losing the event listeners. Listeners are managed with `AbortController` — call `app.boardCtrl.abort()` before re-attaching.

```js
// Hover detection in onBoardMousemove:
const hovKey = g ? `${g.dataset.t}|${g.dataset.r}|${g.dataset.c}` : null;
if (hovKey !== app.hovKey) { … updateBoardOnly(); }
```