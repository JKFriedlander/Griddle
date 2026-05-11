import { THEMES } from './config.js';
import { board, applyBoardConfig } from './boardConfig.js';
import { initGameState, applyMove, aiMove } from './game.js';
import { loadActivePuzzle } from './puzzle.js';
import { buildBoardSVG } from './renderer.js';

// ─── App state ────────────────────────────────────────────────────────────
const app = {
  dark:        true,
  mode:        null,    // '2P' | 'AI' | 'SOLO' | null
  game:        null,
  aiRunning:   false,
  hov:         null,    // { t, r, c } | null  — hovered edge
  hovKey:      null,    // string key for fast change-detection
  boardCtrl:   null,    // AbortController for board event listeners
  globalBoard: null,    // cached board.json for restoring after SOLO
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

// ─── Puzzle icon for the menu button ─────────────────────────────────────
function buildPuzzleIconSVG() {
  const th = getTheme();
  const sp = 20, pad = 8;
  const cx = c => pad + c * sp;
  const cy = r => pad + r * sp;

  const seg = (x1, y1, x2, y2, color, dash = false) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"` +
    ` stroke="${color}" stroke-width="${dash ? 1 : 2.5}" stroke-linecap="round"` +
    (dash ? ` stroke-dasharray="2.5 3" opacity="0.55"` : '') + '/>';

  const dot = (r, c) =>
    `<circle cx="${cx(c)}" cy="${cy(r)}" r="2.8"` +
    ` fill="${th.dotFill}" stroke="${th.dotStroke}" stroke-width="1.2"/>`;

  // TL box captured by player 1
  const fill = `<rect x="${cx(0) + 1}" y="${cy(0) + 1}" width="${sp - 2}" height="${sp - 2}"` +
    ` fill="${th.p1Fill}" rx="1"/>`;

  // ×2 multiplier bonus in TR box (the "prize" for solving the puzzle)
  const bx = cx(1) + sp / 2, by = cy(0) + sp / 2, bsz = 6.5;
  const bonus =
    `<rect x="${bx - bsz}" y="${by - bsz}" width="${bsz * 2}" height="${bsz * 2}"` +
    ` transform="rotate(45 ${bx} ${by})" fill="${th.m2bg}" stroke="${th.m2}" stroke-width="0.8" rx="1.5"/>` +
    `<text x="${bx}" y="${by}" text-anchor="middle" dominant-baseline="central"` +
    ` font-size="7" fill="${th.m2}" font-family="'Share Tech Mono',monospace" font-weight="bold">×2</text>`;

  // Edges: TL fully claimed; TR missing its bottom edge (the puzzle); BL partial; BR empty
  const edges = [
    seg(cx(0), cy(0), cx(1), cy(0), th.p1),          // h top-left
    seg(cx(1), cy(0), cx(2), cy(0), th.p1),          // h top-right
    seg(cx(0), cy(1), cx(1), cy(1), th.p1),          // h mid-left
    seg(cx(1), cy(1), cx(2), cy(1), th.dash, true),  // h mid-right  ← missing edge
    seg(cx(0), cy(2), cx(1), cy(2), th.dash, true),  // h bottom-left
    seg(cx(1), cy(2), cx(2), cy(2), th.dash, true),  // h bottom-right
    seg(cx(0), cy(0), cx(0), cy(1), th.p1),          // v left-top
    seg(cx(1), cy(0), cx(1), cy(1), th.p1),          // v mid-top
    seg(cx(2), cy(0), cx(2), cy(1), th.p1),          // v right-top
    seg(cx(0), cy(1), cx(0), cy(2), th.p1),          // v left-bottom
    seg(cx(1), cy(1), cx(1), cy(2), th.dash, true),  // v mid-bottom
    seg(cx(2), cy(1), cx(2), cy(2), th.dash, true),  // v right-bottom
  ].join('');

  const dots = [0, 1, 2].flatMap(r => [0, 1, 2].map(c => dot(r, c))).join('');

  return `<svg viewBox="0 0 56 56" width="44" height="44" style="flex-shrink:0">` +
    fill + bonus + edges + dots + `</svg>`;
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

      <div class="menu-legend">
        <div><span class="c-bk">╳</span> BLOCKED NODE — CREATES PERMANENT WALLS</div>
        <div>
          <span class="c-f1">●</span> FLAT BONUS (+pts)
          &nbsp;&nbsp;
          <span class="c-m2">◆</span> RUN MULTIPLIER (×pts)
        </div>
        <div class="c-text-sub">SCORE BUILDS DURING YOUR RUN · MULTIPLIERS COMPOUND</div>
      </div>

      <div class="menu-buttons">
        <button class="menu-btn menu-btn--puzzle" data-mode="SOLO">
          ${buildPuzzleIconSVG()}
          DAILY PUZZLE
        </button>
        <div class="menu-btn-row">
          <button class="menu-btn" data-mode="2P">TWO PLAYERS</button>
          <button class="menu-btn" data-mode="AI">VS COMPUTER</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
  document.querySelectorAll('.menu-btn').forEach(btn =>
    btn.addEventListener('click', () => startGame(btn.dataset.mode))
  );
}

// ─── Global actions ───────────────────────────────────────────────────────
function toggleTheme() {
  app.dark = !app.dark;
  document.documentElement.dataset.theme = app.dark ? 'dark' : 'light';
  if (app.mode && app.game) renderGame(); else renderMenu();
}

function goToMenu() {
  if (app.boardCtrl) app.boardCtrl.abort();
  app.mode = null; app.game = null; app.aiRunning = false;
  app.hov  = null; app.hovKey = null;
  renderMenu();
}

// ─── Bootstrap ────────────────────────────────────────────────────────────
async function init() {
  try {
    app.globalBoard = await fetch('puzzles/board.json').then(r => r.json());
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
