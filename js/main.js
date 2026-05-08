import { THEMES } from './config.js';
import { board, applyBoardConfig } from './boardConfig.js';
import { initGameState, applyMove, aiMove } from './game.js';
import { loadActivePuzzle } from './puzzle.js';
import { buildBoardSVG } from './renderer.js';

// ─── App state ────────────────────────────────────────────────────────────
const app = {
  dark:        true,
  mode:        null,    // '2P' | 'AI' | 'SOLO' | 'HTP' | null
  game:        null,
  aiRunning:   false,
  hov:         null,    // { t, r, c } | null  — hovered edge
  hovKey:      null,    // string key for fast change-detection
  boardCtrl:   null,    // AbortController for board event listeners
  globalBoard: null,    // cached board.json for restoring after SOLO
  demoStep:    0,       // 0–3 — which demo frame the menu is showing
};

// ─── Helpers ──────────────────────────────────────────────────────────────
const getTheme    = () => THEMES[app.dark ? 'dark' : 'light'];
const getBmap     = () => app.mode === 'SOLO' ? (app.game?.bmap    ?? {})  : board.bmap;
const getBonusDef = () => app.mode === 'SOLO' ? (app.game?.bonusDef ?? []) : board.bonusDef;
const isCPUMode   = () => app.mode === 'AI' || app.mode === 'SOLO';

/** Scores including any uncommitted run. */
function finalScores() {
  const { committed, runScore, player } = app.game;
  return [
    committed[0] + (player === 0 ? runScore : 0),
    committed[1] + (player === 1 ? runScore : 0),
  ];
}

const pLabel = i => app.mode === '2P' ? `P${i + 1}` : (i === 0 ? 'YOU' : 'CPU');

function winLabel(wi) {
  if (wi === -1)          return 'TIE GAME';
  if (app.mode === '2P')  return `PLAYER ${wi + 1} WINS`;
  return wi === 0 ? 'YOU WIN' : 'CPU WINS';
}

/** CSS class for the winner's colour. */
const winClass = wi => wi === -1 ? 'gold' : `p${wi}`;

// ─── Game logic ───────────────────────────────────────────────────────────
async function startGame(mode) {
  app.mode = mode;

  if (mode === 'SOLO') {
    const puzzle = await loadActivePuzzle();
    // Apply the puzzle's board layout (rows, cols, blocked, bonusDef)
    applyBoardConfig(puzzle);
    // Build bmap for fast scoring lookups during play
    puzzle.bmap = Object.fromEntries(
      (puzzle.bonusDef ?? []).map(b => [`${b.r},${b.c}`, b])
    );
    app.game = puzzle;
  } else {
    // Restore global board layout for 2P/AI modes
    if (app.globalBoard) applyBoardConfig(app.globalBoard);
    app.game = initGameState(board.blocked);
  }

  app.aiRunning = false;
  app.hov       = null;
  app.hovKey    = null;
  renderGame();
}

function handleEdge(type, r, c) {
  if (!app.game || app.game.over || app.aiRunning) return;

  const edge = type === 'h' ? app.game.h[r][c] : app.game.v[r][c];
  if (edge !== null) return;                        // already drawn or wall
  if (isCPUMode() && app.game.player === 1) return; // CPU's turn

  const bm  = getBmap();
  const res = applyMove(type, r, c, app.game.player, app.game, bm);
  const cc  = res.captured.flat().filter(x => x !== null).length;
  const over = cc === board.total;
  const next = res.scored ? app.game.player : 1 - app.game.player;

  app.game  = { ...res, player: next, over };
  app.hov   = null;
  app.hovKey = null;

  renderGame();

  // Hand off to CPU if needed
  if (isCPUMode() && !over && next === 1) runCPU();
}

/** Run the greedy AI in a non-blocking timeout, chaining captures. */
function runCPU() {
  app.aiRunning = true;
  // Update status text immediately so player knows CPU is "thinking"
  const statusEl = document.querySelector('.status-bar > div:first-child');
  if (statusEl) { statusEl.textContent = 'CPU THINKING...'; statusEl.className = 'ai-thinking'; }

  setTimeout(() => {
    const bm = getBmap();
    let s = app.game;

    while (!s.over && s.player === 1) {
      const mv = aiMove(s.h, s.v);
      if (!mv) break;
      const r2 = applyMove(mv.t, mv.r, mv.c, 1, s, bm);
      const c2 = r2.captured.flat().filter(x => x !== null).length;
      s = { ...r2, player: r2.scored ? 1 : 0, over: c2 === board.total };
    }

    // Commit any open run when game ends mid-capture
    if (s.over && s.runScore > 0) {
      const com = [...s.committed];
      com[s.player] += s.runScore;
      s = { ...s, committed: com, runScore: 0 };
    }

    app.game      = s;
    app.aiRunning = false;
    renderGame();
  }, 600);
}

// ─── Board event delegation ───────────────────────────────────────────────
function attachBoardEvents() {
  // Clean up previous listeners via AbortController
  if (app.boardCtrl) app.boardCtrl.abort();
  app.boardCtrl = new AbortController();
  const { signal } = app.boardCtrl;

  const boardEl = document.getElementById('board-container');
  if (!boardEl) return;

  boardEl.addEventListener('click',      onBoardClick,     { signal });
  boardEl.addEventListener('mousemove',  onBoardMousemove, { signal });
  boardEl.addEventListener('mouseleave', onBoardLeave,     { signal });
}

function onBoardClick(e) {
  const g = e.target.closest('[data-t]');
  if (!g) return;
  handleEdge(g.dataset.t, parseInt(g.dataset.r, 10), parseInt(g.dataset.c, 10));
}

function onBoardMousemove(e) {
  const g      = e.target.closest('.edge-available[data-t]');
  const newKey = g ? `${g.dataset.t}|${g.dataset.r}|${g.dataset.c}` : null;
  if (newKey === app.hovKey) return; // nothing changed

  app.hovKey = newKey;
  app.hov    = g ? { t: g.dataset.t, r: parseInt(g.dataset.r, 10), c: parseInt(g.dataset.c, 10) } : null;
  updateBoardOnly();
}

function onBoardLeave() {
  if (app.hovKey !== null) {
    app.hov    = null;
    app.hovKey = null;
    updateBoardOnly();
  }
}

// ─── Partial update: board SVG only ───────────────────────────────────────
/** Rebuilds only the SVG inside board-container (fast, used on hover). */
function updateBoardOnly() {
  const boardEl = document.getElementById('board-container');
  if (!boardEl) return;

  const { game, aiRunning, hov } = app;
  const th        = getTheme();
  const canDraw   = !game.over && !aiRunning && !(isCPUMode() && game.player === 1);
  const hovColor  = game.player === 0 ? th.p1 : th.p2;
  const bonusDef  = getBonusDef();

  boardEl.innerHTML = buildBoardSVG(game, bonusDef, th, app.dark, hov, canDraw, hovColor);
  // NOTE: board-container event listeners survive innerHTML replacement because
  // they are attached to the container element itself, not its children.
}

// ─── Full render: game screen ─────────────────────────────────────────────
function renderGame() {
  const th       = getTheme();
  const { game, aiRunning, hov } = app;
  const { player, over, runScore } = game;
  const fs       = finalScores();
  const wi       = over ? (fs[0] > fs[1] ? 0 : fs[1] > fs[0] ? 1 : -1) : null;
  const canDraw  = !over && !aiRunning && !(isCPUMode() && player === 1);
  const hovColor = player === 0 ? th.p1 : th.p2;
  const isSolo   = app.mode === 'SOLO';
  const bonusDef = getBonusDef();
  const claimed  = game.captured.flat().filter(x => x !== null).length;

  // Render both score blocks
  const scoreBlock = (i) => {
    const active  = player === i && !over;
    const liveRun = i === player && runScore > 0 && !over;
    return `
      <div class="score-block player-${i} ${active ? 'active' : ''}">
        <div class="score-label">
          ${i === 0 && active ? '◀ ' : ''}${pLabel(i)}${i === 1 && active ? ' ▶' : ''}
        </div>
        <div class="score-value c-p${i + 1}">${fs[i]}</div>
        ${liveRun
          ? `<div class="run-badge">RUN ${runScore}</div>`
          : '<div class="run-spacer"></div>'}
        <div class="score-underline ${active ? `c-p${i + 1}-bg` : ''}"></div>
      </div>`;
  };

  document.getElementById('app').innerHTML = `
    <div class="game-screen">
      <button class="theme-toggle" id="theme-toggle">
        ${app.dark ? '☀ LIGHT' : '☾ DARK'}
      </button>

      <h1 class="game-title small">GRID</h1>

      <div class="scoreboard" id="scoreboard">
        ${scoreBlock(0)}
        <div class="score-vs">vs</div>
        ${scoreBlock(1)}
      </div>

      ${isSolo && !over
        ? '<p class="puzzle-hint">FIND THE OPTIMAL SEQUENCE · ORDER MATTERS</p>'
        : ''}

      <div class="board-container" id="board-container">
        ${buildBoardSVG(game, bonusDef, th, app.dark, hov, canDraw, hovColor)}
      </div>

      <div class="status-bar">
        <div class="${aiRunning ? 'ai-thinking' : ''}">
          ${aiRunning ? 'CPU THINKING...' : `${claimed} / ${board.total} BOXES CLAIMED`}
        </div>
        <div class="legend-bar">
          <span class="c-f1">●</span> FLAT &nbsp;
          <span class="c-m2">◆</span> MULTIPLIER &nbsp;
          <span class="c-bk">╳</span> BLOCKED
        </div>
      </div>

      <button class="back-btn" id="back-btn">← MENU</button>

      ${over ? buildGameOverOverlay(wi, fs, isSolo) : ''}
    </div>
  `;

  // Wire up static buttons
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
  document.getElementById('back-btn').addEventListener('click', goToMenu);

  if (over) {
    document.getElementById('play-again')?.addEventListener('click', () => startGame(app.mode));
    document.getElementById('go-menu')?.addEventListener('click', goToMenu);
    document.getElementById('share-result')?.addEventListener('click', onShareClick);
  }

  // Wire up board interaction (replaces any stale AbortController)
  attachBoardEvents();
}

function buildShareText(wi, fs) {
  const title = app.game.title ?? app.game.id ?? 'Puzzle';
  let resultLine;
  if (wi === 0)      resultLine = `YOU WIN  ${fs[0]}–${fs[1]}  ⭐`;
  else if (wi === 1) resultLine = `CPU WINS  ${fs[1]}–${fs[0]}`;
  else               resultLine = `TIE GAME  ${fs[0]}–${fs[1]}`;

  const grid = app.game.captured
    .map(row => row.map(cell => cell === null ? '⬛' : cell === 0 ? '🟦' : '🟥').join(''))
    .join('\n');

  return `GRID · ${title}\n${resultLine}\n\n${grid}`;
}

function onShareClick() {
  const btn = document.getElementById('share-result');
  if (!btn) return;
  const fs = finalScores();
  const wi = fs[0] > fs[1] ? 0 : fs[1] > fs[0] ? 1 : -1;
  const text = buildShareText(wi, fs);
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = 'COPIED!';
    setTimeout(() => { btn.textContent = 'SHARE'; }, 2000);
  }).catch(() => {
    btn.textContent = 'COPY FAILED';
    setTimeout(() => { btn.textContent = 'SHARE'; }, 2000);
  });
}

function buildGameOverOverlay(wi, fs, isSolo) {
  const wc = winClass(wi);
  return `
    <div class="game-over-overlay">
      <div class="game-over-content">
        <h2 class="win-title c-${wc}">${winLabel(wi)}</h2>
        <p class="win-subtitle">FINAL SCORES</p>
        <div class="final-scores">
          <div class="final-score">
            <div class="final-label c-p1">${pLabel(0)}</div>
            <div class="final-value c-p1">${fs[0]}</div>
          </div>
          <div class="final-score">
            <div class="final-label c-p2">${pLabel(1)}</div>
            <div class="final-value c-p2">${fs[1]}</div>
          </div>
        </div>
        ${isSolo
          ? `<p class="puzzle-result c-${wi === 0 ? 'f3' : 'm3'}">
               ${wi === 0 ? 'OPTIMAL PLAY FOUND!' : 'TRY SAVING THE ×3 FOR LAST'}
             </p>
             <button class="btn-share" id="share-result">SHARE</button>`
          : ''}
        <div class="game-over-buttons">
          <button class="btn-primary" id="play-again">PLAY AGAIN</button>
          <button class="btn-secondary" id="go-menu">MENU</button>
        </div>
      </div>
    </div>`;
}

// ─── Menu demo mini-board ─────────────────────────────────────────────────
/** Compact 160×160 SVG (3×3 dots, 2×2 boxes) showing one of 4 demo steps. */
function buildDemoSVG(step, th) {
  const P = 24, D = 56, W = P * 2 + D * 2; // 160
  const x = c => P + c * D;
  const y = r => P + r * D;
  const seg = (x1, y1, x2, y2, stroke, sw, extra = '') =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" ${extra}/>`;

  let out = `<svg viewBox="0 0 ${W} ${W}" width="${W}" height="${W}" xmlns="http://www.w3.org/2000/svg">`;

  // All possible edges as faint dashes (shows the grid structure)
  const dashAttr = `stroke-dasharray="4,6" opacity="0.45"`;
  for (let r = 0; r <= 2; r++)
    for (let c = 0; c <= 1; c++)
      out += seg(x(c), y(r), x(c + 1), y(r), th.dash, 2, dashAttr);
  for (let r = 0; r <= 1; r++)
    for (let c = 0; c <= 2; c++)
      out += seg(x(c), y(r), x(c), y(r + 1), th.dash, 2, dashAttr);

  // Box fill when captured (step 2+)
  if (step >= 2)
    out += `<rect x="${x(0) + 1}" y="${y(0) + 1}" width="${D - 2}" height="${D - 2}" fill="${th.p1Fill}" rx="2"/>`;

  // Drawn edges for box (0,0)
  if (step >= 1) {
    out += seg(x(0), y(0), x(1), y(0), th.p1, 3);  // top
    out += seg(x(0), y(0), x(0), y(1), th.p1, 3);  // left
    out += seg(x(1), y(0), x(1), y(1), th.p1, 3);  // right
    // Bottom: dashed hint in step 1, solid in step 2+
    const botExtra = step === 1 ? 'stroke-dasharray="7,5" opacity="0.55"' : '';
    out += seg(x(0), y(1), x(1), y(1), th.p1, 3, botExtra);
  }

  // Bonus icons on neighbouring boxes (step 3)
  if (step >= 3) {
    const bx1 = x(1) + D / 2, by1 = y(0) + D / 2; // ● +2 on box(0,1)
    out += `<circle cx="${bx1}" cy="${by1}" r="13" fill="${th.f2bg}" stroke="${th.f2}" stroke-width="0.9"/>`;
    out += `<text x="${bx1}" y="${by1}" text-anchor="middle" dominant-baseline="central" font-size="10" fill="${th.f2}" font-family="'Share Tech Mono',monospace" font-weight="bold">+2</text>`;
    const bx2 = x(0) + D / 2, by2 = y(1) + D / 2, sz = 13; // ◆ ×2 on box(1,0)
    out += `<rect x="${bx2 - sz}" y="${by2 - sz}" width="${sz * 2}" height="${sz * 2}" transform="rotate(45 ${bx2} ${by2})" fill="${th.m2bg}" stroke="${th.m2}" stroke-width="0.9" rx="2"/>`;
    out += `<text x="${bx2}" y="${by2}" text-anchor="middle" dominant-baseline="central" font-size="10" fill="${th.m2}" font-family="'Share Tech Mono',monospace" font-weight="bold">×2</text>`;
  }

  // Dots drawn last so they sit on top of edges
  for (let r = 0; r <= 2; r++)
    for (let c = 0; c <= 2; c++)
      out += `<circle cx="${x(c)}" cy="${y(r)}" r="4" fill="${th.dotFill}" stroke="${th.dotStroke}" stroke-width="1.5"/>`;

  return out + '</svg>';
}

// ─── Full render: menu screen ─────────────────────────────────────────────
function renderMenu() {
  document.getElementById('app').innerHTML = `
    <div class="menu">
      <button class="theme-toggle" id="theme-toggle">
        ${app.dark ? '☀ LIGHT' : '☾ DARK'}
      </button>

      <h1 class="game-title">GRIDDLE</h1>
      <h2 class="game-subtitle">The perfect puzzle to go along with eggs and bacon.</h2>

      <div class="demo-wrap">
        <div class="demo-board">${buildDemoSVG(app.demoStep, getTheme())}</div>
        <p class="demo-caption">${[
          'CONNECT THE DOTS · DRAW LINES BETWEEN ADJACENT DOTS',
          'CLOSE A BOX · DRAW THE FOURTH SIDE TO CAPTURE IT',
          'SCORE POINTS · KEEP CAPTURING TO BUILD YOUR RUN',
          'BONUS SQUARES · ● ADDS POINTS · ◆ MULTIPLIES YOUR RUN',
        ][app.demoStep]}</p>
        <div class="demo-nav">
          <button class="demo-btn" id="demo-prev"${app.demoStep === 0 ? ' disabled' : ''}>&#8249;</button>
          <span class="demo-dots">${[0,1,2,3].map(i =>
            `<span class="demo-dot${i === app.demoStep ? ' active' : ''}"></span>`
          ).join('')}</span>
          <button class="demo-btn" id="demo-next"${app.demoStep === 3 ? ' disabled' : ''}>&#8250;</button>
        </div>
      </div>

      <div class="menu-buttons">
        <button class="menu-btn menu-btn--puzzle" data-mode="SOLO">PUZZLE MODE · BEAT THE CPU</button>
        <div class="menu-btn-row">
          <button class="menu-btn" data-mode="2P">TWO PLAYERS</button>
          <button class="menu-btn" data-mode="AI">VS COMPUTER</button>
        </div>
      </div>

      <button class="how-to-link" id="how-to-play">HOW TO PLAY &#8250;</button>
    </div>
  `;

  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
  document.querySelectorAll('.menu-btn').forEach(btn =>
    btn.addEventListener('click', () => startGame(btn.dataset.mode))
  );
  document.getElementById('demo-prev').addEventListener('click', () => {
    app.demoStep = Math.max(0, app.demoStep - 1);
    renderMenu();
  });
  document.getElementById('demo-next').addEventListener('click', () => {
    app.demoStep = Math.min(3, app.demoStep + 1);
    renderMenu();
  });
  document.getElementById('how-to-play').addEventListener('click', () => {
    app.mode = 'HTP';
    renderHowToPlay();
  });
}

// ─── Full render: how to play screen ─────────────────────────────────────
function renderHowToPlay() {
  const thBtn = app.dark ? '&#9728; LIGHT' : '&#9790; DARK';
  document.getElementById('app').innerHTML = `
    <div class="htp-screen">
      <button class="theme-toggle" id="theme-toggle">${thBtn}</button>

      <h1 class="game-title small">HOW TO PLAY</h1>
      <button class="back-btn" id="back-btn-top">&#8592; BACK</button>

      <div class="htp-section">
        <h3 class="htp-heading">THE BASICS</h3>
        <div class="htp-rule">Dots form a grid. Click the gap between two adjacent dots to draw a line.</div>
        <div class="htp-rule">Surround all four sides of a box to capture it and score points.</div>
        <div class="htp-rule">The player with the most points when all boxes are claimed wins.</div>
      </div>

      <div class="htp-section">
        <h3 class="htp-heading">RUNS &amp; SCORING</h3>
        <div class="htp-rule">Each captured box earns at least 1 point.</div>
        <div class="htp-rule">Keep capturing boxes on the same turn to build a RUN — your score accumulates.</div>
        <div class="htp-rule">When you draw a line that does not close any box, your turn ends and your run commits to your total.</div>
      </div>

      <div class="htp-section">
        <h3 class="htp-heading">BONUS SQUARES</h3>
        <div class="htp-rule"><span class="c-f1">&#9679;</span> FLAT BONUS — adds extra points when captured: run = run + 1 + n</div>
        <div class="htp-rule"><span class="c-m2">&#9670;</span> MULTIPLIER — amplifies your entire run: run = (run + 1) &times; n</div>
        <div class="htp-rule c-text-sub">PRO TIP: capture flat bonuses before multipliers — the multiplier amplifies everything that came before it.</div>
      </div>

      <div class="htp-section">
        <h3 class="htp-heading">BLOCKED NODES</h3>
        <div class="htp-rule"><span class="c-bk">&#10007;</span> Some dots are blocked and create permanent walls on all adjacent edges.</div>
        <div class="htp-rule">Blocked nodes split the board and change which boxes can be captured.</div>
      </div>

      <div class="htp-section">
        <h3 class="htp-heading">GAME MODES</h3>
        <div class="htp-rule">TWO PLAYERS — take turns on the same device.</div>
        <div class="htp-rule">VS COMPUTER — play against a greedy AI that always captures when it can.</div>
        <div class="htp-rule">PUZZLE MODE — claim the remaining boxes in the right order to outscore the CPU. Order matters!</div>
      </div>

      <button class="back-btn" id="back-btn-bottom">&#8592; BACK</button>
    </div>
  `;

  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
  document.getElementById('back-btn-top').addEventListener('click', goToMenu);
  document.getElementById('back-btn-bottom').addEventListener('click', goToMenu);
}

// ─── Global actions ───────────────────────────────────────────────────────
function toggleTheme() {
  app.dark = !app.dark;
  document.documentElement.dataset.theme = app.dark ? 'dark' : 'light';
  if (app.mode === 'HTP')        renderHowToPlay();
  else if (app.mode && app.game) renderGame();
  else                           renderMenu();
}

function goToMenu() {
  if (app.boardCtrl) app.boardCtrl.abort();
  app.mode = null; app.game = null; app.aiRunning = false;
  app.hov  = null; app.hovKey = null; app.demoStep = 0;
  renderMenu();
}

// ─── Bootstrap ────────────────────────────────────────────────────────────
async function init() {
  try {
    app.globalBoard = await fetch('/api/board').then(r => r.json());
    applyBoardConfig(app.globalBoard);
  } catch {
    // server not running or board.json missing — keep config.js defaults
    app.globalBoard = {
      rows: board.rows, cols: board.cols,
      blocked: board.blocked, bonusDef: board.bonusDef,
    };
  }
  renderMenu();
}

document.addEventListener('DOMContentLoaded', init);
