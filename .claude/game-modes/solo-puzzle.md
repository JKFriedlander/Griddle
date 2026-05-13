## Solo Puzzle Mode

The puzzle is loaded dynamically from `puzzles/config.json` → `puzzles/<id>.json` via `loadActivePuzzle()` in `puzzle.js`. If the server is unavailable, `loadActivePuzzle()` falls back to the built-in `DEFAULT_PUZZLE` constant (a copy of the active puzzle) embedded in `puzzle.js`. The active puzzle can be changed from the Puzzle Manager at `developer/puzzle-manager.html`.

### Active puzzle: "The Gauntlet" (`puzzle-02`)

A **hard pre-configured endgame** with 5 remaining boxes and a CPU trap. The player is down 82 points and must find the exact GTO ordering to win by 1.

### State going in
- 19 boxes pre-captured and pre-drawn (`'pre'` edges, filled boxes)
- YOU: 5 pts committed, CPU: 87 pts committed
- 5 player boxes + 1 trap:

| Box | Position | Bonus | Missing edge |
|-----|----------|-------|--------------|
| A   | (0,0) | +1 | `h[0][0]` (top perimeter) |
| B   | (0,4) | +2 | `h[0][4]` (top perimeter) |
| C   | (4,0) | +3 | `h[5][0]` (bottom perimeter) |
| D   | (2,4) | ×2 | `v[2][5]` (right perimeter) |
| E   | (4,2) | ×4 | `h[5][2]` (bottom perimeter) |
| T   | (4,4) | —  | `h[5][4]` + `v[4][5]` — TRAP (CPU takes) |

Box T's two wall sides come from the blocked dot at `(4,4)`. After taking A–E the player is forced to open T; CPU captures it for 1 point.

### GTO solution
- **Optimal**: A → B → C → D → E → open T → run = 84 → YOU: 89 vs CPU: 88 → **WIN by 1**
- **Near-wrong** (swap ×4 and ×2): …→ E → D → open T → run = 82 → YOU: 87 vs CPU: 88 → **LOSE by 1**
- **Wrong** (multipliers first): run ≈ 19 → YOU: ~24 vs CPU: 88 → **LOSE badly**

Flat bonus order within A/B/C is interchangeable; the critical decisions are (1) take all flat bonuses before any multiplier and (2) take ×2 (D) before ×4 (E).

After the player opens T (no capture), `runCPU()` fires — CPU captures T, scores 1, game ends.

### Archived puzzle: "The Classic" (`puzzle-01`)

A **medium pre-configured endgame** with 4 remaining corner boxes. GTO: C → B → A → open D → run = 18 → YOU: 25 vs CPU: 17 → WIN.

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
