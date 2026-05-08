const DEFAULT_PUZZLE = {
  id: 'puzzle-01',
  title: 'The Classic',
  description: 'A 4-box endgame. Apply multipliers last.',
  difficulty: 'medium',
  rows: 5,
  cols: 5,
  blocked: [{ r: 0, c: 3 }, { r: 2, c: 2 }, { r: 4, c: 4 }],
  bonusDef: [
    { r: 0, c: 0, op: '*', val: 3 },
    { r: 0, c: 4, op: '+', val: 2 },
    { r: 4, c: 0, op: '+', val: 1 },
    { r: 4, c: 4, op: '*', val: 3 },
  ],
  h: [
    [null, 'pre', 'wall', 'wall', null],
    ['pre', 'pre', 'pre', 'pre', 'pre'],
    ['pre', 'wall', 'wall', 'pre', 'pre'],
    ['pre', 'pre', 'pre', 'pre', 'pre'],
    ['pre', 'pre', 'pre', 'wall', 'wall'],
    [null, 'pre', 'pre', 'pre', null],
  ],
  v: [
    ['pre', 'pre', 'pre', 'wall', 'pre', 'pre'],
    ['pre', 'pre', 'wall', 'pre', 'pre', 'pre'],
    ['pre', 'pre', 'wall', 'pre', 'pre', 'pre'],
    ['pre', 'pre', 'pre', 'pre', 'wall', 'pre'],
    ['pre', 'pre', 'pre', 'pre', 'wall', null],
  ],
  captured: [
    [null, 1, 1, 1, null],
    [1, 0, 0, 1, 1],
    [1, 1, 0, 0, 1],
    [1, 1, 0, 0, 1],
    [null, 1, 0, 1, null],
  ],
  committed: [7, 14],
  runScore: 0,
  player: 0,
  over: false,
  lastMove: null,
};

/** Fetches the currently active puzzle from the server, falling back to the
 *  built-in default if the server is unavailable. */
export async function loadActivePuzzle() {
  try {
    const { active } = await fetch('/api/config').then(r => r.json());
    return await fetch(`/puzzles/${active}.json`).then(r => r.json());
  } catch {
    return DEFAULT_PUZZLE;
  }
}
