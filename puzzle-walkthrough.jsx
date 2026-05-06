const { useState, useEffect, useRef } = React;

// ── GEOMETRY ─────────────────────────────────────────────────────────────────

const PAD = 46, DS = 72, SVG_W = 452, SVG_H = 452;
const gx = c => PAD + c * DS;
const gy = r => PAD + r * DS;

const BLOCKED = [{ r: 0, c: 3 }, { r: 2, c: 2 }, { r: 4, c: 4 }];

const BOXES = {
  A: { r: 0, c: 0, bonus: { op: '*', val: 3 } },
  B: { r: 0, c: 4, bonus: { op: '+', val: 2 } },
  C: { r: 4, c: 0, bonus: { op: '+', val: 1 } },
  D: { r: 4, c: 4, bonus: { op: '*', val: 3 }, trap: true },
};

// Pre-captured: YOU cyan (7), CPU orange (14)
const PRE_YOU = [[0,1],[0,2],[1,0],[1,3],[2,0],[3,1],[2,4]];
const PRE_CPU = [[0,3],[1,1],[1,2],[1,4],[2,1],[2,2],[2,3],[3,0],[3,2],[3,3],[3,4],[4,1],[4,2],[4,3]];

// ── PATHS ─────────────────────────────────────────────────────────────────────

const PATHS = {
  optimal: {
    label: 'OPTIMAL', sequence: 'C → B → A', outcome: 'WIN',
    youCommitted: 7, cpuCommitted: 14,
    youFinal: 25, cpuFinal: 17, run: 18,
    steps: [
      { type: 'capture', boxId: 'C', edge: { t:'h', r:5, c:0 }, bonus: { op:'+', val:1 },
        runBefore: 0, runAfter: 2,
        formula: '0 + 1 + 1 = 2',
        why: 'Flat +1 first — build the base before any multiplication.' },
      { type: 'capture', boxId: 'B', edge: { t:'h', r:0, c:4 }, bonus: { op:'+', val:2 },
        runBefore: 2, runAfter: 5,
        formula: '2 + 1 + 2 = 5',
        why: 'Flat +2 second — base grows to 5. Still no multiplier yet.' },
      { type: 'capture', boxId: 'A', edge: { t:'h', r:0, c:0 }, bonus: { op:'*', val:3 },
        runBefore: 5, runAfter: 18,
        formula: '(5 + 1) × 3 = 18',
        why: 'Multiplier LAST — applies to the full accumulated base of 5. Maximum possible result.' },
      { type: 'open_trap', boxId: null, edge: { t:'h', r:5, c:4 },
        runBefore: 18, runAfter: 18,
        formula: 'No box captured → run commits: 18',
        why: 'Forced: the only remaining null edges belong to trap box D. Drawing one opens it without capturing — your run of 18 is now locked in.' },
      { type: 'cpu_capture', boxId: 'D', edge: { t:'v', r:4, c:5 }, bonus: { op:'*', val:3 },
        runBefore: 0, runAfter: 3,
        formula: 'CPU: (0 + 1) × 3 = 3',
        why: "CPU starts a fresh run of 0 and captures D for 3 pts. CPU total: 14 + 3 = 17. You win 25–17." },
    ],
  },
  sub1: {
    label: 'A→B→C', sequence: 'A → B → C', outcome: 'LOSE',
    youCommitted: 7, cpuCommitted: 14,
    youFinal: 15, cpuFinal: 17, run: 8,
    steps: [
      { type: 'capture', boxId: 'A', edge: { t:'h', r:0, c:0 }, bonus: { op:'*', val:3 },
        runBefore: 0, runAfter: 3,
        formula: '(0 + 1) × 3 = 3',
        why: 'Multiplier on a base of 0 — the ×3 only triples 1. The full amplifying power of the multiplier is wasted.' },
      { type: 'capture', boxId: 'B', edge: { t:'h', r:0, c:4 }, bonus: { op:'+', val:2 },
        runBefore: 3, runAfter: 6,
        formula: '3 + 1 + 2 = 6',
        why: 'Flat +2 after the multiplier — adds linearly instead of being amplified. Compare: if B came before A, this +2 would have been tripled.' },
      { type: 'capture', boxId: 'C', edge: { t:'h', r:5, c:0 }, bonus: { op:'+', val:1 },
        runBefore: 6, runAfter: 8,
        formula: '6 + 1 + 1 = 8',
        why: 'Too late — run maxes at 8 vs the optimal 18. The mistake was made in step 1.' },
      { type: 'open_trap', boxId: null, edge: { t:'h', r:5, c:4 },
        runBefore: 8, runAfter: 8,
        formula: 'No box captured → run commits: 8',
        why: 'Forced trap open — need 10+ run to win (7+10=17), but only have 8 (7+8=15). The game is already lost.' },
      { type: 'cpu_capture', boxId: 'D', edge: { t:'v', r:4, c:5 }, bonus: { op:'*', val:3 },
        runBefore: 0, runAfter: 3,
        formula: 'CPU: (0 + 1) × 3 = 3',
        why: 'CPU captures D for 3 pts. CPU total: 17. You lose 15–17.' },
    ],
  },
  sub2: {
    label: 'A→C→B', sequence: 'A → C → B', outcome: 'LOSE',
    youCommitted: 7, cpuCommitted: 14,
    youFinal: 15, cpuFinal: 17, run: 8,
    steps: [
      { type: 'capture', boxId: 'A', edge: { t:'h', r:0, c:0 }, bonus: { op:'*', val:3 },
        runBefore: 0, runAfter: 3,
        formula: '(0 + 1) × 3 = 3',
        why: 'Same mistake as A→B→C — multiplier on base 0. The order of flats after this point cannot save you.' },
      { type: 'capture', boxId: 'C', edge: { t:'h', r:5, c:0 }, bonus: { op:'+', val:1 },
        runBefore: 3, runAfter: 5,
        formula: '3 + 1 + 1 = 5',
        why: 'Flat +1 after the multiplier. Flat order is irrelevant post-mult — it always just adds linearly.' },
      { type: 'capture', boxId: 'B', edge: { t:'h', r:0, c:4 }, bonus: { op:'+', val:2 },
        runBefore: 5, runAfter: 8,
        formula: '5 + 1 + 2 = 8',
        why: 'Same final run of 8 as A→B→C. Proof that swapping flat order after a multiplier changes nothing.' },
      { type: 'open_trap', boxId: null, edge: { t:'h', r:5, c:4 },
        runBefore: 8, runAfter: 8,
        formula: 'No box captured → run commits: 8',
        why: 'Identical losing result. The wrong move was step 1 — not the flat order.' },
      { type: 'cpu_capture', boxId: 'D', edge: { t:'v', r:4, c:5 }, bonus: { op:'*', val:3 },
        runBefore: 0, runAfter: 3,
        formula: 'CPU: (0 + 1) × 3 = 3',
        why: 'CPU always gets 3 regardless of your order. Your only variable is the run you build — and you needed 18, not 8.' },
    ],
  },
};

// ── BOARD STATE ───────────────────────────────────────────────────────────────

function initBoard() {
  const h = Array.from({ length: 6 }, () => Array(5).fill('pre'));
  const v = Array.from({ length: 5 }, () => Array(6).fill('pre'));

  // Walls from blocked dot (0,3)
  h[0][2] = 'wall'; h[0][3] = 'wall'; v[0][3] = 'wall';
  // Walls from blocked dot (2,2)
  h[2][1] = 'wall'; h[2][2] = 'wall'; v[1][2] = 'wall'; v[2][2] = 'wall';
  // Walls from blocked dot (4,4)
  h[4][3] = 'wall'; h[4][4] = 'wall'; v[3][4] = 'wall'; v[4][4] = 'wall';

  // Free (null) edges for the 4 uncaptured boxes
  h[0][0] = null;  // Box A: top
  h[0][4] = null;  // Box B: top
  h[5][0] = null;  // Box C: bottom
  h[5][4] = null;  // Box D: bottom
  v[4][5] = null;  // Box D: right

  const captured = Array.from({ length: 5 }, () => Array(5).fill(false));
  const owners   = Array.from({ length: 5 }, () => Array(5).fill(null));
  PRE_YOU.forEach(([r, c]) => { captured[r][c] = true; owners[r][c] = 0; });
  PRE_CPU.forEach(([r, c]) => { captured[r][c] = true; owners[r][c] = 1; });

  return { h, v, captured, owners };
}

function getBoardAtStep(pathKey, stepIdx) {
  const base = initBoard();
  const h = base.h.map(r => [...r]);
  const v = base.v.map(r => [...r]);
  const captured = base.captured.map(r => [...r]);
  const owners   = base.owners.map(r => [...r]);
  let activeEdge = null, activeBoxId = null;

  const steps = PATHS[pathKey].steps;
  for (let i = 0; i <= stepIdx && i < steps.length; i++) {
    const s = steps[i];
    const player = s.type === 'cpu_capture' ? 1 : 0;
    if (s.edge.t === 'h') h[s.edge.r][s.edge.c] = player;
    else                   v[s.edge.r][s.edge.c] = player;
    if (s.boxId) {
      const box = BOXES[s.boxId];
      captured[box.r][box.c] = true;
      owners[box.r][box.c] = player;
    }
    if (i === stepIdx) { activeEdge = s.edge; activeBoxId = s.boxId; }
  }
  return { h, v, captured, owners, activeEdge, activeBoxId };
}

// ── COLORS & STYLES ───────────────────────────────────────────────────────────

const C = {
  bg: '#07090f', card: '#0b1220', border: '#1d3a52',
  cyan: '#00d4f0', orange: '#ff5828', gold: '#ffd700',
  green: '#00bb78', red: '#e83020', dim: '#28606e', text: '#a8cdd8',
  blue: '#22aadd',
};
const OUTCOME_COL = { WIN: C.green, LOSE: C.red, TIE: C.gold };

const S = {
  page:      { minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "'Share Tech Mono', monospace", padding: '0 0 60px' },
  header:    { background: '#0b1220', borderBottom: `1px solid ${C.border}`, padding: '18px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 },
  title:     { fontFamily: "'Orbitron', sans-serif", fontWeight: 900, fontSize: 20, letterSpacing: '0.3em', color: C.cyan, textShadow: `0 0 20px ${C.cyan}44`, margin: 0 },
  sub:       { fontSize: 9, letterSpacing: '0.18em', color: C.dim, marginTop: 3 },
  body:      { maxWidth: 1100, margin: '0 auto', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 24 },
  row:       { display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' },
  card:      { background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: '18px 20px' },
  cardTitle: { fontSize: 9, letterSpacing: '0.2em', color: C.dim, marginBottom: 12, textTransform: 'uppercase' },
  btn:       (active, col = C.cyan) => ({
    background: active ? col + '18' : 'transparent',
    border: `1px solid ${active ? col : C.border}`,
    borderRadius: 3, color: active ? col : C.dim,
    fontFamily: "'Share Tech Mono', monospace", fontSize: 10, letterSpacing: '0.1em',
    padding: '5px 14px', cursor: 'pointer', transition: 'all 0.15s',
  }),
  pill:      (col) => ({ background: col + '20', border: `1px solid ${col}`, borderRadius: 12, padding: '2px 10px', fontSize: 10, color: col, display: 'inline-block' }),
};

// ── BOARD SVG ─────────────────────────────────────────────────────────────────

function BoardSVG({ board }) {
  const { h, v, captured, owners, activeEdge, activeBoxId } = board;

  const isBlocked = (r, c) => BLOCKED.some(b => b.r === r && b.c === c);
  const isActiveEdge = (t, r, c) => activeEdge && activeEdge.t === t && activeEdge.r === r && activeEdge.c === c;

  function renderHEdge(r, c) {
    const state = h[r][c];
    const x1 = gx(c), x2 = gx(c + 1), y = gy(r);
    const active = isActiveEdge('h', r, c);
    if (state === null)
      return <line key={`h${r}${c}`} x1={x1} y1={y} x2={x2} y2={y} stroke={C.border} strokeWidth={1.5} strokeDasharray="5 7" opacity={0.7} />;
    if (state === 'wall') {
      const mx = (x1 + x2) / 2, hw = (x2 - x1) * 0.28;
      return <line key={`h${r}${c}`} x1={mx - hw} y1={y} x2={mx + hw} y2={y} stroke="#182430" strokeWidth={2} />;
    }
    if (state === 'pre')
      return <line key={`h${r}${c}`} x1={x1} y1={y} x2={x2} y2={y} stroke="#2a3a4a" strokeWidth={3} strokeLinecap="round" />;
    const col = state === 0 ? C.cyan : C.orange;
    return <line key={`h${r}${c}`} x1={x1} y1={y} x2={x2} y2={y} stroke={col}
      strokeWidth={active ? 5.5 : 4} strokeLinecap="round"
      filter={active ? `drop-shadow(0 0 6px ${col})` : 'none'} opacity={active ? 1 : 0.85} />;
  }

  function renderVEdge(r, c) {
    const state = v[r][c];
    const x = gx(c), y1 = gy(r), y2 = gy(r + 1);
    const active = isActiveEdge('v', r, c);
    if (state === null)
      return <line key={`v${r}${c}`} x1={x} y1={y1} x2={x} y2={y2} stroke={C.border} strokeWidth={1.5} strokeDasharray="5 7" opacity={0.7} />;
    if (state === 'wall') {
      const my = (y1 + y2) / 2, hh = (y2 - y1) * 0.28;
      return <line key={`v${r}${c}`} x1={x} y1={my - hh} x2={x} y2={my + hh} stroke="#182430" strokeWidth={2} />;
    }
    if (state === 'pre')
      return <line key={`v${r}${c}`} x1={x} y1={y1} x2={x} y2={y2} stroke="#2a3a4a" strokeWidth={3} strokeLinecap="round" />;
    const col = state === 0 ? C.cyan : C.orange;
    return <line key={`v${r}${c}`} x1={x} y1={y1} x2={x} y2={y2} stroke={col}
      strokeWidth={active ? 5.5 : 4} strokeLinecap="round"
      filter={active ? `drop-shadow(0 0 6px ${col})` : 'none'} opacity={active ? 1 : 0.85} />;
  }

  // Which box letter is this cell?
  const boxIdAt = (r, c) => Object.keys(BOXES).find(k => BOXES[k].r === r && BOXES[k].c === c) || null;

  return (
    <svg width={SVG_W} height={SVG_H} style={{ display: 'block', maxWidth: '100%' }}>
      <style>{`@keyframes newbox{0%{opacity:0.1}50%{opacity:0.55}100%{opacity:0.3}}`}</style>

      {/* Background */}
      <rect width={SVG_W} height={SVG_H} fill={C.bg} />

      {/* Subtle grid texture */}
      {Array.from({ length: 6 }, (_, r) => (
        <line key={`glh${r}`} x1={PAD} y1={gy(r)} x2={SVG_W - PAD} y2={gy(r)} stroke="#111827" strokeWidth={0.5} opacity={0.6} />
      ))}
      {Array.from({ length: 6 }, (_, c) => (
        <line key={`glv${c}`} x1={gx(c)} y1={PAD} x2={gx(c)} y2={SVG_H - PAD} stroke="#111827" strokeWidth={0.5} opacity={0.6} />
      ))}

      {/* Box fills */}
      {Array.from({ length: 5 }, (_, r) => Array.from({ length: 5 }, (_, c) => {
        if (!captured[r][c]) return null;
        const col = owners[r][c] === 0 ? C.cyan : C.orange;
        const bid = boxIdAt(r, c);
        const isNew = bid && bid === activeBoxId;
        return (
          <rect key={`bf${r}${c}`} x={gx(c) + 1} y={gy(r) + 1} width={DS - 2} height={DS - 2}
            fill={col} opacity={isNew ? 0.32 : 0.13}
            style={isNew ? { animation: 'newbox 0.6s ease-out' } : {}} />
        );
      }))}

      {/* Trap box D outline when uncaptured */}
      {!captured[4][4] && (
        <rect x={gx(4) + 3} y={gy(4) + 3} width={DS - 6} height={DS - 6}
          fill="none" stroke={C.red} strokeWidth={1.5} strokeDasharray="5 3" opacity={0.5} rx={2} />
      )}

      {/* Edges — draw pre/wall first so player edges render on top */}
      {Array.from({ length: 6 }, (_, r) => Array.from({ length: 5 }, (_, c) => {
        const state = h[r][c];
        if (state === 'pre' || state === 'wall') return renderHEdge(r, c);
        return null;
      }))}
      {Array.from({ length: 5 }, (_, r) => Array.from({ length: 6 }, (_, c) => {
        const state = v[r][c];
        if (state === 'pre' || state === 'wall') return renderVEdge(r, c);
        return null;
      }))}
      {/* Player-drawn edges (null/0/1) on top */}
      {Array.from({ length: 6 }, (_, r) => Array.from({ length: 5 }, (_, c) => {
        const state = h[r][c];
        if (state !== 'pre' && state !== 'wall') return renderHEdge(r, c);
        return null;
      }))}
      {Array.from({ length: 5 }, (_, r) => Array.from({ length: 6 }, (_, c) => {
        const state = v[r][c];
        if (state !== 'pre' && state !== 'wall') return renderVEdge(r, c);
        return null;
      }))}

      {/* Bonus icons and labels for the 4 special boxes */}
      {Object.entries(BOXES).map(([id, box]) => {
        const cx = gx(box.c) + DS / 2;
        const cy = gy(box.r) + DS / 2;
        const isCaptured = captured[box.r][box.c];
        const col = box.trap ? C.orange : (box.bonus.op === '+' ? C.blue : C.orange);
        const label = box.trap ? '×3' : (box.bonus.op === '+' ? `+${box.bonus.val}` : `×${box.bonus.val}`);

        return (
          <g key={id}>
            {/* Bonus icon (only when uncaptured) */}
            {!isCaptured && (box.trap ? (
              <g>
                <text x={cx} y={cy - 9} textAnchor="middle" fontSize={16} fill={C.red} fontFamily="sans-serif">⚠</text>
                <text x={cx} y={cy + 9} textAnchor="middle" dominantBaseline="middle"
                  fill={C.orange} fontSize={10} fontFamily="'Share Tech Mono',monospace" letterSpacing="0.08em">
                  ×3 TRAP
                </text>
              </g>
            ) : (
              <g>
                {box.bonus.op === '+' ? (
                  <circle cx={cx} cy={cy + 4} r={15} fill={col + '1a'} stroke={col} strokeWidth={1.5} />
                ) : (
                  <rect x={cx - 13} y={cy - 13 + 4} width={26} height={26}
                    transform={`rotate(45,${cx},${cy + 4})`} fill={col + '1a'} stroke={col} strokeWidth={1.5} />
                )}
                <text x={cx} y={cy + 9} textAnchor="middle" dominantBaseline="middle"
                  fill={col} fontSize={12} fontFamily="'Share Tech Mono',monospace">{label}</text>
              </g>
            ))}
            {/* Box letter label */}
            <text x={cx} y={gy(box.r) + 15} textAnchor="middle"
              fill={isCaptured ? (owners[box.r][box.c] === 0 ? C.cyan + '99' : C.orange + '99') : C.cyan}
              fontSize={13} fontFamily="'Orbitron',sans-serif" fontWeight={900}
              opacity={isCaptured ? 0.6 : 1}>
              {id}
            </text>
          </g>
        );
      })}

      {/* Dots */}
      {Array.from({ length: 6 }, (_, r) => Array.from({ length: 6 }, (_, c) => {
        if (isBlocked(r, c)) return null;
        return <circle key={`dot${r}${c}`} cx={gx(c)} cy={gy(r)} r={4} fill="#0e1a24" stroke="#3a5a6a" strokeWidth={1.5} />;
      }))}
      {BLOCKED.map(({ r, c }) => (
        <g key={`bk${r}${c}`}>
          <circle cx={gx(c)} cy={gy(r)} r={6} fill="#182430" />
          <line x1={gx(c) - 4} y1={gy(r) - 4} x2={gx(c) + 4} y2={gy(r) + 4} stroke="#3a4a5a" strokeWidth={1.5} />
          <line x1={gx(c) + 4} y1={gy(r) - 4} x2={gx(c) - 4} y2={gy(r) + 4} stroke="#3a4a5a" strokeWidth={1.5} />
        </g>
      ))}

      {/* Corner score labels */}
      <text x={10} y={14} fill={C.dim} fontSize={8} fontFamily="'Share Tech Mono',monospace">YOU COMMITTED: 7</text>
      <text x={10} y={24} fill={C.dim} fontSize={8} fontFamily="'Share Tech Mono',monospace">CPU COMMITTED: 14</text>
    </svg>
  );
}

// ── WALKTHROUGH PANEL ────────────────────────────────────────────────────────

function WalkthroughPanel({ pathKey, step, setStep, autoPlay, setAutoPlay }) {
  const path = PATHS[pathKey];
  const steps = path.steps;
  const maxStep = steps.length - 1;
  const currentStep = step >= 0 && step < steps.length ? steps[step] : null;
  const isFinal     = step >= maxStep;
  const MAX_RUN     = 18;
  // yourRun tracks YOUR accumulated run (stays at path.run after CPU step)
  const yourRun = !currentStep ? 0
    : currentStep.type === 'cpu_capture' ? path.run
    : currentStep.runAfter;

  const typeLabel = (s) => {
    if (!s) return 'Initial board';
    if (s.type === 'cpu_capture') return "CPU's Turn — Trap Captured";
    if (s.type === 'open_trap')   return 'Forced: Open Trap Box';
    return `Capture Box ${s.boxId} (${s.bonus.op === '+' ? '+' + s.bonus.val : '×' + s.bonus.val})`;
  };

  const stepColor = (s) => {
    if (!s) return C.dim;
    if (s.type === 'cpu_capture') return C.orange;
    if (s.type === 'open_trap')   return '#e09000';
    return s.bonus.op === '+' ? C.blue : C.orange;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1, minWidth: 300 }}>

      {/* Step header */}
      <div style={{ ...S.card }}>
        <div style={{ fontSize: 9, letterSpacing: '0.15em', color: C.dim, marginBottom: 8 }}>
          {step < 0 ? 'READY TO BEGIN' : `STEP ${step + 1} OF ${steps.length}`}
        </div>
        <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 13, color: stepColor(currentStep), letterSpacing: '0.12em', marginBottom: 10 }}>
          {typeLabel(currentStep)}
        </div>

        {/* Formula display */}
        {currentStep && (
          <div style={{ background: '#0a1520', border: `1px solid ${stepColor(currentStep)}44`, borderRadius: 4, padding: '10px 14px', marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: C.dim, marginBottom: 4, letterSpacing: '0.1em' }}>CALCULATION</div>
            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 16, color: C.gold, letterSpacing: '0.05em' }}>
              {currentStep.formula}
            </div>
          </div>
        )}

        {/* Why */}
        {currentStep && (
          <div style={{ fontSize: 11, color: C.text, lineHeight: 1.7, opacity: 0.85 }}>
            {currentStep.why}
          </div>
        )}
        {!currentStep && (
          <div style={{ fontSize: 11, color: C.dim, lineHeight: 1.7 }}>
            Press NEXT or PLAY to walk through the capture sequence.<br />
            The GTO rule: flat bonuses first, then multipliers last.
          </div>
        )}
      </div>

      {/* Run progress bar */}
      <div style={{ ...S.card, padding: '14px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 9, letterSpacing: '0.12em', color: C.dim }}>
          <span>YOUR RUN</span>
          <span style={{ color: C.gold }}>{yourRun} / {MAX_RUN}</span>
        </div>
        <div style={{ height: 8, background: '#0a1520', borderRadius: 4, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 4,
            width: `${(yourRun / MAX_RUN) * 100}%`,
            background: `linear-gradient(90deg, ${C.cyan}88, ${C.gold})`,
            transition: 'width 0.4s ease',
            boxShadow: yourRun > 0 ? `0 0 8px ${C.gold}44` : 'none',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10 }}>
          <span style={{ color: C.cyan }}>YOU: {7 + yourRun}</span>
          <span style={{ color: C.orange }}>CPU: {step >= maxStep ? path.cpuFinal : 14}</span>
          {isFinal && (
            <span style={S.pill(OUTCOME_COL[path.outcome])}>{path.outcome}</span>
          )}
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button style={S.btn(false)} onClick={() => { setStep(-1); setAutoPlay(false); }}>RESET</button>
        <button style={S.btn(false)} onClick={() => { setAutoPlay(false); setStep(s => Math.max(-1, s - 1)); }}>◀ PREV</button>
        <button style={S.btn(false)} onClick={() => { setAutoPlay(false); setStep(s => Math.min(maxStep, s + 1)); }}>NEXT ▶</button>
        <button style={S.btn(autoPlay, C.cyan)} onClick={() => {
          if (step >= maxStep) setStep(-1);
          setAutoPlay(v => !v);
        }}>
          {autoPlay ? '⏸ PAUSE' : '▶ PLAY'}
        </button>
      </div>

      {/* Step list */}
      <div style={S.card}>
        <div style={S.cardTitle}>ALL STEPS</div>
        {steps.map((s, i) => {
          const past    = i < step;
          const current = i === step;
          const future  = i > step;
          const col     = stepColor(s);
          return (
            <div key={i} onClick={() => { setAutoPlay(false); setStep(i); }}
              style={{
                display: 'flex', gap: 10, alignItems: 'flex-start',
                padding: '8px 10px', marginBottom: 4, borderRadius: 4,
                background: current ? col + '12' : 'transparent',
                border: `1px solid ${current ? col : 'transparent'}`,
                opacity: future ? 0.35 : 1,
                cursor: 'pointer', transition: 'all 0.15s',
              }}>
              <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 11, color: col, minWidth: 20 }}>
                {past ? '✓' : i + 1}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: past ? C.dim : col, letterSpacing: '0.08em' }}>
                  {typeLabel(s)}
                </div>
                <div style={{ fontSize: 10, color: current ? C.gold : C.dim, fontFamily: 'monospace', marginTop: 2 }}>
                  {s.formula}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── GTO RULE CARDS ────────────────────────────────────────────────────────────

const RULES = [
  {
    num: '①', col: C.cyan,
    title: 'Why flat bonuses first?',
    body: `The multiplier computes new_run = (current_run + 1) × n. The key insight: the larger current_run is before you multiply, the more powerful the result.

In this puzzle: Flat first (C→B→A) gives run = (5+1)×3 = 18. Mult first (A→B→C) gives run = (0+1)×3 = 3, then linearly 3+3+2 = 8.

Proof: With one flat (+n) before one mult (×m), you gain an extra n×(m−1) points vs the reversed order. Here n₁=1, n₂=2, m=3: you gain 1×2 + 2×2 = 2+4 = 6 extra pts just from the order — plus the compounding on the base.`,
  },
  {
    num: '②', col: C.blue,
    title: 'Why ascending multiplier order?',
    body: `When multiple multipliers exist, always apply the SMALLER one first.

Proof: For mult ×m₁ then ×m₂ (starting from base b):
  ascending: (b+1)×m₁×m₂ + m₂
  descending: (b+1)×m₁×m₂ + m₁

The product term (b+1)×m₁×m₂ is identical. The difference is the trailing term: ascending wins by exactly m₂ − m₁.

Example: ×2 then ×3 with base b=3:
  ascending:  (3+1)×2 = 8, then (8+1)×3 = 27
  descending: (3+1)×3 = 12, then (12+1)×2 = 26
  Ascending wins by 1 = m₂−m₁ = 3−2.`,
  },
  {
    num: '③', col: C.red,
    title: 'Why does wrong order lose?',
    body: `This puzzle has exactly ONE winning order (C→B→A). Both suboptimal paths tie at run=8, giving YOU=15 vs CPU=17 — a loss by 2.

The error cost: by multiplying first (run=0→3) instead of last (run=5→18), you "wasted" 10 run points. The ×3 tripled 1 instead of tripling 6.

Key takeaway: the trap box CPU score (17) is a fixed constant. Your only variable is the run you build before opening it. In this puzzle you need at least run=10 to win (7+10=17 → tie, 7+11=18 → win). Only the GTO order (run=18) clears that bar.`,
  },
];

function RuleCards() {
  const [open, setOpen] = useState({});
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 9, letterSpacing: '0.2em', color: C.dim }}>◈ GTO PRINCIPLES — CLICK TO EXPAND</div>
      {RULES.map((rule) => (
        <div key={rule.num} style={{ ...S.card, borderLeftWidth: 3, borderLeftColor: rule.col, paddingLeft: 16, cursor: 'pointer' }}
          onClick={() => setOpen(o => ({ ...o, [rule.num]: !o[rule.num] }))}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 16, color: rule.col }}>{rule.num}</span>
            <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 11, color: rule.col, letterSpacing: '0.12em', flex: 1 }}>{rule.title}</span>
            <span style={{ color: C.dim, fontSize: 12 }}>{open[rule.num] ? '▲' : '▼'}</span>
          </div>
          {open[rule.num] && (
            <p style={{ fontSize: 12, color: C.text, lineHeight: 1.85, margin: '12px 0 0', whiteSpace: 'pre-line' }}>
              {rule.body}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ── COMPARISON TABLE ──────────────────────────────────────────────────────────

function ComparisonTable({ activePath, setActivePath, setStep, setAutoPlay }) {
  return (
    <div style={S.card}>
      <div style={S.cardTitle}>ALL ORDERINGS — RANKED BY RUN SCORE</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ color: C.dim, fontSize: 9, letterSpacing: '0.12em' }}>
              {['', 'ORDER', 'SEQUENCE', 'RUN', 'YOU', 'CPU', 'RESULT'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '6px 10px', borderBottom: `1px solid ${C.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(PATHS).map(([key, p], i) => {
              const active = key === activePath;
              const oc = OUTCOME_COL[p.outcome];
              return (
                <tr key={key} onClick={() => { setActivePath(key); setStep(-1); setAutoPlay(false); }}
                  style={{ background: active ? oc + '0c' : 'transparent', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#ffffff08'}
                  onMouseLeave={e => e.currentTarget.style.background = active ? oc + '0c' : 'transparent'}>
                  <td style={{ padding: '9px 10px', color: active ? oc : C.dim, fontSize: 14 }}>{active ? '▶' : i === 0 ? '★' : ''}</td>
                  <td style={{ padding: '9px 10px', color: active ? oc : C.dim, fontFamily: "'Orbitron',sans-serif", fontSize: 10 }}>{p.label}</td>
                  <td style={{ padding: '9px 10px', color: C.text, letterSpacing: '0.05em' }}>{p.sequence} → open D</td>
                  <td style={{ padding: '9px 10px', color: active ? C.gold : C.text, fontWeight: 'bold' }}>{p.run}</td>
                  <td style={{ padding: '9px 10px', color: C.cyan }}>{p.youFinal}</td>
                  <td style={{ padding: '9px 10px', color: C.orange }}>{p.cpuFinal}</td>
                  <td style={{ padding: '9px 10px' }}><span style={S.pill(oc)}>{p.outcome}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 8, fontSize: 9, color: '#1d3a52', letterSpacing: '0.1em' }}>
        CLICK ANY ROW TO SWITCH PATH AND RESET WALKTHROUGH
      </div>
    </div>
  );
}

// ── APP ───────────────────────────────────────────────────────────────────────

function App() {
  const [pathKey, setPathKey]   = useState('optimal');
  const [step, setStep]         = useState(-1);
  const [autoPlay, setAutoPlay] = useState(false);
  const timerRef = useRef(null);

  const maxStep = PATHS[pathKey].steps.length - 1;

  useEffect(() => {
    if (!autoPlay) { clearTimeout(timerRef.current); return; }
    if (step >= maxStep) { setAutoPlay(false); return; }
    timerRef.current = setTimeout(() => setStep(s => s + 1), 1200);
    return () => clearTimeout(timerRef.current);
  }, [autoPlay, step, maxStep]);

  // Reset step when path changes
  const switchPath = (key) => { setPathKey(key); setStep(-1); setAutoPlay(false); };

  const board = getBoardAtStep(pathKey, step);

  return (
    <div style={S.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@900&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; background: #07090f; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0b1220; }
        ::-webkit-scrollbar-thumb { background: #1d3a52; border-radius: 3px; }
      `}</style>

      {/* Header */}
      <div style={S.header}>
        <div>
          <h1 style={S.title}>GRID — GTO PUZZLE WALKTHROUGH</h1>
          <div style={S.sub}>GAME-THEORY OPTIMAL · FLAT BONUSES FIRST · MULTIPLIERS LAST · COMMITTED: YOU 7 · CPU 14</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(PATHS).map(([key, p]) => (
            <button key={key} style={S.btn(pathKey === key, OUTCOME_COL[p.outcome])} onClick={() => switchPath(key)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div style={S.body}>

        {/* Puzzle title */}
        <div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 15, color: C.cyan, letterSpacing: '0.2em', marginBottom: 4 }}>
            THE MULTIPLIER ENDGAME
          </div>
          <div style={{ fontSize: 11, color: C.dim, letterSpacing: '0.08em' }}>
            4 boxes remain. Capture A (×3), B (+2), C (+1) in the optimal order, then open trap D for CPU.
            One ordering wins; two lose. Find the GTO sequence.
          </div>
        </div>

        {/* Board + Walkthrough side by side */}
        <div style={S.row}>
          <div style={{ ...S.card, padding: 12, flexShrink: 0 }}>
            <div style={S.cardTitle}>GAME BOARD</div>
            <BoardSVG board={board} />
            <div style={{ marginTop: 10, display: 'flex', gap: 16, fontSize: 9, color: C.dim, letterSpacing: '0.1em', flexWrap: 'wrap' }}>
              <span><span style={{ color: C.cyan }}>■</span> YOU (pre-captured)</span>
              <span><span style={{ color: C.orange }}>■</span> CPU (pre-captured)</span>
              <span style={{ color: '#2a3a4a' }}>— pre-drawn edge</span>
              <span style={{ color: C.border }}>- - available</span>
              <span style={{ color: C.red }}>⚠ trap</span>
            </div>
          </div>

          <WalkthroughPanel
            pathKey={pathKey} step={step} setStep={setStep}
            autoPlay={autoPlay} setAutoPlay={setAutoPlay}
          />
        </div>

        {/* Comparison table */}
        <ComparisonTable
          activePath={pathKey} setActivePath={setPathKey}
          setStep={setStep} setAutoPlay={setAutoPlay}
        />

        {/* GTO rule cards */}
        <RuleCards />

      </div>
    </div>
  );
}


// Auto-mount when loaded directly via HTML
const _root = document.getElementById('root');
if (_root) ReactDOM.createRoot(_root).render(React.createElement(App));
