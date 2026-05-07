// Puzzle Manager — admin UI for creating, previewing, and activating puzzles.
// Uses CDN React + Babel, no build step required.

const { useState, useEffect, useCallback } = React;

// ── Constants (mirrors js/config.js) ─────────────────────────────────────────
const ROWS = 5, COLS = 5;
const DS = 72, PAD = 46;
const BW = 2 * PAD + COLS * DS;  // 452
const BH = 2 * PAD + ROWS * DS;  // 452
const BLOCKED = [{r:0,c:3},{r:2,c:2},{r:4,c:4}];
const BSET = new Set(BLOCKED.map(({r,c}) => `${r},${c}`));

const gx = c => PAD + c * DS;
const gy = r => PAD + r * DS;

const THEME = {
  gridLine: '#1e3550', dotFill: '#080d1a', dotStroke: '#3a6888',
  dash: 'rgba(58,104,148,0.85)', wall: '#3a5e7a', pre: '#4a7090',
  p1: '#00d4f0', p2: '#ff5828',
  p1Fill: 'rgba(0,212,240,0.22)', p2Fill: 'rgba(255,88,40,0.20)',
  bkFill: '#0e1826', bkStroke: '#2a4968', bkX: '#5080a8',
  f1: '#5599ff', f1bg: 'rgba(55,110,240,0.22)',
  f2: '#22aadd', f2bg: 'rgba(10,150,210,0.22)',
  f3: '#00cc88', f3bg: 'rgba(0,190,120,0.22)',
  m2: '#f0a010', m2bg: 'rgba(220,148,0,0.22)',
  m3: '#f04030', m3bg: 'rgba(230,50,20,0.22)',
};

// ── Puzzle state helpers ──────────────────────────────────────────────────────
function blankPuzzleState() {
  const h = Array.from({length: ROWS+1}, () => new Array(COLS).fill(null));
  const v = Array.from({length: ROWS},   () => new Array(COLS+1).fill(null));
  // Apply walls from BLOCKED dots
  for (const {r, c} of BLOCKED) {
    if (c > 0)    h[r][c-1] = 'wall';
    if (c < COLS) h[r][c]   = 'wall';
    if (r > 0)    v[r-1][c] = 'wall';
    if (r < ROWS) v[r][c]   = 'wall';
  }
  const captured = Array.from({length: ROWS}, () => new Array(COLS).fill(null));
  return { h, v, captured, committed: [0, 0], runScore: 0, player: 0, over: false, lastMove: null };
}

function isWallEdge(type, r, c) {
  // Returns true if this edge is forced to 'wall' by a blocked dot
  for (const {r: br, c: bc} of BLOCKED) {
    if (type === 'h') {
      if (r === br && (c === bc-1 || c === bc)) return true;
    } else {
      if (c === bc && (r === br-1 || r === br)) return true;
    }
  }
  return false;
}

// Cycle edge: null → 'pre' → null (walls are not user-editable)
function cycleEdge(val) {
  if (val === 'wall') return 'wall';
  return val === null ? 'pre' : null;
}

// Cycle box ownership: null → 0 → 1 → null
function cycleCaptured(val) {
  if (val === null) return 0;
  if (val === 0)    return 1;
  return null;
}

// ── Board Preview SVG ─────────────────────────────────────────────────────────
function BoardSVG({ puzzle, bonusDefs = [], scale = 1 }) {
  const th = THEME;
  const { h, v, captured } = puzzle;
  const bmap = Object.fromEntries((bonusDefs || []).map(b => [`${b.r},${b.c}`, b]));

  const w = BW * scale, ht = BH * scale;
  const vb = `0 0 ${BW} ${BH}`;

  // Grid lines
  const gridLines = [];
  for (let r = 0; r <= ROWS; r++)
    gridLines.push(<line key={`hr${r}`} x1={gx(0)} y1={gy(r)} x2={gx(COLS)} y2={gy(r)} stroke={th.gridLine} strokeWidth="1" />);
  for (let c = 0; c <= COLS; c++)
    gridLines.push(<line key={`vc${c}`} x1={gx(c)} y1={gy(0)} x2={gx(c)} y2={gy(ROWS)} stroke={th.gridLine} strokeWidth="1" />);

  // Box fills
  const fills = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const o = captured[r][c];
    if (o === null) continue;
    fills.push(<rect key={`f${r},${c}`} x={gx(c)+1} y={gy(r)+1} width={DS-2} height={DS-2} fill={o===0?th.p1Fill:th.p2Fill} rx={2} />);
  }

  // Bonus icons
  const bonusIcons = [];
  for (const [key, b] of Object.entries(bmap)) {
    const [br, bc] = key.split(',').map(Number);
    const cx = gx(bc) + DS/2, cy = gy(br) + DS/2;
    const isCap = captured[br]?.[bc] !== null;
    const opacity = isCap ? 0.25 : 1;
    let color, bg, label;
    if (b.op === '*') {
      color = b.val===3 ? th.m3 : th.m2;
      bg    = b.val===3 ? th.m3bg : th.m2bg;
      label = `×${b.val}`;
    } else {
      color = b.val===3 ? th.f3 : b.val===2 ? th.f2 : th.f1;
      bg    = b.val===3 ? th.f3bg : b.val===2 ? th.f2bg : th.f1bg;
      label = `+${b.val}`;
    }
    const shape = b.op === '*'
      ? <polygon key={`bi${key}`} points={`${cx},${cy-14} ${cx+12},${cy+7} ${cx-12},${cy+7}`} fill={bg} stroke={color} strokeWidth="1.5" opacity={opacity} />
      : <circle key={`bi${key}`} cx={cx} cy={cy} r={13} fill={bg} stroke={color} strokeWidth="1.5" opacity={opacity} />;
    bonusIcons.push(shape);
    bonusIcons.push(<text key={`bt${key}`} x={cx} y={cy+4} textAnchor="middle" fill={color} fontSize="11" fontFamily="Share Tech Mono,monospace" opacity={opacity}>{label}</text>);
  }

  // Edges
  const edges = [];
  for (let r = 0; r <= ROWS; r++) for (let c = 0; c < COLS; c++) {
    const val = h[r]?.[c];
    if (!val) continue;
    let stroke = val==='wall' ? th.wall : val==='pre' ? th.pre : val===0 ? th.p1 : th.p2;
    edges.push(<line key={`h${r},${c}`} x1={gx(c)} y1={gy(r)} x2={gx(c+1)} y2={gy(r)} stroke={stroke} strokeWidth={val==='wall'?3:2.5} />);
  }
  for (let r = 0; r < ROWS; r++) for (let c = 0; c <= COLS; c++) {
    const val = v[r]?.[c];
    if (!val) continue;
    let stroke = val==='wall' ? th.wall : val==='pre' ? th.pre : val===0 ? th.p1 : th.p2;
    edges.push(<line key={`v${r},${c}`} x1={gx(c)} y1={gy(r)} x2={gx(c)} y2={gy(r+1)} stroke={stroke} strokeWidth={val==='wall'?3:2.5} />);
  }

  // Dots
  const dots = [];
  for (let r = 0; r <= ROWS; r++) for (let c = 0; c <= COLS; c++) {
    const isBlocked = BSET.has(`${r},${c}`);
    if (isBlocked) {
      dots.push(<rect key={`bk${r},${c}`} x={gx(c)-8} y={gy(r)-8} width={16} height={16} fill={th.bkFill} stroke={th.bkStroke} strokeWidth="1.5" rx={2} />);
      dots.push(<text key={`bkx${r},${c}`} x={gx(c)} y={gy(r)+4} textAnchor="middle" fill={th.bkX} fontSize="12">╳</text>);
    } else {
      dots.push(<circle key={`d${r},${c}`} cx={gx(c)} cy={gy(r)} r={4} fill={th.dotFill} stroke={th.dotStroke} strokeWidth="1.5" />);
    }
  }

  return (
    <svg width={w} height={ht} viewBox={vb} style={{display:'block', background:'#07090f'}}>
      {gridLines}{fills}{bonusIcons}{edges}{dots}
    </svg>
  );
}

// ── Board Editor SVG (interactive) ───────────────────────────────────────────
function BoardEditor({ puzzle, bonusDefs, onChange }) {
  const [hov, setHov] = useState(null);
  const th = THEME;
  const { h, v, captured } = puzzle;
  const bmap = Object.fromEntries((bonusDefs||[]).map(b=>[`${b.r},${b.c}`,b]));
  const HIT = 22;

  const clickH = (r, c) => {
    if (isWallEdge('h', r, c)) return;
    const next = JSON.parse(JSON.stringify(puzzle));
    next.h[r][c] = cycleEdge(next.h[r][c]);
    onChange(next);
  };
  const clickV = (r, c) => {
    if (isWallEdge('v', r, c)) return;
    const next = JSON.parse(JSON.stringify(puzzle));
    next.v[r][c] = cycleEdge(next.v[r][c]);
    onChange(next);
  };
  const clickBox = (r, c) => {
    const next = JSON.parse(JSON.stringify(puzzle));
    next.captured[r][c] = cycleCaptured(next.captured[r][c]);
    onChange(next);
  };

  // Grid lines
  const gridLines = [];
  for (let r = 0; r <= ROWS; r++)
    gridLines.push(<line key={`gr${r}`} x1={gx(0)} y1={gy(r)} x2={gx(COLS)} y2={gy(r)} stroke={th.gridLine} strokeWidth="1" />);
  for (let c = 0; c <= COLS; c++)
    gridLines.push(<line key={`gc${c}`} x1={gx(c)} y1={gy(0)} x2={gx(c)} y2={gy(ROWS)} stroke={th.gridLine} strokeWidth="1" />);

  // Box fills + click targets
  const boxes = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const o = captured[r][c];
    boxes.push(
      <rect key={`bx${r},${c}`} x={gx(c)+1} y={gy(r)+1} width={DS-2} height={DS-2}
        fill={o===null?'transparent':o===0?th.p1Fill:th.p2Fill} rx={2}
        style={{cursor:'pointer'}} onClick={()=>clickBox(r,c)} />
    );
  }

  // Bonus icons (non-interactive, just display)
  const bonusIcons = [];
  for (const [key, b] of Object.entries(bmap)) {
    const [br, bc] = key.split(',').map(Number);
    const cx = gx(bc)+DS/2, cy = gy(br)+DS/2;
    const isCap = captured[br]?.[bc] !== null;
    const op = isCap ? 0.25 : 1;
    let color, bg, label;
    if (b.op==='*') { color=b.val===3?th.m3:th.m2; bg=b.val===3?th.m3bg:th.m2bg; label=`×${b.val}`; }
    else { color=b.val===3?th.f3:b.val===2?th.f2:th.f1; bg=b.val===3?th.f3bg:b.val===2?th.f2bg:th.f1bg; label=`+${b.val}`; }
    const shape = b.op==='*'
      ? <polygon key={`bi${key}`} points={`${cx},${cy-14} ${cx+12},${cy+7} ${cx-12},${cy+7}`} fill={bg} stroke={color} strokeWidth="1.5" opacity={op} style={{pointerEvents:'none'}} />
      : <circle  key={`bi${key}`} cx={cx} cy={cy} r={13} fill={bg} stroke={color} strokeWidth="1.5" opacity={op} style={{pointerEvents:'none'}} />;
    bonusIcons.push(shape);
    bonusIcons.push(<text key={`bt${key}`} x={cx} y={cy+4} textAnchor="middle" fill={color} fontSize="11" fontFamily="Share Tech Mono,monospace" opacity={op} style={{pointerEvents:'none'}}>{label}</text>);
  }

  // Drawn edges (display layer)
  const drawnEdges = [];
  for (let r = 0; r <= ROWS; r++) for (let c = 0; c < COLS; c++) {
    const val = h[r]?.[c];
    if (!val) continue;
    const stroke = val==='wall'?th.wall:val==='pre'?th.pre:val===0?th.p1:th.p2;
    drawnEdges.push(<line key={`hd${r},${c}`} x1={gx(c)} y1={gy(r)} x2={gx(c+1)} y2={gy(r)} stroke={stroke} strokeWidth={val==='wall'?3:2.5} style={{pointerEvents:'none'}} />);
  }
  for (let r = 0; r < ROWS; r++) for (let c = 0; c <= COLS; c++) {
    const val = v[r]?.[c];
    if (!val) continue;
    const stroke = val==='wall'?th.wall:val==='pre'?th.pre:val===0?th.p1:th.p2;
    drawnEdges.push(<line key={`vd${r},${c}`} x1={gx(c)} y1={gy(r)} x2={gx(c)} y2={gy(r+1)} stroke={stroke} strokeWidth={val==='wall'?3:2.5} style={{pointerEvents:'none'}} />);
  }

  // Hover highlights for edges
  const hoverHighlight = hov
    ? hov.type==='h'
      ? <line x1={gx(hov.c)} y1={gy(hov.r)} x2={gx(hov.c+1)} y2={gy(hov.r)} stroke="rgba(255,255,255,0.15)" strokeWidth={HIT*2} style={{pointerEvents:'none'}} />
      : <line x1={gx(hov.c)} y1={gy(hov.r)} x2={gx(hov.c)} y2={gy(hov.r+1)} stroke="rgba(255,255,255,0.15)" strokeWidth={HIT*2} style={{pointerEvents:'none'}} />
    : null;

  // Clickable edge hit areas (horizontal)
  const hHits = [];
  for (let r = 0; r <= ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (h[r]?.[c] === 'wall') continue;
    hHits.push(
      <rect key={`hh${r},${c}`} x={gx(c)+4} y={gy(r)-HIT} width={DS-8} height={HIT*2}
        fill="transparent" style={{cursor:'pointer'}}
        onMouseEnter={()=>setHov({type:'h',r,c})}
        onMouseLeave={()=>setHov(null)}
        onClick={()=>clickH(r,c)} />
    );
  }
  // Clickable edge hit areas (vertical)
  const vHits = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c <= COLS; c++) {
    if (v[r]?.[c] === 'wall') continue;
    vHits.push(
      <rect key={`vh${r},${c}`} x={gx(c)-HIT} y={gy(r)+4} width={HIT*2} height={DS-8}
        fill="transparent" style={{cursor:'pointer'}}
        onMouseEnter={()=>setHov({type:'v',r,c})}
        onMouseLeave={()=>setHov(null)}
        onClick={()=>clickV(r,c)} />
    );
  }

  // Dots
  const dots = [];
  for (let r = 0; r <= ROWS; r++) for (let c = 0; c <= COLS; c++) {
    const isBlocked = BSET.has(`${r},${c}`);
    if (isBlocked) {
      dots.push(<rect key={`bk${r},${c}`} x={gx(c)-8} y={gy(r)-8} width={16} height={16} fill={th.bkFill} stroke={th.bkStroke} strokeWidth="1.5" rx={2} style={{pointerEvents:'none'}} />);
      dots.push(<text key={`bkx${r},${c}`} x={gx(c)} y={gy(r)+4} textAnchor="middle" fill={th.bkX} fontSize="12" style={{pointerEvents:'none'}}>╳</text>);
    } else {
      dots.push(<circle key={`d${r},${c}`} cx={gx(c)} cy={gy(r)} r={4} fill={th.dotFill} stroke={th.dotStroke} strokeWidth="1.5" style={{pointerEvents:'none'}} />);
    }
  }

  return (
    <svg width={BW} height={BH} viewBox={`0 0 ${BW} ${BH}`} style={{display:'block', background:'#07090f'}}>
      {gridLines}
      {hoverHighlight}
      {boxes}
      {bonusIcons}
      {drawnEdges}
      {hHits}
      {vHits}
      {dots}
    </svg>
  );
}

// ── Bonus editor row ──────────────────────────────────────────────────────────
function BonusEditor({ bonusDefs, onChange }) {
  const add = () => onChange([...bonusDefs, {r:0, c:0, op:'+', val:1}]);
  const remove = i => onChange(bonusDefs.filter((_,j)=>j!==i));
  const update = (i, key, val) => {
    const next = bonusDefs.map((b,j)=>j===i?{...b,[key]:key==='r'||key==='c'||key==='val'?Number(val):val}:b);
    onChange(next);
  };

  return (
    <div>
      <div className="section-label">BONUSES</div>
      {bonusDefs.map((b, i) => (
        <div key={i} style={{display:'flex', gap:6, marginBottom:6, alignItems:'center'}}>
          <select className="form-input" style={{width:60}} value={b.r} onChange={e=>update(i,'r',e.target.value)}>
            {Array.from({length:ROWS},(_,r)=><option key={r} value={r}>{r}</option>)}
          </select>
          <select className="form-input" style={{width:60}} value={b.c} onChange={e=>update(i,'c',e.target.value)}>
            {Array.from({length:COLS},(_,c)=><option key={c} value={c}>{c}</option>)}
          </select>
          <select className="form-input" style={{width:55}} value={b.op} onChange={e=>update(i,'op',e.target.value)}>
            <option value="+">+</option>
            <option value="*">×</option>
          </select>
          <select className="form-input" style={{width:55}} value={b.val} onChange={e=>update(i,'val',e.target.value)}>
            {[1,2,3].map(v=><option key={v} value={v}>{v}</option>)}
          </select>
          <button className="pm-btn sm danger" onClick={()=>remove(i)}>✕</button>
        </div>
      ))}
      <button className="pm-btn sm" onClick={add} style={{marginTop:4}}>+ ADD BONUS</button>
    </div>
  );
}

// ── Toast notification ────────────────────────────────────────────────────────
function Toast({ message, type = 'ok', onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, []);
  return <div className={`toast${type==='error'?' error':''}`}>{message}</div>;
}

// ── Main App ──────────────────────────────────────────────────────────────────
function PuzzleManager() {
  const [puzzles, setPuzzles]     = useState([]);
  const [selected, setSelected]   = useState(null); // puzzle object
  const [tab, setTab]             = useState('list'); // 'list' | 'edit'
  const [toast, setToast]         = useState(null);

  // Editor state
  const [editState, setEditState]   = useState(null);
  const [editMeta, setEditMeta]     = useState({id:'', title:'', description:'', difficulty:'medium', committed:[0,0], player:0});
  const [editBonuses, setEditBonuses] = useState([]);

  const showToast = (msg, type='ok') => setToast({msg, type});

  // Fetch puzzle list
  const loadPuzzles = async () => {
    try {
      const data = await fetch('/api/puzzles').then(r => r.json());
      setPuzzles(data);
    } catch(e) {
      showToast('Failed to load puzzles — is server.py running?', 'error');
    }
  };

  useEffect(() => { loadPuzzles(); }, []);

  const activate = async (id) => {
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({active: id}),
      });
      showToast(`Activated: ${id}`);
      loadPuzzles();
    } catch(e) {
      showToast('Failed to activate puzzle', 'error');
    }
  };

  const openEdit = (puzzle = null) => {
    if (puzzle) {
      // Load existing puzzle JSON for editing
      fetch(`/puzzles/${puzzle.id}.json`).then(r=>r.json()).then(data => {
        setEditState({h: data.h, v: data.v, captured: data.captured, committed: data.committed||[0,0], runScore:0, player:data.player||0, over:false, lastMove:null});
        setEditMeta({id: data.id, title: data.title||'', description: data.description||'', difficulty: data.difficulty||'medium', committed: data.committed||[0,0], player: data.player||0});
        setEditBonuses([]); // bonuses live in config, not puzzle JSON for now
        setTab('edit');
      });
    } else {
      const blank = blankPuzzleState();
      setEditState(blank);
      setEditMeta({id:'', title:'', description:'', difficulty:'medium', committed:[0,0], player:0});
      setEditBonuses([]);
      setTab('edit');
    }
  };

  const savePuzzle = async () => {
    const id = editMeta.id.trim().replace(/\s+/g, '-').toLowerCase() || `puzzle-${Date.now()}`;
    if (!editMeta.title.trim()) { showToast('Title is required', 'error'); return; }

    const payload = {
      ...editState,
      id,
      title: editMeta.title,
      description: editMeta.description,
      difficulty: editMeta.difficulty,
      committed: editMeta.committed,
      player: editMeta.player,
    };

    try {
      await fetch(`/api/puzzles/${id}`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(payload),
      });
      showToast(`Saved: ${id}`);
      loadPuzzles();
      setTab('list');
    } catch(e) {
      showToast('Failed to save puzzle', 'error');
    }
  };

  // ── Sidebar: puzzle list ─────────────────────────────────────────────────
  const sidebar = (
    <div className="pm-sidebar">
      <div className="pm-header">
        <span className="pm-title">PUZZLES</span>
        <button className="pm-btn primary sm" onClick={()=>openEdit()}>+ NEW</button>
      </div>
      {puzzles.length === 0 && <div style={{fontSize:11,color:'var(--text-sub)'}}>No puzzles found.</div>}
      {puzzles.map(p => (
        <div key={p.id} className={`puzzle-item${selected?.id===p.id?' selected':''}${p.active?' is-active':''}`}
          onClick={()=>setSelected(p)}>
          <div className="puzzle-item-title">{p.title || p.id}</div>
          <div className="puzzle-item-meta">
            {p.active && <span className="active-badge">★ ACTIVE</span>}
            {p.difficulty && <span className={`diff-badge diff-${p.difficulty}`}>{p.difficulty.toUpperCase()}</span>}
            <span style={{marginLeft:'auto', display:'flex', gap:4}}>
              <button className="pm-btn sm" onClick={e=>{e.stopPropagation();openEdit(p)}}>EDIT</button>
              {!p.active && <button className="pm-btn sm active-btn" onClick={e=>{e.stopPropagation();activate(p.id)}}>ACTIVATE</button>}
            </span>
          </div>
        </div>
      ))}
    </div>
  );

  // ── Main panel: preview ──────────────────────────────────────────────────
  const previewPanel = selected ? (
    <div className="preview-panel">
      <div className="section-label">PREVIEW — {selected.title}</div>
      <PreviewLoader id={selected.id} />
    </div>
  ) : (
    <div style={{color:'var(--text-sub)', fontSize:12, marginTop:40, textAlign:'center'}}>
      Select a puzzle from the sidebar to preview it.
    </div>
  );

  // ── Main panel: editor ───────────────────────────────────────────────────
  const editorPanel = editState ? (
    <div>
      <div className="section-label">
        {editMeta.id ? `EDITING: ${editMeta.id}` : 'NEW PUZZLE'}
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:24}}>
        <div>
          <div className="editor-form" style={{marginBottom:16}}>
            <div className="form-row">
              <span className="form-label">ID</span>
              <input className="form-input" placeholder="puzzle-02" value={editMeta.id}
                onChange={e=>setEditMeta(m=>({...m,id:e.target.value}))} />
            </div>
            <div className="form-row">
              <span className="form-label">TITLE</span>
              <input className="form-input" placeholder="My Puzzle" value={editMeta.title}
                onChange={e=>setEditMeta(m=>({...m,title:e.target.value}))} />
            </div>
            <div className="form-row">
              <span className="form-label">DESCRIPTION</span>
              <input className="form-input" placeholder="Short description" value={editMeta.description}
                onChange={e=>setEditMeta(m=>({...m,description:e.target.value}))} />
            </div>
            <div className="form-row">
              <span className="form-label">DIFFICULTY</span>
              <select className="form-input" value={editMeta.difficulty}
                onChange={e=>setEditMeta(m=>({...m,difficulty:e.target.value}))}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div className="form-row">
              <span className="form-label">YOU SCORE</span>
              <input className="form-input" type="number" min="0" value={editMeta.committed[0]}
                onChange={e=>setEditMeta(m=>({...m,committed:[Number(e.target.value),m.committed[1]]}))} />
            </div>
            <div className="form-row">
              <span className="form-label">CPU SCORE</span>
              <input className="form-input" type="number" min="0" value={editMeta.committed[1]}
                onChange={e=>setEditMeta(m=>({...m,committed:[m.committed[0],Number(e.target.value)]}))} />
            </div>
            <div className="form-row">
              <span className="form-label">FIRST TURN</span>
              <select className="form-input" value={editMeta.player}
                onChange={e=>setEditMeta(m=>({...m,player:Number(e.target.value)}))}>
                <option value={0}>YOU (Player 0)</option>
                <option value={1}>CPU (Player 1)</option>
              </select>
            </div>
          </div>

          <BonusEditor bonusDefs={editBonuses} onChange={setEditBonuses} />

          <div className="editor-actions">
            <button className="pm-btn primary" onClick={savePuzzle}>SAVE PUZZLE</button>
            <button className="pm-btn" onClick={()=>setTab('list')}>← BACK</button>
          </div>

          <div style={{marginTop:12, fontSize:10, color:'var(--text-sub)', lineHeight:1.6}}>
            <strong>EDGE:</strong> click to toggle null ↔ pre-drawn<br/>
            <strong>BOX:</strong> click to cycle null → YOU → CPU → null
          </div>
        </div>

        <div>
          <div style={{fontSize:10, color:'var(--text-sub)', marginBottom:8, letterSpacing:1}}>BOARD EDITOR</div>
          <BoardEditor
            puzzle={editState}
            bonusDefs={editBonuses}
            onChange={setEditState}
          />
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div>
      <div style={{padding:'12px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:16}}>
        <a href="index.html" className="back-link">← DEV TOOLS</a>
        <span style={{fontSize:10, color:'var(--border)'}}>|</span>
        <span style={{fontFamily:'Orbitron, sans-serif', fontSize:13, letterSpacing:2, color:'var(--text-sub)'}}>PUZZLE MANAGER</span>
      </div>

      <div className="pm-layout">
        {sidebar}
        <div className="pm-main">
          <div className="tab-bar">
            <button className={`tab${tab==='list'?' active':''}`} onClick={()=>setTab('list')}>PUZZLES</button>
            {editState && <button className={`tab${tab==='edit'?' active':''}`} onClick={()=>setTab('edit')}>EDITOR</button>}
          </div>

          {tab === 'list' ? previewPanel : editorPanel}
        </div>
      </div>

      {toast && <Toast key={toast.msg} message={toast.msg} type={toast.type} onDone={()=>setToast(null)} />}
    </div>
  );
}

// ── Preview loader (fetches full puzzle JSON then renders it) ─────────────────
function PreviewLoader({ id }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    setData(null);
    fetch(`/puzzles/${id}.json`).then(r=>r.json()).then(setData).catch(()=>{});
  }, [id]);
  if (!data) return <div style={{fontSize:11,color:'var(--text-sub)'}}>Loading…</div>;
  return (
    <div>
      <BoardSVG puzzle={data} scale={0.6} />
      <div className="preview-scores">
        <span>YOU: {data.committed?.[0] ?? 0}</span>
        <span>CPU: {data.committed?.[1] ?? 0}</span>
        <span>TURN: {data.player===0?'YOU':'CPU'}</span>
        <span style={{color:'var(--text-sub)'}}>{data.description}</span>
      </div>
    </div>
  );
}

// ── Mount ─────────────────────────────────────────────────────────────────────
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<PuzzleManager />);
