### AI loop (runCPU)

After a human move that passes the turn to player 1, `runCPU()` is called. It:
1. Sets `app.aiRunning = true`
2. Schedules a 600 ms `setTimeout`
3. Runs the greedy AI in a `while` loop until the turn passes back or game ends
4. Commits any open run if the game ends mid-capture
5. Calls `renderGame()` and clears `app.aiRunning`

**Never call `renderGame()` synchronously inside the AI loop** — it would rebuild the DOM while the loop is running. Always let the `setTimeout` callback complete, then render.

---

## AI strategy (game.js — `aiMove`)

Three-tier greedy strategy:

1. **Complete a box** — scan all available edges; return the first one that completes ≥ 1 box.
2. **Safe move** — return a random edge from those that don't give the opponent any 3-sided box.
3. **Random fallback** — any available edge.

The AI does **not** account for run-score optimisation (it doesn't try to maximise its own run via GTO ordering). Improving this is a known limitation.

---