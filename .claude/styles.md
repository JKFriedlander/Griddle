## Visual design system

### Fonts

- **Orbitron 900** — headings, title, win screen, score values
- **Share Tech Mono** — all labels, data, UI text, monospace formulas

Both loaded from Google Fonts in `index.html`.

### Theming

All HTML/CSS colours use **CSS custom properties** defined per `data-theme` on `<html>`:

```css
[data-theme="dark"]  { --p1: #00d4f0; --p2: #ff5828; … }
[data-theme="light"] { --p1: #0055cc; --p2: #cc3300; … }
```

Toggle with `document.documentElement.dataset.theme = 'dark' | 'light'`.

SVG element attributes (`stroke`, `fill`) **cannot use CSS custom properties directly** when set as HTML attributes. Therefore `renderer.js` reads colour values from the JS `THEMES` object in `config.js`, not from CSS. **Never try to put `var(--p1)` in an SVG attribute string.**

### Colour roles

| Token | Dark | Light | Used for |
|-------|------|-------|----------|
| `p1` | `#00d4f0` | `#0055cc` | Player 0 / YOU |
| `p2` | `#ff5828` | `#cc3300` | Player 1 / CPU |
| `f1/f2/f3` | blue spectrum | blue spectrum | Flat bonus icons |
| `m2/m3` | gold/red | gold/red | Multiplier icons |
| `pre` | `#304e62` | `#b8a898` | Pre-drawn puzzle edges |
| `wall` | `#253e50` | `#9a9080` | Wall edges |
| `bkX` | `#2d5068` | `#7a7262` | Blocked dot X marks |

### SVG line visual states (in priority order)

1. `'wall'` — muted, shorter inset, no glow
2. `'pre'` — neutral grey, solid, no glow (puzzle history)
3. `lastMove` — player colour, thicker, **strong glow + CSS `lastPulse` animation**
4. player-drawn (`0`/`1`) — player colour, thick, standard glow filter
5. hover — player colour at 35% opacity (ghost preview)
6. `null` / available — very faint dashed line ("missing line" indicator)

The **last-move glow** uses SVG filters `#gl1`/`#gl2` (much larger blur than normal `#gp1`/`#gp2`) plus the CSS class `last-move` which triggers a `lastPulse` keyframe animation defined in `styles.css`.

---


## Themes

SVG attributes can't use CSS custom properties, so theme colors live in `THEMES` in `config.js` (not in `styles.css`). `dark`/`light` toggle is stored in `app.dark` and `document.documentElement.dataset.theme`.

**When writing or editing styles:**

- Always use CSS custom properties (`var(--token)`) — never hardcode color values (hex, rgb, rgba, hsl) directly in rules.
- If a needed color isn't covered by an existing token, add it to both `[data-theme="dark"]` and `[data-theme="light"]` in `styles.css` before using it.
- After any style change, scan the full `.css` file being edited for remaining hardcoded color values and replace them with the appropriate variables.
- Styles should never exist in an `.html` file.  They should always live in a `.css` file within the `css/` directory.

## SVG renderer (renderer.js)

`buildBoardSVG(game, bonusDef, th, dark, hov, canDraw, hovColor)` returns a complete SVG string. It has **no DOM side effects** — purely a string builder.

### Rendering layers (in SVG paint order)

1. `<defs>` — glow filters (`gp1`, `gp2` normal; `gl1`, `gl2` last-move)
2. Background grid lines
3. Captured box fills (`<rect>` with player fill colour)
4. Bonus icons (circles for flat, rotated squares for multipliers)
5. Horizontal edges (rows 0 → ROWS, cols 0 → COLS-1)
6. Vertical edges (rows 0 → ROWS-1, cols 0 → COLS)
7. Dots — **always last** so they appear on top of edges

### Hit areas

Each available edge `<g>` contains a transparent `<rect>` sized to `HIT = 28` px wide. This catches clicks in the whitespace between dots. The `<g>` carries `data-t`, `data-r`, `data-c` attributes for event delegation.

```html
<!-- Example generated markup for an available horizontal edge -->
<g data-t="h" data-r="2" data-c="1" class="edge-available" style="cursor:pointer">
  <rect x="118" y="132" width="72" height="28" fill="transparent"/>
  <line x1="120" y1="146" x2="188" y2="146" stroke="rgba(28,60,90,0.9)"
        stroke-width="1.5" stroke-dasharray="2 7" stroke-linecap="round"/>
</g>
```

## CSS conventions

- **All colours** go through CSS custom properties (`--p1`, `--p2`, etc.)
- **No `!important`** anywhere
- **No inline `style=` for colours** on HTML elements — use utility classes like `.c-p1`, `.c-p2`, `.c-gold` defined in `styles.css`
- **Inline `style=`** is fine for layout values (widths, gaps, margins) that are computed in JS
- The `last-move` CSS class on an SVG `<line>` triggers the `lastPulse` keyframe animation. This works because the SVG is inline in the DOM and CSS animations apply to inline SVG elements.