# advisor-app — client-view mode

## Context
Advisors sit with a client (in person or on a call) and walk through the
client's variable and fixed expenses against the budget that was built for
them. Today every screen in advisor-app is the advisor's own working view —
internal navigation (CRM, Economic Mapping/OCR queue) and internal shortcuts
(`ClientContextBar`'s next-meeting/open-tasks/CRM link) are visible the whole
time, including when the advisor is screen-sharing or turning the laptop
around to show the client their numbers. There's no way to present the data
cleanly without those internal-only elements in view.

## Goal
A toggle, available everywhere in the app, that switches the current session
into "client-view mode": advisor-only navigation and shortcuts disappear,
leaving only the client-data screens the advisor is walking the client
through (dashboard, cashflow, budget, analysis, goals, subscriptions, credit,
assets). No screen becomes read-only — this only hides navigation and
internal-shortcut chrome, it does not lock editing.

## Design

### State
One boolean, `clientView`, held in `App.jsx` alongside the existing
`nav`/`selectedClient`/`budgetMode` state. Plain React state, not persisted to
the URL — it's a live, in-meeting mode, not a navigable destination; a reload
mid-meeting is expected to drop back to the advisor's normal view.

### Nav filtering
`NAV` (defined in `App.jsx`) already tags each entry with a `group`
(`overview` | `tools` | `money`). The `tools` group is exactly the two
internal-only tabs: `crm` (label "לקוח") and `mapping` ("מיפוי כלכלי"). When
`clientView` is true, the array passed to `<Shell nav=...>` is
`NAV.filter(n => n.group !== 'tools')` — no new tagging needed, the existing
grouping already draws the right line.

A `useEffect` watches `clientView`: if it flips to `true` while `nav` is
`'crm'` or `'mapping'`, it calls `setNav('dashboard')` — the advisor is never
left on a tab that just vanished from the bar.

### Hiding `ClientContextBar`
`ClientContextBar` (rendered in `App.jsx` just inside `<Shell>`, before the
per-tab screen) is the advisor's own mini-toolbar — next meeting, open task
count, household info, and a shortcut into CRM. All of it is advisor-internal
by the same definition already agreed on. It's wrapped in
`{!clientView && <ClientContextBar .../>}` — hidden entirely, not stripped
down, since every piece of it is internal.

### Toggle UI
A new button in `Shell`'s header, next to the existing theme-toggle/print
buttons (`Shell.jsx`/`Shell.module.css` — same row, same visual weight as
those). Props added to `Shell`: `clientView`, `onToggleClientView`. Icon: an
eye/presentation glyph (SVG, matching the app's existing icon style — no
emoji, per project convention).

### Persistent indicator
While `clientView` is true, the toggle button itself switches to an "active"
visual state (filled/accent background, matching how other active toggles in
the app already look — e.g. the theme toggle's pressed state) so it reads
unambiguously as "still on" from a glance at the header, without adding a
second banner element elsewhere on the page.

## Explicitly out of scope
- No read-only enforcement — client-view hides navigation/chrome only, all
  editing on the visible screens still works exactly as it does today.
- No new "budget vs. actual" presentation screen — the existing
  Expenses/Budget tabs already show this; a bigger/more presentational
  version of them is a separate, later idea if it turns out to be needed
  after using this.
- No change to `ClientList` (the pre-client screen) — client-view only
  applies once a client is selected.
- No URL/query persistence of the mode.

## Testing
- Existing test suite (`npm run test`) must keep passing — no existing
  component's public behavior changes when `clientView` is `false` (the
  default).
- Manual verification via the `vite.audit.config.js` mock harness: toggle on
  from each of the two `tools` tabs (confirm auto-redirect to dashboard),
  confirm `ClientContextBar` disappears, confirm the toggle's active state is
  visually distinct in both light and dark mode, confirm toggling off
  restores everything exactly as before.
