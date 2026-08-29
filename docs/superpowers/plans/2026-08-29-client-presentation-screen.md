# Client Presentation Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new, read-only, per-month "present to client" screen to advisor-app — richer and more visual than the existing print-oriented Report, covering income/expenses vs. budget, subscriptions, fixed expenses, loans/payments (flagging what's finishing this month), goals, and assets — reached via its own icon-rail button.

**Architecture:** A new full-screen component (`Presentation.jsx`), rendered as an `App.jsx`-level takeover exactly like the existing `Report`/`reportMode` pattern (a boolean state that short-circuits the render before the normal `<Shell>` tree). It reads data through the same hooks every other screen already uses (`useClientBudget`, `useAdvisorProfile`) and computes everything from functions that already exist in the codebase — no new data model, no writes.

**Tech Stack:** React (function components, hooks), CSS Modules, Chart.js (already a dependency, used the same way `EconomicMapping.jsx`'s cashflow chart uses it).

**Spec:** `docs/superpowers/specs/2026-08-29-client-presentation-screen-design.md`

## Global Constraints
- No new dependencies.
- No writes/edits on this screen — every value is derived from `data` already fetched by `useClientBudget`; there are no forms, no `save()` calls.
- Hebrew UI copy, RTL-safe, no emoji icons (inline SVG matching the app's existing `svgProps` convention).
- This codebase has no component-rendering test harness (existing `*.test.js` files test pure logic only — see `src/budget/*.test.js`). Do not introduce one for this feature; verify manually via the `vite.audit.config.js` mock harness.
- Empty sections are hidden entirely (matches `Report.jsx`'s `cats.length > 0 && (...)` convention) rather than shown with a placeholder.

---

### Task 1: `Presentation.jsx` + `Presentation.module.css`

**Files:**
- Create: `advisor-app/src/budget/Presentation.jsx`
- Create: `advisor-app/src/budget/Presentation.module.css`

**Interfaces:**
- Consumes: `useClientBudget(clientUserId, advisorId)` (`./useClientBudget.js`, returns `{ data, loading, error, reload }` — same shape `Report.jsx`/`Credit.jsx` already consume), `useAdvisorProfile(advisorId)` (`../auth/useAdvisorProfile.js`, returns `{ profile }` with `display_name`/`logo_url` — same shape `Report.jsx` already consumes), `monthSummary`/`effectiveLimit` (`./budgetMath.js`), `loanPayoffMonths`/`currentInstallments` (exported from `./Credit.jsx`), `monthlyEquivalent` (exported from `./Subscriptions.jsx`), `chartTheme`/`catColor` (`../categories.js`).
- Produces: a default-exported `Presentation` component with props `{ clientUserId, advisorId, year, month, email, onClose }` — this exact prop shape is what Task 2's `App.jsx` wiring renders.

- [ ] **Step 1: Write `Presentation.module.css`**

```css
.page {
  background: var(--bg);
  color: var(--text);
  padding: var(--space-7);
  max-width: 900px;
  margin: 0 auto;
  font-family: var(--font-body);
}

.topBar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: var(--space-4);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  border-bottom: 2px solid var(--border-strong);
  padding-bottom: var(--space-4);
  margin-bottom: var(--space-5);
  animation: riseIn var(--motion) var(--ease-out-expo) both;
}

.titleRow {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.advisorLogo {
  width: 30px;
  height: 30px;
  object-fit: contain;
  border-radius: var(--radius-xs);
}

.title {
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  font-weight: 700;
}

.sub {
  color: var(--text3);
  font-size: var(--text-base);
}

.statsRow {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-4);
  margin-bottom: var(--space-5);
}

@media (max-width: 760px) {
  .statsRow { grid-template-columns: repeat(2, 1fr); }
}

.stat {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-card);
  padding: var(--space-4);
  animation: riseIn var(--motion) var(--ease-out-expo) both;
}

.statLabel { font-size: var(--text-xs); color: var(--text3); margin-bottom: var(--space-1); }
.statValue {
  font-variant-numeric: tabular-nums;
  font-family: var(--font-body);
  font-weight: 700;
  font-size: var(--text-xl);
  direction: ltr;
  unicode-bidi: isolate;
  text-align: right;
}
.net { color: var(--text); }
.income { color: var(--green); }
.expense { color: var(--red); }

.chartCard {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-card);
  padding: var(--space-4);
  margin-bottom: var(--space-5);
  height: 140px;
}

.section {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-card);
  padding: var(--space-5);
  margin-bottom: var(--space-5);
  animation: riseIn var(--motion) var(--ease-out-expo) both;
}

.sectionTitle {
  font-weight: 700;
  font-size: var(--text-lg);
  font-family: var(--font-display);
  margin-bottom: var(--space-4);
}

.barRow { margin-bottom: var(--space-3); }
.barRow:last-child { margin-bottom: 0; }

.barLabelRow {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-sm);
  margin-bottom: 4px;
}

.barLabelName { color: var(--text); font-weight: 500; }
.barLabelValue { color: var(--text3); font-variant-numeric: tabular-nums; direction: ltr; unicode-bidi: isolate; }

.barTrack {
  height: 8px;
  border-radius: var(--radius-xs);
  background: var(--track);
  overflow: hidden;
}

.barFill {
  height: 100%;
  border-radius: var(--radius-xs);
  background: var(--accent);
  transform-origin: right;
  transition: transform 0.4s var(--ease-out-expo);
}

.barFillOver { background: var(--red); }

.listRow {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--border);
  font-size: var(--text-base);
}
.listRow:last-child { border-bottom: none; }

.listName { font-weight: 500; }
.listMeta { color: var(--text3); font-size: var(--text-sm); margin-top: 2px; }
.listAmount { font-variant-numeric: tabular-nums; font-weight: 700; direction: ltr; unicode-bidi: isolate; }

.soonBadge {
  margin-inline-start: var(--space-2);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: 700;
  background: rgba(var(--gold-rgb), 0.12);
  color: var(--gold);
}

@keyframes riseIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
```

- [ ] **Step 2: Write `Presentation.jsx`**

```jsx
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useClientBudget } from './useClientBudget.js';
import { useAdvisorProfile } from '../auth/useAdvisorProfile.js';
import { monthSummary, effectiveLimit } from './budgetMath.js';
import { loanPayoffMonths, currentInstallments } from './Credit.jsx';
import { monthlyEquivalent } from './Subscriptions.jsx';
import { chartTheme } from '../categories.js';
import Logo from '../components/Logo.jsx';
import ErrorState from '../components/ErrorState.jsx';
import Button from '../components/Button.jsx';
import Skeleton from '../components/Skeleton.jsx';
import styles from './Presentation.module.css';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const fmt = n => '₪' + Math.ceil(n).toLocaleString('he-IL');
const MONTH_NAMES = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

function inSelectedMonth(dateStr, year, month) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d.getFullYear() === year && d.getMonth() === month;
}

function Bar1({ label, value, max, over }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className={styles.barRow}>
      <div className={styles.barLabelRow}>
        <span className={styles.barLabelName}>{label}</span>
        <span className={styles.barLabelValue}>{fmt(value)}{max > 0 ? ` / ${fmt(max)}` : ''}</span>
      </div>
      <div className={styles.barTrack}>
        <div className={styles.barFill + (over ? ' ' + styles.barFillOver : '')} style={{ transform: `scaleX(${pct / 100})` }} />
      </div>
    </div>
  );
}

export default function Presentation({ clientUserId, advisorId, year, month, email, onClose }) {
  const { data, loading, error, reload } = useClientBudget(clientUserId, advisorId);
  const { profile } = useAdvisorProfile(advisorId);
  if (error) return <ErrorState onRetry={reload} />;
  if (loading || !data) {
    return (
      <div style={{ padding: 24 }}>
        <Skeleton height="48px" radius="12px" style={{ marginBottom: 20 }} />
        <Skeleton height="200px" radius="14px" />
      </div>
    );
  }

  const summary = monthSummary(data, year, month);
  const cats = Object.keys(data.budgets || {}).filter(c => data.budgets[c]).sort();
  const CT = chartTheme();
  const chartData = {
    labels: ['החודש'],
    datasets: [
      { label: 'הכנסה', data: [summary.income], backgroundColor: CT.green, borderRadius: 5 },
      { label: 'הוצאה', data: [summary.expense], backgroundColor: CT.red, borderRadius: 5 }
    ]
  };

  const subs = (data.subscriptions || []).filter(s => s.active);
  const subsRenewingThisMonth = subs.filter(s => inSelectedMonth(s.nextDate, year, month));

  const fixed = data.fixed_expenses || [];

  const loans = data.loans || [];
  const loansFinishingSoon = loans.filter(l => {
    const n = loanPayoffMonths(l.remaining, l.monthly, l.rate);
    return n !== null && n !== Infinity && n <= 1;
  });

  const payments = data.payments || [];
  const paymentsFinishingSoon = payments.filter(p => {
    const total = parseFloat(p.total) || 0;
    const left = Math.max(0, total - currentInstallments(p, total));
    return total > 0 && left <= 1;
  });

  const goals = data.goals || [];
  const assets = data.assets || [];
  const assetsTotal = assets.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);

  return (
    <div className={styles.page} dir="rtl">
      <div className={styles.topBar}>
        <Button variant="ghost" onClick={onClose}>סגור</Button>
      </div>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          {profile?.logo_url ? <img className={styles.advisorLogo} src={profile.logo_url} alt="" /> : <Logo size="sm" />}
          <div>
            <div className={styles.title}>{profile?.display_name ? `${profile.display_name} · תמונת מצב` : 'תמונת מצב'}</div>
            <div className={styles.sub}>{email}</div>
          </div>
        </div>
        <div className={styles.sub}>{MONTH_NAMES[month]} {year}</div>
      </div>

      <div className={styles.statsRow}>
        <div className={styles.stat}><div className={styles.statLabel}>הכנסות</div><div className={styles.statValue + ' ' + styles.income}>{fmt(summary.income)}</div></div>
        <div className={styles.stat}><div className={styles.statLabel}>הוצאות</div><div className={styles.statValue + ' ' + styles.expense}>{fmt(summary.expense)}</div></div>
        <div className={styles.stat}><div className={styles.statLabel}>מאזן</div><div className={styles.statValue + ' ' + (summary.net < 0 ? styles.expense : styles.net)}>{fmt(summary.net)}</div></div>
      </div>

      <div className={styles.chartCard}>
        <Bar
          data={chartData}
          options={{
            maintainAspectRatio: false,
            indexAxis: 'y',
            animation: ChartJS.defaults.animation === false ? false : { duration: 600, easing: 'easeOutQuart' },
            scales: {
              x: { ticks: { color: CT.text2, font: { family: CT.font } }, grid: { color: CT.border } },
              y: { ticks: { color: CT.text2, font: { family: CT.font } }, grid: { display: false } }
            },
            plugins: { legend: { labels: { color: CT.text2, font: { family: CT.font } } } }
          }}
        />
      </div>

      {cats.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>תקציב מול ביצוע</div>
          {cats.map(c => {
            const limit = effectiveLimit(data, c, year, month);
            const spent = summary.spentByCat[c] || 0;
            return <Bar1 key={c} label={c} value={spent} max={limit} over={limit > 0 && spent > limit} />;
          })}
        </div>
      )}

      {subs.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>מנויים פעילים</div>
          {subs.map(s => (
            <div key={s.id} className={styles.listRow}>
              <div>
                <div className={styles.listName}>{s.name}{subsRenewingThisMonth.includes(s) && <span className={styles.soonBadge}>מתחדש החודש</span>}</div>
              </div>
              <div className={styles.listAmount}>{fmt(monthlyEquivalent(s.cycle, s.amount || 0))}</div>
            </div>
          ))}
        </div>
      )}

      {fixed.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>הוצאות קבועות</div>
          {fixed.map(f => (
            <div key={f.id} className={styles.listRow}>
              <div className={styles.listName}>{f.id}</div>
              <div className={styles.listAmount}>{fmt(f.amount || 0)}</div>
            </div>
          ))}
        </div>
      )}

      {loans.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>הלוואות</div>
          {loans.map(l => (
            <div key={l.id} className={styles.listRow}>
              <div>
                <div className={styles.listName}>{l.name}{loansFinishingSoon.includes(l) && <span className={styles.soonBadge}>מסתיימת בקרוב</span>}</div>
                <div className={styles.listMeta}>{l.lender}</div>
              </div>
              <div className={styles.listAmount}>{fmt(l.monthly || 0)}</div>
            </div>
          ))}
        </div>
      )}

      {payments.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>תשלומים בכרטיס אשראי</div>
          {payments.map(p => (
            <div key={p.id} className={styles.listRow}>
              <div>
                <div className={styles.listName}>{p.name}{paymentsFinishingSoon.includes(p) && <span className={styles.soonBadge}>תשלום אחרון</span>}</div>
              </div>
              <div className={styles.listAmount}>{fmt(p.amount || 0)}</div>
            </div>
          ))}
        </div>
      )}

      {goals.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>יעדי חיסכון</div>
          {goals.map(g => <Bar1 key={g.id} label={g.name} value={g.saved || 0} max={g.target || 0} over={false} />)}
        </div>
      )}

      {assets.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>נכסים <span style={{ color: 'var(--text3)', fontWeight: 400 }}>· סה״כ {fmt(assetsTotal)}</span></div>
          {assets.map(a => (
            <div key={a.id} className={styles.listRow}>
              <div>
                <div className={styles.listName}>{a.name}</div>
                <div className={styles.listMeta}>{a.category}</div>
              </div>
              <div className={styles.listAmount}>{fmt(a.amount || 0)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Build to confirm no syntax/import errors**

Run: `cd advisor-app && npm run build`
Expected: build succeeds. (No dedicated test file for this component — matches the codebase's established convention of testing only pure-logic modules, not component rendering; see Global Constraints.)

- [ ] **Step 4: Commit**

```bash
git add advisor-app/src/budget/Presentation.jsx advisor-app/src/budget/Presentation.module.css
git commit -m "advisor-app: add client presentation screen"
```

---

### Task 2: Wire the screen into the app (icon-rail button → App.jsx takeover)

**Files:**
- Modify: `advisor-app/src/components/IconRail.jsx`
- Modify: `advisor-app/src/components/Shell.jsx`
- Modify: `advisor-app/src/App.jsx`

**Interfaces:**
- Consumes: `Presentation` component from Task 1, with the exact prop shape `{ clientUserId, advisorId, year, month, email, onClose }`.
- Produces: nothing consumed by a later task — this is the last functional task.

- [ ] **Step 1: Add the rail button in `IconRail.jsx`**

Open `advisor-app/src/components/IconRail.jsx`. Change the function signature (line 6) from:
```jsx
export default function IconRail({ onBack, onSearch, onPrint, theme, onToggleTheme }) {
```
to:
```jsx
export default function IconRail({ onBack, onSearch, onPrint, onPresent, theme, onToggleTheme }) {
```

In the `actions` array (starts line 7), add a new entry right after the `onPrint && {...}` entry (before the closing `].filter(Boolean);` on line 26):
```jsx
    onPrint && {
      key: 'report',
      label: 'דוח חודשי',
      onClick: onPrint,
      icon: <svg {...svgProps}><path d="M6 9V2h9l3 3v4M6 18H4a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-2" /><path d="M6 14h12v8H6z" /></svg>
    },
    onPresent && {
      key: 'present',
      label: 'תמונת מצב ללקוח',
      onClick: onPresent,
      icon: <svg {...svgProps}><path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12z" /><circle cx="12" cy="12" r="3.2" /></svg>
    }
```
(This replaces just the `onPrint && {...}` block — add the `onPresent && {...}` block as a new sibling entry right after it, still inside the same array.)

- [ ] **Step 2: Thread the prop through `Shell.jsx`**

Open `advisor-app/src/components/Shell.jsx`. Change the `Shell` function signature (line 110) from:
```jsx
export default function Shell({ title, onBack, nav, activeNav, onNavChange, sidebarInfo, onPrint, onSearch, email, advisorId, theme, onToggleTheme, children }) {
```
to:
```jsx
export default function Shell({ title, onBack, nav, activeNav, onNavChange, sidebarInfo, onPrint, onPresent, onSearch, email, advisorId, theme, onToggleTheme, children }) {
```

Update the with-nav `<IconRail>` call (line 144) from:
```jsx
      <IconRail onBack={onBack} onSearch={onSearch} onPrint={onPrint} theme={theme} onToggleTheme={onToggleTheme} />
```
to:
```jsx
      <IconRail onBack={onBack} onSearch={onSearch} onPrint={onPrint} onPresent={onPresent} theme={theme} onToggleTheme={onToggleTheme} />
```
(Leave the no-nav branch's `<IconRail>` call, line 124, untouched — the client-list screen has no `onPrint` either, so it stays without `onPresent` too, matching the same optional-prop convention.)

- [ ] **Step 3: Add `presentMode` state and the takeover render in `App.jsx`**

Open `advisor-app/src/App.jsx`. Add the import near the other budget-screen imports (after the `Report` import, line 21):
```jsx
import Presentation from './budget/Presentation.jsx';
```

Add state right after the existing `reportMode` state (line 75):
```jsx
  const [reportMode, setReportMode] = useState(false);
  const [presentMode, setPresentMode] = useState(false);
```

Add a takeover render block right after the existing `if (reportMode) { ... }` block (after line 153, before the final `return (`):
```jsx
  if (presentMode) {
    return (
      <>
        <Presentation clientUserId={selectedClient.id} advisorId={session.user.id} year={ym.year} month={ym.month} email={selectedClient.email} onClose={() => setPresentMode(false)} />
        <QuickSwitcher advisorId={session.user.id} onSelect={switchClient} open={searchOpen} onOpenChange={setSearchOpen} />
        <Toaster />
      </>
    );
  }
```

Finally, pass the new handler into the main `<Shell>` call — find `onPrint={() => setReportMode(true)}` (line 164) and add right after it:
```jsx
        onPrint={() => setReportMode(true)}
        onPresent={() => setPresentMode(true)}
```

- [ ] **Step 4: Build to confirm no syntax errors**

Run: `cd advisor-app && npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add advisor-app/src/components/IconRail.jsx advisor-app/src/components/Shell.jsx advisor-app/src/App.jsx
git commit -m "advisor-app: wire client presentation screen into icon rail and app shell"
```

---

### Task 3: Manual verification via the mock harness

**Files:** none modified — verification only.

- [ ] **Step 1: Run the full test suite**

Run: `cd advisor-app && npm run test`
Expected: all existing tests still pass (this feature touches no file any existing test covers, count unchanged).

- [ ] **Step 2: Start the mock-Supabase audit harness**

Run: `cd advisor-app && npx vite --config vite.audit.config.js --port 5186` (background).

- [ ] **Step 3: Verify via Playwright, both themes**

Against `http://localhost:5186/?client=11111111-1111-1111-1111-111111111111&nav=dashboard` (client `CLIENT_A` from `src/__audit/seed.js`, which is seeded with subscriptions, loans, payments, goals, and assets):
1. Confirm a new icon appears in the rail below/near the report icon; click it.
2. Confirm the presentation screen renders: branded header (logo/name), income/expense/net stats, the bar chart, and every populated section (budget-vs-actual bars, subscriptions, fixed expenses, loans, payments, goals, assets) — with no empty section showing.
3. Confirm "סגור" returns to the normal screen with the previous tab still active.
4. Repeat with `localStorage.setItem('advisor_theme','dark')` set before navigating (reload required) — confirm legible in dark mode.
5. Load a client seeded with `active:false`/empty arrays (e.g. `CLIENT_B` or `?data=empty`) and confirm sections with no data are hidden rather than showing empty placeholders.

- [ ] **Step 4: Stop the harness**

Kill only the specific `vite --config vite.audit.config.js --port 5186` process this task started (find its PID via `wmic process where "commandline like '%vite.audit.config%port 5186%'" get processid` on Windows) — never a broad `taskkill /IM node.exe`.

- [ ] **Step 5: Push and confirm CI**

```bash
git push
gh run list --limit 1 --json headSha,status,conclusion
```
Expected: the latest run's `headSha` matches the just-pushed commit and, once `status` is `completed`, `conclusion` is `success`.
