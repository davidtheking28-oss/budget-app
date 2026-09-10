# advisor-app layout restructure — design

## Context

The advisor platform (`advisor-app/`) currently feels cluttered. The user shared
a competitor CRM dashboard ("Moneyflow") as a **structural** reference only —
not its branding/colors — and asked for advisor-app's own layout (mint-teal
theme, Assistant font, flat surfaces per `DESIGN.md`) to adopt a similar
density/structure: a wider icon+label sidebar nav, a top bar with search, a
client list with inline status/actions, and a KPI stat-tile row above it.

Do not reuse the competitor's name or copy its visual branding.

## Current structure

- **`IconRail.jsx`** — narrow icon-only rail (RTL, right side): logo, global
  actions (back to clients / search / print report / present, each only when
  its handler prop is passed), theme toggle at the bottom. Tooltips on hover.
- **`Shell.jsx`** — topbar (logo text, search button, account menu) always
  shown. When a client is selected (`nav` prop present), also renders a
  horizontal tab bar below the topbar: 8 nav items (dashboard, crm, mapping,
  budget, analysis, goals, subs, credit, assets) grouped into `overview` /
  `tools` / `money` with divider lines between groups. `sidebarInfo` (the
  `MonthNav` control) renders at the end of that tab row.
- **`App.jsx`** — owns the `NAV` array (key/label/group/icon per item),
  wires `Shell`'s `nav`/`activeNav`/`onNavChange`, and the four IconRail
  actions (`onBack`, `onSearch`, `onPrint`, `onPresent`).
- **`ClientList.jsx`** — the advisor's home screen (no client selected): KPI
  stat bar (active clients, budget overages + amount, open tasks, leads in
  pipeline), add-client form (invite code / email), pending invites, then a
  responsive **card grid** — each card: avatar initials, health badge, email,
  status chips (overage / failed upload / declined meeting / next meeting /
  stale / tasks), remaining-budget stat, remove button. Urgency-sorted.

## Goals

1. Replace the icon-only `IconRail` **and** the horizontal tab bar with a
   single wide icon+label sidebar that carries all navigation (global actions
   + the 8 client nav tabs), so more of the nav is visible at once without a
   second horizontal row competing for the top of the screen.
2. Replace `ClientList`'s card grid with a denser table/row layout, closer to
   `PipelineTable.jsx`'s existing pattern (inline status, inline actions),
   while preserving the KPI bar, add-client form, and pending-invites section
   above it exactly where they are today.
3. Keep it usable on mobile: below a breakpoint the sidebar collapses back to
   the current icon-only rail (tooltip-on-hover/focus), same as today's
   `IconRail` behavior.

## Non-goals

- No visual/branding changes beyond what the restructure requires (colors,
  fonts, card styles elsewhere stay as-is per `DESIGN.md`).
- No changes to the underlying data hooks (`useClientList`, `usePipeline`,
  `usePendingInvites`, etc.) — this is a presentation-layer restructure.
- No changes to `MonthNav`'s own behavior — it keeps rendering next to the
  content area, not inside the sidebar.
- Not reproducing the competitor's own visual design, naming, or copy.

## Design

### 1. Sidebar (merges `IconRail` + Shell's tab bar)

A single sidebar component (`IconRail.jsx` is rewritten in place; Shell stops
rendering a separate horizontal tab bar) renders, top to bottom:

- **Logo mark** (unchanged).
- **Group "כללי"** — always present: back to client list (only when a client
  is selected, i.e. `onBack` passed), search (⌘K).
- **Group "סקירה"** — only when a client is selected: דשבורד, לקוח (CRM),
  מיפוי כלכלי.
- **Group "כספים"** — only when a client is selected: תקציב, ניתוח, יעדים,
  מנויים, הלוואות ואשראי, נכסים והתחייבויות.
- **Group "פעולות"** — only when a client is selected: דוח חודשי (`onPrint`),
  תמונת מצב ללקוח (`onPresent`).
- **Theme toggle** — pinned to the bottom, unchanged behavior.

Group dividers render only between non-empty groups (same rule Shell's tab
bar already uses: `i > 0 && n.group !== nav[i-1].group`). Each nav item shows
its icon + label at full sidebar width; the currently active item
(`activeNav`) gets the existing active-state styling ported from
`.tabItemActive`.

`App.jsx`'s `NAV` array becomes the single source for the "סקירה"/"כספים" nav
items (same shape as today: key/label/group/icon), passed into the sidebar
the way it's passed into `Shell` today. The four global actions
(`onBack`/`onSearch`/`onPrint`/`onPresent`) keep their existing prop-driven
"only render if handler is passed" behavior.

`Shell.jsx` drops its `tabBarBleed`/`tabRow`/`tabBar` rendering entirely;
`sidebarInfo` (`MonthNav`) keeps rendering in the content area's header,
immediately above `children`, instead of at the end of the old tab row.

### 2. `ClientList` → table

The card grid becomes a table, following `PipelineTable.module.css`'s
existing responsive pattern (`.tableWrap`, collapses to one stacked card per
row below 560px via `data-label`, since that pattern is already proven in
this codebase). Columns: client (avatar initials + email + health badge),
status (chips compressed to icon+tooltip so multiple statuses fit one cell),
remaining budget this month, next meeting, actions (existing remove /
confirm-remove control). Row click still opens the client (`onSelect`), same
urgency sort (`byUrgency`) as today. The KPI stat bar, add-client form, and
pending-invites card above the table are unchanged — only the card grid
itself becomes a table.

### 3. Responsive behavior

Above the breakpoint (~860px, matching the width a full label needs to not
crowd content): sidebar shows icon+label, fixed width. Below it: sidebar
collapses to icon-only (current `IconRail` width/behavior), labels become
hover/focus tooltips exactly as `IconRail` does today. `ClientList`'s table
switches to the stacked-card-per-row mobile layout below 560px, matching
`PipelineTable`'s existing breakpoint.

## Files touched

- `advisor-app/src/components/IconRail.jsx` + `IconRail.module.css` —
  rewritten to carry full nav (global actions + client nav groups), with the
  responsive collapse behavior.
- `advisor-app/src/components/Shell.jsx` + `Shell.module.css` — drop the
  horizontal tab bar rendering; `sidebarInfo` moves to the content header.
- `advisor-app/src/App.jsx` — no structural change to `NAV` itself; how it's
  wired into the sidebar vs. `Shell` changes to match the new prop shape.
- `advisor-app/src/clients/ClientList.jsx` + `ClientList.module.css` — card
  grid → table, reusing `PipelineTable`'s responsive pattern.

## Testing

- `advisor-app` has a Vitest suite (`npm run test`) — run it after the
  restructure; add/update any test that currently asserts on `IconRail` or
  `ClientList` DOM shape.
- Visual verification via the `verify` skill / `vite.audit.config.js` mock
  harness (Supabase auth isn't automatable) — check both breakpoints (wide
  sidebar vs. collapsed) and both themes (light/dark), per `advisor-app`'s
  DESIGN.md palette.
