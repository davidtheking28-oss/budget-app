# Client-View Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "client-view mode" toggle to advisor-app that hides advisor-only navigation (CRM, Economic Mapping tabs) and the advisor-only `ClientContextBar` shortcuts, so an advisor can present a client's data cleanly during a meeting without editing/routing capability changing.

**Architecture:** One boolean piece of React state (`clientView`) lives in `App.jsx`. It filters the `NAV` array before it reaches `Shell`, conditionally renders `ClientContextBar`, and auto-redirects off the two hidden tabs if the advisor turns the mode on while already there. The toggle button itself lives in `IconRail` (the same rail that already holds the theme toggle, back, search, and print buttons), threaded through `Shell` as two new props.

**Tech Stack:** React (function components, hooks), CSS Modules. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-29-client-view-mode-design.md`

## Global Constraints
- No new dependencies.
- No emoji icons — new UI uses an inline SVG matching the existing `svgProps` convention in `IconRail.jsx`.
- Hebrew UI copy, RTL-safe (matches every existing label in these files).
- `clientView` state is plain React state — not persisted to the URL or localStorage (per spec: it's a live, in-meeting mode, expected to reset on reload).
- This codebase has no component-rendering test harness (all existing `*.test.js` files test pure logic: math, protocols, hooks-returned-data — see `src/budget/*.test.js`, `src/clients/useClientFreshness.test.js`). Do not introduce one for this feature — verify the new UI behavior manually via the `vite.audit.config.js` mock harness, consistent with how every other UI-only change this session was verified.

---

### Task 1: Add the client-view toggle button to `IconRail`

**Files:**
- Modify: `advisor-app/src/components/IconRail.jsx`
- Modify: `advisor-app/src/components/IconRail.module.css`

**Interfaces:**
- Consumes: nothing new from other tasks (this task is UI-only, wired up in Task 2).
- Produces: `IconRail` accepts two new props, `clientView` (boolean) and `onToggleClientView` (function). When `onToggleClientView` is falsy, no button renders (matches the existing `onBack`/`onSearch`/`onPrint` optional-prop pattern already in this file). Task 2 relies on these exact prop names.

- [ ] **Step 1: Add the button to `IconRail.jsx`**

Open `advisor-app/src/components/IconRail.jsx`. Change the function signature (line 6) from:
```jsx
export default function IconRail({ onBack, onSearch, onPrint, theme, onToggleTheme }) {
```
to:
```jsx
export default function IconRail({ onBack, onSearch, onPrint, clientView, onToggleClientView, theme, onToggleTheme }) {
```

Immediately after the closing `)}` of the `{onToggleTheme && (...)}` block (currently ending at line 52, right before the final `</div>` at line 53), add a new button:
```jsx
      {onToggleClientView && (
        <button
          type="button"
          className={styles.railBtn + (clientView ? ' ' + styles.railBtnActive : '')}
          onClick={onToggleClientView}
          aria-label={clientView ? 'סגור תצוגת לקוח' : 'פתח תצוגת לקוח'}
          aria-pressed={clientView}
        >
          <svg {...svgProps}><path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12z" /><circle cx="12" cy="12" r="3.2" /></svg>
          <span className={styles.tip}>{clientView ? 'סגור תצוגת לקוח' : 'תצוגת לקוח'}</span>
        </button>
      )}
```
Place it right after the theme-toggle block (so it sits at the bottom of the rail, next to it), still inside `<div className={styles.rail}>`.

- [ ] **Step 2: Add the active-state style to `IconRail.module.css`**

Open `advisor-app/src/components/IconRail.module.css`. After the existing `.railBtn:active { transform: scale(0.94); }` rule (line 79), add:
```css
/* Persistent accent fill while client-view mode is on — unlike :hover, this
   has to stay visible without the pointer sitting on the button, so the
   advisor can tell at a glance the mode is still active mid-meeting. */
.railBtnActive {
  color: var(--accent);
  background: var(--accent-dim);
  border-color: rgba(var(--accent-rgb), 0.35);
}
```

- [ ] **Step 3: Build to confirm no syntax errors**

Run: `cd advisor-app && npm run build`
Expected: build succeeds (this is a presentational-only change with no logic to unit-test — `IconRail` has no existing test file, matching this codebase's pattern of not testing component rendering).

- [ ] **Step 4: Commit**

```bash
git add advisor-app/src/components/IconRail.jsx advisor-app/src/components/IconRail.module.css
git commit -m "advisor-app: add client-view toggle button to IconRail"
```

---

### Task 2: Wire `clientView` state through `Shell` into `App.jsx`

**Files:**
- Modify: `advisor-app/src/components/Shell.jsx`
- Modify: `advisor-app/src/App.jsx`

**Interfaces:**
- Consumes: `IconRail`'s `clientView`/`onToggleClientView` props from Task 1.
- Produces: `Shell` accepts and forwards the same two prop names to both of its `<IconRail>` calls. `App.jsx` owns the `clientView` state itself — no other task reads it back out of `App.jsx`.

- [ ] **Step 1: Thread the props through `Shell.jsx`**

Open `advisor-app/src/components/Shell.jsx`. Change the `Shell` function signature (line 110) from:
```jsx
export default function Shell({ title, onBack, nav, activeNav, onNavChange, sidebarInfo, onPrint, onSearch, email, advisorId, theme, onToggleTheme, children }) {
```
to:
```jsx
export default function Shell({ title, onBack, nav, activeNav, onNavChange, sidebarInfo, onPrint, onSearch, email, advisorId, theme, onToggleTheme, clientView, onToggleClientView, children }) {
```

Update both `<IconRail>` call sites to pass the two new props through:

The no-nav branch (line 124):
```jsx
        <IconRail onSearch={onSearch} theme={theme} onToggleTheme={onToggleTheme} clientView={clientView} onToggleClientView={onToggleClientView} />
```

The with-nav branch (line 144):
```jsx
      <IconRail onBack={onBack} onSearch={onSearch} onPrint={onPrint} theme={theme} onToggleTheme={onToggleTheme} clientView={clientView} onToggleClientView={onToggleClientView} />
```

- [ ] **Step 2: Add `clientView` state and `NAV` filtering to `App.jsx`**

Open `advisor-app/src/App.jsx`. Add the state declaration right after the existing `reportMode`/`searchOpen` state (after line 76):
```jsx
  const [clientView, setClientView] = useState(false);
```

Immediately after that, add the auto-redirect effect (this needs `nav`/`setNav`, already in scope):
```jsx
  useEffect(() => {
    if (clientView && (nav === 'crm' || nav === 'mapping')) setNav('dashboard');
  }, [clientView, nav]);
```

Change the `Shell` render (the tab-bar branch, starting at line 158) to compute a filtered nav array and pass the two new props. Replace:
```jsx
      <Shell
        title={NAV.find(n => n.key === nav)?.label}
        onBack={() => setSelectedClient(null)}
        nav={NAV}
        activeNav={nav}
```
with:
```jsx
      <Shell
        title={NAV.find(n => n.key === nav)?.label}
        onBack={() => setSelectedClient(null)}
        nav={clientView ? NAV.filter(n => n.group !== 'tools') : NAV}
        activeNav={nav}
```
and, further down in the same `<Shell ...>` prop list (right after the existing `sidebarInfo={...}` line, currently line 170), add:
```jsx
        clientView={clientView}
        onToggleClientView={() => setClientView(v => !v)}
```

- [ ] **Step 3: Hide `ClientContextBar` in client-view mode**

Still in `App.jsx`, the `<ClientContextBar ...>` call (currently lines 172-181) is wrapped in a conditional. Replace:
```jsx
        <ClientContextBar
          email={selectedClient.email}
          nextMeeting={nextMeeting}
          openTasks={openTasks}
          household={household}
          onOpenCrm={() => setNav('crm')}
          freshness={freshness}
          budgetMode={budgetMode}
          onBudgetModeChange={setBudgetMode}
        />
```
with:
```jsx
        {!clientView && (
          <ClientContextBar
            email={selectedClient.email}
            nextMeeting={nextMeeting}
            openTasks={openTasks}
            household={household}
            onOpenCrm={() => setNav('crm')}
            freshness={freshness}
            budgetMode={budgetMode}
            onBudgetModeChange={setBudgetMode}
          />
        )}
```

- [ ] **Step 4: Build to confirm no syntax errors**

Run: `cd advisor-app && npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add advisor-app/src/components/Shell.jsx advisor-app/src/App.jsx
git commit -m "advisor-app: add client-view mode state, nav filtering, and ClientContextBar guard"
```

---

### Task 3: Manual verification via the mock harness

**Files:** none modified — verification only.

**Interfaces:**
- Consumes: the fully-wired feature from Tasks 1-2.
- Produces: nothing consumed by a later task; this is the terminal task.

- [ ] **Step 1: Run the full test suite**

Run: `cd advisor-app && npm run test`
Expected: all existing tests still pass (this feature touches no file any existing test covers, so the count should be unchanged from before this plan).

- [ ] **Step 2: Start the mock-Supabase audit harness**

Run: `cd advisor-app && npx vite --config vite.audit.config.js --port 5183` (background)

- [ ] **Step 3: Screenshot the toggle in both nav states, both themes**

Using a Playwright driver script (see `.claude/skills/verify/SKILL.md` for the harness's URL/localStorage conventions — set `localStorage.advisor_theme` before navigating, reload for theme changes to apply), against `http://localhost:5183/`:
1. Load with a client selected (root URL already resolves to `CLIENT_A` by default per `src/__audit/seed.js`), on the `dashboard` tab. Confirm the new eye/presentation icon button renders at the bottom of the icon rail, below the theme toggle.
2. Click it. Confirm: the "לקוח" and "מיפוי כלכלי" tabs disappear from the tab bar, `ClientContextBar` (the row with next-meeting/open-tasks/household) disappears, and the button now shows the accent-filled active state.
3. Click it again to turn it off. Confirm everything reappears exactly as before.
4. Navigate to the `crm` tab, then click the toggle on. Confirm `nav` auto-redirects to `dashboard` (the tab bar's active tab becomes "דשבורד") rather than leaving the advisor on a tab that just vanished.
5. Repeat step 2's screenshot with `localStorage.advisor_theme = 'dark'` set before navigating. Confirm the active-state accent fill and icon are legible in dark mode too.

- [ ] **Step 4: Stop the harness**

Kill only the specific `vite --config vite.audit.config.js --port 5183` process this task started (find its PID via `wmic process where "commandline like '%vite.audit.config%port 5183%'" get processid` on Windows) — never a broad `taskkill /IM node.exe`.

- [ ] **Step 5: Push and confirm CI**

```bash
git push
gh run list --limit 1 --json headSha,status,conclusion
```
Expected: the latest run's `headSha` matches the just-pushed commit and, once `status` is `completed`, `conclusion` is `success`.
