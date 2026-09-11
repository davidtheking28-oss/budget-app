# Advisor Dashboard Density Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining visual/structural gaps between advisor-app's `ClientList`/`IconRail` and the user's structural reference: a welcome header, richer KPI cards (backed by real data only), labeled sidebar groups, and always-visible table row actions.

**Architecture:** Four independent, additive changes to the existing `ClientList`/`IconRail`/`App.jsx`/`useClientList` files from the prior [2026-09-10 restructure](../../superpowers/plans/2026-09-10-advisor-layout-restructure.md) — no new components, no new routes, no new data sources beyond one already-fetched-but-unused column (`advisor_clients.created_at`).

**Tech Stack:** React (no TypeScript), CSS Modules, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-11-advisor-dashboard-density-design.md`

## Global Constraints

- No branding, naming, or color-palette copying from the competitor reference — keep advisor-app's own mint-teal/Assistant-font design system throughout.
- No fabricated data: no "today's tasks" strip and no sparkline/trend graphs — this app has no historical time-series data to back them. The one new stat added (clients created this week) uses a real, already-queried column.
- The "פגישה מיידית" (immediate meeting) button is a visible but `disabled` placeholder with `title="בקרוב"` — no video-call feature exists yet and none is being built here.
- This codebase's `npm run test` (Vitest) is logic-only — no component/DOM-rendering tests exist or should be added. New pure-function logic gets a unit test; UI changes are verified via `npm run lint` + manual visual check (the `verify` skill).
- RTL layout throughout (`dir="rtl"`) — use logical properties (`inset-inline-start`, `margin-inline-start`), never hardcode `left`/`right`.
- Follow existing patterns exactly: reuse the `Button` component for page-level actions (matches the existing empty-state CTA), plain `<button className={styles.x}>` for compact in-table/in-row actions (matches `confirmRemoveBtn`/`cancelRemoveBtn`/`rowRemoveBtn`), and the `StatSecondary`/tone-class pattern already in `ClientList.jsx`/`.module.css` for KPI tiles.

---

### Task 1: Sidebar group-header labels

**Files:**
- Modify: `advisor-app/src/App.jsx` (the `NAV` array, lines 34-47 in the version this plan was written against — match by content)
- Modify: `advisor-app/src/components/IconRail.jsx`
- Modify: `advisor-app/src/components/IconRail.module.css`

**Interfaces:**
- Produces: each `NAV` entry may now carry an optional `groupLabel` string (only the first item of a group needs it — `IconRail` renders it once per group, not per item).
- `IconRail`'s own external prop signature is unchanged.

- [ ] **Step 1: Add `groupLabel` to `App.jsx`'s `NAV` array, and merge `crm`/`mapping` into the `overview` group**

In `advisor-app/src/App.jsx`, replace the `NAV` array and the comment above it:

```jsx
// `group` drives the section boundary IconRail renders between clusters, and
// `groupLabel` (set once, on a group's first item) is the text IconRail shows
// there — not a data model, just enough to tell the advisor "overview, then
// the financial detail tabs" at a glance in the sidebar.
const NAV = [
  { key: 'dashboard', label: 'דשבורד', group: 'overview', groupLabel: 'סקירה', icon: <svg {...svgProps}><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="5" rx="1.5" /><rect x="13" y="12" width="8" height="9" rx="1.5" /><rect x="3" y="15" width="8" height="6" rx="1.5" /></svg> },
  { key: 'crm', label: 'לקוח', group: 'overview', icon: <svg {...svgProps}><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.5-6.5 8-6.5s8 2.5 8 6.5" /></svg> },
  { key: 'mapping', label: 'מיפוי כלכלי', group: 'overview', icon: <svg {...svgProps}><path d="M4 4h16v16H4z" /><path d="M4 9h16M9 9v11" /></svg> },
  { key: 'budget', label: 'תקציב', group: 'money', groupLabel: 'כספים', icon: <svg {...svgProps}><circle cx="12" cy="12" r="9" /><path d="M12 3v9l6 3.5" /></svg> },
  { key: 'analysis', label: 'ניתוח', group: 'money', icon: <svg {...svgProps}><path d="M4 20V10M12 20V4M20 20v-7" /></svg> },
  { key: 'goals', label: 'יעדים', group: 'money', icon: <svg {...svgProps}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="0.8" fill="currentColor" /></svg> },
  { key: 'subs', label: 'מנויים', group: 'money', icon: <svg {...svgProps}><rect x="2.5" y="5" width="19" height="14" rx="2" /><path d="M2.5 10h19" /></svg> },
  { key: 'credit', label: 'הלוואות ואשראי', group: 'money', icon: <svg {...svgProps}><circle cx="12" cy="12" r="9" /><path d="M12 3v9l6 3.5" /></svg> },
  { key: 'assets', label: 'נכסים והתחייבויות', group: 'money', icon: <svg {...svgProps}><path d="M3 21h18" /><path d="M5 21V9l7-5 7 5v12" /><path d="M10 21v-6h4v6" /></svg> }
];
```

(Only the `group` value of the `crm` and `mapping` entries changed, from `'tools'` to `'overview'`, plus the two new `groupLabel` fields — every icon/label/key stays exactly as it was.)

- [ ] **Step 2: Render group labels instead of bare dividers in `IconRail.jsx`**

In `advisor-app/src/components/IconRail.jsx`, replace the `nav` rendering block and the trailing-actions divider:

```jsx
        {nav && nav.map((n, i) => {
          const groupStart = i === 0 || n.group !== nav[i - 1].group;
          return [
            groupStart && n.groupLabel
              ? <div key={n.key + '-label'} className={styles.groupLabel} aria-hidden="true">{n.groupLabel}</div>
              : (groupStart && i > 0 ? <span key={n.key + '-div'} className={styles.divider} aria-hidden="true" /> : null),
            <button
              key={n.key}
              type="button"
              className={styles.railBtn + (n.key === activeNav ? ' ' + styles.railBtnActive : '')}
              onClick={() => onNavChange(n.key)}
              aria-label={n.label}
              aria-current={n.key === activeNav ? 'page' : undefined}
            >
              {n.icon}
              <span className={styles.label}>{n.label}</span>
            </button>
          ];
        })}

        {nav && nav.length > 0 && trailingActions.length > 0 && <div className={styles.groupLabel} aria-hidden="true">כלים</div>}
```

This replaces the two blocks currently reading:

```jsx
        {nav && nav.map((n, i) => [
          i > 0 && n.group && n.group !== nav[i - 1].group
            ? <span key={n.key + '-div'} className={styles.divider} aria-hidden="true" />
            : null,
          <button
            key={n.key}
            type="button"
            className={styles.railBtn + (n.key === activeNav ? ' ' + styles.railBtnActive : '')}
            onClick={() => onNavChange(n.key)}
            aria-label={n.label}
            aria-current={n.key === activeNav ? 'page' : undefined}
          >
            {n.icon}
            <span className={styles.label}>{n.label}</span>
          </button>
        ])}

        {nav && nav.length > 0 && trailingActions.length > 0 && <span className={styles.divider} aria-hidden="true" />}
```

(The divider before `nav` starts, between `globalActions` and the first nav group, is untouched — it stays a bare `<span className={styles.divider} />`, since the global-actions cluster has no label per the design.)

- [ ] **Step 3: Add the `.groupLabel` rule to `IconRail.module.css`**

Add this rule (placed right after the existing `.divider` rule):

```css
.groupLabel {
  padding: var(--space-3) var(--space-3) var(--space-1);
  color: var(--text3);
  font-size: var(--text-xs);
  font-weight: 700;
}
```

And inside the existing `@media (max-width: 860px)` block, add (next to the existing `.label { display: none; }` rule):

```css
  .groupLabel { display: none; }
```

- [ ] **Step 4: Verify**

Run: `cd advisor-app && npm run lint`
Expected: passes (no undefined CSS-module classes — `groupLabel` is now defined and referenced consistently; no ESLint errors).

- [ ] **Step 5: Commit**

```bash
git add advisor-app/src/App.jsx advisor-app/src/components/IconRail.jsx advisor-app/src/components/IconRail.module.css
git commit -m "Add group-header labels to the sidebar

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Select `created_at` in `useClientList`

**Files:**
- Modify: `advisor-app/src/clients/useClientList.js`

**Interfaces:**
- Produces: each object in the `clients` array returned by `useClientList` now also has a `createdAt` field (ISO string or `null`), alongside the existing `remaining`/`hasOverage`/etc. fields.

- [ ] **Step 1: Select `created_at` and return it as `createdAt`**

In `advisor-app/src/clients/useClientList.js`, change:

```js
    const { data: roster, error } = await supabase
      .from('advisor_clients')
      .select('id, client_id, client_email')
      .eq('advisor_id', advisorId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });
```

to:

```js
    const { data: roster, error } = await supabase
      .from('advisor_clients')
      .select('id, client_id, client_email, created_at')
      .eq('advisor_id', advisorId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });
```

Then in the `merged` map, change:

```js
        updatedAt: budgetRow?.updated_at || null
      };
    });
```

to:

```js
        updatedAt: budgetRow?.updated_at || null,
        createdAt: c.created_at || null
      };
    });
```

- [ ] **Step 2: Verify**

Run: `cd advisor-app && npm run lint`
Expected: passes.

Run: `cd advisor-app && npm run test`
Expected: 81/81 passing (no test currently covers this hook directly; this is a pure regression check).

- [ ] **Step 3: Commit**

```bash
git add advisor-app/src/clients/useClientList.js
git commit -m "Select created_at in useClientList

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Welcome header + KPI card restyle

**Files:**
- Create: `advisor-app/src/clients/clientStats.js`
- Create: `advisor-app/src/clients/clientStats.test.js`
- Modify: `advisor-app/src/clients/ClientList.jsx`
- Modify: `advisor-app/src/clients/ClientList.module.css`
- Modify: `advisor-app/src/App.jsx` (pass one new prop into `ClientList`)

**Interfaces:**
- Consumes: `createdAt` field on each client object, produced by Task 2's `useClientList`.
- Produces: `countNewThisWeek(clients, now = Date.now())` — a pure function in `clientStats.js`, exported, taking the `clients` array and returning a number. `ClientList` now accepts a new prop `advisorEmail` (string).

- [ ] **Step 1: Write the failing test for `countNewThisWeek`**

Create `advisor-app/src/clients/clientStats.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { countNewThisWeek } from './clientStats.js';

describe('countNewThisWeek', () => {
  it('counts only clients created within the last 7 days', () => {
    const now = new Date('2026-09-11T12:00:00Z').getTime();
    const clients = [
      { createdAt: new Date('2026-09-10T12:00:00Z').toISOString() }, // 1 day ago
      { createdAt: new Date('2026-09-01T12:00:00Z').toISOString() }, // 10 days ago
      { createdAt: null }
    ];
    expect(countNewThisWeek(clients, now)).toBe(1);
  });

  it('returns 0 for an empty list', () => {
    expect(countNewThisWeek([], Date.now())).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd advisor-app && npx vitest run src/clients/clientStats.test.js`
Expected: FAIL — `Cannot find module './clientStats.js'` (the file doesn't exist yet).

- [ ] **Step 3: Implement `countNewThisWeek`**

Create `advisor-app/src/clients/clientStats.js`:

```js
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function countNewThisWeek(clients, now = Date.now()) {
  return clients.filter(c => c.createdAt && (now - new Date(c.createdAt).getTime()) < WEEK_MS).length;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd advisor-app && npx vitest run src/clients/clientStats.test.js`
Expected: PASS, 2/2.

- [ ] **Step 5: Add `advisorEmail` prop in `App.jsx`**

In `advisor-app/src/App.jsx`, change:

```jsx
        <Shell title="לוח בקרה" email={session.user.email} advisorId={session.user.id} onSearch={() => setSearchOpen(true)} theme={theme} onToggleTheme={toggleTheme}>
          <ClientList advisorId={session.user.id} onSelect={switchClient} />
        </Shell>
```

to:

```jsx
        <Shell title="לוח בקרה" email={session.user.email} advisorId={session.user.id} onSearch={() => setSearchOpen(true)} theme={theme} onToggleTheme={toggleTheme}>
          <ClientList advisorId={session.user.id} advisorEmail={session.user.email} onSelect={switchClient} />
        </Shell>
```

- [ ] **Step 6: Add the welcome header and restyle the KPI row in `ClientList.jsx`**

At the top of `advisor-app/src/clients/ClientList.jsx`, add two imports (next to the existing ones):

```jsx
import { useAdvisorProfile } from '../auth/useAdvisorProfile.js';
import { countNewThisWeek } from './clientStats.js';
```

Remove the `StatMain` component entirely (it becomes unused by this task — its one caller is replaced in Step 6 below):

```jsx
function StatMain({ value }) {
  const display = useCountUp(value);
  return <div className={styles.statMainValue}>{Math.round(display)}</div>;
}
```

Add a new icon constant next to the existing `ICON_USERS`/`ICON_ALERT`/`ICON_CHECKLIST`/`ICON_FUNNEL` constants:

```jsx
const ICON_NEW = (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" />
  </svg>
);
```

Add a `greetingText()` helper function next to `byUrgency`/`urgencyRank`:

```jsx
function greetingText() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'בוקר טוב';
  if (h >= 12 && h < 18) return 'צהריים טובים';
  return 'ערב טוב';
}
```

Change the component signature and add the profile hook + new-this-week count. Change:

```jsx
export default function ClientList({ advisorId, onSelect }) {
  const { clients, loading, error, reload } = useClientList(advisorId);
```

to:

```jsx
export default function ClientList({ advisorId, advisorEmail, onSelect }) {
  const { clients, loading, error, reload } = useClientList(advisorId);
  const { profile } = useAdvisorProfile(advisorId);
  const advisorName = profile?.display_name || advisorEmail?.split('@')[0] || '';
```

Change the KPI-numbers block. Change:

```jsx
  const overageCount = clients.filter(c => c.hasOverage).length;
  const overageAmountTotal = clients.reduce((s, c) => s + (c.overageAmount || 0), 0);
  const openTasksTotal = clients.reduce((s, c) => s + c.openTasks, 0);
```

to:

```jsx
  const overageCount = clients.filter(c => c.hasOverage).length;
  const overageAmountTotal = clients.reduce((s, c) => s + (c.overageAmount || 0), 0);
  const openTasksTotal = clients.reduce((s, c) => s + c.openTasks, 0);
  const newThisWeek = countNewThisWeek(clients);
```

Replace the welcome-header-less opening of the returned JSX and the `.statBar` block. Change:

```jsx
      {/* A brand-new advisor has nothing to count, and three zeroes are the first
          thing they would otherwise see. Let the empty state be the whole page —
          unless they already have pipeline prospects, whose only access point is
          this bar's KPI tile. */}
      {(clients.length > 0 || leads.length > 0) && (
        <div className={styles.statBar}>
          <div className={styles.statMain}>
            <span className={styles.statIcon + ' ' + styles.statAccentIcon}>{ICON_USERS}</span>
            <div className={styles.statSecondaryBody}>
              <StatMain value={clients.length} />
              <div className={styles.statMainLabel}>לקוחות פעילים</div>
            </div>
          </div>
          <div className={styles.statDivider}></div>
          <StatSecondary label="חריגות תקציב החודש" value={overageCount} tone={overageCount > 0 ? 'statRed' : undefined} icon={ICON_ALERT} />
          {overageAmountTotal > 0 && (
            <StatSecondary label="סה״כ חריגה בכסף" value={overageAmountTotal} tone="statRed" icon={ICON_ALERT} format={fmt} />
          )}
          <StatSecondary label="משימות פתוחות" value={openTasksTotal} tone={openTasksTotal > 0 ? 'statGold' : undefined} icon={ICON_CHECKLIST} />
          <StatSecondary label="לקוחות חדשים בטיפול" value={leads.length} icon={ICON_FUNNEL} onClick={() => setPipelineOpen(true)} />
        </div>
      )}
```

to:

```jsx
      {/* A brand-new advisor has nothing to count, and three zeroes are the first
          thing they would otherwise see. Let the empty state be the whole page —
          unless they already have pipeline prospects, whose only access point is
          this bar's KPI tile. */}
      {(clients.length > 0 || leads.length > 0) && (
        <>
          <div className={styles.welcomeHeader}>
            <div className={styles.welcomeGreeting}>{greetingText()}{advisorName ? `, ${advisorName}` : ''}</div>
            <div className={styles.welcomeActions}>
              <Button onClick={() => { emailInputRef.current?.scrollIntoView({ block: 'center' }); emailInputRef.current?.focus(); }}>לקוח חדש +</Button>
              <Button variant="ghost" disabled title="בקרוב">פגישה מיידית</Button>
            </div>
          </div>
          <div className={styles.statBar}>
            <StatSecondary label="לקוחות פעילים" value={clients.length} tone="statAccent" icon={ICON_USERS} />
            <StatSecondary label="חריגות תקציב החודש" value={overageCount} tone={overageCount > 0 ? 'statRed' : undefined} icon={ICON_ALERT} />
            {overageAmountTotal > 0 && (
              <StatSecondary label="סה״כ חריגה בכסף" value={overageAmountTotal} tone="statRed" icon={ICON_ALERT} format={fmt} />
            )}
            <StatSecondary label="משימות פתוחות" value={openTasksTotal} tone={openTasksTotal > 0 ? 'statGold' : undefined} icon={ICON_CHECKLIST} />
            <StatSecondary label="לקוחות חדשים בטיפול" value={leads.length} icon={ICON_FUNNEL} onClick={() => setPipelineOpen(true)} />
            <StatSecondary label="לקוחות חדשים השבוע" value={newThisWeek} icon={ICON_NEW} />
          </div>
        </>
      )}
```

- [ ] **Step 7: Update `ClientList.module.css`**

Add these two rules (placed right before the existing `.statBar` rule):

```css
.welcomeHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
  margin-top: var(--space-2);
}

.welcomeGreeting {
  font-family: var(--font-display);
  font-size: var(--text-display-sm);
  font-weight: 700;
}

.welcomeActions {
  display: flex;
  gap: var(--space-3);
}
```

Change the existing combined selectors that mixed `.statMain` in with `.statSecondary`. Change:

```css
.statMain, .statSecondary {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  transition: border-color .25s ease, transform .25s var(--ease-out-expo);
}

.statMain:hover, .statSecondary:hover { border-color: var(--border-strong); transform: translateY(-2px); }
```

to:

```css
.statSecondary {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  transition: border-color .25s ease, transform .25s var(--ease-out-expo);
}

.statSecondary:hover { border-color: var(--border-strong); transform: translateY(-2px); }
```

Change:

```css
.statIcon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text3);
  background: var(--hover);
}

.statAccentIcon { color: var(--accent); background: var(--accent-dim); }
.statIcon.statRed { color: var(--red); background: rgba(var(--red-rgb), 0.10); }
.statIcon.statGold { color: var(--gold); background: rgba(var(--gold-rgb), 0.10); }
```

to:

```css
.statIcon {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text3);
  background: var(--hover);
}

.statIcon.statAccent { color: var(--accent); background: var(--accent-dim); }
.statIcon.statRed { color: var(--red); background: rgba(var(--red-rgb), 0.10); }
.statIcon.statGold { color: var(--gold); background: rgba(var(--gold-rgb), 0.10); }
```

(`.statAccentIcon` is renamed to `.statIcon.statAccent`, matching the compound-selector pattern the red/gold tones already use, since it's now passed through `StatSecondary`'s `tone` prop like the others instead of being hardcoded inline.)

Change:

```css
.statMainValue, .statSecondaryValue {
  font-family: var(--font-body);
  font-size: var(--text-display-sm);
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

.statMainValue { color: var(--accent); }
.statSecondaryValue { color: var(--text); }
```

to:

```css
.statSecondaryValue {
  font-family: var(--font-body);
  font-size: var(--text-display-sm);
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  color: var(--text);
}
```

Change:

```css
.statMainLabel, .statSecondaryLabel {
  color: var(--text2);
  font-size: var(--text-xs);
}

.statDivider { display: none; }
```

to:

```css
.statSecondaryLabel {
  color: var(--text2);
  font-size: var(--text-xs);
}
```

Add the new accent tone's text-color rule next to the existing `.statRed`/`.statGold` rules. Change:

```css
.statRed { color: var(--red); }
.statGold { color: var(--gold); }
```

to:

```css
.statAccent { color: var(--accent); }
.statRed { color: var(--red); }
.statGold { color: var(--gold); }
```

- [ ] **Step 8: Verify**

Run: `cd advisor-app && npm run lint`
Expected: passes — no reference to the now-removed `statMain`/`statAccentIcon`/`statMainValue`/`statMainLabel`/`statDivider` classes remains anywhere in `ClientList.jsx` (they were only ever used in the block this step rewrote), and the new `welcomeHeader`/`welcomeGreeting`/`welcomeActions`/`statAccent` classes are all defined.

Run: `cd advisor-app && npm run test`
Expected: 83/83 passing (81 existing + the 2 new `countNewThisWeek` tests).

- [ ] **Step 9: Commit**

```bash
git add advisor-app/src/App.jsx advisor-app/src/clients/ClientList.jsx advisor-app/src/clients/ClientList.module.css advisor-app/src/clients/clientStats.js advisor-app/src/clients/clientStats.test.js
git commit -m "Add welcome header and restyle ClientList's KPI cards

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Always-visible table row actions

**Files:**
- Modify: `advisor-app/src/clients/ClientList.jsx`
- Modify: `advisor-app/src/clients/ClientList.module.css`

**Interfaces:** No change to `ClientList`'s props or any exported interface — purely a rendering change inside the existing table.

- [ ] **Step 1: Add the "פתח כרטיס" button and stop hiding the remove button on hover**

In `advisor-app/src/clients/ClientList.jsx`, change the actions cell:

```jsx
                    <td data-label="" className={styles.actionsCell}>
                      {confirming ? (
                        <div className={styles.rowConfirmGroup}>
                          <button type="button" className={styles.confirmRemoveBtn} onClick={e => { e.stopPropagation(); removeClient(c.id); }}>
                            לאשר ניתוק?
                          </button>
                          <button type="button" className={styles.cancelRemoveBtn} onClick={e => { e.stopPropagation(); setConfirmingId(null); }}>
                            ביטול
                          </button>
                        </div>
                      ) : (
                        <button type="button" className={styles.removeBtn + ' ' + styles.rowRemoveBtn} title="נתק לקוח" aria-label="נתק לקוח" onClick={e => { e.stopPropagation(); setConfirmingId(c.id); }}>
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
                        </button>
                      )}
                    </td>
```

to:

```jsx
                    <td data-label="" className={styles.actionsCell}>
                      <button type="button" className={styles.openCardBtn} onClick={e => { e.stopPropagation(); onSelect(c.client_id, c.client_email); }}>פתח כרטיס</button>
                      {confirming ? (
                        <div className={styles.rowConfirmGroup}>
                          <button type="button" className={styles.confirmRemoveBtn} onClick={e => { e.stopPropagation(); removeClient(c.id); }}>
                            לאשר ניתוק?
                          </button>
                          <button type="button" className={styles.cancelRemoveBtn} onClick={e => { e.stopPropagation(); setConfirmingId(null); }}>
                            ביטול
                          </button>
                        </div>
                      ) : (
                        <button type="button" className={styles.removeBtn + ' ' + styles.rowRemoveBtn} title="נתק לקוח" aria-label="נתק לקוח" onClick={e => { e.stopPropagation(); setConfirmingId(c.id); }}>
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
                        </button>
                      )}
                    </td>
```

- [ ] **Step 2: Update `ClientList.module.css`**

Change `.actionsCell` to lay its two controls out side by side. Change:

```css
.actionsCell {
  width: 1%;
  white-space: nowrap;
  text-align: left;
}
```

to:

```css
.actionsCell {
  width: 1%;
  white-space: nowrap;
  text-align: left;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
}

.openCardBtn {
  padding: 6px 14px;
  border-radius: var(--radius-sm);
  border: none;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: var(--accent-ink);
  font-family: var(--font-body);
  font-size: var(--text-xs);
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition: box-shadow 0.15s ease, transform 0.15s var(--ease-out-expo);
}

.openCardBtn:hover {
  box-shadow: 0 4px 14px -4px rgba(var(--accent-rgb), 0.5);
}

.openCardBtn:active {
  transform: scale(0.96);
}
```

Change (drop the hover/focus-reveal, since the button is now always visible):

```css
.rowRemoveBtn {
  position: static;
  opacity: 0;
  transition: opacity 0.15s ease, color 0.15s ease, background 0.15s ease;
}

.clientRow:hover .rowRemoveBtn,
.clientRow:focus-within .rowRemoveBtn,
.rowRemoveBtn:focus-visible {
  opacity: 1;
}
```

to:

```css
.rowRemoveBtn {
  position: static;
}
```

Inside the existing `@media (max-width: 560px)` block, delete this now-redundant line (the base rule above no longer hides the button, so nothing needs to un-hide it at 560px):

```css
  .rowRemoveBtn { opacity: 1; }
```

- [ ] **Step 3: Verify**

Run: `cd advisor-app && npm run lint`
Expected: passes — `openCardBtn` is defined and referenced consistently, no leftover reference to a removed rule.

Run: `cd advisor-app && npm run test`
Expected: 83/83 passing (regression check — this task touches only presentation).

- [ ] **Step 4: Commit**

```bash
git add advisor-app/src/clients/ClientList.jsx advisor-app/src/clients/ClientList.module.css
git commit -m "Make table row actions always visible

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full check suite**

```bash
cd advisor-app && npm run lint && npm run test
```

Expected: both pass, 83/83 tests.

- [ ] **Step 2: Build**

```bash
cd advisor-app && npm run build
```

Expected: builds cleanly.

- [ ] **Step 3: Visual check via the `verify` skill**

Launch `advisor-app` against `vite.audit.config.js`'s mock-client harness. On the client-list screen (no client selected), in both light and dark theme, at a wide viewport and a narrow one (below 860px for the sidebar, below 560px for the table):
- Welcome header renders above the KPI row with a name (or falls back to the email's local part if the advisor has no `display_name` set) and both quick-action buttons; "פגישה מיידית" is visibly disabled with a "בקרוב" tooltip on hover.
- KPI row shows 6 round-icon cards including the new "לקוחות חדשים השבוע" tile, all visually consistent (no more special-cased big "active clients" number).
- Sidebar shows "סקירה" above the דשבורד/לקוח/מיפוי כלכלי cluster and "כספים" above the תקציב/ניתוח/... cluster (no label over the back/search cluster), hidden entirely on the collapsed mobile rail.
- Table rows show a green "פתח כרטיס" button and the disconnect (✕) button always, not only on hover; clicking "פתח כרטיס" opens the client same as clicking the row.
- The empty state (no clients, no leads) still shows with no welcome header and no KPI row, unchanged from before this plan.

- [ ] **Step 4: Report findings**

If the visual check finds any issue, fix it directly in the relevant file from Tasks 1-4 and re-run Steps 1-3. No separate commit step — fold fixes into a small follow-up commit if needed.
