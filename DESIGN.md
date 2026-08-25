---
name: Calm Ledger
description: A quiet, premium design system for a Hebrew household budget app — trustworthy without being cold, simple without being childish
colors:
  primary: "#0a7a62"
  primary-dark-mode: "#34d3a9"
  neutral-bg: "#eef3f1"
  neutral-bg-dark: "#100f0d"
  surface: "#ffffff"
  surface-dark: "#1a1916"
  surface-alt: "#f2f7f5"
  surface-alt-dark: "#231f1b"
  border: "#dbe5e1"
  border-dark: "#ffffff14"
  text-primary: "#0f231e"
  text-primary-dark: "#f0ebe3"
  text-secondary: "#566963"
  text-secondary-dark: "#9b9089"
  success: "#046b4d"
  success-dark: "#34d399"
  danger: "#b02631"
  danger-dark: "#f87171"
  warning: "#a35a06"
  warning-dark: "#fbbf24"
  info: "#1d4ed8"
  info-dark: "#60a5fa"
typography:
  display:
    fontFamily: "Assistant, -apple-system, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "4.2rem"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-3px"
  headline:
    fontFamily: "Assistant, -apple-system, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1.55rem"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.5px"
  title:
    fontFamily: "Assistant, -apple-system, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 700
    lineHeight: 1.35
  body:
    fontFamily: "Assistant, -apple-system, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Assistant, -apple-system, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0.04em"
rounded:
  sm: "10px"
  md: "12px"
  lg: "18px"
  pill: "20px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "11px 18px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "16px"
  chip:
    backgroundColor: "{colors.surface-alt}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
---

## Overview

Calm Ledger is the visual language of a Hebrew-first (RTL), mobile household budget app, and its advisor-facing companion. The person on the other end of the screen is not a finance professional — they're checking, mid-errand, whether they can still afford the week. The interface's job is to answer that in about two seconds, without ever feeling like a spreadsheet or a bank's back office.

The system leans on one deep teal-green (Deep Trust Teal) as its single accent, warm off-white or near-black neutrals (never pure `#fff`/`#000`), and one typeface — Assistant — carrying the entire hierarchy through size and weight rather than font-mixing. Numbers are the heroes: the balance figure runs at 4.2rem, tabular and tightly tracked, while everything around it stays quiet.

**Anti-references:** Excel/Sheets (too many rows, too much structure), a government or bank portal (gray, bureaucratic, cold), old-Mint-style budgeting apps (childish, over-animated). This should read as premium and considered — a product worth paying for — while staying unmistakably Israeli and RTL-native, not a translated afterthought.

## Colors

Deep Trust Teal (`#0a7a62` light / `#34d3a9` dark) is the only accent color and is used sparingly — primary actions, the active state, small icon accents. It never fills large surfaces. Backgrounds are warm neutrals with a faint mint or ink tint (`#eef3f1` light, `#100f0d` dark), never true white or black. Status colors (success, danger, warning, info) are reserved strictly for their semantic meaning — a red number always means over-budget or overdue, never used decoratively.

Light and dark are both first-class; the same component vocabulary applies in either, only tone shifts (dark mode drops shadows almost entirely and relies on border + surface contrast instead, since ambient shadow reads as noise on a dark ground).

## Typography

One family end to end: **Assistant** (Hebrew-native, geometric, reads well at small sizes in RTL). Hierarchy comes from scale and weight, not font-switching:

- **Display** (4.2rem / 800 / -3px tracking): the one hero number on a screen — a month's balance. There is only ever one display-sized element in view at a time.
- **Headline** (1.55rem / 800): secondary key figures — a stat-card amount, a KPI.
- **Title** (1.05rem / 700): section headers.
- **Body** (0.9rem / 400): everything else — descriptions, list rows, form labels.
- **Label** (0.75rem / 500 / wide tracking): the smallest text — chip labels, meta captions.

All monetary figures use `font-variant-numeric: tabular-nums` so amounts align in columns and don't visually jitter as digits change.

## Elevation

Ambient, not structural (as confirmed): shadows in light mode are soft and diffuse (`0 2px 6px rgba(20,30,55,.10), 0 1px 2px rgba(20,30,55,.06)`) — they suggest a surface is slightly raised, never draw a hard edge around it. In dark mode, shadow is dropped almost to nothing; separation between a card and the page comes from a 1px near-transparent white border instead (`rgba(255,255,255,0.08)`), because a shadow against a near-black background reads as mud, not depth.

Two elevation steps cover the whole system: resting (card on page) and lifted (an active dropdown, a modal sheet — larger, softer shadow, `0 14px 34px rgba(15,23,42,.22)`). Nothing needs a third step; more layers would fight the "calm" brief.

## Components

**Soft confidence** (as confirmed): rounded corners throughout (10–18px, more generous on larger containers), generous internal padding, no sharp edges anywhere — but restrained, not playful. No bounce, no oversized touch feedback.

- **Buttons**: solid teal fill for the primary action per screen, everything else is a quiet outlined or ghost variant. Minimum 44px touch height.
- **Cards**: white/near-black surface, 18px radius, ambient shadow only, 16–20px internal padding. A card never nests another card.
- **Chips**: pill-shaped (20px radius), small, used for filters and status tags — background is the neutral surface-alt, color communicates meaning only when the chip is a status (red for overage, gold for pending, teal for selected).
- **Progress/limit bars**: thin (5–6px), rounded, fill color shifts teal → gold → red as a category approaches or exceeds its limit — the bar itself carries the warning, no extra icon needed.
- **Inputs**: same radius language as buttons, a visible border at rest, a 2px accent-tinted focus ring on `:focus-visible` (never `outline:none` without a replacement — this was a real bug fixed across the app this cycle).

## Do's and Don'ts

- **Do** let the accent color stay rare. If more than a handful of elements on one screen are teal, it's stopped meaning "this is the important one."
- **Do** keep every screen to one display-sized number, max.
- **Do** tint every neutral toward warm mint (light) or warm ink (dark) — never a pure gray, never `#fff`/`#000`.
- **Don't** stack cards inside cards. If content needs a boundary and it's already inside one, use a divider or a tinted row instead.
- **Don't** use a side-stripe (`border-left`/`border-right` accent bar) as a category or status indicator — use a filled dot, an icon, or a background tint instead.
- **Don't** reach for a modal before checking whether the same thing can be inline or a slide-up sheet — the mobile-first budget flows (add expense, confirm a meeting) are all sheets, not modals, on purpose.
- **Don't** let RTL be an afterthought: numbers and dates stay LTR-isolated inside an RTL sentence (`direction:ltr; unicode-bidi:isolate`), never mirrored.
