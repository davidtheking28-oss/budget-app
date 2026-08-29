# advisor-app — client presentation screen

## Context
Advisors meet with clients and walk them through their full financial
picture — income/expenses vs. budget, subscriptions, fixed expenses, loans
and card payments, savings goals — for the month in question. The existing
monthly Report (`budget/Report.jsx`) covers only income/expense/budget/
insights/goals, in a plain-table, print-oriented layout, and is reached via
a "print" action. A prior attempt to solve "present to client" by hiding
advisor-only chrome across the existing screens (client-view mode) was
built, then explicitly reverted — the advisor wants a dedicated, richer,
purpose-built screen instead, not a stripped-down version of the working
screens.

## Goal
A new, read-only, per-month presentation screen — richer and more visual
than the Report (charts, progress bars, not just HTML tables), branded the
same way (advisor logo/name), covering the full financial picture including
what's changing this month (a subscription renewing, a loan or payment plan
finishing). Reached via its own icon-rail button. No editing on this screen
— corrections happen on the normal screens; the advisor returns here after.

## Design

### Data, all scoped to the selected `{year, month}` (the same `ym` state
`App.jsx` already threads to every other screen)
- **Income / expenses / net** — `monthSummary(data, year, month)` (existing, `budgetMath.js`), shown as a stat row + a bar chart (same Chart.js pattern as `Dashboard.jsx`).
- **Budget vs. actual by category** — `effectiveLimit(data, c, year, month)` vs `summary.spentByCat[c]` (existing, both already used in `Report.jsx`) — rendered as a labeled progress bar per category (not a table), reusing the row/bar visual language already established in `Subscriptions.module.css` (`.loanBar`/`.loanBarFill`/`.loanBarPct`).
- **Subscriptions** — from `data.subscriptions`, filtered `active`; flag any with `nextDate` falling inside the selected month as "renews this month" (adapt the existing `renewingSoon` 7-day-window logic in `Subscriptions.jsx` to a month-window instead, since this screen is month-scoped, not "next 7 days").
- **Fixed expenses** — `data.fixed_expenses`, plain list (name + amount), same as `Subscriptions.jsx`'s fixed-expenses section.
- **Loans** — `data.loans`; for each, reuse `loanPayoffMonths` (exported from `Credit.jsx`) to flag one **finishing this month or next** (`n !== null && n <= 1`) — this is the "an loan ending" signal the advisor asked for.
- **Card payments (תשלומים)** — `data.payments`; reuse `currentInstallments`/the `done` computation already in `Credit.jsx` to flag any finishing this month.
- **Goals** — `data.goals`, progress bar per goal (reuse the visual pattern, not the component, from `Dashboard.jsx`'s goals tile).
- **Assets** (if present) — `data.assets`, simple total + list; skip the section entirely when empty (matches the existing "hide empty sections" convention used throughout advisor-app, e.g. `Report.jsx`'s `cats.length > 0 &&`).

### Branding header
Same pattern as `Report.jsx`: `useAdvisorProfile(advisorId)` for `display_name`/`logo_url`, falling back to the default `Logo` component — copy the header block structure directly.

### Reached via
A new icon-rail button in `IconRail.jsx`, next to the existing "דוח חודשי" (`onPrint`) button — new prop `onPresent`, same optional-prop-gated pattern. Wired through `Shell.jsx` the same way `onPrint` already is. In `App.jsx`, a new boolean state (e.g. `presentMode`) alongside the existing `reportMode`, rendered the same way (`if (presentMode) return <Presentation ... />`) — full-screen takeover, same as Report, with its own close button (no print button — this screen is for live presentation only, not the print/export flow the Report already owns).

### Files
- Create: `advisor-app/src/budget/Presentation.jsx`, `Presentation.module.css`
- Modify: `advisor-app/src/components/IconRail.jsx`, `Shell.jsx`, `App.jsx`

## Explicitly out of scope
- No editing affordances on this screen (no forms, no inline edit) — by design, per the approved "edit-then-present" answer: fix data on the normal screens, then open this one.
- No print/export handling — that's the existing Report's job; this screen is screen-only.
- No new data model / DB changes — every figure is computed from data these hooks already fetch.

## Testing
- `cd advisor-app && npm run test && npm run build`.
- Manual verification via the `vite.audit.config.js` mock harness: open the new screen for a client with active subscriptions/loans/payments spanning a renewal or payoff in the seeded month, confirm the "finishing this month" flags render, confirm empty sections (e.g. no assets) are hidden, confirm branding (logo/name) matches the Report's header, in both light and dark mode.
