## Visual design system

### Fonts

- **Orbitron 900** — headings, title, win screen, score values
- **Share Tech Mono** — all labels, data, UI text, monospace formulas

Both loaded from Google Fonts in `index.html`.

---

## Theming

Two themes: `dark` (default) and `light`. The current theme is stored in `app.dark` and applied as `document.documentElement.dataset.theme = 'dark' | 'light'`.

Theme colours are defined in **two separate places** for two different purposes:

1. **CSS custom properties** in `styles.css` — used by all HTML/CSS rules via `var(--token)`.
2. **`THEMES` object** in `config.js` — used by `renderer.js` to colour SVG attributes, because SVG presentation attributes cannot reference CSS custom properties.

**Never put `var(--token)` in an SVG attribute string.** Always read from the `THEMES` object.

---

## CSS design tokens (`styles.css`)

Defined under `[data-theme="dark"]` and `[data-theme="light"]`. All CSS rules must use these tokens — never hardcode colour values.

### Surface & layout

| Token | Dark | Light | Used for |
|-------|------|-------|----------|
| `--bg` | `#080d1a` | `#f5f0e6` | Page background |
| `--surface` | `#111d30` | `#e4ddd0` | Cards, score panel, menu legend |
| `--border` | `#2a4968` | `#8a8272` | Borders, dividers |

### Text

| Token | Dark | Light | Used for |
|-------|------|-------|----------|
| `--text` | `#cce0ec` | `#252c38` | Primary text |
| `--text-sub` | `#6aaec8` | `#7a7460` | Secondary / muted text |
| `--text-dim` | `#3d6880` | `#c8c0b0` | Dimmed text (footer) |

### Player colours

| Token | Dark | Light | Used for |
|-------|------|-------|----------|
| `--p1` | `#00d4f0` | `#0055cc` | Player 0 / YOU |
| `--p2` | `#ff5828` | `#cc3300` | Player 1 / CPU |

### Bonus colours

| Token | Dark | Light | Used for |
|-------|------|-------|----------|
| `--f1` | `#5599ff` | `#2244cc` | Flat bonus icon (low) |
| `--f3` | `#00cc88` | `#006633` | Flat bonus icon (high) |
| `--m2` | `#f0a010` | `#996200` | Multiplier ×2 / gold |
| `--m3` | `#f04030` | `#cc1400` | Multiplier ×3 / red |
| `--bk-x` | `#4d7fa0` | `#7a7262` | Blocked dot X mark |

### Run badge

| Token | Dark | Light | Used for |
|-------|------|-------|----------|
| `--run-color` | `#ffd700` | `#cc8800` | Run badge text |
| `--run-bg` | `rgba(255,215,0,0.18)` | `rgba(160,120,0,0.12)` | Run badge background |
| `--run-border` | `rgba(255,215,0,0.25)` | `rgba(160,120,0,0.25)` | Run badge border |

### Overlays & interactive states

| Token | Dark | Light | Used for |
|-------|------|-------|----------|
| `--overlay-bg` | `rgba(8,13,26,0.96)` | `rgba(245,240,230,0.94)` | Game-over overlay |
| `--hover-bg` | `rgba(0,212,240,0.10)` | `rgba(0,80,200,0.05)` | Menu button hover fill |
| `--score-line` | `#2a4968` | `#c8c0b0` | Score underline |
| `--p1-subtle` | `rgba(0,212,240,0.12)` | `rgba(0,80,200,0.08)` | Primary button fill |
| `--p1-subtle-hover` | `rgba(0,212,240,0.20)` | `rgba(0,80,200,0.14)` | Primary button hover |

### Shadows & glows (dark theme only; transparent in light)

| Token | Dark | Used for |
|-------|------|----------|
| `--p1-shadow` | `rgba(0,212,240,0.45)` | Title text-shadow |
| `--p2-shadow` | `rgba(255,88,40,0.45)` | Win screen text-shadow |
| `--gold-shadow` | `rgba(240,160,16,0.45)` | Tie text-shadow |
| `--p1-glow` | `rgba(0,212,240,0.20)` | Primary button box-shadow |
| `--p1-drop` | `rgba(0,212,240,0.50)` | Active score drop-shadow |
| `--p2-drop` | `rgba(255,88,40,0.50)` | Active score drop-shadow |

---

## SVG renderer tokens (`THEMES` object in `config.js`)

Used exclusively by `renderer.js` to set SVG attribute values. Not used in CSS.

| Token | Dark | Light | Used for |
|-------|------|-------|----------|
| `p1` | `#00d4f0` | `#0055cc` | Player 0 edges / fills |
| `p2` | `#ff5828` | `#cc3300` | Player 1 edges / fills |
| `p1Fill` | `rgba(0,212,240,0.22)` | `rgba(0,80,200,0.10)` | Captured box fill (P0) |
| `p2Fill` | `rgba(255,88,40,0.20)` | `rgba(204,51,0,0.10)` | Captured box fill (P1) |
| `pre` | `#4a7090` | `#b8a898` | Pre-drawn puzzle edges |
| `wall` | `#3a5e7a` | `#9a9080` | Wall edges |
| `dash` | `rgba(58,104,148,0.85)` | `rgba(160,148,132,0.7)` | Available edge dashes |
| `gridLine` | `#1e3550` | `#c8c0b0` | Background grid |
| `dotFill` | `#080d1a` | `#f5f0e6` | Dot fill |
| `dotStroke` | `#3a6888` | `#8a8272` | Dot stroke |
| `bkFill` | `#0e1826` | `#ece6da` | Blocked dot background |
| `bkStroke` | `#2a4968` | `#a09882` | Blocked dot ring |
| `bkX` | `#5080a8` | `#7a7262` | Blocked dot X |
| `f1/f2/f3` | blue spectrum | blue spectrum | Flat bonus icon colours |
| `f1bg/f2bg/f3bg` | — | — | Flat bonus icon backgrounds |
| `m2/m3` | gold/red | gold/red | Multiplier icon colours |
| `m2bg/m3bg` | — | — | Multiplier icon backgrounds |
| `glowR` | `4` | `1.5` | Normal glow blur radius |
| `lastGlowR` | `10` | `3` | Last-move glow blur radius |

---

## Utility CSS classes

Applied via JS `innerHTML` strings. Do not add inline `style=` for colours — use these classes.

| Class | Value | Used for |
|-------|-------|----------|
| `.c-p1` | `var(--p1)` | Player 0 text colour |
| `.c-p2` | `var(--p2)` | Player 1 text colour |
| `.c-gold` | `var(--m2)` | Gold / tie colour |
| `.c-f1` | `var(--f1)` | Flat bonus accent |
| `.c-m2` | `var(--m2)` | Multiplier ×2 accent |
| `.c-m3` | `var(--m3)` | Multiplier ×3 accent |
| `.c-f3` | `var(--f3)` | High flat bonus accent |
| `.c-bk` | `var(--bk-x)` | Blocked dot accent |
| `.c-text-sub` | `var(--text-sub)` | Muted text |
| `.c-p1-bg` | `var(--p1)` background | Active score underline (P0) |
| `.c-p2-bg` | `var(--p2)` background | Active score underline (P1) |

---

## Menu demo + How To Play screens

New classes added for the tutorial feature. All use existing tokens.

| Class | Purpose |
|-------|---------|
| `.demo-wrap` | Container for the menu mini-board demo |
| `.demo-board` | Holds the 160×160 demo SVG |
| `.demo-caption` | Step description text; `min-height` keeps layout stable across steps |
| `.demo-nav` | Row with PREV/NEXT buttons and step-indicator dots |
| `.demo-btn` | PREV/NEXT buttons; `:disabled` → 28% opacity |
| `.demo-dots` | Row of step-indicator dots |
| `.demo-dot` | Individual dot; `.active` uses `--p1` fill |
| `.how-to-link` | Borderless text button linking to the How To Play screen |
| `.htp-screen` | Flex column wrapper for the How To Play layout |
| `.htp-section` | Surface card per rules section (same look as the old `.menu-legend`) |
| `.htp-heading` | Bold section label inside `.htp-section` |
| `.htp-rule` | Individual rule line; reuses `.c-f1`, `.c-m2`, `.c-bk` for symbols |

---

## CSS conventions

- **All colours** go through CSS custom properties (`var(--token)`) — never hardcode hex/rgb/hsl values directly in rules.
- If a needed colour isn't covered by an existing token, add it to both `[data-theme="dark"]` and `[data-theme="light"]` in `styles.css` before using it.
- After any style change, scan the full `.css` file for remaining hardcoded colour values and replace them.
- **No `!important`** anywhere.
- **No inline `style=` for colours** on HTML elements — use the utility classes above.
- **Inline `style=`** is fine for layout values (widths, gaps, margins) computed in JS.
- Styles must never exist in `.html` files — always in a `.css` file inside `css/`.
- The `last-move` CSS class on an SVG `<line>` triggers the `lastPulse` keyframe animation. This works because the SVG is inline in the DOM.
