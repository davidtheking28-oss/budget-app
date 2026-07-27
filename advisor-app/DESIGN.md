---
name: Budget Advisor
description: Light-default, dark-optional mint-teal advisor console for managing client budgets
themes: [light, dark]
colors:
  bg: "#eef3f1"
  bg-2: "#f6f9f8"
  surface: "#ffffff"
  surface2: "#f2f7f5"
  accent: "#0a7a62"
  accent-2: "#066552"
  accent-ink: "#ffffff"
  accent-dim: "rgba(10, 122, 98, 0.09)"
  gold: "#7c4a06"
  text: "#0f231e"
  text-2: "#566963"
  text-3: "#5b6f69"
  border: "rgba(15, 35, 30, 0.09)"
  border-strong: "rgba(15, 35, 30, 0.16)"
  red: "#b02631"
  green: "#046b4d"
  yellow: "#7c4a06"
  hover: "rgba(15, 35, 30, 0.04)"
  input-bg: "#f2f7f5"
  track: "rgba(15, 35, 30, 0.09)"
  scrim: "rgba(10, 30, 25, 0.45)"
colorsDark:
  bg: "#0b1110"
  bg-2: "#0f1614"
  surface: "#131c1a"
  surface2: "#1b2624"
  accent: "#2dd4a7"
  accent-2: "#22b78e"
  accent-ink: "#052018"
  accent-dim: "rgba(45, 212, 167, 0.14)"
  gold: "#e0b768"
  text: "#e8efec"
  text-2: "#9fb0ab"
  text-3: "#829691"
  border: "rgba(232, 239, 236, 0.10)"
  border-strong: "rgba(232, 239, 236, 0.20)"
  red: "#f28b91"
  green: "#3ddba8"
  yellow: "#e0b768"
  hover: "rgba(232, 239, 236, 0.05)"
  input-bg: "#0f1614"
  track: "rgba(232, 239, 236, 0.12)"
  scrim: "rgba(0, 0, 0, 0.62)"
typography:
  display:
    fontFamily: "Assistant, system-ui, -apple-system, Segoe UI, sans-serif"
    fontWeight: 800
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Assistant, system-ui, -apple-system, Segoe UI, sans-serif"
    fontWeight: 500
  scale:
    xs: "0.74rem"
    sm: "0.8rem"
    base: "0.86rem"
    md: "0.94rem"
    lg: "1.05rem"
    xl: "1.3rem"
    display-sm: "1.7rem"
    display-md: "2rem"
    display-lg: "4.4rem"
rounded:
  xs: "4px"
  sm: "8px"
  md: "14px"
  lg: "20px"
  full: "999px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "24px"
  6: "32px"
  7: "48px"
  8: "64px"
motion:
  fast: "140ms"
  base: "220ms"
  slow: "320ms"
  easing: "cubic-bezier(0.16, 1, 0.3, 1)"
shadows:
  card: "0 1px 2px rgba(15, 35, 30, 0.04), 0 8px 24px -12px rgba(15, 35, 30, 0.12)"
  card-hover: "0 2px 4px rgba(15, 35, 30, 0.05), 0 16px 36px -14px rgba(15, 35, 30, 0.18)"
  lift: "0 20px 60px -20px rgba(15, 35, 30, 0.28)"
zIndex:
  base: 1
  toast: 900
  overlay: 1000
layout:
  page-max: "1280px"
  page-pad: "40px (20px at <=860px)"
  rail-w: "64px"
components:
  button-primary:
    backgroundColor: "linear-gradient(135deg, {colors.accent}, {colors.accent-2})"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.sm}"
    padding: "11px 22px"
    fontWeight: 700
  button-ghost:
    backgroundColor: "{colors.hover}"
    border: "1px solid {colors.border-strong}"
    textColor: "{colors.text-2}"
    rounded: "{rounded.sm}"
    padding: "11px 22px"
    fontWeight: 700
  card:
    backgroundColor: "{colors.surface}"
    border: "1px solid {colors.border}"
    boxShadow: "{shadows.card}"
    rounded: "{rounded.lg}"
    padding: "{spacing.5}"
  input:
    backgroundColor: "{colors.input-bg}"
    border: "1px solid {colors.border}"
    rounded: "{rounded.sm}"
    padding: "11px 14px"
---

# Design System: Budget Advisor

## 1. Overview

Budget Advisor is an advisor-facing console for reviewing client budgets. The
interface is a light-default, dark-optional mint-teal system: flat white cards on
a pale green-gray page, a deep teal accent, and a single type family. It is a
dense working tool, read repeatedly in short sessions, so the visual system stays
quiet and the numbers carry the hierarchy.

The system uses one font family, Assistant, for both display and body
(`--font-display: var(--font-body)`). Hierarchy comes from weight and size, not
from a second face. Assistant is also the family used by the sibling client
budget app, so the two products read as one system.

**Key characteristics:**
- Two themes, both first-class. Light is the default set; dark is
  `:root[data-theme="dark"]`. Everything is expressed through the same variable
  names, so components are written once.
- Flat surfaces: `--surface` fill, `1px solid var(--border)`, and
  `--shadow-card`. No gradient card fills, no texture or grain overlay.
- A single teal accent, plus a gold second signal, plus semantic red/green/yellow.
- RTL-native Hebrew UI. See section 7 for the RTL and bidi rules that this
  codebase has actually gotten wrong before.

**Source of truth:** `src/theme.css`. Every token below is defined there. The
theme is applied by `src/useTheme.js`, which writes `data-theme` onto
`<html>` and persists the choice under the `advisor_theme` localStorage key. It
runs at module load, before React's first render, so anything reading computed
CSS variables during render sees the correct theme.

## 2. Colors

Every color is a CSS variable with a light value in `:root` and a dark value in
`:root[data-theme="dark"]`. Never hardcode a hex in a component; if a value is
missing, add the variable to `theme.css` for both themes.

### Accent
- `--accent` (light `#0a7a62`, dark `#2dd4a7`): links, active nav and tab state,
  primary buttons, focus rings, progress fills, active filter chips.
- `--accent-2` (light `#066552`, dark `#22b78e`): the second stop of the primary
  button gradient.
- `--accent-ink` (light `#ffffff`, dark `#052018`): text on top of an accent fill.
- `--accent-dim` (light `rgba(10,122,98,0.09)`, dark `rgba(45,212,167,0.14)`):
  tinted backgrounds for accent chips and icon-rail hover.
- `--accent-rgb`: the raw channel triplet, for `rgba(var(--accent-rgb), a)`
  compositions. `--gold-rgb`, `--green-rgb`, `--red-rgb`, `--yellow-rgb` exist for
  the same reason.

### Surfaces and neutrals
- `--bg` (light `#eef3f1`, dark `#0b1110`): page background.
- `--bg-2` (light `#f6f9f8`, dark `#0f1614`): recessed wells, such as the expense
  entry form.
- `--surface` (light `#ffffff`, dark `#131c1a`): cards, tiles, the icon rail,
  overlay panels. White cards are the norm in the light theme.
- `--surface2` (light `#f2f7f5`, dark `#1b2624`): nested cells inside a card
  (sub-stats, flow cells), progress-bar tracks in a few places, neutral chips.
- `--text` / `--text2` / `--text3`: primary, secondary, tertiary text.
- `--border` / `--border-strong`: hairline dividers and card edges; both are
  translucent tints of the text color, not flat grays. `--border-strong` is also
  the hover border for cards and tiles.
- `--hover`: neutral hover wash for rows and ghost buttons.
- `--input-bg`: form field fill.
- `--track`: progress-bar track.
- `--scrim`: full-screen backdrop behind modal overlays.

### Semantic
- `--green` (light `#046b4d`, dark `#3ddba8`): income, on-track, good insight.
- `--red` (light `#b02631`, dark `#f28b91`): expense, over budget, danger insight,
  destructive actions.
- `--yellow` (light `#7c4a06`, dark `#e0b768`): warning insight, near-limit budget.
- `--gold`: same value as `--yellow` in both themes, but a separate variable used
  for a different meaning: debt/loans/payments, notes, and open-task signals. Keep
  them separate even though they currently resolve to the same color, so either
  can move independently.

Semantic fills are always composed as `rgba(var(--x-rgb), 0.06-0.14)` with a
matching `rgba(..., 0.25-0.4)` border, so they hold up on both surface colors.

### Chart and category colors
Defined in `src/categories.js`, not in `theme.css`, because Chart.js takes plain
color strings.
- `CHART_PALETTE`: 8 colors, assigned to categories by their canonical order.
- `HASH_PALETTE`: 16 colors for free-text keys (subscription names, custom asset
  labels) that have no canonical position. They are spaced at least 23 delta-E
  apart, hold at least 4:1 against both card surfaces, and stay at least 20 delta-E
  from the green/red status colors so a chip never reads as a verdict. An earlier
  8-slot version collided constantly.
- `catColor(cat)` for known categories; `stableColor(key, order)` for anything
  else, optionally passing the canonical array for that domain.
- `chartTheme()` reads the live computed values of `--font-body`, `--bg`,
  `--surface`, `--text`, `--text2`, `--border`, `--green`, `--red` and returns
  plain strings for Chart.js.

## 3. Typography

**Family:** Assistant (loaded from Google Fonts in `index.html`, weights
300-800), with `system-ui, -apple-system, 'Segoe UI', sans-serif` fallbacks.
`--font-display` is an alias of `--font-body`, so a component that reaches for
`var(--font-display)` gets the same family; the alias exists so display-intent
sites stay marked and can diverge later without a sweep.

`h1, h2, h3` are globally `font-weight: 800`, `letter-spacing: -0.02em`,
`line-height: 1.15`, `margin: 0`.

### Scale
Use these variables for any new or touched size decision.

| Token | Value | Typical use |
| --- | --- | --- |
| `--text-xs` | 0.74rem | chips, badges, metadata, percentages |
| `--text-sm` | 0.8rem | labels, eyebrows, secondary rows |
| `--text-base` | 0.86rem | default UI copy, list rows, inputs, buttons |
| `--text-md` | 0.94rem | section headers inside cards, empty-state copy |
| `--text-lg` | 1.05rem | card sub-values, highlight text |
| `--text-xl` | 1.3rem | section titles, logo, stat values |
| `--text-display-sm` | 1.7rem | tile headline numbers, client initials |
| `--text-display-md` | 2rem | page `<h1>`, hero cash-flow value |
| `--text-display-lg` | 4.4rem | reserved for the largest hero figure |

Weights in practice: 500 body, 600 labels and emphasized rows, 700 numbers,
titles and buttons, 800 for global headings.

Numeric values carry `font-variant-numeric: tabular-nums`, plus the bidi
treatment in section 7.

## 4. Elevation

Depth is a small shadow plus a hairline border, not gradients or texture.

- `--shadow-card`: resting elevation for cards, tiles, and grouped list panels.
  Applied at rest, unlike the previous system.
- `--shadow-card-hover`: the stronger pair, available for hover states.
- `--shadow-lift`: overlays only. Used by the login card, the quick switcher, the
  account dropdown, the import sheet, and toasts.
- Accent glow (`0 6px 18px -6px rgba(var(--accent-rgb), 0.5)`): primary button
  hover. Always accent-tinted, never neutral.

Most cards signal hover by shifting `border-color` to `--border-strong`, sometimes
with a small `translateY(-3px)`.

Modal overlays sit on `--scrim` at `--z-overlay`; toasts at `--z-toast`; the shell
and its content at `--z-base`. The fixed icon rail also uses `--z-overlay`.

## 5. Motion

- `--motion-fast` 140ms, `--motion` 220ms, `--motion-slow` 320ms.
- `--ease-out-expo`: `cubic-bezier(0.16, 1, 0.3, 1)`, the default easing for
  transforms and entrances.
- `riseIn` is a global keyframe in `theme.css` (fade plus 10px rise). Cards,
  tiles, list rows, and overlay panels enter with
  `animation: riseIn var(--motion) var(--ease-out-expo) both`. `Shell.module.css`
  defines a local `tabIn` variant (8px rise) for tab content.
- `prefers-reduced-motion: reduce` collapses all animation and transition
  durations globally in `theme.css`. Chart.js is not covered by that rule; see
  section 7.

## 6. Components

### Layout shell
- Fixed icon rail on the inline-start edge, `--rail-w` 64px, `--surface`
  background, `border-inline-end: 1px solid var(--border)`. Rail buttons are 38px
  (44px on mobile) with a tooltip that appears at `inset-inline-start:
  calc(100% + 8px)`. Below 860px the rail becomes a static horizontal bar and the
  tooltips are hidden, since a side tooltip would overlap the next button and its
  width pushed the document into horizontal scroll.
- Content is centered at `--page-max` 1280px with `--page-pad` (40px, 20px below
  860px) on each side.
- The client workspace uses a tab bar under the topbar. The active tab is marked
  by a 2px accent underline (`::after`, scaling from 0.6 to 1) plus 600 weight.

### Buttons (`components/Button.module.css`)
- Shape: `--radius-sm`, `padding: 11px 22px`, weight 700, `--text-base`.
- Primary: `linear-gradient(135deg, var(--accent), var(--accent-2))` with
  `--accent-ink` text; hover adds the accent glow; active scales to 0.96.
- Ghost: `--hover` background, `1px solid var(--border-strong)`, `--text2` text;
  hover shifts the border to `rgba(var(--accent-rgb), 0.5)` and the text to
  `--text`.

### Cards and tiles
- `--radius-lg` (20px) for primary cards and dashboard tiles, `--radius-md` (14px)
  for grouped list panels, stat cells, and form wells.
- `background: var(--surface)`, `1px solid var(--border)`, `--shadow-card`.
- Padding `--space-4` to `--space-5`.
- The dashboard is a 4-column bento grid with `grid-auto-flow: dense` and 20px
  gaps, dropping to 2 columns at 860px and 1 at 560px.
- Status is expressed by tinting the border only, for example
  `border-color: rgba(var(--red-rgb), 0.3)` on a danger highlight tile.

### Inputs
- `1px solid var(--border)`, `--input-bg` (or `--surface` inside a `--bg-2` form
  well), `--radius-sm`, roughly 9-14px padding, `font-family: var(--font-body)`.
- Focus: `border-color` shifts to `rgba(var(--accent-rgb), 0.5)`. The global
  `:focus-visible` rule in `theme.css` also supplies a 2px accent outline with
  2px offset.

### Chips and filters
- Pill chips use `--radius-full`; small inline tags use `--radius-sm` or
  `--radius-xs`.
- An active filter chip is a solid `--accent` fill with `--accent-ink` text.
- Status chips are the semantic `rgba` fill/border pair described in section 2.

### Progress bars
- Track: `--track` (or `--surface2`), height 3-18px, `overflow: hidden`.
- Fill: full width, animated with `transform: scaleX(pct)` and
  `transform-origin: right` so it grows from the RTL start edge. See section 7 for
  why this is physical `right` and not a logical property.

### Empty states
- Canonical: centered column, `padding: 100px 0`, a 46px circle with
  `1px dashed var(--border-strong)` holding a line icon, then a short
  `--text3` sentence. Optional `--text` title at `--text-lg`.
- ClientList uses the same mark with a solid border and a faint
  `rgba(var(--accent-rgb), 0.05)` fill, since it is the app's primary onboarding
  moment and carries a CTA.
- CRM uses the same mark at `padding: 56px 0`, because up to three empty states
  can stack in one view and 100px each would leave roughly 300px of dead space.

## 7. Conventions that are easy to get wrong

These are documented because they have caused real bugs here.

### RTL and logical properties
The app is `dir="rtl"` at the `<html>` level and Hebrew throughout. Prefer logical
properties (`inset-inline-start/end`, `margin-inline-*`, `padding-inline-*`,
`border-inline-*`) for layout.

The exception: logical properties resolve against the element's **own**
`direction`. A child that sets `direction: ltr` (which numeric elements do, see
below) flips the meaning of `inset-inline-start` inside itself. Progress-bar fills
here therefore use physical `right`/`left` and `transform-origin: right`
deliberately, so the fill always grows from the visual right edge regardless of
the direction context it lands in. Do not "fix" these to logical properties.

### Signed and numeric values
Any element that renders a signed number, currency, percentage, or date needs
**both**:

```css
direction: ltr;
unicode-bidi: isolate;
```

`direction` alone is inert on inline content: the bidi algorithm still reorders the
run and moves the minus sign to the wrong side of the number. `unicode-bidi:
isolate` is what actually isolates the run. Pair both with
`font-variant-numeric: tabular-nums`, and add `text-align: right` when the element
is a block, so the LTR run still aligns to the RTL page.

### Entity-keyed colors
Category and entity colors must be derived from the entity itself via
`catColor(cat)` or `stableColor(key, order)`, never from the item's index in the
list being rendered. Keying on list position means filtering or re-sorting
repaints every surviving item.

### Chart.js
- Chart.js takes plain color strings and cannot follow CSS custom properties. Call
  `chartTheme()` at render time and key the chart on the current theme so it
  re-reads the computed variables when the theme changes.
- Chart.js animates on canvas, so the global `prefers-reduced-motion` rule in
  `theme.css` cannot reach it. It is disabled explicitly in `src/main.jsx`
  (`ChartJS.defaults.animation = false`, plus `animations` and `transitions`).
  Any new chart configuration must not reintroduce a hardcoded animation.

## 8. Do's and Don'ts

### Do
- Do read every color, size, radius, spacing, motion, shadow, and z-index value
  from a `theme.css` variable.
- Do add new tokens to **both** `:root` and `:root[data-theme="dark"]`.
- Do verify a change in both themes before considering it done.
- Do give any signed or numeric value `direction: ltr; unicode-bidi: isolate;` and
  `tabular-nums`.
- Do use the canonical empty-state pattern (46px dashed circle, `--text3`
  sentence) for any new empty state.
- Do key entity colors on the entity, through `catColor`/`stableColor`.
- Do reserve `--gold` for debt/loans/payments/notes and `--yellow` for warnings,
  even though they currently share a value.

### Don't
- Don't hardcode a hex, rgba, px size, or duration in a component stylesheet.
- Don't add gradient card fills, texture, or grain overlays; cards are flat
  `--surface` with a border and `--shadow-card`.
- Don't assume dark mode. Light is the default theme and the one most values are
  authored against first.
- Don't introduce a second display font family; hierarchy is weight and size.
- Don't use a colored side stripe (`border-inline-start` as an accent bar) on a
  card, row, or alert; status is a tinted full border or a dot.
- Don't apply gradient text (`background-clip: text`); use color or weight.
- Don't convert the progress-bar `right`/`transform-origin: right` rules to
  logical properties.
- Don't reach for a modal as the first idea; the app favors inline sections and
  progressive disclosure (see CRM, Subscriptions) over dialogs.
