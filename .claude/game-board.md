## Board geometry

The board is a **5 × 5 grid of boxes** (25 total). Dots sit at the 6 × 6 intersections.

```
Dots:    (ROWS+1) × (COLS+1) = 6 × 6 = 36 dots
H edges: (ROWS+1) × COLS     = 6 × 5 = 30 horizontal edges
V edges: ROWS × (COLS+1)     = 5 × 6 = 30 vertical edges
```

### Coordinate conventions

```
gx(c) = PAD + c * DS    // pixel x for dot at column c
gy(r) = PAD + r * DS    // pixel y for dot at row r

PAD = 46   // board padding
DS  = 72   // dot spacing in pixels
```

### Box boundary edges

Box at `(r, c)` (0-indexed, top-left corner):

| Side   | Edge array index        |
|--------|------------------------|
| Top    | `h[r][c]`              |
| Bottom | `h[r+1][c]`            |
| Left   | `v[r][c]`              |
| Right  | `v[r][c+1]`            |

### Edge values

```
null     — available; player can draw here
'wall'   — permanent wall from a blocked dot (never drawable)
'pre'    — pre-drawn (puzzle history); rendered as neutral solid line
0        — drawn by player 0 (YOU / P1)
1        — drawn by player 1 (CPU / P2)
```

### Blocked dots

Three dots cannot be connected. Their four adjacent edges become `'wall'` at init time.

```js
BLOCKED = [
  { r: 0, c: 3 },   // top area
  { r: 2, c: 2 },   // centre
  { r: 4, c: 4 },   // bottom-right — also creates the Solo Puzzle trap
]
```

Each blocked dot at `(r, c)` walls:
- `h[r][c-1]` and `h[r][c]` (left and right horizontal edges)
- `v[r-1][c]` and `v[r][c]` (above and below vertical edges)

---

### Changing the grid size
All geometry flows from `ROWS`, `COLS`, `DS`, `PAD` in `config.js`. The SVG dimensions (`BW`, `BH`) and coordinate helpers (`gx`, `gy`) are derived automatically. The AI and game logic loops use `ROWS`/`COLS` directly. Changing these values cascades correctly — but blocked dot positions and bonus square positions in `BONUS_DEF` will need manual adjustment.