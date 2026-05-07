/**
 * Mutable board configuration singleton.
 *
 * game.js and renderer.js read from this object so that changing board
 * dimensions, blocked dots, or bonus layout at runtime (e.g. when loading a
 * puzzle with its own layout) automatically propagates everywhere.
 *
 * Call applyBoardConfig() before starting any game mode.
 */
import { ROWS, COLS, DS, PAD, BLOCKED, BONUS_DEF } from './config.js';

export const board = {
  rows:     ROWS,
  cols:     COLS,
  blocked:  BLOCKED,
  bset:     new Set(BLOCKED.map(({ r, c }) => `${r},${c}`)),
  bonusDef: BONUS_DEF,
  bmap:     Object.fromEntries(BONUS_DEF.map(b => [`${b.r},${b.c}`, b])),
  get total() { return this.rows * this.cols; },
  get bw()    { return 2 * PAD + this.cols * DS; },
  get bh()    { return 2 * PAD + this.rows * DS; },
};

export function applyBoardConfig(data) {
  if (data.rows     != null) board.rows     = data.rows;
  if (data.cols     != null) board.cols     = data.cols;
  if (data.blocked  != null) {
    board.blocked = data.blocked;
    board.bset    = new Set(data.blocked.map(({ r, c }) => `${r},${c}`));
  }
  if (data.bonusDef != null) {
    board.bonusDef = data.bonusDef;
    board.bmap     = Object.fromEntries(data.bonusDef.map(b => [`${b.r},${b.c}`, b]));
  }
}
