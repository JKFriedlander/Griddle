// ─── Board geometry ───────────────────────────────────────────────────────
export const ROWS = 5;
export const COLS = 5;
export const DS   = 72;  // dot spacing (px)
export const PAD  = 46;  // board padding (px)
export const HIT  = 28;  // edge hit-area half-height (px)

export const BW    = 2 * PAD + COLS * DS; // SVG width  (452)
export const BH    = 2 * PAD + ROWS * DS; // SVG height (452)
export const TOTAL = ROWS * COLS;         // 25 boxes

/** Pixel x-coordinate for dot column c */
export const gx = c => PAD + c * DS;

/** Pixel y-coordinate for dot row r */
export const gy = r => PAD + r * DS;

// ─── Blocked Dots ─────────────────────────────────────────────────────────
// These nodes can't be connected. Adjacent edges become permanent walls.
export const BLOCKED = [
  { r: 0, c: 3 },
  { r: 2, c: 2 },
  { r: 4, c: 4 },
];

export const BSET = new Set(BLOCKED.map(({ r, c }) => `${r},${c}`));

// ─── Regular Game Bonuses ─────────────────────────────────────────────────
// op '+' → square scores (1 + val) pts added to current run
// op '*' → square scores (run + 1) × val  (multiplies the whole run)
export const BONUS_DEF = [
  { r: 0, c: 0, op: '*', val: 3 },  // ×3 — top-left
  { r: 0, c: 4, op: '+', val: 2 },  // +2 — top-right
  { r: 1, c: 3, op: '+', val: 1 },  // +1 — upper area
  { r: 2, c: 0, op: '*', val: 2 },  // ×2 — left middle
  { r: 3, c: 4, op: '+', val: 3 },  // +3 — right side
  { r: 4, c: 1, op: '*', val: 2 },  // ×2 — bottom
  { r: 4, c: 3, op: '+', val: 1 },  // +1 — bottom right
];

export const BMAP = Object.fromEntries(
  BONUS_DEF.map(b => [`${b.r},${b.c}`, b])
);

// ─── Solo Puzzle Bonuses ──────────────────────────────────────────────────
// Four remaining corner boxes.  Optimal play: apply multiplier (×3) LAST.
//   Wrong order  → run=8,  you lose.
//   Correct order → run=18, you win.
export const SOLO_BONUS_DEF = [
  { r: 0, c: 0, op: '*', val: 3 },  // A — ×3 multiplier (apply last!)
  { r: 0, c: 4, op: '+', val: 2 },  // B — +2 flat
  { r: 4, c: 0, op: '+', val: 1 },  // C — +1 flat
  { r: 4, c: 4, op: '*', val: 3 },  // D — ×3 trap (CPU claims this)
];

export const SOLO_BMAP = Object.fromEntries(
  SOLO_BONUS_DEF.map(b => [`${b.r},${b.c}`, b])
);

// ─── Themes ───────────────────────────────────────────────────────────────
// Used by renderer.js to colour SVG attributes (can't use CSS vars in attrs).
export const THEMES = {
  dark: {
    gridLine:  '#111827',
    dotFill:   '#07090f',
    dotStroke: '#1d3a52',
    dash:      'rgba(28,60,90,0.9)',
    wall:      '#253e50',
    pre:       '#304e62',
    p1:        '#00d4f0',
    p2:        '#ff5828',
    p1Fill:    'rgba(0,212,240,0.12)',
    p2Fill:    'rgba(255,88,40,0.11)',
    bkFill:    '#0b1220',
    bkStroke:  '#1d3a52',
    bkX:       '#2d5068',
    f1:        '#4488ee', f1bg: 'rgba(44,88,220,0.14)',
    f2:        '#22aadd', f2bg: 'rgba(10,150,210,0.14)',
    f3:        '#00bb78', f3bg: 'rgba(0,170,100,0.14)',
    m2:        '#e09000', m2bg: 'rgba(200,130,0,0.14)',
    m3:        '#e83020', m3bg: 'rgba(210,40,10,0.14)',
    glowR:     4,
    lastGlowR: 10,
  },
  light: {
    gridLine:  '#c8c0b0',
    dotFill:   '#f5f0e6',
    dotStroke: '#8a8272',
    dash:      'rgba(160,148,132,0.7)',
    wall:      '#9a9080',
    pre:       '#b8a898',
    p1:        '#0055cc',
    p2:        '#cc3300',
    p1Fill:    'rgba(0,80,200,0.10)',
    p2Fill:    'rgba(204,51,0,0.10)',
    bkFill:    '#ece6da',
    bkStroke:  '#a09882',
    bkX:       '#7a7262',
    f1:        '#2244cc', f1bg: 'rgba(34,68,204,0.10)',
    f2:        '#0077aa', f2bg: 'rgba(0,119,170,0.10)',
    f3:        '#006633', f3bg: 'rgba(0,102,51,0.10)',
    m2:        '#996200', m2bg: 'rgba(153,98,0,0.10)',
    m3:        '#cc1400', m3bg: 'rgba(204,20,0,0.10)',
    glowR:     1.5,
    lastGlowR: 3,
  },
};
