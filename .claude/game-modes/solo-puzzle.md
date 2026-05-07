## Solo Puzzle Mode

The puzzle is a **pre-configured endgame** loaded by `buildSoloPuzzle()` in `puzzle.js`.

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

The puzzle uses `SOLO_BMAP` instead of `BMAP`. In `main.js`, the correct map is selected:

```js
const bm = app.mode === 'SOLO' ? SOLO_BMAP : BMAP;
```