import { ROWS, COLS, DS, PAD, HIT, BW, BH, BSET, gx, gy } from './config.js';

// ─── SVG helpers ──────────────────────────────────────────────────────────
const svgEl = (tag, attrs, children = '') => {
  const a = Object.entries(attrs)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');
  return `<${tag} ${a}>${children}</${tag}>`;
};

const line = (attrs) => {
  const a = Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ');
  return `<line ${a}/>`;
};

const circle = (attrs) => {
  const a = Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ');
  return `<circle ${a}/>`;
};

const rect = (attrs) => {
  const a = Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ');
  return `<rect ${a}/>`;
};

// ─── Glow filter defs ────────────────────────────────────────────────────
function buildDefs(th) {
  const filter = (id, r) => `
    <filter id="${id}" x="-70%" y="-70%" width="240%" height="240%">
      <feGaussianBlur stdDeviation="${r}" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>`;

  const filterLg = (id, r) => `
    <filter id="${id}" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="${r}" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>`;

  return `<defs>
    ${filter('gp1', th.glowR)}
    ${filter('gp2', th.glowR)}
    ${filterLg('gl1', th.lastGlowR)}
    ${filterLg('gl2', th.lastGlowR)}
  </defs>`;
}

// ─── Box fills ────────────────────────────────────────────────────────────
function buildBoxFills(captured, th) {
  let out = '';
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const o = captured[r][c];
      if (o === null) continue;
      out += rect({
        x: gx(c) + 1, y: gy(r) + 1,
        width: DS - 2, height: DS - 2,
        fill: o === 0 ? th.p1Fill : th.p2Fill,
        rx: 2,
      });
    }
  }
  return out;
}

// ─── Bonus icons ─────────────────────────────────────────────────────────
function buildBonusIcon(r, c, op, val, captured, th) {
  const cx = gx(c) + DS / 2;
  const cy = gy(r) + DS / 2;
  const isCaptured = captured[r][c] !== null;
  const opacity = isCaptured ? 0.25 : 1;
  const sz = 13;

  let color, bg, label;
  if (op === '*') {
    color = val === 3 ? th.m3 : th.m2;
    bg    = val === 3 ? th.m3bg : th.m2bg;
    label = `\u00d7${val}`; // × (multiplication sign)
  } else {
    color = val === 3 ? th.f3 : val === 2 ? th.f2 : th.f1;
    bg    = val === 3 ? th.f3bg : val === 2 ? th.f2bg : th.f1bg;
    label = `+${val}`;
  }

  const textEl = `<text
    x="${cx}" y="${cy}"
    text-anchor="middle" dominant-baseline="central"
    font-size="10" fill="${color}"
    font-family="'Share Tech Mono',monospace" font-weight="bold"
    style="pointer-events:none">${label}</text>`;

  let shapeEl;
  if (op === '*') {
    // Diamond (rotated square) for multipliers
    shapeEl = `<rect
      x="${cx - sz}" y="${cy - sz}"
      width="${sz * 2}" height="${sz * 2}"
      transform="rotate(45 ${cx} ${cy})"
      fill="${bg}" stroke="${color}" stroke-width="0.9" rx="2"/>`;
  } else {
    // Circle for flat bonuses
    shapeEl = circle({ cx, cy, r: sz, fill: bg, stroke: color, 'stroke-width': 0.9 });
  }

  return `<g opacity="${opacity}" style="pointer-events:none">${shapeEl}${textEl}</g>`;
}

// ─── Single edge ──────────────────────────────────────────────────────────
/**
 * Build the SVG markup for one edge.
 *
 * Visual states:
 *   'wall'         — muted solid line, shorter inset
 *   'pre'          — neutral-colour solid line (puzzle history)
 *   lastMove       — player-colour, thick, pulsing glow (.last-move CSS class)
 *   0 or 1         — player colour, thick, normal glow
 *   hover          — player colour ghost (semi-transparent)
 *   null           — very faint dashed "missing line" (available)
 */
function buildEdge(axis, r, c, e, th, dark, hov, lastMove, canDraw, hovColor) {
  const isH = axis === 'h';

  // Coordinates
  const x1 = gx(c),          x2 = isH ? gx(c + 1) : gx(c);
  const y1 = gy(r),          y2 = isH ? gy(r)      : gy(r + 1);

  const isWall = e === 'wall';
  const isPre  = e === 'pre';
  const isP0   = e === 0;
  const isP1   = e === 1;
  const isLast = lastMove && lastMove.t === axis && lastMove.r === r && lastMove.c === c;
  const lp     = lastMove ? lastMove.p : 0;
  const isHov  = hov && hov.t === axis && hov.r === r && hov.c === c;
  const click  = e === null && canDraw;

  // ─ Hit area (transparent, only for available edges) ─
  let hitArea = '';
  if (click) {
    hitArea = isH
      ? rect({ x: x1, y: y1 - HIT / 2, width: DS, height: HIT, fill: 'transparent' })
      : rect({ x: x1 - HIT / 2, y: y1, width: HIT, height: DS, fill: 'transparent' });
  }

  // ─ Visual line ─
  const cap = 'round';
  let lineEl = '';

  if (isWall) {
    // Shorter, muted — clearly not a player line
    lineEl = isH
      ? line({ x1: x1+6, y1, x2: x2-6, y2, stroke: th.wall, 'stroke-width': 2, 'stroke-linecap': cap })
      : line({ x1, y1: y1+6, x2, y2: y2-6, stroke: th.wall, 'stroke-width': 2, 'stroke-linecap': cap });

  } else if (isPre) {
    // Pre-drawn (puzzle history)
    lineEl = isH
      ? line({ x1: x1+2, y1, x2: x2-2, y2, stroke: th.pre, 'stroke-width': 2.5, 'stroke-linecap': cap })
      : line({ x1, y1: y1+2, x2, y2: y2-2, stroke: th.pre, 'stroke-width': 2.5, 'stroke-linecap': cap });

  } else if (isLast) {
    // Most recent move — extra glow + pulsing animation
    const stroke = lp === 0 ? th.p1 : th.p2;
    const sw = dark ? 6 : 5;
    const flt = `url(#gl${lp + 1})`;
    lineEl = isH
      ? `<line x1="${x1+2}" y1="${y1}" x2="${x2-2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="${cap}" filter="${flt}" class="last-move"/>`
      : `<line x1="${x1}" y1="${y1+2}" x2="${x2}" y2="${y2-2}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="${cap}" filter="${flt}" class="last-move"/>`;

  } else if (isP0 || isP1) {
    // Player-drawn line — solid, prominent glow
    const stroke = isP0 ? th.p1 : th.p2;
    const sw = dark ? 5 : 4.5;
    const flt = `url(#gp${isP0 ? 1 : 2})`;
    lineEl = isH
      ? line({ x1: x1+2, y1, x2: x2-2, y2, stroke, 'stroke-width': sw, 'stroke-linecap': cap, filter: flt })
      : line({ x1, y1: y1+2, x2, y2: y2-2, stroke, 'stroke-width': sw, 'stroke-linecap': cap, filter: flt });

  } else if (isHov) {
    // Hover ghost — player colour, semi-transparent
    lineEl = isH
      ? line({ x1: x1+2, y1, x2: x2-2, y2, stroke: hovColor, 'stroke-width': 4, 'stroke-opacity': 0.35, 'stroke-linecap': cap })
      : line({ x1, y1: y1+2, x2, y2: y2-2, stroke: hovColor, 'stroke-width': 4, 'stroke-opacity': 0.35, 'stroke-linecap': cap });

  } else {
    // Available — very faint dashed "missing line"
    lineEl = isH
      ? line({ x1: x1+12, y1, x2: x2-12, y2, stroke: th.dash, 'stroke-width': 1.5, 'stroke-dasharray': '2 7', 'stroke-linecap': cap })
      : line({ x1, y1: y1+12, x2, y2: y2-12, stroke: th.dash, 'stroke-width': 1.5, 'stroke-dasharray': '2 7', 'stroke-linecap': cap });
  }

  const cls = click ? ' class="edge-available"' : '';
  const cur = click ? 'pointer' : 'default';
  return `<g data-t="${axis}" data-r="${r}" data-c="${c}"${cls} style="cursor:${cur}">${hitArea}${lineEl}</g>`;
}

// ─── Dots ─────────────────────────────────────────────────────────────────
function buildDots(th) {
  let out = '';
  for (let r = 0; r <= ROWS; r++) {
    for (let c = 0; c <= COLS; c++) {
      const cx = gx(c), cy = gy(r);
      if (BSET.has(`${r},${c}`)) {
        // Blocked dot — X mark
        out += `<g style="pointer-events:none">
          ${circle({ cx, cy, r: 8, fill: th.bkFill, stroke: th.bkStroke, 'stroke-width': 1.5 })}
          <line x1="${cx-4}" y1="${cy-4}" x2="${cx+4}" y2="${cy+4}" stroke="${th.bkX}" stroke-width="2" stroke-linecap="round"/>
          <line x1="${cx+4}" y1="${cy-4}" x2="${cx-4}" y2="${cy+4}" stroke="${th.bkX}" stroke-width="2" stroke-linecap="round"/>
        </g>`;
      } else {
        out += circle({ cx, cy, r: 5, fill: th.dotFill, stroke: th.dotStroke, 'stroke-width': 1.5, style: 'pointer-events:none' });
      }
    }
  }
  return out;
}

// ─── Main export ──────────────────────────────────────────────────────────
/**
 * Build and return the complete SVG markup for the game board.
 *
 * @param {object}  game      Current game state.
 * @param {Array}   bonusDef  Bonus square definitions for the current mode.
 * @param {object}  th        Theme colour object (from THEMES).
 * @param {boolean} dark      True when dark mode is active.
 * @param {object|null} hov   Currently hovered edge { t, r, c } or null.
 * @param {boolean} canDraw   Whether the human player can draw an edge now.
 * @param {string}  hovColor  Hex colour for the hover ghost line.
 * @returns {string}          SVG element as an HTML string.
 */
export function buildBoardSVG(game, bonusDef, th, dark, hov, canDraw, hovColor) {
  const { h, v, captured, lastMove } = game;
  let out = `<svg xmlns="http://www.w3.org/2000/svg"
    id="game-board"
    width="${BW}" height="${BH}"
    viewBox="0 0 ${BW} ${BH}">`;

  // ─ Filters ─
  out += buildDefs(th);

  // ─ Background grid lines (very subtle) ─
  for (let i = 0; i <= ROWS; i++) {
    out += `<line x1="${PAD}" y1="${gy(i)}" x2="${PAD + COLS * DS}" y2="${gy(i)}" stroke="${th.gridLine}" stroke-width="1"/>`;
  }
  for (let i = 0; i <= COLS; i++) {
    out += `<line x1="${gx(i)}" y1="${PAD}" x2="${gx(i)}" y2="${PAD + ROWS * DS}" stroke="${th.gridLine}" stroke-width="1"/>`;
  }

  // ─ Layer 1: captured box fills ─
  out += buildBoxFills(captured, th);

  // ─ Layer 2: bonus icons ─
  for (const { r, c, op, val } of bonusDef) {
    out += buildBonusIcon(r, c, op, val, captured, th);
  }

  // ─ Layer 3: all edges ─
  // Horizontal: rows 0..ROWS, cols 0..COLS-1
  for (let r = 0; r <= ROWS; r++)
    for (let c = 0; c < COLS; c++)
      out += buildEdge('h', r, c, h[r][c], th, dark, hov, lastMove, canDraw, hovColor);

  // Vertical: rows 0..ROWS-1, cols 0..COLS
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c <= COLS; c++)
      out += buildEdge('v', r, c, v[r][c], th, dark, hov, lastMove, canDraw, hovColor);

  // ─ Layer 4: dots (always on top, pointer-events:none) ─
  out += buildDots(th);

  out += '</svg>';
  return out;
}
