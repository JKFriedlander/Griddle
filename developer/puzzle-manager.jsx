// Puzzle Manager — admin UI for creating, previewing, and activating puzzles,
// plus a global board layout editor (blocked dots, bonuses, grid size).
// Uses CDN React + Babel, no build step required.

const { useState, useEffect } = React;

// ── Visual constants (mirrors js/config.js) ───────────────────────────────────
const DS = 72, PAD = 46, HIT = 22;
const gx = c => PAD + c * DS;
const gy = r => PAD + r * DS;
const bw = cols => 2 * PAD + cols * DS;
const bh = rows => 2 * PAD + rows * DS;

const THEME = {
  gridLine: '#1e3550', dotFill: '#080d1a', dotStroke: '#3a6888',
  wall: '#3a5e7a', pre: '#4a7090',
  p1: '#00d4f0', p2: '#ff5828',
  p1Fill: 'rgba(0,212,240,0.22)', p2Fill: 'rgba(255,88,40,0.20)',
  bkFill: '#0e1826', bkStroke: '#2a4968', bkX: '#5080a8',
  blockedRing: 'rgba(255,88,40,0.5)',
  f1: '#5599ff', f1bg: 'rgba(55,110,240,0.22)',
  f2: '#22aadd', f2bg: 'rgba(10,150,210,0.22)',
  f3: '#00cc88', f3bg: 'rgba(0,190,120,0.22)',
  m2: '#f0a010', m2bg: 'rgba(220,148,0,0.22)',
  m3: '#f04030', m3bg: 'rgba(230,50,20,0.22)',
};

// ── Bonus helpers ─────────────────────────────────────────────────────────────
const BONUS_CYCLE = [
  null,
  { op: '+', val: 1 }, { op: '+', val: 2 }, { op: '+', val: 3 },
  { op: '*', val: 2 }, { op: '*', val: 3 },
];

function bonusColor(b) {
  if (!b) return null;
  if (b.op === '*') return b.val === 3 ? THEME.m3 : THEME.m2;
  return b.val === 3 ? THEME.f3 : b.val === 2 ? THEME.f2 : THEME.f1;
}
function bonusBg(b) {
  if (!b) return null;
  if (b.op === '*') return b.val === 3 ? THEME.m3bg : THEME.m2bg;
  return b.val === 3 ? THEME.f3bg : b.val === 2 ? THEME.f2bg : THEME.f1bg;
}

function cycleBonus(bonusDef, r, c) {
  const existing = bonusDef.find(b => b.r === r && b.c === c);
  const idx = existing
    ? BONUS_CYCLE.findIndex(b => b && b.op === existing.op && b.val === existing.val)
    : 0;
  const next = BONUS_CYCLE[(idx + 1) % BONUS_CYCLE.length];
  const filtered = bonusDef.filter(b => !(b.r === r && b.c === c));
  return next ? [...filtered, { ...next, r, c }] : filtered;
}

// ── Shared wall-from-blocked computation ──────────────────────────────────────
function wallSet(rows, cols, blocked) {
  const walls = new Set();
  for (const { r, c } of blocked) {
    if (c > 0)    walls.add(`h:${r}:${c - 1}`);
    if (c < cols) walls.add(`h:${r}:${c}`);
    if (r > 0)    walls.add(`v:${r - 1}:${c}`);
    if (r < rows) walls.add(`v:${r}:${c}`);
  }
  return walls;
}

function blankEdges(rows, cols, blocked) {
  const walls = wallSet(rows, cols, blocked);
  const h = Array.from({ length: rows + 1 }, (_, r) =>
    Array.from({ length: cols }, (_, c) => walls.has(`h:${r}:${c}`) ? 'wall' : null)
  );
  const v = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols + 1 }, (_, c) => walls.has(`v:${r}:${c}`) ? 'wall' : null)
  );
  return { h, v };
}

// ── Board Layout Editor ───────────────────────────────────────────────────────
// Interactive SVG where:
//   • Clicking a dot  → toggles it in/out of blocked[]
//   • Clicking a box  → cycles its bonus (none → +1 → +2 → +3 → ×2 → ×3 → none)
// Wall edges derived from blocked dots are shown but not clickable.
function BoardLayoutEditor({ rows, cols, blocked, bonusDef, onChange }) {
  const [hov, setHov] = useState(null); // { kind: 'dot'|'box', r, c }
  const th = THEME;
  const bset = new Set(blocked.map(({ r, c }) => `${r},${c}`));
  const walls = wallSet(rows, cols, blocked);
  const bmap = Object.fromEntries(bonusDef.map(b => [`${b.r},${b.c}`, b]));

  const W = bw(cols), H = bh(rows);

  const toggleBlocked = (r, c) => {
    const key = `${r},${c}`;
    const next = bset.has(key)
      ? blocked.filter(b => !(b.r === r && b.c === c))
      : [...blocked, { r, c }];
    onChange({ rows, cols, blocked: next, bonusDef });
  };

  const clickBonus = (r, c) => {
    onChange({ rows, cols, blocked, bonusDef: cycleBonus(bonusDef, r, c) });
  };

  // Grid lines
  const gridLines = [];
  for (let r = 0; r <= rows; r++)
    gridLines.push(<line key={`gr${r}`} x1={gx(0)} y1={gy(r)} x2={gx(cols)} y2={gy(r)} stroke={th.gridLine} strokeWidth="1" />);
  for (let c = 0; c <= cols; c++)
    gridLines.push(<line key={`gc${c}`} x1={gx(c)} y1={gy(0)} x2={gx(c)} y2={gy(rows)} stroke={th.gridLine} strokeWidth="1" />);

  // Wall edges
  const wallEdges = [];
  for (let r = 0; r <= rows; r++) for (let c = 0; c < cols; c++) {
    if (!walls.has(`h:${r}:${c}`)) continue;
    wallEdges.push(<line key={`wh${r},${c}`} x1={gx(c) + 6} y1={gy(r)} x2={gx(c + 1) - 6} y2={gy(r)} stroke={th.wall} strokeWidth="2" strokeLinecap="round" style={{ pointerEvents: 'none' }} />);
  }
  for (let r = 0; r < rows; r++) for (let c = 0; c <= cols; c++) {
    if (!walls.has(`v:${r}:${c}`)) continue;
    wallEdges.push(<line key={`wv${r},${c}`} x1={gx(c)} y1={gy(r) + 6} x2={gx(c)} y2={gy(r + 1) - 6} stroke={th.wall} strokeWidth="2" strokeLinecap="round" style={{ pointerEvents: 'none' }} />);
  }

  // Box click targets + bonus display
  const boxes = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const b = bmap[`${r},${c}`];
    const isHov = hov?.kind === 'box' && hov.r === r && hov.c === c;
    const cx = gx(c) + DS / 2, cy = gy(r) + DS / 2;
    const color = bonusColor(b);
    const bg = bonusBg(b);

    boxes.push(
      <rect key={`bx${r},${c}`} x={gx(c) + 1} y={gy(r) + 1} width={DS - 2} height={DS - 2}
        fill={isHov ? 'rgba(255,255,255,0.04)' : 'transparent'} rx={2}
        style={{ cursor: 'pointer' }}
        onMouseEnter={() => setHov({ kind: 'box', r, c })}
        onMouseLeave={() => setHov(null)}
        onClick={() => clickBonus(r, c)} />
    );

    if (b) {
      const sz = 13;
      const label = b.op === '*' ? `×${b.val}` : `+${b.val}`;
      const shape = b.op === '*'
        ? <rect key={`bs${r},${c}`} x={cx - sz} y={cy - sz} width={sz * 2} height={sz * 2}
            transform={`rotate(45 ${cx} ${cy})`} fill={bg} stroke={color} strokeWidth="1" rx="2"
            style={{ pointerEvents: 'none' }} />
        : <circle key={`bs${r},${c}`} cx={cx} cy={cy} r={sz} fill={bg} stroke={color} strokeWidth="1"
            style={{ pointerEvents: 'none' }} />;
      boxes.push(shape);
      boxes.push(<text key={`bt${r},${c}`} x={cx} y={cy + 4} textAnchor="middle" fill={color}
        fontSize="11" fontFamily="Share Tech Mono,monospace" style={{ pointerEvents: 'none' }}>{label}</text>);
    }
  }

  // Dot click targets
  const dots = [];
  for (let r = 0; r <= rows; r++) for (let c = 0; c <= cols; c++) {
    const isBlocked = bset.has(`${r},${c}`);
    const isHov = hov?.kind === 'dot' && hov.r === r && hov.c === c;
    const cx = gx(c), cy = gy(r);

    if (isBlocked) {
      dots.push(
        <g key={`d${r},${c}`} style={{ cursor: 'pointer' }}
          onMouseEnter={() => setHov({ kind: 'dot', r, c })}
          onMouseLeave={() => setHov(null)}
          onClick={() => toggleBlocked(r, c)}>
          <circle cx={cx} cy={cy} r={10} fill={isHov ? 'rgba(255,88,40,0.15)' : th.bkFill} stroke={isHov ? th.p2 : th.bkStroke} strokeWidth="1.5" />
          <line x1={cx - 4} y1={cy - 4} x2={cx + 4} y2={cy + 4} stroke={th.bkX} strokeWidth="2" strokeLinecap="round" />
          <line x1={cx + 4} y1={cy - 4} x2={cx - 4} y2={cy + 4} stroke={th.bkX} strokeWidth="2" strokeLinecap="round" />
        </g>
      );
    } else {
      dots.push(
        <g key={`d${r},${c}`} style={{ cursor: 'pointer' }}
          onMouseEnter={() => setHov({ kind: 'dot', r, c })}
          onMouseLeave={() => setHov(null)}
          onClick={() => toggleBlocked(r, c)}>
          <circle cx={cx} cy={cy} r={isHov ? 8 : 5}
            fill={isHov ? 'rgba(255,88,40,0.15)' : th.dotFill}
            stroke={isHov ? th.p2 : th.dotStroke} strokeWidth="1.5"
            style={{ transition: 'r 0.1s' }} />
        </g>
      );
    }
  }

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', background: '#07090f' }}>
      {gridLines}{wallEdges}{boxes}{dots}
    </svg>
  );
}

// ── Board State Editor (puzzle h/v/captured) ──────────────────────────────────
// Interactive SVG where:
//   • Clicking an edge → cycles null ↔ 'pre' (walls are fixed)
//   • Clicking a box  → cycles null → player 0 → player 1 → null
function BoardStateEditor({ puzzle, bonusDef, onChange }) {
  const [hov, setHov] = useState(null);
  const th = THEME;
  const { rows, cols, blocked, h, v, captured } = puzzle;
  const bmap = Object.fromEntries((bonusDef || []).map(b => [`${b.r},${b.c}`, b]));
  const W = bw(cols), H = bh(rows);

  const clickH = (r, c) => {
    if (h[r]?.[c] === 'wall') return;
    const next = JSON.parse(JSON.stringify(puzzle));
    next.h[r][c] = next.h[r][c] === null ? 'pre' : null;
    onChange(next);
  };
  const clickV = (r, c) => {
    if (v[r]?.[c] === 'wall') return;
    const next = JSON.parse(JSON.stringify(puzzle));
    next.v[r][c] = next.v[r][c] === null ? 'pre' : null;
    onChange(next);
  };
  const clickBox = (r, c) => {
    const next = JSON.parse(JSON.stringify(puzzle));
    const cur = next.captured[r][c];
    next.captured[r][c] = cur === null ? 0 : cur === 0 ? 1 : null;
    onChange(next);
  };

  const bset = new Set((blocked || []).map(({ r, c }) => `${r},${c}`));

  // Grid lines
  const gridLines = [];
  for (let r = 0; r <= rows; r++)
    gridLines.push(<line key={`gr${r}`} x1={gx(0)} y1={gy(r)} x2={gx(cols)} y2={gy(r)} stroke={th.gridLine} strokeWidth="1" />);
  for (let c = 0; c <= cols; c++)
    gridLines.push(<line key={`gc${c}`} x1={gx(c)} y1={gy(0)} x2={gx(c)} y2={gy(rows)} stroke={th.gridLine} strokeWidth="1" />);

  // Box fills + click targets
  const boxes = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const o = captured[r][c];
    boxes.push(
      <rect key={`bx${r},${c}`} x={gx(c) + 1} y={gy(r) + 1} width={DS - 2} height={DS - 2}
        fill={o === null ? 'transparent' : o === 0 ? th.p1Fill : th.p2Fill} rx={2}
        style={{ cursor: 'pointer' }} onClick={() => clickBox(r, c)} />
    );
  }

  // Bonus icons
  const bonusIcons = [];
  for (const [key, b] of Object.entries(bmap)) {
    const [br, bc] = key.split(',').map(Number);
    const cx = gx(bc) + DS / 2, cy = gy(br) + DS / 2;
    const isCap = captured[br]?.[bc] !== null;
    const op = isCap ? 0.25 : 1;
    const color = bonusColor(b), bg = bonusBg(b);
    const label = b.op === '*' ? `×${b.val}` : `+${b.val}`;
    const sz = 13;
    const shape = b.op === '*'
      ? <rect key={`bs${key}`} x={cx - sz} y={cy - sz} width={sz * 2} height={sz * 2}
          transform={`rotate(45 ${cx} ${cy})`} fill={bg} stroke={color} strokeWidth="1" rx="2" opacity={op} style={{ pointerEvents: 'none' }} />
      : <circle key={`bs${key}`} cx={cx} cy={cy} r={sz} fill={bg} stroke={color} strokeWidth="1" opacity={op} style={{ pointerEvents: 'none' }} />;
    bonusIcons.push(shape);
    bonusIcons.push(<text key={`bt${key}`} x={cx} y={cy + 4} textAnchor="middle" fill={color} fontSize="11" fontFamily="Share Tech Mono,monospace" opacity={op} style={{ pointerEvents: 'none' }}>{label}</text>);
  }

  // Drawn edges
  const drawnEdges = [];
  for (let r = 0; r <= rows; r++) for (let c = 0; c < cols; c++) {
    const val = h[r]?.[c];
    if (!val) continue;
    const stroke = val === 'wall' ? th.wall : val === 'pre' ? th.pre : val === 0 ? th.p1 : th.p2;
    const sw = val === 'wall' ? 2 : 2.5;
    drawnEdges.push(<line key={`hd${r},${c}`} x1={gx(c) + (val === 'wall' ? 6 : 2)} y1={gy(r)} x2={gx(c + 1) - (val === 'wall' ? 6 : 2)} y2={gy(r)} stroke={stroke} strokeWidth={sw} strokeLinecap="round" style={{ pointerEvents: 'none' }} />);
  }
  for (let r = 0; r < rows; r++) for (let c = 0; c <= cols; c++) {
    const val = v[r]?.[c];
    if (!val) continue;
    const stroke = val === 'wall' ? th.wall : val === 'pre' ? th.pre : val === 0 ? th.p1 : th.p2;
    const sw = val === 'wall' ? 2 : 2.5;
    drawnEdges.push(<line key={`vd${r},${c}`} x1={gx(c)} y1={gy(r) + (val === 'wall' ? 6 : 2)} x2={gx(c)} y2={gy(r + 1) - (val === 'wall' ? 6 : 2)} stroke={stroke} strokeWidth={sw} strokeLinecap="round" style={{ pointerEvents: 'none' }} />);
  }

  // Hover highlight
  const hoverEl = hov
    ? hov.type === 'h'
      ? <line x1={gx(hov.c)} y1={gy(hov.r)} x2={gx(hov.c + 1)} y2={gy(hov.r)} stroke="rgba(255,255,255,0.12)" strokeWidth={HIT * 2} style={{ pointerEvents: 'none' }} />
      : <line x1={gx(hov.c)} y1={gy(hov.r)} x2={gx(hov.c)} y2={gy(hov.r + 1)} stroke="rgba(255,255,255,0.12)" strokeWidth={HIT * 2} style={{ pointerEvents: 'none' }} />
    : null;

  // Edge hit areas
  const edgeHits = [];
  for (let r = 0; r <= rows; r++) for (let c = 0; c < cols; c++) {
    if (h[r]?.[c] === 'wall') continue;
    edgeHits.push(
      <rect key={`hh${r},${c}`} x={gx(c) + 4} y={gy(r) - HIT} width={DS - 8} height={HIT * 2}
        fill="transparent" style={{ cursor: 'pointer' }}
        onMouseEnter={() => setHov({ type: 'h', r, c })}
        onMouseLeave={() => setHov(null)}
        onClick={() => clickH(r, c)} />
    );
  }
  for (let r = 0; r < rows; r++) for (let c = 0; c <= cols; c++) {
    if (v[r]?.[c] === 'wall') continue;
    edgeHits.push(
      <rect key={`vh${r},${c}`} x={gx(c) - HIT} y={gy(r) + 4} width={HIT * 2} height={DS - 8}
        fill="transparent" style={{ cursor: 'pointer' }}
        onMouseEnter={() => setHov({ type: 'v', r, c })}
        onMouseLeave={() => setHov(null)}
        onClick={() => clickV(r, c)} />
    );
  }

  // Dots
  const dots = [];
  for (let r = 0; r <= rows; r++) for (let c = 0; c <= cols; c++) {
    const isBlocked = bset.has(`${r},${c}`);
    if (isBlocked) {
      dots.push(<g key={`bk${r},${c}`} style={{ pointerEvents: 'none' }}>
        <circle cx={gx(c)} cy={gy(r)} r={8} fill={th.bkFill} stroke={th.bkStroke} strokeWidth="1.5" />
        <line x1={gx(c) - 4} y1={gy(r) - 4} x2={gx(c) + 4} y2={gy(r) + 4} stroke={th.bkX} strokeWidth="2" strokeLinecap="round" />
        <line x1={gx(c) + 4} y1={gy(r) - 4} x2={gx(c) - 4} y2={gy(r) + 4} stroke={th.bkX} strokeWidth="2" strokeLinecap="round" />
      </g>);
    } else {
      dots.push(<circle key={`d${r},${c}`} cx={gx(c)} cy={gy(r)} r={5} fill={th.dotFill} stroke={th.dotStroke} strokeWidth="1.5" style={{ pointerEvents: 'none' }} />);
    }
  }

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', background: '#07090f' }}>
      {gridLines}{hoverEl}{boxes}{bonusIcons}{drawnEdges}{edgeHits}{dots}
    </svg>
  );
}

// ── Read-only Board Preview ───────────────────────────────────────────────────
function BoardPreview({ puzzle, bonusDef = [], scale = 0.55 }) {
  const th = THEME;
  const { rows = 5, cols = 5, blocked = [], h, v, captured } = puzzle;
  const bset = new Set(blocked.map(({ r, c }) => `${r},${c}`));
  const bmap = Object.fromEntries(bonusDef.map(b => [`${b.r},${b.c}`, b]));
  const W = bw(cols) * scale, H = bh(rows) * scale;

  const gridLines = [];
  for (let r = 0; r <= rows; r++)
    gridLines.push(<line key={`gr${r}`} x1={gx(0)} y1={gy(r)} x2={gx(cols)} y2={gy(r)} stroke={th.gridLine} strokeWidth="1" />);
  for (let c = 0; c <= cols; c++)
    gridLines.push(<line key={`gc${c}`} x1={gx(c)} y1={gy(0)} x2={gx(c)} y2={gy(rows)} stroke={th.gridLine} strokeWidth="1" />);

  const fills = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const o = captured?.[r]?.[c];
    if (o == null) continue;
    fills.push(<rect key={`f${r},${c}`} x={gx(c) + 1} y={gy(r) + 1} width={DS - 2} height={DS - 2} fill={o === 0 ? th.p1Fill : th.p2Fill} rx={2} />);
  }

  const bonusIcons = [];
  for (const [key, b] of Object.entries(bmap)) {
    const [br, bc] = key.split(',').map(Number);
    const cx = gx(bc) + DS / 2, cy = gy(br) + DS / 2;
    const isCap = captured?.[br]?.[bc] != null;
    const op = isCap ? 0.25 : 1;
    const color = bonusColor(b), bg = bonusBg(b);
    const label = b.op === '*' ? `×${b.val}` : `+${b.val}`;
    const sz = 13;
    const shape = b.op === '*'
      ? <rect key={`bs${key}`} x={cx - sz} y={cy - sz} width={sz * 2} height={sz * 2} transform={`rotate(45 ${cx} ${cy})`} fill={bg} stroke={color} strokeWidth="1" rx="2" opacity={op} />
      : <circle key={`bs${key}`} cx={cx} cy={cy} r={sz} fill={bg} stroke={color} strokeWidth="1" opacity={op} />;
    bonusIcons.push(shape);
    bonusIcons.push(<text key={`bt${key}`} x={cx} y={cy + 4} textAnchor="middle" fill={color} fontSize="11" fontFamily="Share Tech Mono,monospace" opacity={op}>{label}</text>);
  }

  const edges = [];
  for (let r = 0; r <= rows; r++) for (let c = 0; c < cols; c++) {
    const val = h?.[r]?.[c];
    if (!val) continue;
    const stroke = val === 'wall' ? th.wall : val === 'pre' ? th.pre : val === 0 ? th.p1 : th.p2;
    edges.push(<line key={`h${r},${c}`} x1={gx(c) + (val === 'wall' ? 6 : 2)} y1={gy(r)} x2={gx(c + 1) - (val === 'wall' ? 6 : 2)} y2={gy(r)} stroke={stroke} strokeWidth={val === 'wall' ? 2 : 2.5} strokeLinecap="round" />);
  }
  for (let r = 0; r < rows; r++) for (let c = 0; c <= cols; c++) {
    const val = v?.[r]?.[c];
    if (!val) continue;
    const stroke = val === 'wall' ? th.wall : val === 'pre' ? th.pre : val === 0 ? th.p1 : th.p2;
    edges.push(<line key={`v${r},${c}`} x1={gx(c)} y1={gy(r) + (val === 'wall' ? 6 : 2)} x2={gx(c)} y2={gy(r + 1) - (val === 'wall' ? 6 : 2)} stroke={stroke} strokeWidth={val === 'wall' ? 2 : 2.5} strokeLinecap="round" />);
  }

  const dots = [];
  for (let r = 0; r <= rows; r++) for (let c = 0; c <= cols; c++) {
    const isBlocked = bset.has(`${r},${c}`);
    if (isBlocked) {
      dots.push(<g key={`bk${r},${c}`}>
        <circle cx={gx(c)} cy={gy(r)} r={8} fill={th.bkFill} stroke={th.bkStroke} strokeWidth="1.5" />
        <line x1={gx(c) - 4} y1={gy(r) - 4} x2={gx(c) + 4} y2={gy(r) + 4} stroke={th.bkX} strokeWidth="2" strokeLinecap="round" />
        <line x1={gx(c) + 4} y1={gy(r) - 4} x2={gx(c) - 4} y2={gy(r) + 4} stroke={th.bkX} strokeWidth="2" strokeLinecap="round" />
      </g>);
    } else {
      dots.push(<circle key={`d${r},${c}`} cx={gx(c)} cy={gy(r)} r={4} fill={th.dotFill} stroke={th.dotStroke} strokeWidth="1.5" />);
    }
  }

  return (
    <svg width={W} height={H} viewBox={`0 0 ${bw(cols)} ${bh(rows)}`} style={{ display: 'block', background: '#07090f' }}>
      {gridLines}{fills}{bonusIcons}{edges}{dots}
    </svg>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ message, type = 'ok', onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2400);
    return () => clearTimeout(t);
  }, []);
  return <div className={`toast${type === 'error' ? ' error' : ''}`}>{message}</div>;
}

// ── Global Board Editor tab ───────────────────────────────────────────────────
function GlobalBoardEditor({ onToast }) {
  const [layout, setLayout] = useState(null); // { rows, cols, blocked, bonusDef }
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/board').then(r => r.json()).then(setLayout).catch(() =>
      onToast('Failed to load board — is py/server.py running?', 'error')
    );
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await fetch('/api/board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(layout),
      });
      onToast('Board saved — reload the game to see changes.');
    } catch {
      onToast('Failed to save board', 'error');
    }
    setSaving(false);
  };

  const setSize = (key, val) => {
    const rows = key === 'rows' ? val : layout.rows;
    const cols = key === 'cols' ? val : layout.cols;
    // Prune blocked/bonuses that fall outside new grid
    const blocked = layout.blocked.filter(b => b.r < rows && b.c < cols);
    const bonusDef = layout.bonusDef.filter(b => b.r < rows - 1 && b.c < cols - 1);
    setLayout({ rows, cols, blocked, bonusDef });
  };

  if (!layout) return <div style={{ fontSize: 11, color: 'var(--text-sub)', padding: 20 }}>Loading board config…</div>;

  return (
    <div>
      <div className="section-label" style={{ marginBottom: 16 }}>GLOBAL BOARD LAYOUT</div>
      <p style={{ fontSize: 11, color: 'var(--text-sub)', marginBottom: 16, lineHeight: 1.6 }}>
        This board is used by <strong>Two Players</strong> and <strong>VS Computer</strong> modes.
        Puzzles carry their own layout independently.
      </p>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 220 }}>
          <div style={{ marginBottom: 16 }}>
            <div className="section-label">GRID SIZE</div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <label style={{ fontSize: 11, color: 'var(--text-sub)' }}>ROWS</label>
              <select className="form-input" style={{ width: 60 }} value={layout.rows} onChange={e => setSize('rows', Number(e.target.value))}>
                {[3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <label style={{ fontSize: 11, color: 'var(--text-sub)' }}>COLS</label>
              <select className="form-input" style={{ width: 60 }} value={layout.cols} onChange={e => setSize('cols', Number(e.target.value))}>
                {[3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          <div style={{ fontSize: 10, color: 'var(--text-sub)', lineHeight: 1.8, marginBottom: 16 }}>
            <strong>DOTS:</strong> click to toggle blocked (╳)<br />
            <strong>BOXES:</strong> click to cycle bonus<br />
            <span style={{ opacity: 0.6 }}>none → +1 → +2 → +3 → ×2 → ×3 → none</span>
          </div>

          <button className="pm-btn primary" onClick={save} disabled={saving} style={{ marginTop: 8 }}>
            {saving ? 'SAVING…' : 'SAVE BOARD'}
          </button>
        </div>

        <div>
          <div style={{ fontSize: 10, color: 'var(--text-sub)', marginBottom: 8, letterSpacing: 1 }}>
            {layout.rows}×{layout.cols} BOARD · {layout.blocked.length} BLOCKED · {layout.bonusDef.length} BONUSES
          </div>
          <BoardLayoutEditor
            rows={layout.rows} cols={layout.cols}
            blocked={layout.blocked} bonusDef={layout.bonusDef}
            onChange={setLayout}
          />
        </div>
      </div>
    </div>
  );
}

// ── Puzzle Editor ─────────────────────────────────────────────────────────────
// Two-step flow:
//   Step 1 — LAYOUT: grid size, blocked dots, solo bonus placement
//   Step 2 — STATE:  pre-drawn edges, pre-captured boxes, metadata
function PuzzleEditor({ puzzle: initialPuzzle, onSave, onCancel, onToast }) {
  const [step, setStep] = useState(1);
  const [layout, setLayout] = useState(null); // null until loaded
  const [meta, setMeta] = useState({
    id:          initialPuzzle?.id          ?? '',
    title:       initialPuzzle?.title       ?? '',
    description: initialPuzzle?.description ?? '',
    difficulty:  initialPuzzle?.difficulty  ?? 'medium',
    committed:   initialPuzzle?.committed   ?? [0, 0],
    player:      initialPuzzle?.player      ?? 0,
  });

  // puzzleState holds h/v/captured — seeded from existing puzzle if editing
  const [puzzleState, setPuzzleState] = useState(
    initialPuzzle?.h
      ? { rows: initialPuzzle.rows ?? 5, cols: initialPuzzle.cols ?? 5,
          blocked: initialPuzzle.blocked ?? [],
          h: initialPuzzle.h, v: initialPuzzle.v, captured: initialPuzzle.captured }
      : null
  );
  const [saving, setSaving] = useState(false);

  // Load global board.json to use as defaults for new puzzles,
  // or to seed layout for existing puzzles missing layout fields.
  useEffect(() => {
    if (initialPuzzle?.rows != null) {
      // Existing puzzle has its own layout
      setLayout({
        rows:     initialPuzzle.rows,
        cols:     initialPuzzle.cols,
        blocked:  initialPuzzle.blocked  ?? [],
        bonusDef: initialPuzzle.bonusDef ?? [],
      });
    } else {
      // New puzzle or missing layout — inherit from global board.json
      fetch('/api/board').then(r => r.json()).then(board => {
        setLayout({
          rows:     board.rows     ?? 5,
          cols:     board.cols     ?? 5,
          blocked:  board.blocked  ?? [],
          bonusDef: board.bonusDef ?? [],
        });
      }).catch(() => setLayout({ rows: 5, cols: 5, blocked: [], bonusDef: [] }));
    }
  }, []);

  const goToStep2 = () => {
    // Recompute edges from the current layout's blocked dots, preserving
    // existing 'pre' values where the edge position still exists and isn't a wall.
    const { rows, cols, blocked } = layout;
    const { h: freshH, v: freshV } = blankEdges(rows, cols, blocked);

    if (puzzleState && puzzleState.rows === rows && puzzleState.cols === cols) {
      // Merge: carry over 'pre' from existing state at non-wall positions
      const mergedH = freshH.map((row, r) => row.map((val, c) => {
        if (val === 'wall') return 'wall';
        const old = puzzleState.h[r]?.[c];
        return old === 'pre' ? 'pre' : null;
      }));
      const mergedV = freshV.map((row, r) => row.map((val, c) => {
        if (val === 'wall') return 'wall';
        const old = puzzleState.v[r]?.[c];
        return old === 'pre' ? 'pre' : null;
      }));
      const mergedCaptured = Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => puzzleState.captured?.[r]?.[c] ?? null)
      );
      setPuzzleState({ rows, cols, blocked, h: mergedH, v: mergedV, captured: mergedCaptured });
    } else {
      // Fresh state
      const captured = Array.from({ length: rows }, () => new Array(cols).fill(null));
      setPuzzleState({ rows, cols, blocked, h: freshH, v: freshV, captured });
    }
    setStep(2);
  };

  const save = async () => {
    const id = meta.id.trim().replace(/\s+/g, '-').toLowerCase() || `puzzle-${Date.now()}`;
    if (!meta.title.trim()) { onToast('Title is required', 'error'); return; }
    setSaving(true);
    const payload = {
      ...puzzleState,
      id, ...meta, ...layout,
      committed: meta.committed,
      player: meta.player,
      runScore: 0, over: false, lastMove: null,
    };
    try {
      await fetch(`/api/puzzles/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      onToast(`Saved: ${id}`);
      onSave();
    } catch {
      onToast('Failed to save puzzle', 'error');
    }
    setSaving(false);
  };

  if (!layout) return <div style={{ fontSize: 11, color: 'var(--text-sub)', padding: 20 }}>Loading…</div>;

  return (
    <div>
      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        <button className={`tab${step === 1 ? ' active' : ''}`} onClick={() => setStep(1)}>1 · LAYOUT</button>
        <button className={`tab${step === 2 ? ' active' : ''}`}
          onClick={() => { if (puzzleState) setStep(2); else goToStep2(); }}
          style={{ opacity: puzzleState ? 1 : 0.4 }}>
          2 · STATE
        </button>
      </div>

      {step === 1 && (
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ minWidth: 220 }}>
            <div className="section-label">GRID SIZE</div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: 'var(--text-sub)' }}>ROWS</label>
              <select className="form-input" style={{ width: 60 }} value={layout.rows}
                onChange={e => setLayout(l => ({ ...l, rows: Number(e.target.value), blocked: l.blocked.filter(b => b.r < Number(e.target.value)), bonusDef: l.bonusDef.filter(b => b.r < Number(e.target.value) - 1) }))}>
                {[3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <label style={{ fontSize: 11, color: 'var(--text-sub)' }}>COLS</label>
              <select className="form-input" style={{ width: 60 }} value={layout.cols}
                onChange={e => setLayout(l => ({ ...l, cols: Number(e.target.value), blocked: l.blocked.filter(b => b.c < Number(e.target.value)), bonusDef: l.bonusDef.filter(b => b.c < Number(e.target.value) - 1) }))}>
                {[3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>

            <div style={{ fontSize: 10, color: 'var(--text-sub)', lineHeight: 1.8, marginBottom: 20 }}>
              <strong>DOTS:</strong> click to toggle blocked (╳)<br />
              <strong>BOXES:</strong> click to cycle solo bonus<br />
              <span style={{ opacity: 0.6 }}>none → +1 → +2 → +3 → ×2 → ×3 → none</span>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="pm-btn primary" onClick={goToStep2}>NEXT: STATE →</button>
              <button className="pm-btn" onClick={onCancel}>CANCEL</button>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 10, color: 'var(--text-sub)', marginBottom: 8, letterSpacing: 1 }}>
              {layout.rows}×{layout.cols} · {layout.blocked.length} BLOCKED · {layout.bonusDef.length} BONUSES
            </div>
            <BoardLayoutEditor
              rows={layout.rows} cols={layout.cols}
              blocked={layout.blocked} bonusDef={layout.bonusDef}
              onChange={setLayout}
            />
          </div>
        </div>
      )}

      {step === 2 && puzzleState && (
        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 24 }}>
          <div>
            <div className="editor-form" style={{ marginBottom: 16 }}>
              {[
                ['ID', 'id', 'text', 'puzzle-02'],
                ['TITLE', 'title', 'text', 'My Puzzle'],
                ['DESCRIPTION', 'description', 'text', 'Short description'],
              ].map(([label, key, type, placeholder]) => (
                <div key={key} className="form-row">
                  <span className="form-label">{label}</span>
                  <input className="form-input" type={type} placeholder={placeholder} value={meta[key]}
                    onChange={e => setMeta(m => ({ ...m, [key]: e.target.value }))} />
                </div>
              ))}
              <div className="form-row">
                <span className="form-label">DIFFICULTY</span>
                <select className="form-input" value={meta.difficulty}
                  onChange={e => setMeta(m => ({ ...m, difficulty: e.target.value }))}>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              <div className="form-row">
                <span className="form-label">YOU SCORE</span>
                <input className="form-input" type="number" min="0" value={meta.committed[0]}
                  onChange={e => setMeta(m => ({ ...m, committed: [Number(e.target.value), m.committed[1]] }))} />
              </div>
              <div className="form-row">
                <span className="form-label">CPU SCORE</span>
                <input className="form-input" type="number" min="0" value={meta.committed[1]}
                  onChange={e => setMeta(m => ({ ...m, committed: [m.committed[0], Number(e.target.value)] }))} />
              </div>
              <div className="form-row">
                <span className="form-label">FIRST TURN</span>
                <select className="form-input" value={meta.player}
                  onChange={e => setMeta(m => ({ ...m, player: Number(e.target.value) }))}>
                  <option value={0}>YOU (Player 0)</option>
                  <option value={1}>CPU (Player 1)</option>
                </select>
              </div>
            </div>

            <div style={{ fontSize: 10, color: 'var(--text-sub)', lineHeight: 1.8, marginBottom: 16 }}>
              <strong>EDGE:</strong> click to toggle null ↔ pre-drawn<br />
              <strong>BOX:</strong> click to cycle null → YOU → CPU → null
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="pm-btn primary" onClick={save} disabled={saving}>
                {saving ? 'SAVING…' : 'SAVE PUZZLE'}
              </button>
              <button className="pm-btn" onClick={() => setStep(1)}>← LAYOUT</button>
              <button className="pm-btn" onClick={onCancel}>CANCEL</button>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 10, color: 'var(--text-sub)', marginBottom: 8, letterSpacing: 1 }}>BOARD STATE EDITOR</div>
            <BoardStateEditor
              puzzle={puzzleState}
              bonusDef={layout.bonusDef}
              onChange={setPuzzleState}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Preview loader ────────────────────────────────────────────────────────────
function PreviewLoader({ id }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    setData(null);
    fetch(`/puzzles/${id}.json`).then(r => r.json()).then(setData).catch(() => {});
  }, [id]);
  if (!data) return <div style={{ fontSize: 11, color: 'var(--text-sub)' }}>Loading…</div>;
  return (
    <div>
      <BoardPreview puzzle={data} bonusDef={data.bonusDef || []} />
      <div className="preview-scores">
        <span>YOU: {data.committed?.[0] ?? 0}</span>
        <span>CPU: {data.committed?.[1] ?? 0}</span>
        <span>TURN: {data.player === 0 ? 'YOU' : 'CPU'}</span>
        <span style={{ color: 'var(--text-sub)' }}>{data.description}</span>
      </div>
    </div>
  );
}

// ── Puzzle List sidebar ───────────────────────────────────────────────────────
function PuzzlesSidebar({ puzzles, selected, onSelect, onEdit, onActivate, onNew }) {
  return (
    <div className="pm-sidebar">
      <div className="pm-header">
        <span className="pm-title">PUZZLES</span>
        <button className="pm-btn primary sm" onClick={onNew}>+ NEW</button>
      </div>
      {puzzles.length === 0 && <div style={{ fontSize: 11, color: 'var(--text-sub)' }}>No puzzles found.</div>}
      {puzzles.map(p => (
        <div key={p.id}
          className={`puzzle-item${selected?.id === p.id ? ' selected' : ''}${p.active ? ' is-active' : ''}`}
          onClick={() => onSelect(p)}>
          <div className="puzzle-item-title">{p.title || p.id}</div>
          <div className="puzzle-item-meta">
            {p.active && <span className="active-badge">★ ACTIVE</span>}
            {p.difficulty && <span className={`diff-badge diff-${p.difficulty}`}>{p.difficulty.toUpperCase()}</span>}
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              <button className="pm-btn sm" onClick={e => { e.stopPropagation(); onEdit(p); }}>EDIT</button>
              {!p.active && <button className="pm-btn sm active-btn" onClick={e => { e.stopPropagation(); onActivate(p.id); }}>ACTIVATE</button>}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────────
function PuzzleManager() {
  const [topTab, setTopTab] = useState('puzzles'); // 'puzzles' | 'board'
  const [puzzles, setPuzzles] = useState([]);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);   // null | puzzle-data | 'new'
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'ok') => setToast({ msg, type });

  const loadPuzzles = async () => {
    try {
      const data = await fetch('/api/puzzles').then(r => r.json());
      setPuzzles(data);
    } catch {
      showToast('Failed to load puzzles — is py/server.py running?', 'error');
    }
  };

  useEffect(() => { loadPuzzles(); }, []);

  const activate = async id => {
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: id }),
      });
      showToast(`Activated: ${id}`);
      loadPuzzles();
    } catch {
      showToast('Failed to activate puzzle', 'error');
    }
  };

  const openEdit = async p => {
    if (p) {
      const data = await fetch(`/puzzles/${p.id}.json`).then(r => r.json()).catch(() => null);
      setEditing(data ?? p);
    } else {
      setEditing('new');
    }
  };

  const cancelEdit = () => setEditing(null);
  const afterSave = () => { setEditing(null); loadPuzzles(); };

  const showEditor = editing !== null;

  return (
    <div>
      {/* Top bar */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 16 }}>
        <a href="index.html" className="back-link">← DEV TOOLS</a>
        <span style={{ fontSize: 10, color: 'var(--border)' }}>|</span>
        <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 13, letterSpacing: 2, color: 'var(--text-sub)' }}>PUZZLE MANAGER</span>
      </div>

      {/* Top-level tabs */}
      <div className="tab-bar" style={{ padding: '0 20px', borderBottom: '1px solid var(--border)', marginBottom: 0 }}>
        <button className={`tab${topTab === 'puzzles' ? ' active' : ''}`} onClick={() => setTopTab('puzzles')}>PUZZLES</button>
        <button className={`tab${topTab === 'board' ? ' active' : ''}`} onClick={() => setTopTab('board')}>BOARD LAYOUT</button>
      </div>

      {topTab === 'board' && (
        <div style={{ padding: 20 }}>
          <GlobalBoardEditor onToast={showToast} />
        </div>
      )}

      {topTab === 'puzzles' && (
        <div className="pm-layout">
          <PuzzlesSidebar
            puzzles={puzzles}
            selected={selected}
            onSelect={p => { setSelected(p); if (showEditor) setEditing(null); }}
            onEdit={openEdit}
            onActivate={activate}
            onNew={() => openEdit(null)}
          />

          <div className="pm-main">
            {showEditor ? (
              <PuzzleEditor
                puzzle={editing === 'new' ? null : editing}
                onSave={afterSave}
                onCancel={cancelEdit}
                onToast={showToast}
              />
            ) : (
              <>
                <div className="section-label" style={{ marginBottom: 12 }}>PREVIEW</div>
                {selected
                  ? <PreviewLoader id={selected.id} />
                  : <div style={{ color: 'var(--text-sub)', fontSize: 12, marginTop: 40, textAlign: 'center' }}>
                      Select a puzzle to preview, or click + NEW to create one.
                    </div>
                }
              </>
            )}
          </div>
        </div>
      )}

      {toast && <Toast key={toast.msg} message={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}

// ── Mount ─────────────────────────────────────────────────────────────────────
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<PuzzleManager />);
