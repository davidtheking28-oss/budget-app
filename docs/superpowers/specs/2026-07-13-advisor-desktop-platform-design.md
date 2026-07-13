# Advisor Desktop Platform — Design

## Purpose

The budget app today is mobile-only, single-user. The user is a financial advisor
and wants to work with clients from a computer: (1) a desktop layout of the
existing budget app, and (2) an advisor console to manage multiple clients'
budgets from one place. Inspiration: [velora-finance.com](https://www.velora-finance.com/),
an existing advisor platform (client roster, branded client app, automatic
financial mapping on onboarding, AI insights, task/meeting/notification
management, multi-advisor support).

## Code organization

Single file, logically separated. All advisor-specific code (tables, screens,
CRM, reports) lives in `index.html` alongside the personal-budget code — no
second HTML file, no separate build. Keep it easy to tell the two apart at a
glance: advisor CSS/JS grouped in clearly labeled blocks/sections (e.g. a
`/* ── Advisor console ── */` banner comment and `advisor*`-prefixed function
names), not interleaved line-by-line with personal-budget logic. This mirrors
how Step 1's desktop-layout CSS already lives as one clearly bounded
`@media(min-width:1024px)` block rather than being scattered through the
stylesheet.

## Desktop access is advisor-only (2026-07-13 revision)

Regular clients (non-advisors) always use the mobile UI, even when they open
the app from a desktop browser — the desktop sidebar layout must NOT trigger
for them. Only accounts recognized as advisors get the desktop layout when on
a wide viewport. Both surfaces stay in sync automatically because they read
the same `budget_data` row — there is no separate sync mechanism to build.

**Known gap from Step 1:** the desktop CSS shipped in Step 1 currently
triggers on viewport width alone (`@media(min-width:1024px)`), with no
advisor check — so today, ANY user on a wide browser window sees the sidebar
layout, not just advisors. This must be gated before Step 1 is considered
finished under this revision: the trigger needs to become conditional on
advisor status (e.g. a `body.is-advisor` class set by JS after auth resolves,
combined with the width media query), not width alone. Gating on advisor
status depends on Step 2's `advisor_clients` infrastructure (a way to know
"is this logged-in user an advisor") — until Step 2 exists, there is no
signal to gate on, so this fix is sequenced as part of Step 2, not
retrofitted onto Step 1 in isolation.

## Non-goals (V1)

- Branded/white-labeled client-facing app (Velora does this; noted as a future
  extension, not built now).
- Native desktop app — this stays a responsive web layout of `index.html`.
- Billing/subscription management for the advisor's own business.

## Users

- **Advisor**: uses the desktop layout to manage their own budget AND to view/edit
  clients' budgets, track tasks/meetings/notes per client, see reports.
- **Client**: keeps using the mobile app exactly as today. Gains one new action:
  generate an invite code to link an advisor, same UX as the existing household
  invite flow.

## Architecture

Single `index.html`, same Supabase project, same `budget_data` table and schema.
No parallel app, no new data model for the budget itself.

### 1. Desktop layout (breakpoint ≥1024px)

Reuses the mockup approach the user approved (**Option A**): the bottom nav bar
becomes a right-side sidebar; existing screens (ראשי / הוצאות / תקציב / ניתוח)
get full width with summary cards laid out in a row instead of stacked. Pure
CSS/layout change — no new tables, no new JS data flow. Same categories, same
data as mobile.

### 2. Advisor–client linking

New table `advisor_clients`:

```sql
create table advisor_clients (
  id uuid primary key default gen_random_uuid(),
  advisor_id uuid not null references auth.users(id),
  client_id uuid not null references auth.users(id),
  invite_code text,
  status text not null default 'active', -- 'pending' | 'active' | 'removed'
  created_at timestamptz not null default now()
);
alter table advisor_clients enable row level security;
```

Modeled as an explicit join table (not a 1:1 owner/member row like `households`)
so a client can be linked to more than one advisor later, per Velora's
multi-advisor support — V1 UI only surfaces a single advisor per client, but the
schema doesn't foreclose more.

**Linking flow** mirrors the existing household invite code exactly: client
generates a 6-character code in Settings → "יועץ פיננסי", advisor enters it in
their advisor console → row created with `status='active'`.

**RLS**: advisor can `select`/`update` a client's `budget_data` row only where
an `advisor_clients` row exists with `advisor_id = auth.uid()`,
`client_id = budget_data.user_id`, `status = 'active'`. Same pattern as the
current household RLS, extended to the new join table.

### 3. Advisor console

New sidebar section "יועץ" appears only for users who have at least one row in
`advisor_clients` as advisor. Contains:

- **מסך לקוחות** (approved **Option A — table**): one row per client — name,
  "נשאר החודש", budget overage flags, next meeting date, sortable. Chosen over
  a card grid because it scales to a full book of clients; a card view can be
  added later as an alternate view, not required for V1.
- **Client onboarding**: when a client is newly linked, if their `budget_data`
  is empty/near-empty, show a short guided setup (income, fixed expenses, goals)
  instead of dropping the advisor into a blank budget — mirrors Velora's
  "automatic financial mapping in minutes."
- **Entering a client's budget**: clicking a client loads their `budget_data`
  through the existing `_householdOwner`-style mechanism (reuse `_getDataUserId()`
  indirection, just pointed at the client's `user_id` via the advisor session).
  A persistent top bar reads "אתה צופה בתקציב של <שם> — כל שינוי נשמר אצלם" with
  a return-to-clients action. Permissions: full view + edit, no restrictions.

### 4. Per-client CRM (tasks, meetings, notes)

New tables, advisor-only RLS (`advisor_id = auth.uid()`, never visible to the
client):

```sql
create table advisor_notes (id uuid pk, advisor_id, client_id, body text, created_at);
create table advisor_tasks (id uuid pk, advisor_id, client_id, title text, done bool, due_date date);
create table advisor_meetings (id uuid pk, advisor_id, client_id, scheduled_at timestamptz, notes text);
```

Surfaced both per-client (tab inside a client's view) and as global "משימות" /
"פגישות" screens in the advisor sidebar, aggregating across all clients — this
is the "מערכת ניהול משימות/פגישות" piece from Velora.

### 5. Reports & AI insights

- **Client-facing monthly report**: reuses existing chart/analytics rendering
  (`renderOverview` equivalents) scoped to the client's data, exportable/viewable
  by the advisor.
- **AI insights**: new edge function alongside `parse-expense`/`parse-receipt`,
  same Groq key, same rate-limiting pattern (check `ai_requests` before calling
  out). Runs over a client's `budget_data` and surfaces short flags, e.g. "חרג
  מהתקציב 3 חודשים ברצף בקטגוריית מסעדות" — shown to the advisor, not proactively
  pushed to the client in V1.

### 6. Notifications (advisor channel)

Existing `push_subscriptions`/`push_log` infrastructure gains an advisor-facing
trigger set: meeting reminders, client budget-overage alerts. No new
infrastructure — new server-side triggers into the existing push pipeline.

## Data flow summary

- Budget data itself: unchanged schema, unchanged read/write path
  (`_sb.from('budget_data')...`), only the *scoping* changes (which `user_id` is
  active) based on advisor context instead of household context.
- All new advisor-only data (`advisor_clients`, `advisor_notes`, `advisor_tasks`,
  `advisor_meetings`) is additive — no migration of existing tables.

## Build order

1. Desktop layout (CSS/layout only, no schema changes) — usable immediately,
   independent of everything else.
2. Advisor core: `advisor_clients` + RLS, invite-code linking, client list
   screen, enter/exit a client's budget.
3. Per-client CRM: notes/tasks/meetings tables + screens.
4. Reports + AI insights edge function.

Each step ships and is verifiable independently; later steps don't block on
earlier ones being "perfect."

## Testing

- RLS verified both directions: an advisor with no `advisor_clients` row for a
  given client must get zero rows back from that client's `budget_data`.
- Mobile regression: desktop layout must not change mobile rendering (same
  `index.html`, breakpoint-gated CSS only) — verify existing mobile screenshots
  still match.
- Standard deploy verification per `CLAUDE.md` (`curl` check against GitHub
  Pages after deploy).

## Future extensions (explicitly out of scope now)

- Branded/white-labeled client app per advisor.
- Proactive AI-driven push notifications to clients.
- Card-view alternate layout for the client list.
