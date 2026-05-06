# GRID — Dots & Boxes Reimagined

A strategic puzzle game built with vanilla HTML, CSS, and JavaScript (ES modules).

## Features

- **Three modes** — Two Players, VS Computer, Puzzle Mode
- **Dark / Light theme** — toggle in the top-right corner
- **Run-based scoring** — score builds during your turn; multipliers compound
- **Bonus squares** — flat bonuses (+1/+2/+3) and run multipliers (×2/×3)
- **Blocked nodes** — permanent walls that reshape the board
- **Last-move glow** — pulsing highlight shows the most recent edge drawn
- **Puzzle Mode** — a hand-crafted endgame with a game-theory optimal solution

## Scoring Rules

Each turn you draw edges until you fail to capture a box.

| Box type    | Effect on run score                   |
|-------------|---------------------------------------|
| Normal      | `run = run + 1`                       |
| Flat (+n)   | `run = run + 1 + n`  (base first)     |
| Multi (×n)  | `run = (run + 1) × n` (base first)    |

When your turn ends your run is banked.  The key insight: always apply
multipliers **last** — they multiply everything built up before them.

## Puzzle Mode

You face an endgame with four remaining boxes:

| Box   | Bonus | Status        |
|-------|-------|---------------|
| A     | ×3    | 3 sides drawn |
| B     | +2    | 3 sides drawn |
| C     | +1    | 3 sides drawn |
| D     | ×3    | 2 sides (walls) — CPU will claim this |

**The lesson:** take A (×3) *last*.

- Optimal: C → B → A gives run = 18 → YOU WIN 25–17
- Wrong:   A first      gives run = 8  → YOU LOSE 15–17

## Project Structure

```
grid-game/
├── index.html          # HTML shell (single page)
├── css/
│   └── styles.css      # All styles; CSS custom properties for theming
└── js/
    ├── config.js       # Constants, blocked dots, bonus defs, theme colours
    ├── game.js         # Pure game logic (no DOM)
    ├── puzzle.js       # Solo puzzle board builder
    ├── renderer.js     # SVG string builder (no DOM side-effects)
    └── main.js         # App state, rendering, event handling
```

## Running Locally

ES modules require a web server (browsers block `file://` module imports).

### Option A — Python (no install needed)

```bash
cd grid-game
python3 -m http.server 8080
# open http://localhost:8080
```

### Option B — Node.js / npx

```bash
cd grid-game
npx serve .
# follow the URL printed in the terminal
```

### Option C — VS Code

Install the **Live Server** extension, right-click `index.html` → *Open with Live Server*.

## Browser Support

Any modern browser (Chrome 80+, Firefox 75+, Safari 14+, Edge 80+).
Requires: ES modules, CSS custom properties, `AbortController`.
