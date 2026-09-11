# advisor-app dashboard density — design

## Context

The [2026-09-10 layout restructure](2026-09-10-advisor-layout-restructure-design.md) merged the icon-only
rail and the horizontal tab bar into one wide sidebar, and converted the
connected-clients card grid into a table. After seeing it running, the user
compared it again to their competitor structural reference ("Moneyflow", a
financial-advisor CRM dashboard — structural reference only, never
branding/naming, see [[competitor-research-branding-caution]]) and said it
still doesn't resemble the reference closely enough. This spec closes the
remaining concrete gaps between the reference screenshot and the current
`ClientList`/`IconRail`.

## Goals

1. A personalized welcome header above the KPI section, with two quick-action
   buttons.
2. A visually richer KPI section (separated cards, colored icon circles)
   without inventing data we don't have.
3. Group-header labels in the sidebar, above each icon cluster.
4. A table with always-visible row actions instead of hover-reveal.

## Non-goals / explicit deviations from the reference

- **No fake "today's tasks" strip.** The reference's 4-card row ("מסמך ממתין
  לחתימה", "שאלון הושלם", etc.) has no backing data source in this app —
  building it would mean either dummy content or inventing a new feature
  (document e-signing, questionnaires) that wasn't asked for. Skipped.
- **No sparkline/trend graphs on KPI cards.** `useClientList` has no
  historical/time-series data — a decorative trend line would be fabricated.
  One real trend metric is added instead (§3).
- **"Immediate meeting" button is a visible but disabled placeholder** — no
  video-call feature exists yet. Per the user's explicit call: the button
  stays in the UI (visual parity with the reference) but is disabled with a
  "בקרוב" (coming soon) tooltip, not wired to fake functionality. A real
  video feature is a future, separate project.
- No branding, naming, or color-palette copying from the reference — this
  app keeps its own DESIGN.md mint-teal/Assistant-font system throughout.

## Design

### 1. Welcome header (`ClientList.jsx`)

New section rendered above the existing `.statBar`, only when
`clients.length > 0 || leads.length > 0` (same gate as the stat bar, so a
brand-new advisor with nothing yet still sees the existing empty state as
the whole page, unchanged).

Greeting text: `"{שם}, {greeting}"` is intentionally reversed from the
reference's "{greeting}, {שם}" to read naturally in RTL — resolved as
`{greeting}` computed from `new Date().getHours()` (5–11 → "בוקר טוב",
12–17 → "צהריים טובים", 18–4 → "ערב טוב"), and `{שם}` from
`useAdvisorProfile(advisorId).profile.display_name`, falling back to the
local part of the advisor's email (`session.user.email.split('@')[0]`,
already available via the `email` prop `Shell` receives — `ClientList`
needs to also receive `advisorEmail` as a new prop from `App.jsx`, or reuse
`useAdvisorProfile` which `ClientList` doesn't currently import) if
`display_name` is null. `ClientList` doesn't currently call
`useAdvisorProfile` — it will import and call it with `advisorId`, exactly
like `Shell.jsx`'s `AccountMenu` already does.

Two buttons, right-aligned under/beside the greeting:
- **"לקוח חדש +"** — reuses the exact behavior the existing empty-state CTA
  already has: `emailInputRef.current?.focus()`, scrolled into view if
  needed (`scrollIntoView({ block: 'center' })` since this section may be
  off-screen below the header on a short viewport).
- **"פגישה מיידית"** — rendered `disabled`, `title="בקרוב"`, no `onClick`.
  Same visual weight as the first button (not greyed into invisibility —
  it should read as "coming soon", not "broken").

### 2. KPI cards (`ClientList.jsx` / `.module.css`)

The existing `.statBar` (one continuous bar: one large "active clients"
figure + a divider + several `StatSecondary` inline items) becomes a row of
separated cards — each stat (active clients, budget overages this month,
total overage amount, open tasks, leads in pipeline, **new: clients added
this week**) gets its own card: colored icon circle (reusing each stat's
existing tone — `statAccentIcon`/`statRed`/`statGold`) at a slightly larger
size, value below it, label below that. This is a pure CSS/markup
restyle of the existing `StatMain`/`StatSecondary` components' output — no
new data-fetching logic for the 5 stats that already exist.

**New real stat:** "לקוחות חדשים השבוע" — `useClientList` already orders by
`created_at` but doesn't select or return it. Add `created_at` to the
`advisor_clients` select in `useClientList.js`, and compute
`newThisWeek = clients.filter(c => c.createdAt && (Date.now() - new
Date(c.createdAt).getTime()) < 7*24*60*60*1000).length` in `ClientList.jsx`.
Rendered as a `StatSecondary` alongside the others, no icon circle color
urgency (neutral tone, like the existing "leads in pipeline" tile).

No sparklines, no fabricated week-over-week percentage deltas.

### 3. Sidebar group-header labels (`IconRail.jsx` / `.module.css`)

Each of `IconRail`'s existing dividers (rendered between `nav` groups, and
around the global-actions/trailing-actions clusters) is replaced by a small
non-interactive label matching that cluster's purpose, instead of a bare
line:
- Global actions cluster (back/search): no label (matches the reference,
  which doesn't caption its top utility icons either).
- `nav` groups: driven by a new `groupLabel` field the plan adds to
  `App.jsx`'s `NAV` array entries (only the first item of each group needs
  it) — e.g. `"סקירה"` for the dashboard/crm/mapping group, `"כספים"` for
  budget/analysis/goals/subs/credit/assets.
- Trailing actions cluster (report/present): label `"כלים"`.

Rendered as `<div className={styles.groupLabel}>{label}</div>` — small,
muted, uppercase-tracked text (`var(--text3)`, `var(--text-xs)`), replacing
the current bare `<span className={styles.divider} />` at that position
(the divider styling — thin line — is kept for the un-labeled global-actions
boundary only). Hidden entirely below 860px (the collapsed icon-only rail
has no room for labels, consistent with `.label` already being hidden
there).

### 4. Table row actions always visible (`ClientList.jsx` / `.module.css`)

- `.rowRemoveBtn`'s `opacity: 0` (hover/focus-reveal) is removed — it
  renders at full opacity like every other cell, matching the reference's
  always-visible disconnect affordance. (The existing 560px mobile override
  that already forces `opacity: 1` there becomes redundant and is removed
  along with the base rule it was overriding.)
- The table gains a `<th>`-driven visual treatment matching the reference's
  green "פתח כרטיס" button: the existing `clientCellBtn` (first cell) stays
  the click target, but a dedicated last-column button is added, styled like
  the app's primary `Button` component (existing `--accent` green-teal),
  labeled "פתח כרטיס", calling the same `onSelect(c.client_id,
  c.client_email)`. `.actionsCell` now holds two controls side by side: the
  new "פתח כרטיס" button and the existing disconnect (✕) button (or the
  confirm/cancel pair when disconnecting).

## Files touched

- `advisor-app/src/clients/ClientList.jsx` + `ClientList.module.css` —
  welcome header, KPI card restyle + new stat, always-visible actions +
  "פתח כרטיס" button.
- `advisor-app/src/clients/useClientList.js` — select `created_at`, return
  it as `createdAt` on each client.
- `advisor-app/src/components/IconRail.jsx` + `IconRail.module.css` — group
  labels.
- `advisor-app/src/App.jsx` — add `groupLabel` to the relevant `NAV` entries.

## Testing

- Same convention as the prior restructure: this codebase's Vitest suite is
  logic-only. `useClientList.test.js` doesn't exist today; adding
  `created_at`/`createdAt` plumbing is simple enough not to need a new test
  file, but if a reviewer flags it, a small unit test on the "new this week"
  filter logic (pure function, extractable) is reasonable to add.
- Visual verification via the `verify` skill / `vite.audit.config.js` mock
  harness, both themes, both the wide and collapsed sidebar breakpoints, and
  the empty-state path (`clients.length === 0 && leads.length === 0`) to
  confirm the welcome header still correctly stays hidden there.
