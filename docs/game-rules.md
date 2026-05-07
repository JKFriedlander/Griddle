## Scoring System Rules

This is the most important mechanic. Read it carefully before touching any score logic.

A **run** starts at 0 when a player's turn begins. It accumulates as long as the player keeps capturing boxes. When the player draws a line that captures nothing, the run commits and the turn passes.

Every capture increments a live `runScore`; when a move captures nothing, the run commits to `committed[player]` and resets.

| Box type  | Formula                    |
|-----------|----------------------------|
| Normal    | `run = run + 1`            |
| Flat +n   | `run = run + 1 + n`        |
| Multi ×n  | `run = (run + 1) × n`      |

The base `+1` always applies before the bonus. GTO rule: apply multipliers last (ascending if multiple).

### Per-capture formula

```
Normal box:   run = run + 1
Flat +n box:  run = run + 1 + n        // base added first, then flat bonus
Mult ×n box:  run = (run + 1) × n      // base added first, then multiply entire run
```

**The base (+1 for the capture itself) is ALWAYS applied before the bonus.**

### Run commit

```js
// In applyMove — when scored === false:
ncom[player] += nr;   // bank the run
nr = 0;               // reset accumulator
```

### Displayed score

During a live run, the player's displayed total = `committed[player] + runScore`. This updates live as boxes are captured. When the turn ends, `runScore` is committed and resets to 0.

```js
// In main.js:
const finalScores = () => [
  committed[0] + (player === 0 ? runScore : 0),
  committed[1] + (player === 1 ? runScore : 0),
];
```

### Bonus squares

Bonus squares are defined in `config.js` as `BONUS_DEF` (regular game) and `SOLO_BONUS_DEF` (puzzle mode). Each entry is `{ r, c, op, val }`.

```js
BONUS_DEF = [
  { r: 0, c: 0, op: '*', val: 3 },   // ×3 top-left
  { r: 0, c: 4, op: '+', val: 2 },   // +2 top-right
  { r: 1, c: 3, op: '+', val: 1 },   // +1
  { r: 2, c: 0, op: '*', val: 2 },   // ×2
  { r: 3, c: 4, op: '+', val: 3 },   // +3
  { r: 4, c: 1, op: '*', val: 2 },   // ×2
  { r: 4, c: 3, op: '+', val: 1 },   // +1
]
```

**Flat bonuses** (`op: '+'`) render as **circle badges** (blue-green spectrum).  
**Multipliers** (`op: '*'`) render as **diamond badges** (gold-red spectrum).

Adding a new bonus: add an entry to `BONUS_DEF` in `config.js` only. `renderer.js` reads `bonusDef` passed from `main.js` and handles rendering automatically.

---