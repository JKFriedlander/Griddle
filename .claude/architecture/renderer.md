## SVG renderer (`renderer.js`)

`buildBoardSVG(game, bonusDef, th, dark, hov, canDraw, hovColor)` returns a complete SVG string. It has **no DOM side effects** — purely a string builder. Called by `main.js` and injected via `innerHTML`.

### Rendering layers (SVG paint order)

1. `<defs>` — glow filters (`gp1`, `gp2` normal; `gl1`, `gl2` last-move). Filters use `filterUnits="userSpaceOnUse"` with absolute SVG-canvas coordinates. Percentage-based `objectBoundingBox` units cannot be used for `<line>` elements because their geometric bounding box has zero height/width, which collapses the filter region and makes lines invisible on mobile browsers.
2. Background grid lines
3. Captured box fills (`<rect>` with player fill colour)
4. Bonus icons (circles for flat bonuses, rotated squares for multipliers)
5. Horizontal edges (rows 0 → ROWS, cols 0 → COLS-1)
6. Vertical edges (rows 0 → ROWS-1, cols 0 → COLS)
7. Dots — **always last** so they render on top of edges

### SVG line visual states (priority order)

1. `'wall'` — muted, shorter inset, no glow
2. `'pre'` — neutral grey, solid, no glow (puzzle history)
3. `lastMove` — player colour, thicker, **strong glow + CSS `lastPulse` animation**
4. player-drawn (`0`/`1`) — player colour, thick, standard glow filter
5. hover — player colour at 35% opacity (ghost preview)
6. `null` / available — very faint dashed line ("missing line" indicator)

The **last-move glow** uses SVG filters `#gl1`/`#gl2` (much larger blur than normal `#gp1`/`#gp2`) plus the CSS class `last-move` which triggers the `lastPulse` keyframe animation in `styles.css`.

### Hit areas

Each available edge `<g>` contains a transparent `<rect>` sized to `HIT = 28` px wide. This catches clicks in the whitespace between dots. The `<g>` carries `data-t`, `data-r`, `data-c` attributes for event delegation.

```html
<!-- Example: available horizontal edge -->
<g data-t="h" data-r="2" data-c="1" class="edge-available" style="cursor:pointer">
  <rect x="118" y="132" width="72" height="28" fill="transparent"/>
  <line x1="120" y1="146" x2="188" y2="146" stroke="rgba(28,60,90,0.9)"
        stroke-width="1.5" stroke-dasharray="2 7" stroke-linecap="round"/>
</g>
```

Event listeners are **never** attached to individual SVG child elements — always delegate from `#board-container`.
