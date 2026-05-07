## Puzzle Analyzer tool

Located at `puzzle-analyzer.jsx` (React). Standalone from the main game.

Key functions:
- `perms(arr)` — all permutations of an array
- `applyBonus(run, bonus)` — returns `{ after, expr, type }` for one capture
- `computeRun(order)` — full detailed run trace for a box ordering
- `analyzeAll(puzzle)` — all permutations sorted by run score, with outcome (WIN/TIE/LOSE)
- `buildExplanation(puzzle, analysis)` — generates algorithmic GTO explanation blocks
- `generateRandom()` — creates a random puzzle guaranteed to have distinct optimal/worst scores
- `TheoryPanel` component — calls the Anthropic streaming API for a Claude-generated lesson

The analyzer does **not** show the actual D&B grid board. It works at the abstract level of "free box A has bonus ×3" without placing those boxes on a visual grid. A future feature would be a split-panel view: live game board on the left, GTO walkthrough on the right.

