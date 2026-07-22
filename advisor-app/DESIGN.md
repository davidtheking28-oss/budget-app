---
name: Budget Advisor
description: Dark, editorial-financial control panel for advisors managing client budgets
colors:
  bg: "#0a0908"
  bg-2: "#100d0b"
  surface: "#17130f"
  surface2: "#201a15"
  accent: "#4f83ff"
  accent-2: "#3f66e0"
  accent-ink: "#eef3ff"
  gold: "#c9a875"
  text: "#f2f0ea"
  text-2: "#9a9d9f"
  text-3: "#83878a"
  border: "rgba(242, 240, 234, 0.08)"
  border-strong: "rgba(242, 240, 234, 0.16)"
  red: "#e8756a"
  green: "#52c99a"
  yellow: "#d9b25c"
typography:
  display:
    fontFamily: "Frank Ruhl Libre, Times New Roman, serif"
    fontWeight: 700
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Heebo, system-ui, sans-serif"
    fontWeight: 500
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
components:
  button-primary:
    backgroundColor: "linear-gradient(135deg, {colors.accent}, {colors.accent-2})"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.sm}"
    padding: "11px 22px"
  button-ghost:
    backgroundColor: "rgba(255,255,255,0.02)"
    textColor: "{colors.text-2}"
    rounded: "{rounded.sm}"
    padding: "11px 22px"
  card:
    backgroundColor: "linear-gradient(165deg, {colors.surface}, {colors.bg-2})"
    rounded: "{rounded.lg}"
    padding: "{spacing.5}"
---

# Design System: Budget Advisor

## 1. Overview

**Creative North Star: "The Advisor's Ledger"**

Budget Advisor reads like a well-kept private ledger open under a desk lamp, not a
consumer fintech app. The palette is near-black and warm-tinted rather than pure
dark-mode gray; a serif display face (Frank Ruhl Libre) gives numbers and section
titles the weight of a printed statement, while Heebo carries the day-to-day
Hebrew UI text with clarity. A single restrained blue accent marks the one thing
that matters on any given screen; everything else stays quiet. Depth comes from
soft diagonal gradients and a faint film-grain texture over the whole app, never
from flat panels or heavy drop shadows.

This system explicitly rejects generic light-mode SaaS dashboard tropes: no flat
white cards, no blue-on-white stat tiles, no default Bootstrap-style form controls.
It also rejects decoration for its own sake, since the advisor is scanning real
client numbers, often mid-call.

**Key Characteristics:**
- Near-black, warm-tinted neutrals; never pure `#000`/`#fff`.
- One accent color (blue) at low-to-moderate usage; gold reserved for a second,
  rarer signal (loans/urgency).
- Serif display type for numbers and headings, sans body type for UI chrome.
- Depth via gradient + grain, not shadow stacks.
- RTL-native: every layout uses logical CSS properties.

## 2. Colors

Warm near-black neutrals carry the whole surface; a single blue accent is spent
deliberately, and semantic reds/greens/golds are reserved strictly for financial
meaning (over budget, on track, debt/urgent).

### Primary
- **Ledger Blue** (`#4f83ff`, `--accent`): links, active nav state, primary buttons,
  focus rings, progress fills. Paired with `--accent-2` (`#3f66e0`) for gradient
  buttons and `--accent-ink` (`#eef3ff`) for text on top of it.

### Secondary
- **Antique Gold** (`#c9a875`, `--gold`): a second, rarer signal reserved for
  debt/loan chips and one radial background glow. Never used interchangeably
  with the primary accent.

### Neutral
- **Near-Black Ink** (`#0a0908`, `--bg`) / (`#100d0b`, `--bg-2`): page background,
  gradient endpoints.
- **Warm Charcoal Surface** (`#17130f`, `--surface`) / (`#201a15`, `--surface2`):
  card and panel backgrounds, always as a `linear-gradient(165deg, surface, bg-2)`,
  never flat.
- **Bone White** (`#f2f0ea`, `--text`): primary text.
- **Warm Gray** (`#9a9d9f`, `--text2`) / (`#83878a`, `--text3`): secondary and
  tertiary text, labels, metadata.
- **Hairline Border** (`rgba(242,240,234,0.08)`, `--border`) / **Strong Border**
  (`rgba(242,240,234,0.16)`, `--border-strong`): dividers and card edges, always
  a translucent tint of the text color, never a flat gray.

### Semantic
- **Green** (`#52c99a`): income, on-track, good insight.
- **Red** (`#e8756a`): expense, over-budget, danger insight.
- **Yellow** (`#d9b25c`): warning insight, 80%+ budget usage.

### Named Rules
**The One Voice Rule.** The blue accent is spent on one primary action or state
per view; it never competes with itself. Gold is a distinct second voice, not a
backup blue.

**The Tinted Neutral Rule.** No neutral is pure black, white, or gray. Every
background and border is a translucent or warm-shifted tint of `--text` or `--bg`.

## 3. Typography

**Display Font:** Frank Ruhl Libre (fallback: Times New Roman, serif)
**Body Font:** Heebo (fallback: system-ui, sans-serif)

**Character:** A newspaper-finance pairing: serif display type gives numbers and
section headings editorial gravity, while Heebo keeps dense Hebrew UI copy legible
and neutral at small sizes.

### Hierarchy
- **Display** (700, `--text-display-lg` 4.4rem / `--text-display-md` 2rem /
  `--text-display-sm` 1.7rem, line-height ~1.05): hero net-worth figures, page
  `<h1>`s, tile headline numbers. Always `letter-spacing: -0.01em` to -0.015em.
- **Title** (700, `--text-xl` 1.3rem): section titles, card headline values.
- **Body** (500, `--text-base` 0.86rem / `--text-md` 0.94rem): form fields, list
  rows, primary UI copy.
- **Label** (600, `--text-sm` 0.8rem / `--text-xs` 0.74rem, `letter-spacing: 0.05em`
  on uppercase-weight labels): tile labels, section eyebrows, metadata.

### Named Rules
**The Numeric LTR Rule.** Every currency, percentage, date, or count is wrapped
in `direction: ltr` with `font-variant-numeric: tabular-nums`, even inside an
RTL page, so digits never reverse or misalign.

## 4. Elevation

The system is flat by default; depth comes from a diagonal `linear-gradient(165deg,
surface, bg-2)` on every card and a subtle SVG film-grain layer over the whole
page (`opacity: 0.035`), not from box-shadow stacks. The one true shadow token
(`--shadow-lift`, `0 20px 60px -20px rgba(0,0,0,0.6)`) is reserved for genuinely
overlaid surfaces: dropdown panels, the quick-switcher modal, the login card.

### Shadow Vocabulary
- **Lift** (`--shadow-lift`: `0 20px 60px -20px rgba(0,0,0,0.6)`): overlays and
  floating panels only.
- **Accent glow** (`0 6px 18px -6px rgba(accent-rgb, 0.5)`, `0 2px 12px -4px
  rgba(accent-rgb, 0.35)`): hover/active state on primary buttons and the active
  nav item, always accent-tinted, never neutral gray.

### Named Rules
**The Flat-Card Rule.** Resting cards carry no shadow, only a gradient fill and a
1px `--border`. Shadow appears only in response to state (hover, active overlay).

## 5. Components

### Buttons
- **Shape:** `border-radius: var(--radius-sm)` (8px), `padding: 11px 22px`,
  `font-weight: 700`.
- **Primary:** `linear-gradient(135deg, accent, accent-2)` background,
  `accent-ink` text; hover adds an accent-tinted glow shadow; active scales to
  0.96.
- **Ghost:** `rgba(255,255,255,0.02)` background, `1px solid border-strong`,
  `text2` color; hover shifts border to accent at 50% opacity and text to full
  `--text`.

### Cards / Containers
- **Corner Style:** `var(--radius-lg)` (20px) for primary content cards/tiles,
  `var(--radius-md)` (14px) for smaller rows and form wells.
- **Background:** `linear-gradient(165deg, surface, bg-2)`, always the gradient
  pair, never a flat surface color.
- **Shadow Strategy:** none at rest (see Elevation); border-color shifts to
  `border-strong` on hover, sometimes paired with a small `translateY` lift.
- **Border:** `1px solid var(--border)`.
- **Internal Padding:** `var(--space-4)`–`var(--space-5)` (16–24px).

### Inputs / Fields
- **Style:** `1px solid var(--border)`, `rgba(0,0,0,0.2)` background,
  `var(--radius-sm)` corners, `10-14px` padding.
- **Focus:** `border-color` shifts to `rgba(accent-rgb, 0.5)`, no glow/ring.

### Empty States
- **Canonical pattern** (established in Goals, now applied consistently across
  Budget/Expenses/Subscriptions): `padding: 100px 0`, centered column, a 46px
  circle with `1px dashed border-strong` holding an 18px line-icon, followed by
  a short `text3`-colored sentence.
- **Density exception (CRM):** Crm.jsx can show up to three of these empty
  states stacked in one view (meetings/tasks/notes each empty independently).
  There the same circle+sentence pattern uses `padding: 56px 0` instead of
  100px, so three stacked empties don't push the page to ~300px of dead
  space. Same visual language, tuned padding for a multi-section page.

### Navigation (Sidebar)
- Fixed 264px sidebar, vertical stack, `2px` active indicator bar on the
  inline-end edge (`accent`), active item gets `accent-dim` background fill and
  600-weight text. Footer (back button + account menu) pinned to the bottom via
  `margin-top: auto` with a `border-top` divider, independent of nav content
  height.

## 6. Do's and Don'ts

### Do:
- **Do** keep every card/tile background as the `linear-gradient(165deg, surface, bg-2)`
  pair, matching Dashboard, Goals, and ClientList.
- **Do** wrap every currency/date/count value in `direction: ltr` with
  `tabular-nums`.
- **Do** use the canonical empty-state pattern (46px dashed circle + `padding:
  100px 0`) for any new empty state.
- **Do** use logical CSS properties (`inset-inline-*`, `margin-inline-*`,
  `padding-inline-*`) exclusively; this is an RTL-first app.
- **Do** reserve gold strictly for debt/loan/urgent signals, never as a decorative
  second accent.

### Don't:
- **Don't** introduce flat white or light-gray cards; this breaks the near-black
  warm-neutral system entirely.
- **Don't** add drop-shadow stacks to resting cards; depth comes from the
  gradient + grain, not shadows.
- **Don't** use a side-stripe (`border-left`/`border-right` as a colored accent)
  on any card, row, or alert.
- **Don't** apply gradient text (`background-clip: text`); use color or weight
  for emphasis instead.
- **Don't** invent a second blue-adjacent accent; gold is the only second voice.
- **Don't** reach for a modal as the first idea for the loans/payments redesign;
  this app already favors inline sections and progressive disclosure (see CRM,
  Subscriptions) over modal dialogs.
