# Advisor App V2 — Data Depth, Insights & CRM — Design

## Purpose

The advisor app (`advisor-app/`, live at `/advisor/`) shipped as a functional
V1: login → client list → per-client dashboard/expenses/budget/analysis for
the current month. It looks polished after the nocturnal-ledger redesign but
is thin on advisor-grade substance: the client list shows only emails, every
screen is locked to the current month, and there is no way to record any
advisor-side context about a client. This iteration adds the data depth and
workflow features that make it an actual working tool, per the original
platform vision (`2026-07-13-advisor-desktop-platform-design.md` Steps 3-4,
minus real AI).

## Scope (V2)

1. **Client-list metrics** — each roster row also shows "נותר החודש"
   (total effective budget minus month expenses) and a warning chip when any
   budgeted category is over its limit. Red/neutral state at a glance.
2. **Month navigation** — a shared month switcher (prev/next chevrons +
   "חודש נוכחי" reset) in the client view's Shell area, driving Dashboard,
   Expenses, Budget, and Analysis together via a single `(year, month)`
   state lifted to `App.jsx`.
3. **6-month trend chart** — Dashboard gains a bar chart (income vs.
   expenses per month, last 6 months ending at the selected month), built
   with the already-bundled chart.js.
4. **Auto insights** — Dashboard gains an insights panel computed
   client-side from existing data. No LLM, no edge function. Initial rules:
   - over-budget categories this month (name + overage amount);
   - a category ≥50% higher than its 3-month average (and above a ₪200
     floor, to skip noise);
   - no income recorded this month (after the 5th of the month);
   - spending pace: projected month-end total exceeds total budget while
     it's still mid-month.
5. **Goals tab** — new "יעדים" tab rendering `budget_data.goals`
   (name/target/saved/months, data already exists — read-only progress
   bars; no goal editing in V2).
6. **CRM tab** — new "לקוח" tab per client with notes and tasks:
   - `advisor_notes`: free-text note + created_at, newest first, delete.
   - `advisor_tasks`: title + optional due date + done toggle, open tasks
     first, delete.
   - Advisor-only visibility (see Data model). Client never sees these.
   - Open-task count also surfaces as a small chip on the client-list row.

## Non-goals (V2)

- Real AI/LLM insights (client-side rules only).
- Meetings table (`advisor_meetings` from the original spec) — deferred;
  tasks with due dates cover the near-term need.
- Goal editing from the advisor app (read-only in V2).
- Budget rollover/carry-forward parity — the accepted V1 limitation stands.
- Fixing the multi-writer sync gap (accepted V1 limitation, unchanged).

## Data model

Two new tables (names per the original platform spec):

```sql
create table public.advisor_notes (
  id uuid primary key default gen_random_uuid(),
  advisor_id uuid not null references auth.users(id),
  client_id uuid not null references auth.users(id),
  body text not null,
  created_at timestamptz not null default now()
);

create table public.advisor_tasks (
  id uuid primary key default gen_random_uuid(),
  advisor_id uuid not null references auth.users(id),
  client_id uuid not null references auth.users(id),
  title text not null,
  done boolean not null default false,
  due_date date,
  created_at timestamptz not null default now()
);
```

RLS on both: single `FOR ALL` policy `using (auth.uid() = advisor_id) with
check (auth.uid() = advisor_id)`. The client has no access path at all —
these are the advisor's private working notes. Applied via Supabase MCP,
recorded as numbered migration files (next free numbers in
`supabase/migrations/`).

No changes to `budget_data` or `advisor_clients`.

## Architecture notes

- **Client-list metrics** require each roster row's `budget_data`. One
  batched query — `.in('user_id', clientIds)` on `budget_data` — not N
  queries; RLS already grants the advisor read access to active clients'
  rows. Compute per-client remaining/overage in JS. Open-task counts come
  from one `advisor_tasks` query filtered `done = false`, grouped in JS.
- **Month state** lives in `App.jsx` (`{year, month}`), passed to all four
  screens; `monthUtils.js` gains `addMonths(y, m, delta)`. Insights and the
  trend chart derive from the same `data.transactions` already loaded by
  `useClientBudget` — no new data fetching for features 2-5.
- **Insights** are a pure function `computeInsights(data, year, month)` in
  a new `insights.js` module — testable in isolation, no hooks inside.
- **CRM** gets its own hook (`useClientCrm(advisorId, clientId)`) wrapping
  the two tables with list/add/toggle/delete, optimistic updates matching
  the project's UX convention.
- All new UI follows the existing nocturnal-ledger design system (tokens in
  `theme.css`, CSS Modules per component, `riseIn` animation, Frank Ruhl
  Libre for display numbers).

## Testing / verification

Per-task Playwright verification against the dev server with scratch
mounts and placeholder UUIDs (established pattern; real authenticated
flows remain manually verified by the user — known environment limitation).
RLS on the new tables verified via `pg_policies` and an impersonated
`request.jwt.claims` query. Deploy verified live per the project rule.
