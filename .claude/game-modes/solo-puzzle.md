## Solo Puzzle Mode

The puzzle is loaded dynamically from `puzzles/config.json` → `puzzles/<id>.json` via `loadActivePuzzle()` in `puzzle.js`. If the server is unavailable, `loadActivePuzzle()` falls back to the built-in `DEFAULT_PUZZLE` constant (a copy of puzzle-01) embedded in `puzzle.js`. The active puzzle can be changed from the Puzzle Manager at `developer/puzzle-manager.html`.

### Default puzzle: "The Classic" (`puzzle-01`)

A **pre-configured endgame** with 4 remaining corner boxes.

### State going in
- 21 boxes pre-captured and pre-drawn (`'pre'` edges, filled boxes)
- YOU: 7 pts committed, CPU: 14 pts committed
- 4 remaining corner boxes:

| Box | Position | Bonus | Missing edge |
|-----|----------|-------|--------------|
| A   | (0,0) | ×3 | `h[0][0]` (top perimeter) |
| B   | (0,4) | +2 | `h[0][4]` (top perimeter) |
| C   | (4,0) | +1 | `h[5][0]` (bottom perimeter) |
| D   | (4,4) | ×3 | `h[5][4]` + `v[4][5]` — TRAP (CPU takes) |

Box D's two wall sides come from the blocked dot at `(4,4)`. Its only null edges are perimeter edges — so after taking A, B, C the player **must** open D with no other moves available.

### GTO solution
- **Optimal**: C → B → A → open D → run = 18 → YOU: 25 vs CPU: 17 → **WIN**
- **Wrong** (A first): A → B → C → open D → run = 8 → YOU: 15 vs CPU: 17 → **LOSE**

After the player opens D (no capture), `runCPU()` fires — CPU captures D, scores `(0+1)×3 = 3`, game ends.

### Puzzle-specific bonus map

Each puzzle JSON includes its own `bonusDef` array. `startGame('SOLO')` in `main.js` builds `puzzle.bmap` from it and stores it on the game object. `getBmap()` returns `app.game.bmap` when in SOLO mode, so the puzzle's bonuses are used for scoring rather than the regular board's.

### Puzzle JSON format

Each puzzle file is a complete `GameState` snapshot:

```json
{
  "id": "puzzle-01",
  "title": "The Classic",
  "description": "...",
  "difficulty": "medium",
  "rows": 5,
  "cols": 5,
  "blocked": [{"r": 0, "c": 3}, ...],
  "bonusDef": [{"r": 0, "c": 0, "op": "*", "val": 3}, ...],
  "h": [[...], ...],
  "v": [[...], ...],
  "captured": [[...], ...],
  "committed": [7, 14],
  "runScore": 0,
  "player": 0,
  "over": false,
  "lastMove": null
}
```

`rows`, `cols`, `blocked`, and `bonusDef` are passed to `applyBoardConfig()` before the game starts, so puzzles can use a different board layout from the regular game.

### Adding a new puzzle

1. Open `developer/puzzle-manager.html` (requires `server.py` running) to create the puzzle via the UI, or write `puzzles/<id>.json` by hand following the format above.
2. Set `"active"` in `puzzles/config.json` to the new ID.
3. Verify the GTO solution using `developer/puzzle-analyzer.html`.
