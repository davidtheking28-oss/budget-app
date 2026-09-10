# Advisor App Layout Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge advisor-app's icon-only `IconRail` and Shell's horizontal client-nav tab bar into one wide icon+label sidebar, and convert `ClientList`'s card grid into a dense table — while collapsing back to the current icon-only rail on narrow screens.

**Architecture:** `IconRail` becomes the single owner of all navigation (global actions + the existing `NAV` array's client tabs), rendered vertically with visible labels above 860px and horizontally as icons-only below it (same breakpoint and collapse behavior it already has). `Shell` stops rendering its own tab bar and just forwards `nav`/`activeNav`/`onNavChange` into `IconRail`; `App.jsx` needs no changes since it already passes those same props into `Shell`. `ClientList`'s connected-clients section becomes a `<table>` following the exact responsive pattern already proven in `PipelineTable.jsx`/`PipelineTable.module.css` (stacks to one row-per-card below 560px via `data-label`).

**Tech Stack:** React (no TypeScript), CSS Modules, Vitest (logic-only tests — this codebase has no component/DOM-rendering tests; see Global Constraints).

**Spec:** `docs/superpowers/specs/2026-09-10-advisor-layout-restructure-design.md`

## Global Constraints

- Do not reuse the competitor reference's ("Moneyflow") name or copy its visual branding — structure only, keep advisor-app's own mint-teal/Assistant-font/flat-surface design system (`DESIGN.md`).
- No changes to data hooks (`useClientList`, `usePipeline`, `usePendingInvites`, `useClientFreshness`, etc.) — presentation-layer only.
- No changes to `MonthNav`'s own behavior — it keeps rendering next to the content, not inside the sidebar.
- Existing breakpoints stay: 860px (sidebar wide ↔ collapsed; also `ClientList`'s stat bar / add-form reflow), 560px (table ↔ stacked-card, matching `PipelineTable.module.css`).
- `--rail-w` (defined in `advisor-app/src/theme.css`) is the single source of the sidebar's fixed desktop width — currently `64px` (icon-only); this plan repurposes it to be the wide (icon+label) width, since the collapsed mobile state doesn't use this variable (it goes `position: static; width: 100%`).
- **Testing convention:** this codebase's `npm run test` (Vitest) covers pure logic only (`budgetMath.test.js`, `syncProtocol.test.js`, etc.) — there are zero component/DOM-rendering tests anywhere in `advisor-app/src`. Do not introduce a new React-Testing-Library/component-test setup for this restructure; that would be new test infrastructure the user didn't ask for. Verify each task via `npm run lint` (runs ESLint **and** `scripts/check-css-modules.mjs`, which fails the build if JSX references a CSS-module class that isn't defined), `npm run test` (regression — confirms untouched logic still passes), and a manual visual check per the `verify` skill (`vite --config vite.audit.config.js`), covering both themes (light/dark) and both sidebar breakpoints.
- RTL layout throughout (`dir="rtl"`) — mirror existing `inset-inline-start`/`margin-inline-start` logical-property usage, never hardcode `left`/`right` for direction-sensitive rules.

---

### Task 1: Widen the sidebar variable and rebuild IconRail to carry full navigation

**Files:**
- Modify: `advisor-app/src/theme.css:24`
- Modify (full rewrite): `advisor-app/src/components/IconRail.jsx`
- Modify (full rewrite): `advisor-app/src/components/IconRail.module.css`

**Interfaces:**
- Produces: `IconRail({ onBack, onSearch, onPrint, onPresent, nav, activeNav, onNavChange, theme, onToggleTheme })` — `nav` is an optional array of `{ key, label, group, icon }` (same shape `App.jsx`'s existing `NAV` array already has), `activeNav` is the active `key` string, `onNavChange(key)` fires on click. All other props keep their exact existing meaning from today's `IconRail`.

- [ ] **Step 1: Widen `--rail-w`**

In `advisor-app/src/theme.css`, change line 24:

```css
  --rail-w: 64px;
```

to:

```css
  --rail-w: 232px;
```

- [ ] **Step 2: Rewrite `IconRail.jsx`**

Replace the entire file content with:

```jsx
import Logo from './Logo.jsx';
import styles from './IconRail.module.css';

const svgProps = { viewBox: '0 0 24 24', width: 18, height: 18, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };

export default function IconRail({ onBack, onSearch, onPrint, onPresent, nav, activeNav, onNavChange, theme, onToggleTheme }) {
  const globalActions = [
    onBack && {
      key: 'clients',
      label: 'הלקוחות שלי',
      onClick: onBack,
      icon: <svg {...svgProps}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 3-5.8 6.5-5.8s6.5 2.2 6.5 5.8" /><path d="M17 8.5a3 3 0 0 0 0 5" /><path d="M18.5 20c0-2.6-.9-4.4-2.3-5.4" /></svg>
    },
    onSearch && {
      key: 'search',
      label: 'חיפוש לקוח',
      onClick: onSearch,
      icon: <svg {...svgProps}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
    }
  ].filter(Boolean);

  const trailingActions = [
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
  ].filter(Boolean);

  return (
    <div className={styles.rail}>
      <div className={styles.mark} aria-hidden="true"><Logo /></div>
      <nav className={styles.actions} aria-label="ניווט">
        {globalActions.map(a => (
          <button key={a.key} type="button" className={styles.railBtn} onClick={a.onClick} aria-label={a.label}>
            {a.icon}
            <span className={styles.label}>{a.label}</span>
          </button>
        ))}

        {globalActions.length > 0 && nav && nav.length > 0 && <span className={styles.divider} aria-hidden="true" />}

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

        {trailingActions.map(a => (
          <button key={a.key} type="button" className={styles.railBtn} onClick={a.onClick} aria-label={a.label}>
            {a.icon}
            <span className={styles.label}>{a.label}</span>
          </button>
        ))}
      </nav>
      {onToggleTheme && (
        <button
          type="button"
          className={styles.railBtn + ' ' + styles.themeBtn}
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'עבור למצב בהיר' : 'עבור למצב כהה'}
          aria-pressed={theme === 'dark'}
        >
          {theme === 'dark'
            ? <svg {...svgProps}><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2M12 19.5v2M4.5 12h-2M21.5 12h-2M6.3 6.3 4.9 4.9M19.1 19.1l-1.4-1.4M17.7 6.3l1.4-1.4M4.9 19.1l1.4-1.4" /></svg>
            : <svg {...svgProps}><path d="M20 13.2A8.2 8.2 0 0 1 10.8 4a8.5 8.5 0 1 0 9.2 9.2z" /></svg>}
          <span className={styles.label}>{theme === 'dark' ? 'מצב בהיר' : 'מצב כהה'}</span>
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Rewrite `IconRail.module.css`**

Replace the entire file content with:

```css
.rail {
  position: fixed;
  inset-block: 0;
  inset-inline-start: 0;
  z-index: var(--z-overlay);
  width: var(--rail-w);
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--space-1);
  padding: var(--space-4) var(--space-2);
  background: var(--surface);
  border-inline-end: 1px solid var(--border);
  overflow-y: auto;
}

.mark {
  display: flex;
  align-items: center;
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  margin: 0 var(--space-2) var(--space-3);
}

.actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.divider {
  height: 1px;
  margin: var(--space-2);
  background: var(--border);
  flex-shrink: 0;
}

.themeBtn {
  margin-top: auto;
}

.railBtn {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px var(--space-3);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: none;
  color: var(--text3);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: color .18s ease, background .18s ease, border-color .18s ease;
}

.railBtn svg {
  flex-shrink: 0;
}

.railBtn:hover {
  color: var(--accent);
  background: var(--accent-dim);
  border-color: rgba(var(--accent-rgb), 0.25);
}

.railBtn:active { transform: scale(0.98); }

.railBtnActive {
  color: var(--accent);
  background: var(--accent-dim);
  font-weight: 600;
}

.label {
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 860px) {
  .rail {
    position: static;
    width: 100%;
    flex-direction: row;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1) var(--page-pad);
    border-inline-end: none;
    border-bottom: 1px solid var(--border);
    overflow-y: visible;
  }

  .mark { width: 28px; height: 28px; margin: 0 var(--space-2) 0 0; flex-shrink: 0; }

  .actions {
    flex-direction: row;
    align-items: center;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .actions::-webkit-scrollbar { display: none; }

  .divider {
    width: 1px;
    height: 20px;
    margin: 0 var(--space-2);
    flex-shrink: 0;
  }

  .railBtn {
    width: 44px;
    height: 44px;
    padding: 0;
    justify-content: center;
    flex-shrink: 0;
  }

  /* Visually hidden here (not just narrower) — mobile keeps the existing
     icon-only rail, identified via aria-label alone, same as before this
     restructure. */
  .label { display: none; }

  .themeBtn { margin-top: 0; margin-inline-start: auto; }
}
```

- [ ] **Step 4: Verify**

Run: `cd advisor-app && npm run lint`
Expected: passes (no undefined CSS-module classes, no ESLint errors). `IconRail` is self-contained at this point — nothing else references it yet with the new props, so this only checks the file compiles/lints cleanly.

- [ ] **Step 5: Commit**

```bash
git add advisor-app/src/theme.css advisor-app/src/components/IconRail.jsx advisor-app/src/components/IconRail.module.css
git commit -m "Rebuild IconRail as a wide icon+label sidebar carrying full nav

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Simplify Shell to forward navigation into the sidebar

**Files:**
- Modify: `advisor-app/src/components/Shell.jsx`
- Modify: `advisor-app/src/components/Shell.module.css`

**Interfaces:**
- Consumes: `IconRail` from Task 1 — `nav`/`activeNav`/`onNavChange` forwarded straight through.
- Produces: `Shell`'s own external prop signature is unchanged (`title, onBack, nav, activeNav, onNavChange, sidebarInfo, onPrint, onPresent, onSearch, email, advisorId, theme, onToggleTheme, children`) — `App.jsx` requires **no edits**, since it already passes exactly these props to `Shell` today.

- [ ] **Step 1: Drop the tab-bar rendering and forward nav to IconRail**

In `advisor-app/src/components/Shell.jsx`, replace lines 110–182 (the whole `Shell` function body) with:

```jsx
export default function Shell({ title, onBack, nav, activeNav, onNavChange, sidebarInfo, onPrint, onPresent, onSearch, email, advisorId, theme, onToggleTheme, children }) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeNav]);

  if (!nav) {
    return (
      <div className={styles.shell} dir="rtl">
        <IconRail onSearch={onSearch} theme={theme} onToggleTheme={onToggleTheme} />
        <div className={styles.topbarBleed}>
          <div className={styles.topbar}>
            <div className={styles.logo}>תקציב אישי · יועץ</div>
            <div className={styles.topbarEnd}>
              {onSearch && <SearchBar onOpen={onSearch} />}
              <AccountMenu email={email} advisorId={advisorId} />
            </div>
          </div>
        </div>
        <div className={styles.content}>
          {title && <h1>{title}</h1>}
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.shellTabs} dir="rtl">
      <IconRail
        onBack={onBack}
        onSearch={onSearch}
        onPrint={onPrint}
        onPresent={onPresent}
        nav={nav}
        activeNav={activeNav}
        onNavChange={onNavChange}
        theme={theme}
        onToggleTheme={onToggleTheme}
      />
      <div className={styles.topbarBleed}>
        <div className={styles.topbar}>
          <div className={styles.topbarStart}>
            <div className={styles.logo}>תקציב אישי · יועץ</div>
          </div>
          <div className={styles.topbarEnd}>
            {onSearch && <SearchBar onOpen={onSearch} />}
            <AccountMenu email={email} advisorId={advisorId} />
          </div>
        </div>
      </div>
      <div className={styles.contentTabs}>
        {sidebarInfo && <div className={styles.infoRow}>{sidebarInfo}</div>}
        {children}
      </div>
    </div>
  );
}
```

This drops the `activeTabRef` scroll-into-view effect (it existed to keep the active item visible in the old horizontally-scrolling tab bar; the sidebar's own `overflow-y: auto` from Task 1 makes it unnecessary) and the `useRef` it used — `useRef` is still imported and still used by `AccountMenu` above in the same file, so leave the import line as-is.

- [ ] **Step 2: Remove the now-unused tab-bar CSS**

In `advisor-app/src/components/Shell.module.css`, delete lines 238–334 (from the `/* === Tab-bar shell (client workspace) === */` comment's `.tabBarBleed` rule through `.tabItemActive .tabIcon`) — i.e. remove these rules entirely: `.tabBarBleed`, `.tabRow`, `.infoRow` (old definition), `.tabBar`, `.tabBar::-webkit-scrollbar`, `.tabDivider`, `.tabItem`, `.tabItem::after`, `.tabItem:hover`, `.tabItemActive`, `.tabItemActive::after`, `.tabIcon`, `.tabItemActive .tabIcon`.

Keep everything from `.contentTabs` onward (line 336 in the original file) exactly as-is, **except** re-add a standalone `.infoRow` rule (since the one just deleted was the only definition) right before `.contentTabs`:

```css
.infoRow {
  margin-bottom: var(--space-5);
}
```

- [ ] **Step 3: Remove the tab-row-specific mobile overrides**

Still in `Shell.module.css`, inside the `@media (max-width: 860px)` block (originally lines 360–404), delete the `.tabRow`, `.infoRow` (mobile `order: -1` override), and `.tabItem` rules:

```css
  .tabRow {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-2);
    padding-top: var(--space-2);
  }

  .infoRow {
    order: -1;
    display: flex;
    justify-content: flex-start;
  }

  .tabItem {
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-sm);
  }
```

Leave the rest of that media block (`.shell, .shellTabs { padding-inline-start: 0; }`, `.shellTabs .topbar { ... }`, `.contentTabs { ... }`, `.contentTabs h1 { ... }`, `.topbar { ... }`, `.accountEmail { ... }`) and the `@media (max-width: 560px)` block untouched.

- [ ] **Step 4: Verify**

Run: `cd advisor-app && npm run lint`
Expected: passes.

Run: `cd advisor-app && npm run test`
Expected: all existing (logic-only) tests still pass — this task touches no logic, only presentation, so this is a pure regression check.

- [ ] **Step 5: Commit**

```bash
git add advisor-app/src/components/Shell.jsx advisor-app/src/components/Shell.module.css
git commit -m "Drop Shell's tab bar, forward nav into the sidebar

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Convert ClientList's connected-clients grid into a table

**Files:**
- Modify: `advisor-app/src/clients/ClientList.jsx`
- Modify: `advisor-app/src/clients/ClientList.module.css`

**Interfaces:**
- No change to `ClientList`'s own external props (`advisorId`, `onSelect`).
- Consumes only what already exists in the file: `HealthBadge`, `RemainingStat`, `byUrgency`, `isStale`/`relativeTime`, `formatDateTime`, `initials`.

- [ ] **Step 1: Replace the card grid with a table**

In `advisor-app/src/clients/ClientList.jsx`, replace lines 295–366 (from `{!clients.length ? (` through the closing `)}` of that ternary) with:

```jsx
      {!clients.length ? (
        <div className={styles.empty}>
          <div className={styles.emptyMark}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.5-6.5 8-6.5s8 2.5 8 6.5" />
            </svg>
          </div>
          <div className={styles.emptyTitle}>אין עדיין לקוחות מחוברים</div>
          <div className={styles.emptyText}>שלח הזמנה לכתובת האימייל של הלקוח, או בקש ממנו ליצור קוד הזמנה בהגדרות האפליקציה שלו והדבק אותו כאן</div>
          <Button className={styles.emptyCta} onClick={() => emailInputRef.current?.focus()}>הזמן לקוח ראשון</Button>
        </div>
      ) : (
        <div className={styles.tableWrap} role="region" aria-label="טבלת לקוחות, גלול לצפייה בכל העמודות" tabIndex={0}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>לקוח</th>
                <th>סטטוס</th>
                <th>יתרה החודש</th>
                <th>פגישה הבאה</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {[...clients].sort(byUrgency).map(c => {
                const urgent = c.hasOverage || c.hasFailedUpload || c.hasDeclinedMeeting;
                const confirming = confirmingId === c.id;
                return (
                  <tr key={c.id} className={styles.clientRow + (urgent ? ' ' + styles.rowUrgent : '')}>
                    <td data-label="לקוח">
                      <button type="button" className={styles.clientCellBtn} onClick={() => onSelect(c.client_id, c.client_email)}>
                        <div className={styles.initial} aria-hidden="true">
                          {initials(c.client_email)}
                          {urgent && <span className={styles.alertDot} title="דורש טיפול" />}
                        </div>
                        <div className={styles.info}>
                          <div className={styles.email}>
                            <HealthBadge score={c.healthScore} />
                            <span className={styles.emailText} title={c.client_email}>{c.client_email}</span>
                          </div>
                        </div>
                      </button>
                    </td>
                    <td data-label="סטטוס">
                      <div className={styles.chips}>
                        {c.hasOverage && <div className={styles.overageChip}>חריגת תקציב</div>}
                        {c.hasFailedUpload && <div className={styles.uploadErrorChip}>העלאה נכשלה</div>}
                        {c.hasDeclinedMeeting && <div className={styles.overageChip}>פגישה נדחתה</div>}
                        {c.lastMeetingAt && <div className={styles.staleChip}>פגישה אחרונה {relativeTime(c.lastMeetingAt)}</div>}
                        {c.totalTasks > 0 && <div className={styles.staleChip}>בוצעו {c.doneTasks}/{c.totalTasks} משימות</div>}
                        {c.openTasks > 0 && <div className={styles.taskChip}>{c.openTasks} משימות פתוחות</div>}
                        {c.updatedAt && isStale(c.updatedAt) && (
                          <div className={styles.staleChip}>לא עודכן {relativeTime(c.updatedAt)}</div>
                        )}
                      </div>
                    </td>
                    <td data-label="יתרה החודש" className={styles.remainingCell}>
                      <RemainingStat value={c.remaining} />
                    </td>
                    <td data-label="פגישה הבאה">{c.nextMeetingAt ? formatDateTime(c.nextMeetingAt) : '—'}</td>
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
```

- [ ] **Step 2: Remove the now-unused stagger-animation ref**

In the same file, delete these two lines (originally lines 130–131):

```jsx
  const mountedRef = useRef(false);
  useEffect(() => { mountedRef.current = true; }, []);
```

`useEffect` and `useRef` stay imported and used elsewhere in the file (`useEffect`/`useRef` power `codeInputRef`/`emailInputRef` and the claim/invite handlers) — only this one `mountedRef` pair goes.

- [ ] **Step 3: Add the table styles and remove the now-dead card-grid ones**

In `advisor-app/src/clients/ClientList.module.css`:

Delete the `.cardNoAnim` rule (lines 116–118):

```css
.cardNoAnim {
  animation: none;
}
```

Delete the `.cardWide` line from the existing mobile media query (line 22 only — keep `.grid { grid-template-columns: 1fr; }` since the skeleton and pending-invites grids still use `.grid`):

```css
  .cardWide { grid-column: span 1; }
```

Delete the standalone `.cardWide` rule (lines 120–124):

```css
/* span 2 left ragged holes once the track count reached 3+; a full row keeps the
   urgent-client emphasis without punching gaps into the grid. */
.cardWide {
  grid-column: 1 / -1;
}
```

Then append these new rules at the end of the file (after `.pendingChipSignup`):

```css
/* --- connected-clients table --- */

.tableWrap {
  overflow-x: auto;
  margin-top: var(--space-6);
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
}

.table th {
  text-align: right;
  color: var(--text3);
  font-weight: 600;
  font-size: var(--text-xs);
  letter-spacing: 0.03em;
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}

.table td {
  padding: var(--space-3);
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
}

.table tr:last-child td {
  border-bottom: none;
}

.clientRow {
  transition: background 0.15s ease;
}

.clientRow:hover {
  background: var(--hover);
}

.rowUrgent {
  background: rgba(var(--red-rgb), 0.04);
}

.clientCellBtn {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-width: 0;
  padding: 0;
  border: none;
  background: none;
  font-family: inherit;
  text-align: inherit;
  cursor: pointer;
  color: inherit;
}

.remainingCell {
  text-align: left;
  white-space: nowrap;
}

.actionsCell {
  width: 1%;
  white-space: nowrap;
  text-align: left;
}

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

.rowConfirmGroup {
  display: flex;
  gap: var(--space-2);
}

/* Below 560px the 5-column table stops fitting even with horizontal scroll on
   a real 320px device — same fallback PipelineTable.module.css already uses:
   one card per client, each cell labeled via data-label. */
@media (max-width: 560px) {
  .tableWrap { overflow-x: visible; }

  .table, .table thead, .table tbody, .table tr, .table td { display: block; width: 100%; }
  .table thead { position: absolute; inset-inline-start: -9999px; }

  .table tr {
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--space-2) var(--space-3);
    margin-bottom: var(--space-3);
  }

  .table td {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    white-space: normal;
    border-bottom: 1px solid var(--border);
    padding: var(--space-2) 0;
  }

  .table td:last-child { border-bottom: none; justify-content: flex-end; }

  .table td[data-label]:not([data-label=""])::before {
    content: attr(data-label);
    color: var(--text3);
    font-size: var(--text-xs);
    font-weight: 600;
    flex-shrink: 0;
  }

  .clientCellBtn {
    width: auto;
  }

  .remainingCell {
    text-align: right;
  }
}
```

- [ ] **Step 4: Verify**

Run: `cd advisor-app && npm run lint`
Expected: passes — confirms every `styles.X` reference used in the new JSX (`clientRow`, `rowUrgent`, `clientCellBtn`, `remainingCell`, `actionsCell`, `rowRemoveBtn`, `rowConfirmGroup`, `tableWrap`, `table`) is defined, and that no leftover reference to the deleted `cardWide`/`cardNoAnim` remains.

Run: `cd advisor-app && npm run test`
Expected: all existing tests still pass (this task touches presentation only; `useClientFreshness.test.js` covers the `isStale`/`relativeTime` helpers reused here unchanged).

- [ ] **Step 5: Commit**

```bash
git add advisor-app/src/clients/ClientList.jsx advisor-app/src/clients/ClientList.module.css
git commit -m "Convert ClientList's card grid into a table

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Full-app verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full check suite**

```bash
cd advisor-app && npm run lint && npm run test
```

Expected: both pass with zero failures.

- [ ] **Step 2: Build**

```bash
cd advisor-app && npm run build
```

Expected: builds cleanly (this is what CI runs for the `/advisor/` deploy — see the project `CLAUDE.md`).

- [ ] **Step 3: Visual check via the `verify` skill**

Follow the `verify` skill to launch `advisor-app` against `vite.audit.config.js`'s mock-client harness (Supabase auth isn't automatable, per `advisor-app/src/__audit/`). Check, in both light and dark theme:
- The client-list screen (no client selected): sidebar shows logo + back/search only (no client nav groups), KPI stat bar, add-client form, pending invites, and the new table — at both a wide viewport (sidebar shows icon+label) and a narrow one below 860px (sidebar collapses to icon-only, table stacks to cards below 560px).
- A client-selected screen: sidebar shows all nav groups (סקירה/תוכן, כספים, פעולות) with the current tab visually marked active, `MonthNav` renders above the page content (not inside the sidebar), and switching tabs updates the active state correctly.

- [ ] **Step 4: Report findings**

If the visual check finds any issue (overflow, missing active state, broken breakpoint, contrast issue against `DESIGN.md`'s mint-teal palette), fix it directly in the relevant file from Tasks 1–3 and re-run Steps 1–3 before considering the plan done. No separate commit step here — fixes get folded into a small follow-up commit if needed.
