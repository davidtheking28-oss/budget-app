# Advisor App V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `advisor-app/` from a functional V1 into a real advisor console: a sidebar shell, month-aware data screens with trend/insights, roster-level metrics, and an advisor-only CRM (notes/tasks/meetings), plus a printable monthly report and in-app client onboarding.

**Architecture:** All changes live inside `advisor-app/` (React + Vite, no TypeScript, CSS Modules, existing nocturnal-ledger design system in `theme.css`). Three new Supabase tables back the CRM; every other feature reads data already present in `budget_data`/`advisor_clients`. A small set of shared pure modules (`budgetMath.js`, `insights.js`) prevents the four/five screens that need budget totals from each computing them differently.

**Tech Stack:** React 18, `@supabase/supabase-js`, `chart.js` + `react-chartjs-2` (already bundled), no new npm dependencies for this plan.

## Global Constraints

- No TypeScript. Plain `.jsx`/`.js`, CSS Modules, no comments unless explaining a non-obvious workaround.
- No test framework in this project — verification per task is Playwright against the local dev server (`npm run dev` in `advisor-app/`) using scratch mounts and placeholder UUIDs, the same pattern used throughout the V1 plan. Revert every scratch edit to `App.jsx` before committing.
- RTL throughout (`dir="rtl"`); design tokens only from `advisor-app/src/theme.css` — never hardcode a color that already has a token.
- New Supabase tables (`advisor_notes`, `advisor_tasks`, `advisor_meetings`) get RLS scoped to `auth.uid() = advisor_id` for every operation — the client never has any access path. Apply via `mcp__supabase__apply_migration`, never tell the user to paste SQL manually.
- `useClientBudget(clientUserId, advisorId)` already exists (`advisor-app/src/budget/useClientBudget.js`) returning `{data, loading, error, save, reload}` where `save(patch)` upserts `{user_id, updated_by: advisorId, ...patch}`. Do not change its signature or behavior in this plan — build on top of it.
- Budget/expense totals must be computed through `budgetMath.js` (Task 2) everywhere — no screen recomputes "remaining this month" or "over-budget categories" locally after Task 2 lands.
- Every mutating action (add/delete/toggle) shows a toast (Task 4) on success and on error — no silent failures.
- Stop any dev server started for verification via the `TaskStop` tool (never `taskkill`), and never touch unrelated background processes.

---

### Task 1: CRM tables + RLS

**Files:**
- Create: `supabase/migrations/010_advisor_crm.sql`

**Interfaces:**
- Produces: tables `public.advisor_notes` (`id, advisor_id, client_id, body, created_at`), `public.advisor_tasks` (`id, advisor_id, client_id, title, done, due_date, created_at`), `public.advisor_meetings` (`id, advisor_id, client_id, scheduled_at, notes, created_at`). Consumed by Task 13's `useClientCrm` hook and Task 9's roster open-task count.

- [ ] **Step 1: Write and apply the migration**

```sql
create table public.advisor_notes (
  id uuid primary key default gen_random_uuid(),
  advisor_id uuid not null references auth.users(id),
  client_id uuid not null references auth.users(id),
  body text not null,
  created_at timestamptz not null default now()
);
alter table public.advisor_notes enable row level security;
create policy "advisor owns their notes"
  on public.advisor_notes for all
  using (auth.uid() = advisor_id)
  with check (auth.uid() = advisor_id);

create table public.advisor_tasks (
  id uuid primary key default gen_random_uuid(),
  advisor_id uuid not null references auth.users(id),
  client_id uuid not null references auth.users(id),
  title text not null,
  done boolean not null default false,
  due_date date,
  created_at timestamptz not null default now()
);
alter table public.advisor_tasks enable row level security;
create policy "advisor owns their tasks"
  on public.advisor_tasks for all
  using (auth.uid() = advisor_id)
  with check (auth.uid() = advisor_id);

create table public.advisor_meetings (
  id uuid primary key default gen_random_uuid(),
  advisor_id uuid not null references auth.users(id),
  client_id uuid not null references auth.users(id),
  scheduled_at timestamptz not null,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.advisor_meetings enable row level security;
create policy "advisor owns their meetings"
  on public.advisor_meetings for all
  using (auth.uid() = advisor_id)
  with check (auth.uid() = advisor_id);
```

Write this exact SQL to `supabase/migrations/010_advisor_crm.sql`, then call `mcp__supabase__apply_migration` with `name: "advisor_crm"` and this SQL.

- [ ] **Step 2: Verify schema and RLS**

```sql
select table_name, column_name, data_type from information_schema.columns
where table_schema='public' and table_name in ('advisor_notes','advisor_tasks','advisor_meetings')
order by table_name, ordinal_position;
```
Expected: 5 columns for `advisor_notes`, 6 for `advisor_tasks`, 5 for `advisor_meetings`.

```sql
select tablename, policyname, cmd from pg_policies
where tablename in ('advisor_notes','advisor_tasks','advisor_meetings');
```
Expected: exactly 1 `ALL` policy per table, each `using`/`with check` referencing `advisor_id = auth.uid()`.

Then prove isolation with an impersonated query:
```sql
begin;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000099","role":"authenticated"}', true);
set local role authenticated;
insert into public.advisor_notes (advisor_id, client_id, body) values ('00000000-0000-0000-0000-000000000099','00000000-0000-0000-0000-000000000098','test note');
select count(*) from public.advisor_notes where advisor_id='00000000-0000-0000-0000-000000000099';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000097","role":"authenticated"}', true);
select count(*) from public.advisor_notes where advisor_id='00000000-0000-0000-0000-000000000099';
rollback;
```
Expected: the first count is `1` (the inserting advisor sees their own row), the second count is `0` (a different advisor sees nothing) — confirms isolation before rollback discards the test row.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/010_advisor_crm.sql
git commit -m "add advisor_notes/advisor_tasks/advisor_meetings tables with RLS"
```

---

### Task 2: Shared budget math + month arithmetic

**Files:**
- Create: `advisor-app/src/budget/budgetMath.js`
- Modify: `advisor-app/src/budget/monthUtils.js`

**Interfaces:**
- Consumes: `getMonthTx` (existing, `monthUtils.js`).
- Produces: `monthSummary(data, year, month)` → `{income, expense, net, totalBudget, spentByCat, overCats, remaining}` where `overCats` is `[{cat, limit, spent, over}]`. `addMonths(y, m, delta)` → `{year, month}`. Consumed by Task 3 (insights), Task 8 (Dashboard), Task 9 (roster), Task 12 (Budget screen refactor), Task 14 (report).

- [ ] **Step 1: Add `addMonths` to `monthUtils.js`**

Append to the existing file:

```javascript
export function addMonths(y, m, delta) {
  const d = new Date(y, m + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}
```

- [ ] **Step 2: Create `budgetMath.js`**

```javascript
import { getMonthTx } from './monthUtils.js';

export function monthSummary(data, year, month) {
  const monthTx = getMonthTx(data?.transactions, year, month);
  const income = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const budgets = data?.budgets || {};
  const spentByCat = {};
  monthTx.filter(t => t.type === 'expense').forEach(t => {
    spentByCat[t.cat] = (spentByCat[t.cat] || 0) + t.amount;
  });
  const totalBudget = Object.values(budgets).reduce((s, v) => s + (v || 0), 0);
  const overCats = Object.keys(budgets)
    .filter(c => budgets[c] && (spentByCat[c] || 0) > budgets[c])
    .map(c => ({ cat: c, limit: budgets[c], spent: spentByCat[c] || 0, over: (spentByCat[c] || 0) - budgets[c] }));
  const remaining = totalBudget > 0 ? totalBudget - expense : null;
  return { income, expense, net: income - expense, totalBudget, spentByCat, overCats, remaining };
}
```

- [ ] **Step 3: Verify with a scratch script**

Run (from `advisor-app/`):
```bash
node -e "
import('./src/budget/budgetMath.js').then(({ monthSummary }) => {
  const data = { transactions: [
    { type: 'income', cat: 'שכר', desc: 'x', amount: 10000, date: '2026-07-05' },
    { type: 'expense', cat: 'מזון לבית', desc: 'x', amount: 1200, date: '2026-07-10' }
  ], budgets: { 'מזון לבית': 1000 } };
  const s = monthSummary(data, 2026, 6);
  console.log(JSON.stringify(s));
  if (s.income !== 10000 || s.expense !== 1200 || s.overCats.length !== 1 || s.overCats[0].over !== 200) throw new Error('mismatch');
  console.log('OK');
});
"
```
Expected: prints the summary JSON then `OK`. (Node's ESM loader resolves the relative import fine when run from `advisor-app/`; if it errors on module resolution, run with `node --input-type=module -e "..."` instead.)

- [ ] **Step 4: Commit**

```bash
git add advisor-app/src/budget/budgetMath.js advisor-app/src/budget/monthUtils.js
git commit -m "add shared budgetMath module and addMonths helper"
```

---

### Task 3: Auto insights (pure, rule-based)

**Files:**
- Create: `advisor-app/src/budget/insights.js`

**Interfaces:**
- Consumes: `monthSummary` (Task 2), `getMonthTx` (`monthUtils.js`).
- Produces: `computeInsights(data, year, month)` → `[{kind: 'danger'|'warn', text}]`. Consumed by Task 8 (Dashboard) and Task 14 (report).

- [ ] **Step 1: Create `insights.js`**

```javascript
import { getMonthTx } from './monthUtils.js';
import { monthSummary } from './budgetMath.js';

const fmt = n => '₪' + Math.round(n).toLocaleString('he-IL');

export function computeInsights(data, year, month) {
  const insights = [];
  const summary = monthSummary(data, year, month);

  summary.overCats.forEach(o => {
    insights.push({ kind: 'danger', text: `חריגה בקטגוריית ${o.cat} — ${fmt(o.over)} מעבר לתקציב` });
  });

  const now = new Date();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() === month;
  if (isCurrentMonth && now.getDate() > 5 && summary.income === 0) {
    insights.push({ kind: 'warn', text: 'אין הכנסה רשומה החודש' });
  }

  const priorMonths = [1, 2, 3].map(back => {
    const d = new Date(year, month - back, 1);
    return getMonthTx(data?.transactions, d.getFullYear(), d.getMonth()).filter(t => t.type === 'expense');
  });
  Object.keys(summary.spentByCat).forEach(cat => {
    const priorAvg = priorMonths.reduce((s, txs) => s + txs.filter(t => t.cat === cat).reduce((s2, t) => s2 + t.amount, 0), 0) / 3;
    const current = summary.spentByCat[cat];
    if (current > 200 && priorAvg > 0 && current >= priorAvg * 1.5) {
      insights.push({ kind: 'warn', text: `${cat} גבוה ב-${Math.round((current / priorAvg - 1) * 100)}% מהממוצע התלת-חודשי` });
    }
  });

  if (isCurrentMonth && summary.totalBudget > 0) {
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    if (dayOfMonth < daysInMonth) {
      const projected = (summary.expense / dayOfMonth) * daysInMonth;
      if (projected > summary.totalBudget) {
        insights.push({ kind: 'warn', text: `בקצב הנוכחי צפויה חריגה של ${fmt(projected - summary.totalBudget)} עד סוף החודש` });
      }
    }
  }

  return insights;
}
```

- [ ] **Step 2: Verify with a scratch script**

Run (from `advisor-app/`):
```bash
node --input-type=module -e "
import { computeInsights } from './src/budget/insights.js';
const data = { transactions: [
  { type: 'expense', cat: 'מזון לבית', desc: 'x', amount: 1200, date: '2026-07-10' }
], budgets: { 'מזון לבית': 1000 } };
const r = computeInsights(data, 2026, 6);
console.log(JSON.stringify(r));
if (!r.some(i => i.kind === 'danger' && i.text.includes('מזון לבית'))) throw new Error('missing overage insight');
console.log('OK');
"
```
Expected: prints the insights array then `OK`.

- [ ] **Step 3: Commit**

```bash
git add advisor-app/src/budget/insights.js
git commit -m "add rule-based auto insights module"
```

---

### Task 4: Toast notifications

**Files:**
- Create: `advisor-app/src/toast.js`
- Create: `advisor-app/src/components/Toaster.jsx`
- Create: `advisor-app/src/components/Toaster.module.css`
- Modify: `advisor-app/src/App.jsx`

**Interfaces:**
- Produces: `toast(message, kind = 'info')` (kinds: `'success'|'error'|'info'`), `<Toaster />` (mount once). Consumed by every mutating action across Tasks 9, 10, 11, 13.

- [ ] **Step 1: Create `advisor-app/src/toast.js`**

```javascript
let listeners = [];
let idSeq = 0;

export function toast(message, kind = 'info') {
  const id = ++idSeq;
  const item = { id, message, kind };
  listeners.forEach(fn => fn(item));
  return id;
}

export function subscribeToast(fn) {
  listeners.push(fn);
  return () => { listeners = listeners.filter(l => l !== fn); };
}
```

- [ ] **Step 2: Create `advisor-app/src/components/Toaster.module.css`**

```css
.wrap {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 999;
  align-items: center;
}

.toast {
  padding: 12px 20px;
  border-radius: 10px;
  font-family: var(--font-body);
  font-size: 0.86rem;
  font-weight: 500;
  box-shadow: var(--shadow-lift);
  border: 1px solid var(--border-strong);
  background: var(--surface);
  color: var(--text);
  animation: toastIn 0.3s var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1)) both;
}

.success { border-color: rgba(82, 201, 154, 0.4); }
.error { border-color: rgba(232, 117, 106, 0.5); }
.info { border-color: var(--border-strong); }

@keyframes toastIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
```

- [ ] **Step 3: Create `advisor-app/src/components/Toaster.jsx`**

```javascript
import { useEffect, useState } from 'react';
import { subscribeToast } from '../toast.js';
import styles from './Toaster.module.css';

export default function Toaster() {
  const [items, setItems] = useState([]);

  useEffect(() => subscribeToast(item => {
    setItems(prev => [...prev, item]);
    setTimeout(() => setItems(prev => prev.filter(i => i.id !== item.id)), 3200);
  }), []);

  if (!items.length) return null;

  return (
    <div className={styles.wrap} dir="rtl">
      {items.map(i => (
        <div key={i.id} className={styles.toast + ' ' + styles[i.kind]}>{i.message}</div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Mount `<Toaster />` in `App.jsx`**

Read the current `App.jsx` first. Add the import `import Toaster from './components/Toaster.jsx';` and wrap every returned branch so `<Toaster />` renders alongside it (using a fragment). The three existing return points become:

```javascript
  if (!session) return (<><Login /><Toaster /></>);
```

```javascript
  if (!selectedClient) {
    return (
      <>
        <Shell title="לקוחות">
          <ClientList
            advisorId={session.user.id}
            onSelect={(clientId, clientEmail) => setSelectedClient({ id: clientId, email: clientEmail })}
          />
        </Shell>
        <Toaster />
      </>
    );
  }
```

and the final client-view return also wraps its `<Shell>...</Shell>` with a fragment and appends `<Toaster />` after it, keeping everything else in that branch unchanged for now (later tasks will modify this branch further).

- [ ] **Step 5: Verify with Playwright**

Temporarily add a button in a scratch `App.jsx` (`<button onClick={() => toast('בדיקה', 'success')}>t</button>` alongside `<Toaster />`) importing `{ toast }` from `../toast.js` (or `./toast.js` depending on the scratch file's location — place the scratch button directly in `App.jsx` so the import path is `./toast.js`). Run the dev server, navigate, click the button, confirm a toast slides in and disappears after ~3.2s, then revert `App.jsx` to the real Step 4 state.

- [ ] **Step 6: Commit**

```bash
git add advisor-app/src/toast.js advisor-app/src/components/Toaster.jsx advisor-app/src/components/Toaster.module.css advisor-app/src/App.jsx
git commit -m "add toast notification system to advisor-app"
```

---

### Task 5: Skeleton loading + motion/focus tokens

**Files:**
- Create: `advisor-app/src/components/Skeleton.jsx`
- Create: `advisor-app/src/components/Skeleton.module.css`
- Modify: `advisor-app/src/theme.css`

**Interfaces:**
- Produces: `<Skeleton width height radius />` component; CSS custom property `--ease-out-expo`; global `:focus-visible` ring; global `prefers-reduced-motion` override. Consumed by Tasks 8, 9, 13 (loading states) and by every animated component going forward.

- [ ] **Step 1: Add tokens and global rules to `theme.css`**

Add inside the existing `:root { ... }` block (alongside the other custom properties):

```css
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
```

Append these rules after the existing `::selection` block:

```css
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 4px;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 2: Create `advisor-app/src/components/Skeleton.module.css`**

```css
.skeleton {
  background: linear-gradient(90deg, var(--surface) 25%, var(--surface2) 50%, var(--surface) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.6s ease-in-out infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

- [ ] **Step 3: Create `advisor-app/src/components/Skeleton.jsx`**

```javascript
import styles from './Skeleton.module.css';

export default function Skeleton({ width = '100%', height = '16px', radius = '6px', style }) {
  return <div className={styles.skeleton} style={{ width, height, borderRadius: radius, ...style }} />;
}
```

- [ ] **Step 4: Verify with Playwright**

Temporarily mount `<Skeleton width="200px" height="40px" />` in a scratch `App.jsx`, run the dev server, navigate, confirm a shimmering gray block renders and animates (screenshot won't show motion, but confirm via `mcp__playwright__browser_evaluate` that `getComputedStyle` on the element reports a non-`none` `animationName`). Also confirm, via `mcp__playwright__browser_evaluate`, that focusing a button (e.g. `document.querySelector('button')?.focus()`) results in a visible outline (`getComputedStyle(el).outlineStyle !== 'none'`). Revert `App.jsx` afterward.

- [ ] **Step 5: Commit**

```bash
git add advisor-app/src/components/Skeleton.jsx advisor-app/src/components/Skeleton.module.css advisor-app/src/theme.css
git commit -m "add skeleton loading component and motion/focus tokens"
```

---

### Task 6: Count-up number hook

**Files:**
- Create: `advisor-app/src/useCountUp.js`

**Interfaces:**
- Produces: `useCountUp(value, duration = 600)` → `number` (animates from its previous value to `value`, snaps instantly under `prefers-reduced-motion`). Consumed by Task 8 (Dashboard) and Task 9 (roster remaining chip).

- [ ] **Step 1: Create `advisor-app/src/useCountUp.js`**

```javascript
import { useEffect, useRef, useState } from 'react';

export function useCountUp(value, duration = 600) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { setDisplay(value); fromRef.current = value; return; }
    const from = fromRef.current;
    let start = null;
    let raf;
    function step(ts) {
      if (start === null) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (value - from) * eased);
      if (progress < 1) raf = requestAnimationFrame(step);
      else fromRef.current = value;
    }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return display;
}
```

- [ ] **Step 2: Verify with Playwright**

Temporarily mount a scratch component in `App.jsx`:
```javascript
function CountUpDemo() {
  const [v, setV] = useState(0);
  const display = useCountUp(v);
  return <div><div>{Math.round(display)}</div><button onClick={() => setV(1000)}>go</button></div>;
}
```
(with `import { useCountUp } from './useCountUp.js';` and `import { useState } from 'react';` already present). Run the dev server, navigate, click the button, confirm the displayed number animates up toward `1000` rather than jumping instantly (check via `mcp__playwright__browser_evaluate` reading the text content twice ~100ms apart and confirming it changed and is less than 1000 partway through). Revert `App.jsx` afterward.

- [ ] **Step 3: Commit**

```bash
git add advisor-app/src/useCountUp.js
git commit -m "add count-up animation hook"
```

---

### Task 7: Sidebar console shell + month navigation

**Files:**
- Modify: `advisor-app/src/components/Shell.jsx`
- Modify: `advisor-app/src/components/Shell.module.css`
- Create: `advisor-app/src/components/MonthNav.jsx`
- Create: `advisor-app/src/components/MonthNav.module.css`
- Modify: `advisor-app/src/App.jsx`
- Modify: `advisor-app/src/budget/Dashboard.jsx`
- Modify: `advisor-app/src/budget/Expenses.jsx`
- Modify: `advisor-app/src/budget/Budget.jsx`
- Modify: `advisor-app/src/budget/Analysis.jsx`

**Interfaces:**
- Consumes: `addMonths` (Task 2).
- Produces: `Shell` gains a sidebar variant — new props `nav` (array of `{key, label}`), `activeNav`, `onNavChange`, `sidebarInfo` (arbitrary JSX rendered above the nav list); when `nav` is omitted, `Shell` renders exactly as before (roster screen, unaffected). `onBack`/`title`/`children` keep their meaning. `<MonthNav year month onChange email />` — `onChange(delta)` where `delta` is `-1` or `1`; also exposes a "היום" reset via an `onReset` prop. `App.jsx` lifts `{year, month}` state and passes `year`/`month` props to `Dashboard`/`Expenses`/`Budget`/`Analysis`, which stop computing `new Date()` internally and use the passed props instead. Consumed by Tasks 8, 9 (via the new roster/sidebar patterns), 11, 12, 13 (each adds one `nav` entry and one case branch to `App.jsx`).

- [ ] **Step 1: Rewrite `Shell.jsx`**

```javascript
import styles from './Shell.module.css';

export default function Shell({ title, onBack, nav, activeNav, onNavChange, sidebarInfo, children }) {
  if (!nav) {
    return (
      <div className={styles.shell} dir="rtl">
        <div className={styles.topbar}>
          <div className={styles.logo}><span className={styles.logoMark}></span>Budget Advisor</div>
        </div>
        <div className={styles.content}>
          {title && <h1>{title}</h1>}
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.shellSidebar} dir="rtl">
      <aside className={styles.sidebar}>
        <div className={styles.logo}><span className={styles.logoMark}></span>Budget Advisor</div>
        {sidebarInfo}
        <nav className={styles.nav}>
          {nav.map(n => (
            <button
              key={n.key}
              className={styles.navItem + (n.key === activeNav ? ' ' + styles.navItemActive : '')}
              onClick={() => onNavChange(n.key)}
            >
              {n.label}
            </button>
          ))}
        </nav>
        <button className={styles.backButton} onClick={onBack}>← חזרה ללקוחות</button>
      </aside>
      <div className={styles.mainArea}>
        <div className={styles.contentSidebar}>
          {title && <h1>{title}</h1>}
          {children}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add sidebar styles to `Shell.module.css`**

Append to the existing file (the `.shell`/`.topbar`/`.logo`/`.logoMark`/`.content`/`.backButton` rules stay untouched — they still serve the roster screen):

```css
.shellSidebar {
  min-height: 100vh;
  display: flex;
  position: relative;
  z-index: 1;
}

.sidebar {
  width: 264px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 24px 20px;
  background: linear-gradient(180deg, var(--surface), rgba(20, 24, 28, 0.5));
  border-inline-start: 1px solid var(--border);
  min-height: 100vh;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.navItem {
  text-align: right;
  padding: 11px 14px;
  border-radius: 9px;
  border: none;
  background: none;
  color: var(--text3);
  font-family: var(--font-body);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
}

.navItem:hover {
  color: var(--text2);
  background: rgba(255, 255, 255, 0.02);
}

.navItemActive {
  color: var(--text);
  background: var(--accent-dim);
  font-weight: 600;
}

.mainArea {
  flex: 1;
  min-width: 0;
}

.contentSidebar {
  padding: 44px 48px 64px;
  max-width: 980px;
  animation: riseIn 0.5s var(--ease-out-expo) both;
}

.contentSidebar h1 {
  font-size: 1.7rem;
  margin-bottom: 24px;
}
```

- [ ] **Step 3: Create `advisor-app/src/components/MonthNav.module.css`**

```css
.wrap {
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  padding: 16px 0;
  margin: 4px 0;
}

.email {
  font-size: 0.86rem;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 14px;
  word-break: break-word;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.arrow {
  background: none;
  border: 1px solid var(--border-strong);
  color: var(--text2);
  border-radius: 7px;
  width: 28px;
  height: 28px;
  cursor: pointer;
  font-size: 0.8rem;
  transition: border-color 0.2s ease, color 0.2s ease;
}

.arrow:hover {
  border-color: rgba(var(--accent-rgb), 0.5);
  color: var(--accent);
}

.label {
  font-size: 0.84rem;
  color: var(--text2);
  cursor: pointer;
  text-align: center;
  flex: 1;
}
```

- [ ] **Step 4: Create `advisor-app/src/components/MonthNav.jsx`**

```javascript
import styles from './MonthNav.module.css';

const MONTH_NAMES = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

export default function MonthNav({ year, month, onChange, onReset, email }) {
  const now = new Date();
  const isCurrent = year === now.getFullYear() && month === now.getMonth();
  return (
    <div className={styles.wrap}>
      {email && <div className={styles.email}>{email}</div>}
      <div className={styles.row}>
        <button className={styles.arrow} onClick={() => onChange(-1)} aria-label="חודש קודם">▶</button>
        <div className={styles.label} onClick={isCurrent ? undefined : onReset} style={{ cursor: isCurrent ? 'default' : 'pointer' }}>
          {MONTH_NAMES[month]} {year}
        </div>
        <button className={styles.arrow} onClick={() => onChange(1)} aria-label="חודש הבא">◀</button>
      </div>
    </div>
  );
}
```

(Arrows are visually reversed — `▶` moves to the previous month and `◀` to the next — because the layout is RTL: "previous" reads as pointing right, "next" as pointing left, matching how the rest of this RTL app orders temporal/list controls.)

- [ ] **Step 5: Update `Dashboard.jsx`, `Expenses.jsx`, `Budget.jsx`, `Analysis.jsx` to accept `year`/`month` props**

In each of the four files, find the line `const now = new Date();` followed by `getMonthTx(data.transactions, now.getFullYear(), now.getMonth())` (or equivalent). Replace the function signature and that logic:

`Dashboard.jsx` — change:
```javascript
export default function Dashboard({ clientUserId }) {
  const { data, loading } = useClientBudget(clientUserId);
  if (loading || !data) return null;

  const now = new Date();
  const monthTx = getMonthTx(data.transactions, now.getFullYear(), now.getMonth());
```
to:
```javascript
export default function Dashboard({ clientUserId, year, month }) {
  const { data, loading } = useClientBudget(clientUserId);
  if (loading || !data) return null;

  const monthTx = getMonthTx(data.transactions, year, month);
```
(Task 8 rewrites the rest of `Dashboard.jsx`'s body in full — this step only needs to compile with the new signature in the meantime; if easier, do this rename as part of Task 8 instead and skip a separate edit here for `Dashboard.jsx`. For `Expenses.jsx`, `Budget.jsx`, `Analysis.jsx`, apply the equivalent signature/now-removal change now, since those three are not otherwise touched again in this plan.)

`Expenses.jsx` — change the function signature to `export default function Expenses({ clientUserId, advisorId, year, month }) {` and replace `const now = new Date();` plus its `getMonthTx(data.transactions, now.getFullYear(), now.getMonth())` call with `getMonthTx(data.transactions, year, month)`. The "add transaction" `date` field currently uses `now.toISOString().slice(0, 10)` — change this to construct a date within the *selected* month instead: add `const today = new Date(); const isCurrent = year === today.getFullYear() && month === today.getMonth(); const txDate = isCurrent ? today.toISOString().slice(0, 10) : new Date(year, month, 1).toISOString().slice(0, 10);` and use `date: txDate` in the new transaction object — adding an expense while viewing a past month should date it into that month, not today.

`Budget.jsx` — same signature change to `{ clientUserId, advisorId, year, month }`, replace `const now = new Date();` plus its `getMonthTx` call with `getMonthTx(data.transactions, year, month)`.

`Analysis.jsx` — same signature change to `{ clientUserId, year, month }`, replace `const now = new Date();` plus its `getMonthTx` call with `getMonthTx(data.transactions, year, month)`.

- [ ] **Step 6: Rewrite `App.jsx`**

```javascript
import { useState } from 'react';
import { useSession } from './auth/useSession.js';
import Login from './auth/Login.jsx';
import Shell from './components/Shell.jsx';
import Toaster from './components/Toaster.jsx';
import MonthNav from './components/MonthNav.jsx';
import ClientList from './clients/ClientList.jsx';
import Dashboard from './budget/Dashboard.jsx';
import Expenses from './budget/Expenses.jsx';
import Budget from './budget/Budget.jsx';
import Analysis from './budget/Analysis.jsx';
import { addMonths } from './budget/monthUtils.js';

const NAV = [
  { key: 'dashboard', label: 'דשבורד' },
  { key: 'expenses', label: 'הוצאות' },
  { key: 'budget', label: 'תקציב' },
  { key: 'analysis', label: 'ניתוח' }
];

const today = new Date();

export default function App() {
  const { session, loading } = useSession();
  const [selectedClient, setSelectedClient] = useState(null);
  const [nav, setNav] = useState(NAV[0].key);
  const [ym, setYm] = useState({ year: today.getFullYear(), month: today.getMonth() });

  if (loading) return null;
  if (!session) return (<><Login /><Toaster /></>);

  if (!selectedClient) {
    return (
      <>
        <Shell title="לקוחות">
          <ClientList
            advisorId={session.user.id}
            onSelect={(clientId, clientEmail) => {
              setSelectedClient({ id: clientId, email: clientEmail });
              setNav(NAV[0].key);
              setYm({ year: today.getFullYear(), month: today.getMonth() });
            }}
          />
        </Shell>
        <Toaster />
      </>
    );
  }

  const changeMonth = delta => setYm(prev => addMonths(prev.year, prev.month, delta));
  const resetMonth = () => setYm({ year: today.getFullYear(), month: today.getMonth() });

  return (
    <>
      <Shell
        title={NAV.find(n => n.key === nav)?.label}
        onBack={() => setSelectedClient(null)}
        nav={NAV}
        activeNav={nav}
        onNavChange={setNav}
        sidebarInfo={<MonthNav year={ym.year} month={ym.month} onChange={changeMonth} onReset={resetMonth} email={selectedClient.email} />}
      >
        {nav === 'dashboard' && <Dashboard clientUserId={selectedClient.id} year={ym.year} month={ym.month} />}
        {nav === 'expenses' && <Expenses clientUserId={selectedClient.id} advisorId={session.user.id} year={ym.year} month={ym.month} />}
        {nav === 'budget' && <Budget clientUserId={selectedClient.id} advisorId={session.user.id} year={ym.year} month={ym.month} />}
        {nav === 'analysis' && <Analysis clientUserId={selectedClient.id} year={ym.year} month={ym.month} />}
      </Shell>
      <Toaster />
    </>
  );
}
```

- [ ] **Step 7: Verify with Playwright**

Run the dev server, navigate to the roster screen (`http://localhost:5173/budget-app/advisor/` — confirm it's unchanged, still top-bar only, no sidebar). Then temporarily force `selectedClient` to a placeholder (`useState({id:'00000000-0000-0000-0000-000000000000', email:'demo@example.com'})` as the initial state) to reach the sidebar view without auth; screenshot and confirm: right-side sidebar with logo, month nav ("email", month/year label, two arrow buttons), 4 nav items with "דשבורד" active, back button at the bottom, wide content area. Click "הוצאות" and confirm the nav highlight moves and the Expenses screen renders (still empty-state, since the placeholder UUID has no data). Click the "next month" arrow and confirm the month label changes. Revert the placeholder `useState` back to `useState(null)` afterward.

- [ ] **Step 8: Commit**

```bash
git add advisor-app/src/components/Shell.jsx advisor-app/src/components/Shell.module.css advisor-app/src/components/MonthNav.jsx advisor-app/src/components/MonthNav.module.css advisor-app/src/App.jsx advisor-app/src/budget/Dashboard.jsx advisor-app/src/budget/Expenses.jsx advisor-app/src/budget/Budget.jsx advisor-app/src/budget/Analysis.jsx
git commit -m "add sidebar console shell and month navigation"
```

---

### Task 8: Dashboard V2 — trend chart, insights, count-up

**Files:**
- Modify: `advisor-app/src/budget/Dashboard.jsx`
- Modify: `advisor-app/src/budget/Dashboard.module.css`

**Interfaces:**
- Consumes: `monthSummary` (Task 2), `computeInsights` (Task 3), `useCountUp` (Task 6), `Skeleton` (Task 5).
- Produces: nothing new consumed elsewhere — this is the final Dashboard.

- [ ] **Step 1: Rewrite `Dashboard.jsx`**

```javascript
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useClientBudget } from './useClientBudget.js';
import { monthSummary } from './budgetMath.js';
import { computeInsights } from './insights.js';
import { useCountUp } from '../useCountUp.js';
import Skeleton from '../components/Skeleton.jsx';
import styles from './Dashboard.module.css';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

const fmt = n => '₪' + Math.round(n).toLocaleString('he-IL');
const MONTH_SHORT = ['ינו','פבר','מרץ','אפר','מאי','יונ','יול','אוג','ספט','אוק','נוב','דצמ'];

function StatCard({ label, value, kind, glow }) {
  const display = useCountUp(value);
  return (
    <div className={styles.card}>
      <div className={styles.glow + ' ' + styles[glow]}></div>
      <div className={styles.label}>{label}</div>
      <div className={styles.value + ' ' + (kind ? styles[kind] : '')}>{fmt(display)}</div>
    </div>
  );
}

export default function Dashboard({ clientUserId, year, month }) {
  const { data, loading } = useClientBudget(clientUserId);

  if (loading || !data) {
    return (
      <div className={styles.cards}>
        <Skeleton height="112px" radius="16px" />
        <Skeleton height="112px" radius="16px" />
        <Skeleton height="112px" radius="16px" />
      </div>
    );
  }

  const summary = monthSummary(data, year, month);
  const insights = computeInsights(data, year, month);

  const trendMonths = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(year, month - i, 1);
    trendMonths.push({ year: d.getFullYear(), month: d.getMonth() });
  }
  const trendData = trendMonths.map(({ year: y, month: m }) => monthSummary(data, y, m));

  const chartData = {
    labels: trendMonths.map(({ month: m }) => MONTH_SHORT[m]),
    datasets: [
      { label: 'הכנסות', data: trendData.map(s => s.income), backgroundColor: '#52c99a' },
      { label: 'הוצאות', data: trendData.map(s => s.expense), backgroundColor: '#e8756a' }
    ]
  };

  return (
    <div>
      <div className={styles.cards}>
        <StatCard label="הכנסות החודש" value={summary.income} kind="income" glow="glowGreen" />
        <StatCard label="הוצאות החודש" value={summary.expense} kind="expense" glow="glowRed" />
        <StatCard label="מאזן" value={summary.net} kind="net" glow="glowGold" />
      </div>

      {insights.length > 0 && (
        <div className={styles.insights}>
          {insights.map((ins, i) => (
            <div key={i} className={styles.insight + ' ' + styles[ins.kind]}>{ins.text}</div>
          ))}
        </div>
      )}

      <div className={styles.trendWrap}>
        <div className={styles.trendTitle}>מגמת 6 חודשים</div>
        <div className={styles.trendChart}>
          <Bar
            data={chartData}
            options={{
              maintainAspectRatio: false,
              scales: {
                x: { ticks: { color: '#9a9d9f', font: { family: 'Heebo' } }, grid: { display: false } },
                y: { ticks: { color: '#9a9d9f', font: { family: 'Heebo' } }, grid: { color: 'rgba(242,240,234,0.06)' } }
              },
              plugins: { legend: { labels: { color: '#9a9d9f', font: { family: 'Heebo' } } } }
            }}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add insights + trend styles to `Dashboard.module.css`**

Append:

```css
.insights {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 20px;
}

.insight {
  padding: 12px 16px;
  border-radius: 10px;
  font-size: 0.86rem;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.015);
}

.insight.danger { border-color: rgba(232, 117, 106, 0.35); color: var(--red); }
.insight.warn { border-color: rgba(217, 178, 92, 0.35); color: var(--yellow); }

.trendWrap {
  margin-top: 28px;
}

.trendTitle {
  color: var(--text3);
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  margin-bottom: 12px;
}

.trendChart {
  height: 260px;
  background: linear-gradient(165deg, var(--surface), var(--bg-2));
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 20px;
}
```

- [ ] **Step 3: Verify with Playwright**

Scratch-mount `<Dashboard clientUserId="00000000-0000-0000-0000-000000000000" year={2026} month={6} />` in `App.jsx`, run the dev server, navigate, confirm: three skeleton blocks appear briefly then three ₪0 cards, no insights panel (no data means no insights), a 6-month bar chart renders with 6 x-axis labels, no console errors. Revert `App.jsx` afterward.

- [ ] **Step 4: Commit**

```bash
git add advisor-app/src/budget/Dashboard.jsx advisor-app/src/budget/Dashboard.module.css
git commit -m "upgrade dashboard: 6-month trend chart, auto insights, count-up stats"
```

---

### Task 9: Client-list metrics

**Files:**
- Modify: `advisor-app/src/clients/useClientList.js`
- Modify: `advisor-app/src/clients/ClientList.jsx`
- Modify: `advisor-app/src/clients/ClientList.module.css`

**Interfaces:**
- Consumes: `monthSummary` (Task 2), `Skeleton` (Task 5), `useCountUp` (Task 6).
- Produces: `useClientList(advisorId)` now also returns per-client `{remaining, hasOverage, openTasks}` merged into each roster item.

- [ ] **Step 1: Rewrite `useClientList.js`**

```javascript
import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { monthSummary } from '../budget/budgetMath.js';

export function useClientList(advisorId) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!advisorId) return;
    let cancelled = false;
    setLoading(true);

    async function load() {
      const { data: roster, error } = await supabase
        .from('advisor_clients')
        .select('id, client_id, client_email')
        .eq('advisor_id', advisorId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (cancelled) return;
      if (error || !roster || !roster.length) { setClients([]); setLoading(false); return; }

      const clientIds = roster.map(c => c.client_id);
      const now = new Date();

      const [{ data: budgetRows }, { data: taskRows }] = await Promise.all([
        supabase.from('budget_data').select('user_id, transactions, budgets').in('user_id', clientIds),
        supabase.from('advisor_tasks').select('client_id').eq('advisor_id', advisorId).eq('done', false).in('client_id', clientIds)
      ]);

      const budgetByUser = {};
      (budgetRows || []).forEach(r => { budgetByUser[r.user_id] = r; });
      const openTaskCounts = {};
      (taskRows || []).forEach(r => { openTaskCounts[r.client_id] = (openTaskCounts[r.client_id] || 0) + 1; });

      const merged = roster.map(c => {
        const budgetRow = budgetByUser[c.client_id];
        const summary = budgetRow ? monthSummary(budgetRow, now.getFullYear(), now.getMonth()) : null;
        return {
          ...c,
          remaining: summary ? summary.remaining : null,
          hasOverage: summary ? summary.overCats.length > 0 : false,
          openTasks: openTaskCounts[c.client_id] || 0
        };
      });

      if (!cancelled) { setClients(merged); setLoading(false); }
    }

    load();
    return () => { cancelled = true; };
  }, [advisorId]);

  return { clients, loading };
}
```

- [ ] **Step 2: Rewrite `ClientList.jsx`**

```javascript
import { useClientList } from './useClientList.js';
import { useCountUp } from '../useCountUp.js';
import Skeleton from '../components/Skeleton.jsx';
import styles from './ClientList.module.css';

function initials(email) {
  return (email || '?').trim()[0]?.toUpperCase() || '?';
}

const fmt = n => '₪' + Math.round(n).toLocaleString('he-IL');

function RemainingChip({ value }) {
  const display = useCountUp(value ?? 0);
  if (value === null) return null;
  return <div className={styles.remaining}>{fmt(display)} נותר</div>;
}

export default function ClientList({ advisorId, onSelect }) {
  const { clients, loading } = useClientList(advisorId);

  if (loading) {
    return (
      <div className={styles.list}>
        {[0, 1, 2].map(i => (
          <div key={i} className={styles.row}>
            <Skeleton width="42px" height="42px" radius="50%" />
            <Skeleton width="160px" />
          </div>
        ))}
      </div>
    );
  }

  if (!clients.length) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyMark}></div>
        אין עדיין לקוחות מחוברים
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {clients.map((c, i) => (
        <div
          key={c.id}
          className={styles.row}
          style={{ animationDelay: (i * 0.04) + 's' }}
          onClick={() => onSelect(c.client_id, c.client_email)}
        >
          <div className={styles.avatar}>{initials(c.client_email)}</div>
          <div className={styles.info}>
            <div className={styles.email}>{c.client_email}</div>
            <div className={styles.chips}>
              <RemainingChip value={c.remaining} />
              {c.hasOverage && <div className={styles.overageChip}>חריגת תקציב</div>}
              {c.openTasks > 0 && <div className={styles.taskChip}>{c.openTasks} משימות פתוחות</div>}
            </div>
          </div>
          <div className={styles.arrow}>כניסה לתקציב ←</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Add chip styles to `ClientList.module.css`**

Append (and change `.row` to `align-items: center` remains as-is, `.email` stays; add a wrapping `.info` block since the row now has three visual segments):

```css
.info {
  flex: 1;
  min-width: 0;
}

.chips {
  display: flex;
  gap: 8px;
  margin-top: 6px;
  flex-wrap: wrap;
}

.remaining {
  font-size: 0.76rem;
  color: var(--text3);
}

.overageChip, .taskChip {
  font-size: 0.72rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 6px;
}

.overageChip {
  color: var(--red);
  background: rgba(232, 117, 106, 0.12);
}

.taskChip {
  color: var(--gold);
  background: rgba(var(--gold-rgb), 0.12);
}
```

- [ ] **Step 4: Verify with Playwright**

Scratch-mount `<ClientList advisorId="00000000-0000-0000-0000-000000000000" onSelect={() => {}} />`, run the dev server, navigate, confirm: three shimmering skeleton rows appear briefly, then the "אין עדיין לקוחות מחוברים" empty state (that UUID has no roster rows so this is expected — the merged-metrics code path only visibly differs from V1 when there IS a roster, which cannot be exercised without a real advisor session in this sandbox; note this gap in the report). Confirm no console errors either way. Revert `App.jsx` afterward.

- [ ] **Step 5: Commit**

```bash
git add advisor-app/src/clients/useClientList.js advisor-app/src/clients/ClientList.jsx advisor-app/src/clients/ClientList.module.css
git commit -m "add remaining-budget, overage, and open-task metrics to client roster"
```

---

### Task 10: Add client from the advisor app

**Files:**
- Modify: `advisor-app/src/clients/ClientList.jsx`
- Modify: `advisor-app/src/clients/ClientList.module.css`

**Interfaces:**
- Consumes: `toast` (Task 4), the existing `claim_advisor_invite` Postgres RPC (already deployed, takes `p_code text`, returns boolean).
- Produces: nothing new consumed elsewhere.

- [ ] **Step 1: Add the add-client form to `ClientList.jsx`**

Add `useState` import and a `code`/`submitting` state, plus a `claimCode` async function, and render the form above the list. Full updated file:

```javascript
import { useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { useClientList } from './useClientList.js';
import { useCountUp } from '../useCountUp.js';
import Skeleton from '../components/Skeleton.jsx';
import { toast } from '../toast.js';
import styles from './ClientList.module.css';

function initials(email) {
  return (email || '?').trim()[0]?.toUpperCase() || '?';
}

const fmt = n => '₪' + Math.round(n).toLocaleString('he-IL');

function RemainingChip({ value }) {
  const display = useCountUp(value ?? 0);
  if (value === null) return null;
  return <div className={styles.remaining}>{fmt(display)} נותר</div>;
}

export default function ClientList({ advisorId, onSelect }) {
  const { clients, loading } = useClientList(advisorId);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function claimCode() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) { toast('הזן קוד', 'error'); return; }
    setSubmitting(true);
    const { data, error } = await supabase.rpc('claim_advisor_invite', { p_code: trimmed });
    setSubmitting(false);
    if (error || !data) { toast('קוד לא תקין או שכבר נוצל', 'error'); return; }
    toast('הלקוח חובר בהצלחה', 'success');
    setCode('');
  }

  return (
    <div>
      <div className={styles.addForm}>
        <input
          className={styles.addInput}
          placeholder="קוד הזמנה מהלקוח"
          value={code}
          onChange={e => setCode(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && claimCode()}
        />
        <button className={styles.addButton} onClick={claimCode} disabled={submitting}>+ הוסף לקוח</button>
      </div>

      {loading ? (
        <div className={styles.list}>
          {[0, 1, 2].map(i => (
            <div key={i} className={styles.row}>
              <Skeleton width="42px" height="42px" radius="50%" />
              <Skeleton width="160px" />
            </div>
          ))}
        </div>
      ) : !clients.length ? (
        <div className={styles.empty}>
          <div className={styles.emptyMark}></div>
          אין עדיין לקוחות מחוברים
        </div>
      ) : (
        <div className={styles.list}>
          {clients.map((c, i) => (
            <div
              key={c.id}
              className={styles.row}
              style={{ animationDelay: (i * 0.04) + 's' }}
              onClick={() => onSelect(c.client_id, c.client_email)}
            >
              <div className={styles.avatar}>{initials(c.client_email)}</div>
              <div className={styles.info}>
                <div className={styles.email}>{c.client_email}</div>
                <div className={styles.chips}>
                  <RemainingChip value={c.remaining} />
                  {c.hasOverage && <div className={styles.overageChip}>חריגת תקציב</div>}
                  {c.openTasks > 0 && <div className={styles.taskChip}>{c.openTasks} משימות פתוחות</div>}
                </div>
              </div>
              <div className={styles.arrow}>כניסה לתקציב ←</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

Note: reload of the roster after a successful claim happens naturally on the next mount of `ClientList` (the roster screen is re-rendered whenever the user returns to it); if immediate in-place refresh is wanted without navigating away, that would require lifting `useClientList`'s reload out of the effect — out of scope for this task, since navigating back to the roster (already the natural flow) refreshes it.

- [ ] **Step 2: Add form styles to `ClientList.module.css`**

Append:

```css
.addForm {
  display: flex;
  gap: 10px;
  margin-bottom: 8px;
}

.addInput {
  flex: 1;
  padding: 11px 14px;
  border-radius: 9px;
  border: 1px solid var(--border);
  background: rgba(0, 0, 0, 0.2);
  color: var(--text);
  font-family: var(--font-body);
  font-size: 0.86rem;
  outline: none;
  text-transform: uppercase;
}

.addInput:focus {
  border-color: rgba(var(--accent-rgb), 0.5);
}

.addButton {
  padding: 11px 22px;
  border-radius: 9px;
  border: none;
  background: linear-gradient(135deg, var(--accent), #22b3a0);
  color: #06201c;
  font-family: var(--font-body);
  font-weight: 700;
  font-size: 0.86rem;
  cursor: pointer;
  white-space: nowrap;
}

.addButton:disabled {
  opacity: 0.6;
  cursor: default;
}
```

- [ ] **Step 3: Verify with Playwright**

Run the dev server (real auth not needed — no auth-gated `App.jsx` bypass required since this file is reachable via the same scratch-mount technique as Task 9), navigate, confirm the add-client form renders above the list (input + "+ הוסף לקוח" button). Type a clearly-invalid code (`ZZZZZZ`) and click the button; confirm an error toast ("קוד לא תקין או שכבר נוצל") appears (the RPC call will genuinely execute against the live Supabase project and correctly return `false`/no match for a bogus code — this is safe, it cannot claim anything). Revert `App.jsx` afterward if a scratch mount was used.

- [ ] **Step 4: Commit**

```bash
git add advisor-app/src/clients/ClientList.jsx advisor-app/src/clients/ClientList.module.css
git commit -m "add in-app client onboarding via invite code redemption"
```

---

### Task 11: Goals screen

**Files:**
- Create: `advisor-app/src/budget/Goals.jsx`
- Create: `advisor-app/src/budget/Goals.module.css`
- Modify: `advisor-app/src/App.jsx`

**Interfaces:**
- Consumes: `useClientBudget` (existing), `Skeleton` (Task 5).
- Produces: `<Goals clientUserId>`. Adds one `NAV` entry (`{key:'goals', label:'יעדים'}`) and one case branch to `App.jsx`.

- [ ] **Step 1: Create `advisor-app/src/budget/Goals.module.css`**

```css
.list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 8px;
}

.item {
  background: linear-gradient(165deg, var(--surface), var(--bg-2));
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 20px 22px;
  animation: riseIn 0.4s var(--ease-out-expo) both;
}

.top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 12px;
}

.name {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.05rem;
}

.amounts {
  font-size: 0.82rem;
  color: var(--text2);
  direction: ltr;
}

.bar {
  height: 6px;
  border-radius: 3px;
  background: rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent), var(--gold));
  transition: width 0.4s var(--ease-out-expo);
}

.meta {
  margin-top: 8px;
  font-size: 0.78rem;
  color: var(--text3);
}

.empty {
  color: var(--text3);
  text-align: center;
  padding: 100px 0;
  font-size: 0.92rem;
}
```

- [ ] **Step 2: Create `advisor-app/src/budget/Goals.jsx`**

```javascript
import { useClientBudget } from './useClientBudget.js';
import Skeleton from '../components/Skeleton.jsx';
import styles from './Goals.module.css';

const fmt = n => '₪' + Math.round(n).toLocaleString('he-IL');

export default function Goals({ clientUserId }) {
  const { data, loading } = useClientBudget(clientUserId);

  if (loading || !data) {
    return (
      <div className={styles.list}>
        <Skeleton height="90px" radius="14px" />
        <Skeleton height="90px" radius="14px" />
      </div>
    );
  }

  const goals = data.goals || [];
  if (!goals.length) {
    return <div className={styles.empty}>הלקוח עדיין לא הגדיר יעדי חיסכון</div>;
  }

  return (
    <div className={styles.list}>
      {goals.map(g => {
        const pct = g.target ? Math.min(Math.round((g.saved / g.target) * 100), 100) : 0;
        return (
          <div key={g.id} className={styles.item}>
            <div className={styles.top}>
              <div className={styles.name}>{g.name}</div>
              <div className={styles.amounts}>{fmt(g.saved || 0)} / {fmt(g.target || 0)}</div>
            </div>
            <div className={styles.bar}><div className={styles.fill} style={{ width: pct + '%' }} /></div>
            <div className={styles.meta}>{pct}% הושלם{g.months ? ' · יעד ל-' + g.months + ' חודשים' : ''}</div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Wire into `App.jsx`**

Add `{ key: 'goals', label: 'יעדים' }` to the `NAV` array (after the `analysis` entry), add `import Goals from './budget/Goals.jsx';`, and add the render branch:

```javascript
        {nav === 'goals' && <Goals clientUserId={selectedClient.id} />}
```

- [ ] **Step 4: Verify with Playwright**

Scratch-mount `<Goals clientUserId="00000000-0000-0000-0000-000000000000" />`, run the dev server, navigate, confirm two skeleton blocks then the "הלקוח עדיין לא הגדיר יעדי חיסכון" empty state (no goals for that UUID), no console errors. Revert `App.jsx` afterward.

- [ ] **Step 5: Commit**

```bash
git add advisor-app/src/budget/Goals.jsx advisor-app/src/budget/Goals.module.css advisor-app/src/App.jsx
git commit -m "add read-only goals screen to advisor-app"
```

---

### Task 12: Subscriptions & loans screen

**Files:**
- Create: `advisor-app/src/budget/Subscriptions.jsx`
- Create: `advisor-app/src/budget/Subscriptions.module.css`
- Modify: `advisor-app/src/App.jsx`

**Interfaces:**
- Consumes: `useClientBudget` (existing), `Skeleton` (Task 5).
- Produces: `<Subscriptions clientUserId>`. Adds one `NAV` entry (`{key:'subs', label:'מנויים והלוואות'}`) and one case branch to `App.jsx`.

- [ ] **Step 1: Create `advisor-app/src/budget/Subscriptions.module.css`**

```css
.section {
  margin-bottom: 32px;
}

.sectionTitle {
  color: var(--text3);
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  margin-bottom: 12px;
}

.list {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--border);
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 4px;
  border-bottom: 1px solid var(--border);
  animation: riseIn 0.4s var(--ease-out-expo) both;
}

.name {
  font-weight: 500;
}

.meta {
  color: var(--text3);
  font-size: 0.78rem;
  margin-top: 2px;
}

.amount {
  font-family: var(--font-display);
  font-weight: 700;
  direction: ltr;
}

.empty {
  color: var(--text3);
  font-size: 0.86rem;
  padding: 16px 4px;
}
```

- [ ] **Step 2: Create `advisor-app/src/budget/Subscriptions.jsx`**

```javascript
import { useClientBudget } from './useClientBudget.js';
import Skeleton from '../components/Skeleton.jsx';
import styles from './Subscriptions.module.css';

const fmt = n => '₪' + Math.round(n).toLocaleString('he-IL');
const CYCLE_LABELS = { monthly: 'חודשי', yearly: 'שנתי' };

export default function Subscriptions({ clientUserId }) {
  const { data, loading } = useClientBudget(clientUserId);

  if (loading || !data) {
    return (
      <div>
        <Skeleton height="60px" radius="10px" style={{ marginBottom: 10 }} />
        <Skeleton height="60px" radius="10px" />
      </div>
    );
  }

  const subs = data.subscriptions || [];
  const loans = data.loans || [];

  return (
    <div>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>מנויים</div>
        {subs.length ? (
          <div className={styles.list}>
            {subs.map(s => (
              <div key={s.id} className={styles.row}>
                <div>
                  <div className={styles.name}>{s.name}</div>
                  <div className={styles.meta}>{CYCLE_LABELS[s.cycle] || s.cycle}{s.nextDate ? ' · חידוש ' + s.nextDate : ''}</div>
                </div>
                <div className={styles.amount}>{fmt(s.amount || 0)}</div>
              </div>
            ))}
          </div>
        ) : <div className={styles.empty}>אין מנויים רשומים</div>}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>הלוואות</div>
        {loans.length ? (
          <div className={styles.list}>
            {loans.map(l => (
              <div key={l.id} className={styles.row}>
                <div>
                  <div className={styles.name}>{l.name || 'הלוואה'}</div>
                  <div className={styles.meta}>{l.current !== undefined ? 'יתרה ' + fmt(l.current) + ' מתוך ' + fmt(l.total) : ''}</div>
                </div>
                <div className={styles.amount}>{fmt(l.amount || 0)}</div>
              </div>
            ))}
          </div>
        ) : <div className={styles.empty}>אין הלוואות רשומות</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire into `App.jsx`**

Add `{ key: 'subs', label: 'מנויים והלוואות' }` to `NAV` (after `goals`), add `import Subscriptions from './budget/Subscriptions.jsx';`, and add:

```javascript
        {nav === 'subs' && <Subscriptions clientUserId={selectedClient.id} />}
```

- [ ] **Step 4: Verify with Playwright**

Scratch-mount `<Subscriptions clientUserId="00000000-0000-0000-0000-000000000000" />`, run the dev server, navigate, confirm both section empty states render ("אין מנויים רשומים", "אין הלוואות רשומות"), no console errors. Revert `App.jsx` afterward.

- [ ] **Step 5: Commit**

```bash
git add advisor-app/src/budget/Subscriptions.jsx advisor-app/src/budget/Subscriptions.module.css advisor-app/src/App.jsx
git commit -m "add read-only subscriptions and loans screen to advisor-app"
```

---

### Task 13: CRM — notes, tasks, meetings

**Files:**
- Create: `advisor-app/src/crm/useClientCrm.js`
- Create: `advisor-app/src/crm/Crm.jsx`
- Create: `advisor-app/src/crm/Crm.module.css`
- Modify: `advisor-app/src/components/MonthNav.jsx`
- Modify: `advisor-app/src/App.jsx`

**Interfaces:**
- Consumes: `supabase`, `toast` (Task 4).
- Produces: `useClientCrm(advisorId, clientId)` → `{notes, tasks, meetings, loading, addNote, deleteNote, addTask, toggleTask, deleteTask, addMeeting, deleteMeeting}`. `<Crm advisorId clientId>`. Adds one `NAV` entry (`{key:'crm', label:'לקוח'}`) and one case branch to `App.jsx`. `MonthNav` gains an optional `nextMeeting` prop to show the next upcoming meeting date in the sidebar.

- [ ] **Step 1: Create `advisor-app/src/crm/useClientCrm.js`**

```javascript
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { toast } from '../toast.js';

export function useClientCrm(advisorId, clientId) {
  const [notes, setNotes] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!advisorId || !clientId) return;
    setLoading(true);
    const [notesRes, tasksRes, meetingsRes] = await Promise.all([
      supabase.from('advisor_notes').select('*').eq('advisor_id', advisorId).eq('client_id', clientId).order('created_at', { ascending: false }),
      supabase.from('advisor_tasks').select('*').eq('advisor_id', advisorId).eq('client_id', clientId).order('created_at', { ascending: false }),
      supabase.from('advisor_meetings').select('*').eq('advisor_id', advisorId).eq('client_id', clientId).order('scheduled_at', { ascending: true })
    ]);
    setNotes(notesRes.data || []);
    setTasks((tasksRes.data || []).sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1)));
    setMeetings(meetingsRes.data || []);
    setLoading(false);
  }, [advisorId, clientId]);

  useEffect(() => { reload(); }, [reload]);

  async function addNote(body) {
    if (!body.trim()) return;
    const { error } = await supabase.from('advisor_notes').insert({ advisor_id: advisorId, client_id: clientId, body: body.trim() });
    if (error) { toast('שגיאה בשמירת ההערה', 'error'); return; }
    toast('הערה נוספה', 'success');
    reload();
  }

  async function deleteNote(id) {
    const { error } = await supabase.from('advisor_notes').delete().eq('id', id);
    if (error) { toast('שגיאה במחיקה', 'error'); return; }
    setNotes(prev => prev.filter(n => n.id !== id));
  }

  async function addTask(title, dueDate) {
    if (!title.trim()) return;
    const { error } = await supabase.from('advisor_tasks').insert({ advisor_id: advisorId, client_id: clientId, title: title.trim(), due_date: dueDate || null });
    if (error) { toast('שגיאה בהוספת המשימה', 'error'); return; }
    toast('משימה נוספה', 'success');
    reload();
  }

  async function toggleTask(id, done) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done } : t));
    const { error } = await supabase.from('advisor_tasks').update({ done }).eq('id', id);
    if (error) { toast('שגיאה בעדכון המשימה', 'error'); reload(); return; }
    toast(done ? 'משימה סומנה כהושלמה' : 'משימה סומנה כפתוחה', 'success');
  }

  async function deleteTask(id) {
    const { error } = await supabase.from('advisor_tasks').delete().eq('id', id);
    if (error) { toast('שגיאה במחיקה', 'error'); return; }
    setTasks(prev => prev.filter(t => t.id !== id));
  }

  async function addMeeting(scheduledAt, notesText) {
    if (!scheduledAt) return;
    const { error } = await supabase.from('advisor_meetings').insert({ advisor_id: advisorId, client_id: clientId, scheduled_at: scheduledAt, notes: notesText || null });
    if (error) { toast('שגיאה בקביעת הפגישה', 'error'); return; }
    toast('פגישה נקבעה', 'success');
    reload();
  }

  async function deleteMeeting(id) {
    const { error } = await supabase.from('advisor_meetings').delete().eq('id', id);
    if (error) { toast('שגיאה במחיקה', 'error'); return; }
    setMeetings(prev => prev.filter(m => m.id !== id));
  }

  return { notes, tasks, meetings, loading, addNote, deleteNote, addTask, toggleTask, deleteTask, addMeeting, deleteMeeting };
}
```

- [ ] **Step 2: Create `advisor-app/src/crm/Crm.module.css`**

```css
.section {
  margin-bottom: 36px;
}

.sectionTitle {
  color: var(--text3);
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  margin-bottom: 12px;
}

.form {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.input, .textarea {
  padding: 10px 13px;
  border-radius: 9px;
  border: 1px solid var(--border);
  background: rgba(0, 0, 0, 0.2);
  color: var(--text);
  font-family: var(--font-body);
  font-size: 0.85rem;
  outline: none;
}

.input:focus, .textarea:focus {
  border-color: rgba(var(--accent-rgb), 0.5);
}

.textarea {
  flex: 1;
  min-width: 220px;
  resize: vertical;
  min-height: 40px;
}

.button {
  padding: 10px 18px;
  border-radius: 9px;
  border: none;
  background: linear-gradient(135deg, var(--accent), #22b3a0);
  color: #06201c;
  font-weight: 700;
  font-size: 0.84rem;
  cursor: pointer;
  white-space: nowrap;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.015);
  animation: riseIn 0.35s var(--ease-out-expo) both;
}

.taskRow {
  align-items: center;
}

.done {
  opacity: 0.5;
  text-decoration: line-through;
}

.meta {
  color: var(--text3);
  font-size: 0.76rem;
  margin-top: 3px;
}

.del {
  background: none;
  border: none;
  color: var(--text3);
  cursor: pointer;
  font-size: 0.8rem;
  flex-shrink: 0;
}

.del:hover { color: var(--red); }

.checkbox {
  width: 18px;
  height: 18px;
  accent-color: var(--accent);
  cursor: pointer;
  flex-shrink: 0;
}

.taskBody {
  flex: 1;
}

.empty {
  color: var(--text3);
  font-size: 0.84rem;
  padding: 8px 2px;
}
```

- [ ] **Step 3: Create `advisor-app/src/crm/Crm.jsx`**

```javascript
import { useState } from 'react';
import { useClientCrm } from './useClientCrm.js';
import styles from './Crm.module.css';

export default function Crm({ advisorId, clientId }) {
  const { notes, tasks, meetings, loading, addNote, deleteNote, addTask, toggleTask, deleteTask, addMeeting, deleteMeeting } = useClientCrm(advisorId, clientId);
  const [noteBody, setNoteBody] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [meetingAt, setMeetingAt] = useState('');
  const [meetingNotes, setMeetingNotes] = useState('');

  if (loading) return null;

  return (
    <div>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>פגישות</div>
        <div className={styles.form}>
          <input className={styles.input} type="datetime-local" value={meetingAt} onChange={e => setMeetingAt(e.target.value)} />
          <input className={styles.input} placeholder="נושא / הערה" value={meetingNotes} onChange={e => setMeetingNotes(e.target.value)} />
          <button className={styles.button} onClick={() => { addMeeting(meetingAt ? new Date(meetingAt).toISOString() : null, meetingNotes); setMeetingAt(''); setMeetingNotes(''); }}>קבע פגישה</button>
        </div>
        {meetings.length ? (
          <div className={styles.list}>
            {meetings.map(m => (
              <div key={m.id} className={styles.row}>
                <div>
                  <div>{new Date(m.scheduled_at).toLocaleString('he-IL')}</div>
                  {m.notes && <div className={styles.meta}>{m.notes}</div>}
                </div>
                <button className={styles.del} onClick={() => deleteMeeting(m.id)}>✕</button>
              </div>
            ))}
          </div>
        ) : <div className={styles.empty}>אין פגישות מתוזמנות</div>}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>משימות</div>
        <div className={styles.form}>
          <input className={styles.input} placeholder="כותרת המשימה" value={taskTitle} onChange={e => setTaskTitle(e.target.value)} />
          <input className={styles.input} type="date" value={taskDue} onChange={e => setTaskDue(e.target.value)} />
          <button className={styles.button} onClick={() => { addTask(taskTitle, taskDue); setTaskTitle(''); setTaskDue(''); }}>הוסף משימה</button>
        </div>
        {tasks.length ? (
          <div className={styles.list}>
            {tasks.map(t => (
              <div key={t.id} className={styles.row + ' ' + styles.taskRow}>
                <input className={styles.checkbox} type="checkbox" checked={t.done} onChange={e => toggleTask(t.id, e.target.checked)} />
                <div className={styles.taskBody + (t.done ? ' ' + styles.done : '')}>
                  <div>{t.title}</div>
                  {t.due_date && <div className={styles.meta}>יעד: {t.due_date}</div>}
                </div>
                <button className={styles.del} onClick={() => deleteTask(t.id)}>✕</button>
              </div>
            ))}
          </div>
        ) : <div className={styles.empty}>אין משימות</div>}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>הערות</div>
        <div className={styles.form}>
          <textarea className={styles.textarea} placeholder="הערה חדשה על הלקוח" value={noteBody} onChange={e => setNoteBody(e.target.value)} />
          <button className={styles.button} onClick={() => { addNote(noteBody); setNoteBody(''); }}>שמור הערה</button>
        </div>
        {notes.length ? (
          <div className={styles.list}>
            {notes.map(n => (
              <div key={n.id} className={styles.row}>
                <div>
                  <div>{n.body}</div>
                  <div className={styles.meta}>{new Date(n.created_at).toLocaleDateString('he-IL')}</div>
                </div>
                <button className={styles.del} onClick={() => deleteNote(n.id)}>✕</button>
              </div>
            ))}
          </div>
        ) : <div className={styles.empty}>אין הערות</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add `nextMeeting` display to `MonthNav.jsx`**

Modify the component to accept and render an optional `nextMeeting` prop (an ISO string or `null`), shown below the email:

```javascript
import styles from './MonthNav.module.css';

const MONTH_NAMES = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

export default function MonthNav({ year, month, onChange, onReset, email, nextMeeting }) {
  const now = new Date();
  const isCurrent = year === now.getFullYear() && month === now.getMonth();
  return (
    <div className={styles.wrap}>
      {email && <div className={styles.email}>{email}</div>}
      {nextMeeting && <div className={styles.nextMeeting}>📅 {new Date(nextMeeting).toLocaleString('he-IL')}</div>}
      <div className={styles.row}>
        <button className={styles.arrow} onClick={() => onChange(-1)} aria-label="חודש קודם">▶</button>
        <div className={styles.label} onClick={isCurrent ? undefined : onReset} style={{ cursor: isCurrent ? 'default' : 'pointer' }}>
          {MONTH_NAMES[month]} {year}
        </div>
        <button className={styles.arrow} onClick={() => onChange(1)} aria-label="חודש הבא">◀</button>
      </div>
    </div>
  );
}
```

Append to `MonthNav.module.css`:

```css
.nextMeeting {
  font-size: 0.76rem;
  color: var(--gold);
  margin-bottom: 10px;
}
```

- [ ] **Step 5: Wire into `App.jsx`**

Add `{ key: 'crm', label: 'לקוח' }` to `NAV` (last entry), add `import Crm from './crm/Crm.jsx';`, add the render branch:

```javascript
        {nav === 'crm' && <Crm advisorId={session.user.id} clientId={selectedClient.id} />}
```

For the `nextMeeting` sidebar line, this task does not add a live query for it in `App.jsx` (that would duplicate `useClientCrm`'s meetings fetch) — pass `nextMeeting={null}` for now and leave a note that a future task could lift the meetings list up if the sidebar line is wanted without opening the CRM tab first. This is an intentional scope cut, not an oversight: computing it correctly would mean either fetching meetings twice or restructuring where `useClientCrm` lives, both of which are bigger changes than this task's budget.

- [ ] **Step 6: Verify with Playwright**

Scratch-mount `<Crm advisorId="00000000-0000-0000-0000-000000000000" clientId="00000000-0000-0000-0000-000000000001" />` in `App.jsx`, run the dev server, navigate, confirm all three sections render with their forms and empty states ("אין פגישות מתוזמנות", "אין משימות", "אין הערות"). Type a task title, click "הוסף משימה"; confirm either a success toast + new row appears, or an error toast if RLS rejects the unauthenticated write (expected without a real session — note which happened in the report). Revert `App.jsx` afterward.

- [ ] **Step 7: Commit**

```bash
git add advisor-app/src/crm/useClientCrm.js advisor-app/src/crm/Crm.jsx advisor-app/src/crm/Crm.module.css advisor-app/src/components/MonthNav.jsx advisor-app/src/components/MonthNav.module.css advisor-app/src/App.jsx
git commit -m "add CRM tab: notes, tasks, and meetings per client"
```

---

### Task 14: Printable monthly report

**Files:**
- Create: `advisor-app/src/budget/Report.jsx`
- Create: `advisor-app/src/budget/Report.module.css`
- Modify: `advisor-app/src/App.jsx`
- Modify: `advisor-app/src/components/Shell.jsx`
- Modify: `advisor-app/src/components/Shell.module.css`

**Interfaces:**
- Consumes: `monthSummary` (Task 2), `computeInsights` (Task 3), `useClientBudget` (existing).
- Produces: `<Report clientUserId year month email>`. A "דוח חודשי" button in the sidebar (rendered by `Shell` when a new `onPrint` prop is supplied) toggles a `reportMode` boolean in `App.jsx`; when true, `Report` renders instead of the normal nav content, full-bleed, with `window.print()` wired to an in-report button.

- [ ] **Step 1: Create `advisor-app/src/budget/Report.module.css`**

```css
.page {
  background: #fff;
  color: #14181c;
  padding: 48px;
  max-width: 720px;
  margin: 0 auto;
  font-family: var(--font-body);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  border-bottom: 2px solid #14181c;
  padding-bottom: 16px;
  margin-bottom: 24px;
}

.title {
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 700;
}

.sub {
  color: #666;
  font-size: 0.86rem;
}

.statsRow {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 28px;
}

.stat {
  border: 1px solid #ddd;
  border-radius: 10px;
  padding: 14px;
}

.statLabel {
  font-size: 0.74rem;
  color: #666;
  margin-bottom: 6px;
}

.statValue {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.25rem;
  direction: ltr;
  text-align: right;
}

.sectionTitle {
  font-weight: 700;
  font-size: 0.92rem;
  margin: 24px 0 10px;
  border-bottom: 1px solid #ddd;
  padding-bottom: 6px;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.84rem;
}

th, td {
  text-align: right;
  padding: 6px 4px;
  border-bottom: 1px solid #eee;
}

.insight {
  font-size: 0.84rem;
  padding: 6px 0;
  border-bottom: 1px solid #eee;
}

.printButton {
  margin-bottom: 20px;
}

@media print {
  .printButton, .closeButton { display: none !important; }
  .page { padding: 0; max-width: none; }
}
```

- [ ] **Step 2: Create `advisor-app/src/budget/Report.jsx`**

```javascript
import { useClientBudget } from './useClientBudget.js';
import { monthSummary } from './budgetMath.js';
import { computeInsights } from './insights.js';
import styles from './Report.module.css';

const fmt = n => '₪' + Math.round(n).toLocaleString('he-IL');
const MONTH_NAMES = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

export default function Report({ clientUserId, year, month, email, onClose }) {
  const { data, loading } = useClientBudget(clientUserId);
  if (loading || !data) return null;

  const summary = monthSummary(data, year, month);
  const insights = computeInsights(data, year, month);
  const cats = Object.keys(data.budgets || {}).filter(c => data.budgets[c]).sort();

  return (
    <div className={styles.page} dir="rtl">
      <div className={styles.printButton}>
        <button onClick={() => window.print()}>הדפס</button>
        <button className={styles.closeButton} onClick={onClose}>סגור</button>
      </div>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>דוח חודשי</div>
          <div className={styles.sub}>{email}</div>
        </div>
        <div className={styles.sub}>{MONTH_NAMES[month]} {year}</div>
      </div>

      <div className={styles.statsRow}>
        <div className={styles.stat}><div className={styles.statLabel}>הכנסות</div><div className={styles.statValue}>{fmt(summary.income)}</div></div>
        <div className={styles.stat}><div className={styles.statLabel}>הוצאות</div><div className={styles.statValue}>{fmt(summary.expense)}</div></div>
        <div className={styles.stat}><div className={styles.statLabel}>מאזן</div><div className={styles.statValue}>{fmt(summary.net)}</div></div>
      </div>

      {cats.length > 0 && (
        <>
          <div className={styles.sectionTitle}>תקציב מול ביצוע</div>
          <table>
            <thead><tr><th>קטגוריה</th><th>תקציב</th><th>בפועל</th></tr></thead>
            <tbody>
              {cats.map(c => (
                <tr key={c}>
                  <td>{c}</td>
                  <td>{fmt(data.budgets[c])}</td>
                  <td>{fmt(summary.spentByCat[c] || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {insights.length > 0 && (
        <>
          <div className={styles.sectionTitle}>תובנות</div>
          {insights.map((ins, i) => <div key={i} className={styles.insight}>{ins.text}</div>)}
        </>
      )}

      {(data.goals || []).length > 0 && (
        <>
          <div className={styles.sectionTitle}>יעדי חיסכון</div>
          <table>
            <thead><tr><th>יעד</th><th>נחסך</th><th>מטרה</th></tr></thead>
            <tbody>
              {data.goals.map(g => (
                <tr key={g.id}><td>{g.name}</td><td>{fmt(g.saved || 0)}</td><td>{fmt(g.target || 0)}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add a print trigger to `Shell.jsx`**

Modify the sidebar variant to accept an optional `onPrint` prop and render a button for it, placed between `sidebarInfo` and `nav`:

```javascript
export default function Shell({ title, onBack, nav, activeNav, onNavChange, sidebarInfo, onPrint, children }) {
```

and inside the sidebar `<aside>`, right after `{sidebarInfo}`:

```javascript
        {onPrint && <button className={styles.reportButton} onClick={onPrint}>📄 דוח חודשי</button>}
```

Append to `Shell.module.css`:

```css
.reportButton {
  padding: 9px 14px;
  border-radius: 8px;
  border: 1px solid var(--border-strong);
  background: rgba(255, 255, 255, 0.02);
  color: var(--text2);
  font-family: var(--font-body);
  font-size: 0.82rem;
  cursor: pointer;
  text-align: right;
  transition: border-color 0.2s ease, color 0.2s ease;
}

.reportButton:hover {
  border-color: rgba(var(--gold-rgb), 0.5);
  color: var(--gold);
}
```

- [ ] **Step 4: Wire report mode into `App.jsx`**

Add a `reportMode` boolean state and an `onClose` handler; when true, render `<Report>` full-page instead of `<Shell>`:

```javascript
  const [reportMode, setReportMode] = useState(false);
```

and change the final return to:

```javascript
  if (reportMode) {
    return (
      <>
        <Report clientUserId={selectedClient.id} year={ym.year} month={ym.month} email={selectedClient.email} onClose={() => setReportMode(false)} />
        <Toaster />
      </>
    );
  }

  return (
    <>
      <Shell
        title={NAV.find(n => n.key === nav)?.label}
        onBack={() => setSelectedClient(null)}
        nav={NAV}
        activeNav={nav}
        onNavChange={setNav}
        onPrint={() => setReportMode(true)}
        sidebarInfo={<MonthNav year={ym.year} month={ym.month} onChange={changeMonth} onReset={resetMonth} email={selectedClient.email} nextMeeting={null} />}
      >
```

(keep the rest of the `<Shell>` body as Task 13 left it), and add `import Report from './budget/Report.jsx';` at the top.

- [ ] **Step 5: Verify with Playwright**

Scratch-mount `<Report clientUserId="00000000-0000-0000-0000-000000000000" year={2026} month={6} email="demo@example.com" onClose={() => {}} />` in `App.jsx`, run the dev server, navigate, confirm: white page, "דוח חודשי" header, three stat boxes at ₪0, no category/insights/goals sections (none exist for that UUID), "הדפס"/"סגור" buttons render, no console errors. Revert `App.jsx` afterward. Separately, in the full wired app (no scratch mount needed since the button is reachable from the normal sidebar once authenticated — note in the report that the click-through itself can only be exercised with a real session, same known limitation as prior tasks), confirm via code review that `onPrint`/`reportMode` wiring compiles (`npm run build` succeeds).

- [ ] **Step 6: Commit**

```bash
git add advisor-app/src/budget/Report.jsx advisor-app/src/budget/Report.module.css advisor-app/src/App.jsx advisor-app/src/components/Shell.jsx advisor-app/src/components/Shell.module.css
git commit -m "add printable monthly report to advisor-app"
```

---

### Task 15: Consistency pass — skeletons and toasts on remaining screens

**Files:**
- Modify: `advisor-app/src/budget/Expenses.jsx`
- Modify: `advisor-app/src/budget/Budget.jsx`
- Modify: `advisor-app/src/budget/Analysis.jsx`

**Interfaces:**
- Consumes: `Skeleton` (Task 5), `toast` (Task 4).
- Produces: nothing new consumed elsewhere — this is a polish pass so the three screens built before the design-system additions (Tasks 1-6 of this plan came after the original V1 build) match the same loading/feedback conventions as Dashboard, roster, and CRM.

- [ ] **Step 1: Add a loading skeleton to `Expenses.jsx`**

Find `if (loading || !data) return null;` and replace with:

```javascript
  if (loading || !data) {
    return (
      <div>
        <Skeleton height="48px" radius="12px" style={{ marginBottom: 20 }} />
        <Skeleton height="56px" radius="10px" style={{ marginBottom: 8 }} />
        <Skeleton height="56px" radius="10px" />
      </div>
    );
  }
```

Add `import Skeleton from '../components/Skeleton.jsx';` and `import { toast } from '../toast.js';` to the top. In `addTx()`, after the `await save(...)` call, add `toast('הוצאה נוספה', 'success');` (or `'הכנסה נוספה'` when `type === 'income'` — branch on `type` to pick the message). In `removeTx()`, after `await save(...)`, add `toast('נמחק', 'success');`.

- [ ] **Step 2: Add a loading skeleton and toasts to `Budget.jsx`**

Same pattern: replace `if (loading || !data) return null;` with a skeleton block (`<Skeleton height="48px" radius="12px" style={{ marginBottom: 20 }} /><Skeleton height="72px" radius="14px" />`), add the `Skeleton`/`toast` imports, and in `setBudget()` add `toast('תקציב עודכן', 'success');` after the `await save(...)` call.

- [ ] **Step 3: Add a loading skeleton to `Analysis.jsx`**

Replace `if (loading || !data) return null;` with `return <Skeleton height="400px" radius="16px" style={{ maxWidth: 460, margin: '32px auto 0' }} />;` and add the `Skeleton` import.

- [ ] **Step 4: Verify with Playwright**

For each of the three screens, scratch-mount it with a placeholder `clientUserId` (and `advisorId` for `Expenses`/`Budget`), run the dev server, navigate, confirm the skeleton renders (briefly, before the query resolves to empty) with no console errors. For `Expenses` and `Budget`, also add a row/budget as in their original V1 verification and confirm a success toast now appears alongside the existing optimistic UI update. Revert `App.jsx` after each check.

- [ ] **Step 5: Commit**

```bash
git add advisor-app/src/budget/Expenses.jsx advisor-app/src/budget/Budget.jsx advisor-app/src/budget/Analysis.jsx
git commit -m "apply skeleton loading and toast feedback to expenses, budget, and analysis screens"
```

---

### Task 16: Deploy verification

**Files:** none (verification only).

- [ ] **Step 1: Confirm `npm run build` succeeds**

```bash
cd advisor-app && npm run build
```
Expected: succeeds, output lands at `../advisor`.

- [ ] **Step 2: Push and monitor the deploy**

After all prior tasks are committed (this project auto-pushes on commit — confirm via `git status` showing "up to date with origin/main"), confirm the GitHub Actions workflow run succeeds.

- [ ] **Step 3: Verify the deployed app**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://davidtheking28-oss.github.io/budget-app/advisor/
```
Expected: `200`.

```bash
curl -s https://davidtheking28-oss.github.io/budget-app/advisor/ | grep -c "Frank+Ruhl"
```
Expected: non-zero (confirms the deployed bundle is current, not a stale cache).

- [ ] **Step 4: Verify the new CRM tables live**

```sql
select tablename from pg_tables where schemaname='public' and tablename in ('advisor_notes','advisor_tasks','advisor_meetings');
```
Expected: 3 rows.

- [ ] **Step 5: Report to the user**

State the live URL and remind the user that real authenticated verification (logging in, clicking through the sidebar, adding a real note/task/meeting, printing a report) still needs to happen in their own browser — this plan's Playwright verification throughout used placeholder UUIDs and could not exercise a real session, per this project's established environment limitation.
