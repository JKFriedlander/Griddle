import { board } from './boardConfig.js';

// ─── Edge initialisation ──────────────────────────────────────────────────
/**
 * Build blank edge arrays with walls applied for the given blocked dots.
 * Edge values:
 *   null     — available (player can draw here)
 *   'wall'   — permanent wall from a blocked dot
 *   'pre'    — pre-drawn (puzzle history, neutral colour)
 *   0        — drawn by player 0
 *   1        — drawn by player 1
 */
export function initWalls(blocked) {
  const { rows, cols } = board;
  const h = Array.from({ length: rows + 1 }, () => new Array(cols).fill(null));
  const v = Array.from({ length: rows },     () => new Array(cols + 1).fill(null));

  for (const { r, c } of blocked) {
    if (c > 0)    h[r][c - 1] = 'wall';
    if (c < cols) h[r][c]     = 'wall';
    if (r > 0)    v[r - 1][c] = 'wall';
    if (r < rows) v[r][c]     = 'wall';
  }
  return { h, v };
}

/** Full blank game state (regular modes). */
export function initGameState(blocked) {
  const { rows, cols } = board;
  return {
    ...initWalls(blocked),
    captured:  Array.from({ length: rows }, () => new Array(cols).fill(null)),
    committed: [0, 0],   // scores banked when a run ends
    runScore:  0,         // live run accumulator for the active player
    player:    0,
    over:      false,
    lastMove:  null,      // { t, r, c, p } — most recent edge drawn
  };
}

// ─── Board queries ────────────────────────────────────────────────────────
/**
 * Boxes that share the given edge (both must be within grid bounds).
 * Horizontal edge (r,c): top of box (r,c) and bottom of box (r-1,c).
 * Vertical   edge (r,c): left of box (r,c) and right of box (r,c-1).
 */
export function adjBoxes(type, r, c) {
  const { rows, cols } = board;
  return (type === 'h' ? [[r - 1, c], [r, c]] : [[r, c - 1], [r, c]])
    .filter(([br, bc]) => br >= 0 && br < rows && bc >= 0 && bc < cols);
}

/** Count how many of a box's 4 edges are non-null (drawn or walled). */
export function countSides(r, c, h, v) {
  return [h[r][c], h[r + 1][c], v[r][c], v[r][c + 1]]
    .filter(e => e !== null).length;
}

/** True when all 4 sides of a box are drawn/walled. */
export function boxFull(r, c, h, v) {
  return countSides(r, c, h, v) === 4;
}

// ─── Run-based scoring ────────────────────────────────────────────────────
/**
 * Apply the bonus for capturing box (r,c) to the current run score.
 *
 * Scoring rules (applied in order per capture):
 *   Normal box:  run = run + 1
 *   Flat  (+n):  run = run + 1 + n   (base first, then flat bonus)
 *   Multi (×n):  run = (run + 1) × n (base first, then multiply whole run)
 *
 * The base "+1 for capturing" is always applied before the bonus.
 */
export function applyRunScore(run, r, c, bmap) {
  const b = bmap[`${r},${c}`];
  if (!b)             return run + 1;
  if (b.op === '+')   return run + 1 + b.val;
  /* b.op === '*' */  return (run + 1) * b.val;
}

// ─── Move application ─────────────────────────────────────────────────────
/**
 * Draw edge (type, r, c) for `player`.  Returns the next state (immutable).
 *
 * If the move captures ≥ 1 box:
 *   - runScore is updated via applyRunScore for each captured box.
 *   - The turn does NOT pass (player goes again).
 *
 * If the move captures 0 boxes:
 *   - runScore is committed to committed[player].
 *   - runScore resets to 0 and the turn passes.
 */
export function applyMove(type, r, c, player, state, bmap) {
  const { h, v, captured, committed, runScore } = state;

  const nh  = h.map(row => [...row]);
  const nv  = v.map(row => [...row]);
  const nc  = captured.map(row => [...row]);
  const ncom = [...committed];
  let nr = runScore;
  let scored = false;

  if (type === 'h') nh[r][c] = player;
  else              nv[r][c] = player;

  for (const [br, bc] of adjBoxes(type, r, c)) {
    if (nc[br][bc] === null && boxFull(br, bc, nh, nv)) {
      nc[br][bc] = player;
      nr = applyRunScore(nr, br, bc, bmap);
      scored = true;
    }
  }

  // Commit run when turn ends
  if (!scored) {
    ncom[player] += nr;
    nr = 0;
  }

  return {
    h: nh, v: nv, captured: nc,
    committed: ncom,
    runScore:  nr,
    scored,
    lastMove:  { t: type, r, c, p: player },
  };
}

// ─── AI ───────────────────────────────────────────────────────────────────
/** All null edges available to draw. */
export function getAvail(h, v) {
  const { rows, cols } = board;
  const edges = [];
  for (let r = 0; r <= rows; r++)
    for (let c = 0; c < cols; c++)
      if (h[r][c] === null) edges.push({ t: 'h', r, c });
  for (let r = 0; r < rows; r++)
    for (let c = 0; c <= cols; c++)
      if (v[r][c] === null) edges.push({ t: 'v', r, c });
  return edges;
}

/**
 * Greedy AI move selection:
 *   1. Complete a box if possible (take points).
 *   2. Make a "safe" move that doesn't give the opponent a 3-sided box.
 *   3. Random move as a last resort.
 */
export function aiMove(h, v) {
  const { rows, cols } = board;
  const avail = getAvail(h, v);
  if (!avail.length) return null;

  /** Simulate placing edge m on scratch copies. */
  const sim = m => {
    const nh = h.map(row => [...row]);
    const nv = v.map(row => [...row]);
    if (m.t === 'h') nh[m.r][m.c] = 'x';
    else             nv[m.r][m.c] = 'x';
    return { nh, nv };
  };

  // Priority 1 — capture a box
  const fill = avail.find(m => {
    const { nh, nv } = sim(m);
    return adjBoxes(m.t, m.r, m.c).some(([br, bc]) => boxFull(br, bc, nh, nv));
  });
  if (fill) return fill;

  // Priority 2 — don't hand opponent a 3-sided box
  const safe = avail.filter(m => {
    const { nh, nv } = sim(m);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        if (countSides(r, c, nh, nv) === 3) return false;
    return true;
  });
  if (safe.length) return safe[Math.floor(Math.random() * safe.length)];

  // Priority 3 — random
  return avail[Math.floor(Math.random() * avail.length)];
}
