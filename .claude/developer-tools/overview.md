## Developer tools (`developer/`)

Standalone React tools using CDN React + `@babel/standalone` — no build step. Requires `server.py` running at `http://localhost:8080`.

### Landing page (`developer/index.html`)

Navigation hub at `http://localhost:8080/developer/`. Links to Puzzle Walkthrough and Puzzle Analyzer. Does **not** link to Puzzle Manager — navigate to that directly.

### Puzzle Analyzer (`developer/puzzle-analyzer.html`)

Enumerates all orderings of a puzzle's free boxes, computes game-theory optimal play, and explains the mathematics behind the GTO solution.

Key functions in `puzzle-analyzer.jsx`:
- `perms(arr)` — all permutations of an array
- `applyBonus(run, bonus)` — returns `{ after, expr, type }` for one capture
- `computeRun(order)` — full detailed run trace for a box ordering
- `analyzeAll(puzzle)` — all permutations sorted by run score, with outcome (WIN/TIE/LOSE)
- `buildExplanation(puzzle, analysis)` — generates algorithmic GTO explanation blocks
- `generateRandom()` — creates a random puzzle guaranteed to have distinct optimal/worst scores
- `TheoryPanel` component — calls the Anthropic streaming API for a Claude-generated lesson

The analyzer works at the abstract level of "free box A has bonus ×3" — it does not show the D&B grid visually.

### Puzzle Manager (`developer/puzzle-manager.html`)

UI for creating and switching the active puzzle. Reads/writes via the server API:
- List all puzzles and set the active one
- Create new puzzle JSON files without editing by hand

Not linked from the landing page — open directly at `http://localhost:8080/developer/puzzle-manager.html`.

### Puzzle Walkthrough (`developer/puzzle-walkthrough.html`)

Step-by-step explanation of how the GTO solution works for the active puzzle.
