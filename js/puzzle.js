import { ROWS, COLS, BLOCKED } from './config.js';
import { initWalls } from './game.js';

/**
 * Build the Solo Puzzle state.
 *
 * Scenario
 * --------
 * 25 boxes total; 21 already captured (shown as game history).
 *   YOU  own 7 boxes  → committed[0] = 7
 *   CPU  owns 14 boxes → committed[1] = 14
 *
 * 4 remaining uncaptured — all in corners:
 *   A = (0,0)  ×3 multiplier  — 3 sides pre-drawn, missing top  (h[0][0])
 *   B = (0,4)  +2 flat bonus  — 3 sides pre-drawn, missing top  (h[0][4])
 *   C = (4,0)  +1 flat bonus  — 3 sides pre-drawn, missing bottom (h[5][0])
 *   D = (4,4)  ×3 multiplier  — 2 sides (WALLS from blocked dot), missing
 *                                bottom (h[5][4]) and right (v[4][5])
 *
 * Game-theory optimal for YOU
 * ----------------------------
 * Rule: accumulate flat bonuses in the run BEFORE applying any multiplier.
 *
 *   Optimal order — C → B → A  (A is the ×3 — apply it LAST):
 *     Take C (+1):   run = 0 + 1 + 1 = 2
 *     Take B (+2):   run = 2 + 1 + 2 = 5
 *     Take A (×3):   run = (5 + 1) × 3 = 18
 *     Forced open D: your run commits → YOU: 7 + 18 = 25
 *     CPU takes D (×3): CPU run = (0 + 1) × 3 = 3 → CPU: 14 + 3 = 17
 *     YOU WIN 25 – 17.
 *
 *   Wrong order — take A (×3) first:
 *     Take A (×3):   run = (0 + 1) × 3 = 3
 *     Take B (+2):   run = 3 + 1 + 2 = 6
 *     Take C (+1):   run = 6 + 1 + 1 = 8
 *     Open D:        YOU: 7 + 8 = 15
 *     CPU takes D:   CPU: 17
 *     YOU LOSE 15 – 17.
 */
export function buildSoloPuzzle() {
  const { h, v } = initWalls(BLOCKED);

  // Corners stay uncaptured (the puzzle boxes).
  const remaining   = new Set(['0,0', '0,4', '4,0', '4,4']);

  // Your 7 pre-captured boxes (middle cluster).
  const playerOwned = new Set(['1,1', '1,2', '2,2', '2,3', '3,2', '3,3', '4,2']);

  const captured = Array.from({ length: ROWS }, () => new Array(COLS).fill(null));

  // Mark each non-corner box as pre-captured and draw all 4 of its edges as 'pre'.
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (remaining.has(`${r},${c}`)) continue;
      captured[r][c] = playerOwned.has(`${r},${c}`) ? 0 : 1;
      if (h[r][c]     === null) h[r][c]     = 'pre';
      if (h[r + 1][c] === null) h[r + 1][c] = 'pre';
      if (v[r][c]     === null) v[r][c]     = 'pre';
      if (v[r][c + 1] === null) v[r][c + 1] = 'pre';
    }
  }

  // Perimeter edges of remaining corners that aren't shared with pre-captured boxes.
  if (v[0][0] === null) v[0][0] = 'pre'; // A's left  edge (perimeter)
  if (v[0][5] === null) v[0][5] = 'pre'; // B's right edge (perimeter)
  if (v[4][0] === null) v[4][0] = 'pre'; // C's left  edge (perimeter)

  // Guarantee missing edges are null (override any accidental 'pre' assignment).
  h[0][0] = null; // A top    (draw to capture A)
  h[0][4] = null; // B top    (draw to capture B)
  h[5][0] = null; // C bottom (draw to capture C)
  h[5][4] = null; // D bottom (draw this or v[4][5] to open D for CPU)
  v[4][5] = null; // D right  (only perimeter edges of D are missing)

  return {
    h, v, captured,
    committed: [7, 14],  // [YOU, CPU]
    runScore:  0,
    player:    0,         // YOU go first
    over:      false,
    lastMove:  null,
  };
}
