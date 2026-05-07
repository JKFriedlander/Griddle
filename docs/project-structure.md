## Project structure

```
grid-game/
├── index.html          # Shell — loads fonts, links CSS, bootstraps JS module
├── css/
│   └── styles.css      # All styling. CSS custom properties drive dark/light theming.
└── js/
    ├── config.js       # Constants, blocked-dot positions, bonus definitions, theme colour objects
    ├── game.js         # Pure game logic — no DOM touches, fully unit-testable
    ├── puzzle.js       # Builds the Solo Puzzle pre-configured board state
    ├── renderer.js     # Builds the SVG board as an HTML string — no DOM side effects
    └── main.js         # App state object, render functions, event wiring, AI loop
```