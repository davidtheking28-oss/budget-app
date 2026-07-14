# Advisor App V2 — Console Shell, Data Depth, Insights & CRM — Design

## Purpose

The advisor app (`advisor-app/`, live at `/advisor/`) shipped as a functional
V1: login → client list → per-client dashboard/expenses/budget/analysis for
the current month, styled with the nocturnal-ledger redesign. It is still
thin as a working tool: the client list shows only emails, every screen is
locked to the current month, the tab layout reads as a website rather than a
professional console, and there is no advisor-side context (notes, tasks,
meetings) anywhere. V2 turns it into a real console, per the original
platform vision (`2026-07-13-advisor-desktop-platform-design.md` Steps 3-4,
minus real AI).

## Scope (V2)

### A. Console shell redesign

1. **Sidebar layout replaces tabs.** Inside a client, a fixed right-side
   sidebar (RTL) carries: the client's identity block (avatar-initial,
   email, "נותר החודש" mini-stat), nav entries — דשבורד, הוצאות, תקציב,
   ניתוח, יעדים, מנויים והלוואות, לקוח (CRM) — and a "חזרה ללקוחות" action
   at the bottom. The content area widens accordingly. The roster screen
   keeps the current top-bar-only layout (no sidebar when no client is
   selected). Same design tokens (`theme.css`), Frank Ruhl Libre display
   numbers, `riseIn` motion.
2. **Loading skeletons** — shimmering placeholder blocks (cards, list rows)
   replace the current blank screens while `useClientBudget`/roster queries
   resolve.
3. **Toasts** — a lightweight toast module (no dependency) confirms every
   mutating action (הוצאה נוספה, משימה סומנה, קוד מומש...) and surfaces
   errors, matching the client app's toast convention.
4. **Micro-animations** — stat numbers count up from 0 on mount
   (requestAnimationFrame, ~600ms, respects `prefers-reduced-motion`);
   hover lifts on cards/rows; animated progress-bar fills.

### B. Data depth (existing data, no schema changes)

5. **Client-list metrics** — each roster row shows "נותר החודש" (total
   effective budget minus month expenses), a warning chip when any budgeted
   category exceeds its limit, and an open-tasks count chip.
6. **Month navigation** — shared month switcher (prev/next chevrons +
   "חודש נוכחי" reset) in the client view, driving all data screens via a
   single `{year, month}` state lifted to `App.jsx`.
7. **6-month trend chart** — Dashboard bar chart (income vs. expenses per
   month, last 6 months ending at the selected month), chart.js (already
   bundled).
8. **Auto insights** — Dashboard panel computed client-side from existing
   data (pure function, no LLM). Initial rules:
   - over-budget categories this month (name + overage amount);
   - a category ≥50% above its 3-month average (and above a ₪200 floor);
   - no income recorded this month (after the 5th);
   - projected month-end spending exceeds total budget mid-month.
9. **Goals screen** — renders `budget_data.goals` (name/target/saved/
   months) as read-only progress bars.
10. **Subscriptions & loans screen** — read-only rendering of
    `budget_data.subscriptions` (name, amount, cycle, next renewal) and
    `budget_data.loans` — completes the client's financial picture. No
    editing in V2.

### C. Advisor workflow (new tables)

11. **CRM screen ("לקוח")** — notes, tasks, and meetings for the selected
    client:
    - `advisor_notes`: free-text note + created_at, newest first, delete.
    - `advisor_tasks`: title + optional due date + done toggle, open first,
      delete.
    - `advisor_meetings`: scheduled_at (datetime) + free-text notes; list
      upcoming first; delete. An upcoming-meeting line (next meeting date)
      also shows in the sidebar identity block.
    - Advisor-only visibility (see Data model). The client never sees these.
12. **Add client from the advisor app** — a "+ הוסף לקוח" action on the
    roster screen opens an inline code-entry field that calls the existing
    `claim_advisor_invite` RPC, refreshes the roster on success, and shows
    a toast. (The client still generates the code in the mobile app; this
    removes the advisor's awkward detour through `index.html` Settings.)
13. **Printable monthly report** — a "דוח חודשי" action inside a client
    view opens a print-oriented layout (dedicated print stylesheet:
    light background, no sidebar/nav) summarizing the selected month:
    income/expense/net, budget-vs-actual table per category, insights list,
    goals progress. Triggered via `window.print()`; no PDF library.

## Non-goals (V2)

- Real AI/LLM insights.
- Editing goals/subscriptions/loans from the advisor app (read-only).
- Budget rollover/carry-forward parity (accepted V1 limitation stands).
- Fixing the multi-writer sync gap (accepted V1 limitation stands).
- Push notifications/reminders for meetings (list + sidebar line only).

## Data model

Three new tables (names per the original platform spec):

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

create table public.advisor_meetings (
  id uuid primary key default gen_random_uuid(),
  advisor_id uuid not null references auth.users(id),
  client_id uuid not null references auth.users(id),
  scheduled_at timestamptz not null,
  notes text,
  created_at timestamptz not null default now()
);
```

RLS on all three: single `FOR ALL` policy `using (auth.uid() = advisor_id)
with check (auth.uid() = advisor_id)`. Applied via Supabase MCP, recorded
as numbered migration files (next free numbers in `supabase/migrations/`).

No changes to `budget_data` or `advisor_clients`.

## Architecture notes

- **Shared budget math**: "נותר החודש" and over-budget detection are needed
  by the roster rows, the sidebar identity block, the Budget screen summary,
  the insights rules, and the printed report. To prevent four drifting
  implementations, a single pure module `budgetMath.js` exposes
  `monthSummary(data, year, month)` → `{income, expense, remaining,
  totalBudget, overCats}` — every consumer uses it; no screen computes
  these numbers locally.
- **Roster metrics**: one batched `.in('user_id', clientIds)` query on
  `budget_data` (RLS already grants advisor read on active clients) + one
  `advisor_tasks` query (`done = false`), grouped in JS. No N+1. Meetings
  are NOT fetched on the roster — they only appear inside a client view,
  where `useClientCrm` loads them anyway.
- **Month state** `{year, month}` lives in `App.jsx`; `monthUtils.js` gains
  `addMonths(y, m, delta)`. Trend chart and insights derive from
  `data.transactions` already loaded by `useClientBudget` — no new fetches
  for section B.
- **Insights**: pure function `computeInsights(data, year, month)` in
  `insights.js` — no hooks inside, testable in isolation; consumes
  `budgetMath.js` for budget/overage numbers rather than recomputing.
- **CRM**: one hook `useClientCrm(advisorId, clientId)` wrapping the three
  tables with list/add/toggle/delete, optimistic updates + toast on
  success/error per the project convention.
- **Toasts**: module-level `toast(msg, kind)` with a `<Toaster>` mounted
  once in `App.jsx` — no context/provider ceremony, no dependency.
- **Sidebar shell**: `Shell.jsx` grows a `sidebar` variant (client selected)
  vs. the existing top-bar-only variant (roster). Nav state replaces the
  `tabs` prop.
- **Print report**: a `Report.jsx` rendered into the normal tree but shown
  via a `@media print` stylesheet + a dedicated "report mode" state; no
  new route, no PDF dependency. It renders from the same
  `monthSummary()`/`computeInsights()` outputs and the same goals data the
  live screens use — zero recomputation or duplicated markup logic.
- **Interaction polish**: one shared easing token (`--ease-out-expo`) and a
  visible `:focus-visible` ring on all interactive elements — keyboard
  navigation looks as deliberate as mouse hover; count-up and skeleton
  animations are skipped under `prefers-reduced-motion`.

## Testing / verification

Per-task Playwright verification against the dev server with scratch mounts
and placeholder UUIDs (established pattern; real authenticated flows remain
manually verified by the user — known environment limitation). RLS on the
three new tables verified via `pg_policies` plus an impersonated
`request.jwt.claims` query proving a non-owner advisor sees zero rows.
Deploy verified live per the project rule.
