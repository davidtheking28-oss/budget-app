# Advisor Separate App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the CSS-only desktop-advisor layout in `index.html` with a
standalone React + Vite app (`advisor-app/`, deployed to `/advisor/`) that
lets an advisor log in, see their client roster, and fully manage a
selected client's budget (dashboard, expenses, budget limits, analysis) —
sharing the same Supabase backend/data as the client-facing mobile app.

**Architecture:** New React + Vite SPA, source in `advisor-app/`, built by
CI to `advisor/` at the repo root and deployed alongside the existing static
`index.html` on GitHub Pages under `/budget-app/advisor/`. Both apps read
and write the same `budget_data` and `advisor_clients` Supabase tables
directly via `@supabase/supabase-js`; no new backend tables or RLS policies
are introduced by this plan (all required RLS/RPC infrastructure — the
`advisor_clients` table, the `budget_data` advisor RLS branch, and the
`claim_advisor_invite` RPC — already exists and is verified live).

**Tech Stack:** React 18, Vite 5, `@supabase/supabase-js`, `chart.js` +
`react-chartjs-2` for the analysis screen, plain CSS Modules for styling (no
Tailwind/CSS framework). No TypeScript (matches the rest of this project,
which is untyped JS throughout). No test framework — this project has none
(see Global Constraints); verification is manual/Playwright per task,
consistent with `docs/superpowers/plans/2026-07-13-advisor-core.md`.

## Global Constraints

- Source lives at `advisor-app/` (new directory). Build output lands at
  `advisor/` at the repo root (git-ignored, CI-generated) — never commit
  `advisor/` or `advisor-app/node_modules/`.
- `vite.config.js` must set `base: '/budget-app/advisor/'` so built asset
  URLs resolve under the GitHub Pages sub-path, and
  `build.outDir: '../advisor'` so output lands at the repo root.
- No TypeScript. Plain `.jsx`/`.js`. No comments in code unless explaining a
  non-obvious workaround (per this user's global code-style rules).
- Supabase project ref `fnklrqxwyeibfptaxewf`, URL
  `https://fnklrqxwyeibfptaxewf.supabase.co`. The anon key is never
  hardcoded — read from `import.meta.env.VITE_SUPABASE_ANON` at build time,
  injected via a CI env var (mirrors how `index.html` injects
  `__SUPABASE_ANON__`, but using Vite's native env-var mechanism instead of
  a placeholder string-replace).
- Auth: Supabase magic-link only (`signInWithOtp`), matching `index.html`'s
  existing method exactly. No password login.
- Data model (verified live via `information_schema.columns` on
  `budget_data`): one row per `user_id`, columns `transactions` (jsonb
  array), `budgets` (jsonb object, `{category: monthlyLimitNumber}`),
  `goals`, `subscriptions`, `loans`, `fixed_expenses`, `settings`,
  `business`, `sync_meta` (all jsonb), `updated_at`, `updated_by`. A
  transaction object (per `index.html`'s existing shape, e.g.
  `index.html:2980,3002`) is `{id, type:'income'|'expense', cat, desc,
  amount, date:'YYYY-MM-DD', recurring, fixed}`.
- Category lists are hardcoded constants in `index.html` (`EXPENSE_CATS`,
  `FIXED_CATS`, `INCOME_CATS` at `index.html:2413-2429`) — not stored in the
  database. This plan duplicates those exact lists into
  `advisor-app/src/categories.js` as a plain constants module. This
  duplication is an accepted, explicit trade-off (two separate codebases,
  no shared package) — do not attempt to load categories from `index.html`
  at runtime.
- **V1 scope simplification (explicit, not an oversight):** the budget
  screen shows spent-vs-limit for the current month only, with **no
  rollover/carry-forward logic** (`index.html`'s `_budgetCarry`/`effLim`
  machinery is NOT replicated). This is a deliberate scope cut for V1,
  documented in the design spec's "Non-goals" implicitly via the "full
  parity" wording — flag to the human if exact carry-forward parity turns
  out to matter before this ships.
- RTL: the advisor app's UI is still Hebrew-first (same user base), so every
  screen sets `dir="rtl"` — but the visual design language (palette,
  typography) is independent from `index.html`'s navy/indigo theme, per the
  design spec.
- Every task's Playwright verification step navigates to the local Vite dev
  server (`npm run dev`, default `http://localhost:5173`), not the deployed
  site, until the final deploy-verification task.

---

### Task 1: Scaffold the Vite + React app

**Files:**
- Create: `advisor-app/package.json`
- Create: `advisor-app/vite.config.js`
- Create: `advisor-app/index.html` (Vite's own dev-server entry HTML, distinct from the repo-root `index.html`)
- Create: `advisor-app/src/main.jsx`
- Create: `advisor-app/src/App.jsx`
- Create: `advisor-app/.gitignore`
- Modify: `.gitignore` (repo root)

**Interfaces:**
- Produces: a working `npm run dev` and `npm run build` in `advisor-app/`,
  a root `<App />` component later tasks extend.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "advisor-app",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.45.0",
    "chart.js": "^4.4.0",
    "react": "^18.3.0",
    "react-chartjs-2": "^5.2.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create `vite.config.js`**

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/budget-app/advisor/',
  build: {
    outDir: '../advisor',
    emptyOutDir: true
  }
});
```

- [ ] **Step 3: Create `advisor-app/index.html`**

```html
<!doctype html>
<html lang="he" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Budget Advisor</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Create `advisor-app/src/main.jsx`**

```javascript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 5: Create a placeholder `advisor-app/src/App.jsx`**

```javascript
export default function App() {
  return <div>advisor app scaffold</div>;
}
```

- [ ] **Step 6: Create `advisor-app/.gitignore`**

```
node_modules
dist
.env.local
```

- [ ] **Step 7: Add `advisor/` to the repo-root `.gitignore`**

Read the current repo-root `.gitignore` first, then append a new line:

```
advisor/
```

- [ ] **Step 8: Install dependencies and verify the dev server starts**

Run:
```bash
cd advisor-app && npm install
```
Expected: installs without errors, creates `advisor-app/node_modules/` and `advisor-app/package-lock.json`.

Run:
```bash
cd advisor-app && npm run dev -- --port 5173 &
sleep 3
curl -s http://localhost:5173/ | grep -c "advisor app scaffold"
```
Expected: server starts, but note the placeholder text is inside a JS bundle rendered client-side, so a raw `curl` of the HTML shell will NOT contain it (Vite serves an empty `#root` div pre-render) — instead verify the dev server responds successfully:
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/
```
Expected: `200`. Then stop the background dev server (`kill %1` or equivalent).

- [ ] **Step 9: Verify `npm run build` succeeds and outputs to `../advisor`**

Run:
```bash
cd advisor-app && npm run build
```
Expected: build succeeds, and `ls ../advisor` (relative to `advisor-app/`, i.e. the repo root `advisor/` directory) shows `index.html` and an `assets/` folder.

- [ ] **Step 10: Commit**

```bash
git add advisor-app/package.json advisor-app/vite.config.js advisor-app/index.html advisor-app/src/main.jsx advisor-app/src/App.jsx advisor-app/.gitignore advisor-app/package-lock.json .gitignore
git commit -m "scaffold advisor-app (Vite + React)"
```

(Do not add `advisor-app/node_modules/` or the repo-root `advisor/` — both are git-ignored.)

---

### Task 2: Supabase client module + env config

**Files:**
- Create: `advisor-app/src/supabaseClient.js`
- Create: `advisor-app/.env.local` (local-only, git-ignored, for `npm run dev`)
- Create: `advisor-app/.env.example` (committed, documents the required var)

**Interfaces:**
- Consumes: `import.meta.env.VITE_SUPABASE_ANON` (Vite env var, set at build/dev time).
- Produces: `export const supabase` — a configured Supabase JS client, imported by every later task that touches data.

- [ ] **Step 1: Create `advisor-app/src/supabaseClient.js`**

```javascript
import { createClient } from '@supabase/supabase-js';

const SUPA_URL = 'https://fnklrqxwyeibfptaxewf.supabase.co';
const SUPA_ANON = import.meta.env.VITE_SUPABASE_ANON;

export const supabase = createClient(SUPA_URL, SUPA_ANON);
```

- [ ] **Step 2: Create `advisor-app/.env.example`**

```
VITE_SUPABASE_ANON=your-anon-key-here
```

- [ ] **Step 3: Create `advisor-app/.env.local` with the real anon key for local dev**

Get the real anon key by asking the user for it, or by running (if the Supabase MCP tools are available in this session):
```
mcp__supabase__get_publishable_keys
```
Write the returned anon key into `advisor-app/.env.local`:
```
VITE_SUPABASE_ANON=<the real key>
```
This file is git-ignored (Task 1, Step 6) — it will never be committed.

- [ ] **Step 4: Verify the client initializes without throwing**

Modify `advisor-app/src/App.jsx` temporarily to import and log the client:
```javascript
import { supabase } from './supabaseClient.js';

export default function App() {
  console.log('supabase client:', supabase);
  return <div>advisor app scaffold</div>;
}
```
Run `npm run dev` in `advisor-app/`, open the served URL with Playwright (`mcp__playwright__browser_navigate` to `http://localhost:5173/`), and check the browser console via `mcp__playwright__browser_console_messages` for the logged client object with no errors. Revert the temporary `console.log` line afterward (App.jsx stays as the Task 1 placeholder — Task 5/6 will replace it for real).

- [ ] **Step 5: Commit**

```bash
git add advisor-app/src/supabaseClient.js advisor-app/.env.example
git commit -m "add Supabase client module to advisor-app"
```

(`.env.local` stays uncommitted — git-ignored.)

---

### Task 3: CI build step for advisor-app

**Files:**
- Modify: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: GitHub Actions secret `SUPABASE_ANON` (already exists — used today by the `Inject Supabase anon key` step for `index.html`).
- Produces: a CI pipeline that builds `advisor-app/` into `advisor/` before the Pages artifact upload.

- [ ] **Step 1: Read the current workflow file**

Read `.github/workflows/deploy.yml` in full before editing (it has 5 steps today: checkout, inject anon key into `index.html`, configure-pages, upload-pages-artifact, deploy-pages).

- [ ] **Step 2: Insert a Node setup + advisor-app build step**

Insert this new step immediately after the existing `Inject Supabase anon key` step and before the existing `uses: actions/configure-pages@v4` step:

```yaml
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Build advisor app
        working-directory: advisor-app
        env:
          VITE_SUPABASE_ANON: ${{ secrets.SUPABASE_ANON }}
        run: |
          npm ci
          npm run build
```

- [ ] **Step 3: Verify the full resulting file is well-formed YAML**

Read the file back in full and confirm: the step order is now checkout →
inject anon key → setup-node → build advisor app → configure-pages →
upload-pages-artifact → deploy-pages, and indentation matches the existing
steps exactly (2-space, `- name:`/`- uses:` at the same nesting level as
siblings).

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "build advisor-app in CI before Pages deploy"
```

Note: this step's effect (does the live site actually serve `/advisor/`
correctly) is verified in Task 14, after the app has real content — an
empty scaffold deploying successfully is a necessary but not sufficient
check.

---

### Task 4: Design tokens + app shell

**Files:**
- Create: `advisor-app/src/theme.css`
- Modify: `advisor-app/src/main.jsx` (import the stylesheet)
- Modify: `advisor-app/src/App.jsx`
- Create: `advisor-app/src/components/Shell.jsx`
- Create: `advisor-app/src/components/Shell.module.css`

**Interfaces:**
- Produces: CSS custom properties (`--bg`, `--surface`, `--accent`, `--text`,
  `--text2`, `--border`) consumed by every later screen's CSS Module, and a
  `<Shell>` component (top bar + content area) that later screens render
  inside.

- [ ] **Step 1: Create `advisor-app/src/theme.css`**

A palette distinct from `index.html`'s navy/indigo (`#0d1526`/`#4f83ff`) —
this app uses a deep charcoal background with a teal accent (visually
distinct, professional-tool feel per the design spec):

```css
:root {
  --bg: #14181c;
  --surface: #1c2126;
  --surface2: #232a30;
  --accent: #2dd4bf;
  --accent-rgb: 45, 212, 191;
  --text: #f2f5f4;
  --text2: #9ba3a8;
  --text3: #6b7378;
  --border: rgba(255, 255, 255, 0.08);
  --red: #f87171;
  --green: #34d399;
  --yellow: #fbbf24;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: 'Inter', 'Plus Jakarta Sans', sans-serif;
}
```

- [ ] **Step 2: Import it in `main.jsx`**

```javascript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './theme.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 3: Create `advisor-app/src/components/Shell.module.css`**

```css
.shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 32px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

.logo {
  font-weight: 800;
  font-size: 1.1rem;
  color: var(--accent);
}

.content {
  flex: 1;
  padding: 32px;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
}
```

- [ ] **Step 4: Create `advisor-app/src/components/Shell.jsx`**

```javascript
import styles from './Shell.module.css';

export default function Shell({ title, right, children }) {
  return (
    <div className={styles.shell} dir="rtl">
      <div className={styles.topbar}>
        <div className={styles.logo}>Budget Advisor</div>
        {right}
      </div>
      <div className={styles.content}>
        {title && <h1>{title}</h1>}
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Update `App.jsx` to render the shell**

```javascript
import Shell from './components/Shell.jsx';

export default function App() {
  return <Shell title="לוח בקרה">בקרוב</Shell>;
}
```

- [ ] **Step 6: Verify visually with Playwright**

Run `npm run dev` in `advisor-app/`, navigate with `mcp__playwright__browser_navigate` to `http://localhost:5173/`, take a screenshot with `mcp__playwright__browser_take_screenshot`, and confirm: dark charcoal background, teal "Budget Advisor" wordmark top-right (RTL), "לוח בקרה" heading, "בקרוב" text — no console errors via `mcp__playwright__browser_console_messages`.

- [ ] **Step 7: Commit**

```bash
git add advisor-app/src/theme.css advisor-app/src/main.jsx advisor-app/src/App.jsx advisor-app/src/components/Shell.jsx advisor-app/src/components/Shell.module.css
git commit -m "add design tokens and app shell to advisor-app"
```

---

### Task 5: Auth — magic-link login + session handling

**Files:**
- Create: `advisor-app/src/auth/useSession.js`
- Create: `advisor-app/src/auth/Login.jsx`
- Create: `advisor-app/src/auth/Login.module.css`
- Modify: `advisor-app/src/App.jsx`

**Interfaces:**
- Consumes: `supabase` from `supabaseClient.js` (Task 2).
- Produces: `useSession()` hook returning `{session, loading}` (re-renders on
  auth state change), a `<Login>` component that sends a magic link and
  shows a "check your email" state. `App.jsx` uses `useSession()` to decide
  whether to render `<Login>` or the authenticated app (later tasks fill in
  the authenticated branch).

- [ ] **Step 1: Create `advisor-app/src/auth/useSession.js`**

```javascript
import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';

export function useSession() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  return { session, loading };
}
```

- [ ] **Step 2: Create `advisor-app/src/auth/Login.module.css`**

```css
.wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 40px;
  width: 360px;
  text-align: center;
}

.logo {
  font-weight: 800;
  font-size: 1.4rem;
  color: var(--accent);
  margin-bottom: 24px;
}

.input {
  width: 100%;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface2);
  color: var(--text);
  font-size: 0.95rem;
  margin-bottom: 12px;
}

.button {
  width: 100%;
  padding: 12px;
  border-radius: 10px;
  border: none;
  background: var(--accent);
  color: #0b1210;
  font-weight: 700;
  cursor: pointer;
}

.sent {
  color: var(--text2);
  font-size: 0.9rem;
}
```

- [ ] **Step 3: Create `advisor-app/src/auth/Login.jsx`**

```javascript
import { useState } from 'react';
import { supabase } from '../supabaseClient.js';
import styles from './Login.module.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function sendLink() {
    setError('');
    if (!email.trim()) { setError('הזן אימייל'); return; }
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true }
    });
    if (error) { setError('שגיאה בשליחת קישור'); return; }
    setSent(true);
  }

  return (
    <div className={styles.wrap} dir="rtl">
      <div className={styles.card}>
        <div className={styles.logo}>Budget Advisor</div>
        {sent ? (
          <div className={styles.sent}>שלחנו לך קישור התחברות למייל — בדוק את תיבת הדואר</div>
        ) : (
          <>
            <input
              className={styles.input}
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
            <button className={styles.button} onClick={sendLink}>שלח קישור התחברות</button>
            {error && <div style={{ color: 'var(--red)', marginTop: 10, fontSize: '0.85rem' }}>{error}</div>}
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire it into `App.jsx`**

```javascript
import { useSession } from './auth/useSession.js';
import Login from './auth/Login.jsx';
import Shell from './components/Shell.jsx';

export default function App() {
  const { session, loading } = useSession();

  if (loading) return null;
  if (!session) return <Login />;

  return <Shell title="לוח בקרה">מחובר כ־{session.user.email}</Shell>;
}
```

- [ ] **Step 5: Verify with Playwright**

Navigate to `http://localhost:5173/`, confirm the login card renders (teal
"Budget Advisor" wordmark, email input, "שלח קישור התחברות" button). Type a
test email into the input (`mcp__playwright__browser_type`) and click the
button (`mcp__playwright__browser_click`); confirm the UI switches to the
"שלחנו לך קישור..." message (the actual email send will succeed or fail
silently against live Supabase depending on network — either way the UI
state transition is what this step verifies, not real email delivery).

- [ ] **Step 6: Commit**

```bash
git add advisor-app/src/auth/useSession.js advisor-app/src/auth/Login.jsx advisor-app/src/auth/Login.module.css advisor-app/src/App.jsx
git commit -m "add magic-link auth to advisor-app"
```

---

### Task 6: Client list screen

**Files:**
- Create: `advisor-app/src/clients/useClientList.js`
- Create: `advisor-app/src/clients/ClientList.jsx`
- Create: `advisor-app/src/clients/ClientList.module.css`
- Modify: `advisor-app/src/App.jsx`

**Interfaces:**
- Consumes: `supabase`, `useSession()`.
- Produces: `useClientList()` hook returning `{clients, loading}` (array of
  `{id, client_id, client_email}` rows from `advisor_clients` where
  `advisor_id = auth.uid() and status = 'active'`), `<ClientList
  onSelect={(clientId, clientEmail) => void}>` component. `App.jsx` renders
  `<ClientList>` when authenticated and no client is currently selected.

- [ ] **Step 1: Create `advisor-app/src/clients/useClientList.js`**

```javascript
import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';

export function useClientList(advisorId) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!advisorId) return;
    let cancelled = false;
    setLoading(true);
    supabase
      .from('advisor_clients')
      .select('id, client_id, client_email')
      .eq('advisor_id', advisorId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        setClients(error ? [] : data || []);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [advisorId]);

  return { clients, loading };
}
```

- [ ] **Step 2: Create `advisor-app/src/clients/ClientList.module.css`**

```css
.list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 20px;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px 20px;
  cursor: pointer;
}

.row:hover {
  border-color: var(--accent);
}

.email {
  font-weight: 700;
}

.arrow {
  color: var(--accent);
  font-weight: 700;
  font-size: 0.85rem;
}

.empty {
  color: var(--text2);
  text-align: center;
  padding: 60px 0;
}
```

- [ ] **Step 3: Create `advisor-app/src/clients/ClientList.jsx`**

```javascript
import { useClientList } from './useClientList.js';
import styles from './ClientList.module.css';

export default function ClientList({ advisorId, onSelect }) {
  const { clients, loading } = useClientList(advisorId);

  if (loading) return null;
  if (!clients.length) {
    return <div className={styles.empty}>אין עדיין לקוחות מחוברים</div>;
  }

  return (
    <div className={styles.list}>
      {clients.map(c => (
        <div key={c.id} className={styles.row} onClick={() => onSelect(c.client_id, c.client_email)}>
          <div className={styles.email}>{c.client_email}</div>
          <div className={styles.arrow}>כניסה לתקציב ←</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Wire into `App.jsx`**

```javascript
import { useState } from 'react';
import { useSession } from './auth/useSession.js';
import Login from './auth/Login.jsx';
import Shell from './components/Shell.jsx';
import ClientList from './clients/ClientList.jsx';

export default function App() {
  const { session, loading } = useSession();
  const [selectedClient, setSelectedClient] = useState(null);

  if (loading) return null;
  if (!session) return <Login />;

  if (!selectedClient) {
    return (
      <Shell title="לקוחות">
        <ClientList
          advisorId={session.user.id}
          onSelect={(clientId, clientEmail) => setSelectedClient({ id: clientId, email: clientEmail })}
        />
      </Shell>
    );
  }

  return <Shell title={selectedClient.email}>בקרוב: ניהול תקציב</Shell>;
}
```

- [ ] **Step 5: Verify with Playwright**

Navigate to `http://localhost:5173/`. Since there is no live authenticated
session in this dev environment, `useSession()` will resolve `session` to
`null` and the Login screen renders — this is expected and correct
behavior; note in the report that the client-list rendering itself (empty
state and populated state) cannot be exercised without a real Supabase
session, matching the same documented limitation prior advisor-core tasks
hit. To verify the component logic without live auth, temporarily mount
`<ClientList advisorId="00000000-0000-0000-0000-000000000000" onSelect={() => {}} />`
directly in a scratch `App.jsx` edit, confirm the "אין עדיין לקוחות מחוברים"
empty state renders (that UUID has no rows), then revert `App.jsx` to the
real Step 4 version.

- [ ] **Step 6: Commit**

```bash
git add advisor-app/src/clients/useClientList.js advisor-app/src/clients/ClientList.jsx advisor-app/src/clients/ClientList.module.css advisor-app/src/App.jsx
git commit -m "add client list screen to advisor-app"
```

---

### Task 7: Client budget data hook

**Files:**
- Create: `advisor-app/src/budget/useClientBudget.js`
- Create: `advisor-app/src/categories.js`

**Interfaces:**
- Consumes: `supabase`.
- Produces: `export const EXPENSE_CATS, FIXED_CATS, INCOME_CATS, BUDGET_CATS`
  (copied verbatim from `index.html:2413-2429`); `useClientBudget(clientUserId)`
  hook returning `{data, loading, error, save}` where `data` is the raw
  `budget_data` row (`{transactions, budgets, goals, ...}` or `null` if the
  client has no row yet) and `save(patch)` is an async function that merges
  `patch` into the current row and writes it back via
  `.update(patch).eq('user_id', clientUserId)`, then updates local state.
  This hook is the single data-access point every screen task (8-10) builds
  on.

- [ ] **Step 1: Create `advisor-app/src/categories.js`**

```javascript
export const EXPENSE_CATS = ['מזון לבית','אוכל בחוץ ובילויים','פארם','דלק וחניה','מתנות לאירועים ולשמחות','ביגוד והנעלה','תחב״צ','כבישי אגרה','תספורת וקוסמטיקה','תחביבים','סיגריות','חופשה/טיול','עזרת/שמרטף','תיקוני רכב','בריאות','בעלי חיים','דמי כיס/ילדים','יהדות/חגים','ביטוח לאומי','שונות'];
export const FIXED_CATS = ['משכנתא','שכר דירה','ועד בית','גז','ארנונה','מים וביוב','חשמל','תרומות בהוראת קבע','חינוך, חוגים וקייטנות','ביטוחי בריאות וחיים','מניות','ביטוח בריאות','ריבית על המינוס','עמלת פעולות בערוץ ישיר','עמלת SMS','דמי כרטיס אשראי','החזר הלוואות + חיוב קבוע','עסקאות בתשלומים'];
export const BUDGET_CATS = [...EXPENSE_CATS, ...FIXED_CATS.filter(c => !EXPENSE_CATS.includes(c))];
export const INCOME_CATS = ['שכר','שכר בן/בת זוג','פרילנס','קצבת ילדים','קצבאות','הכנסה מנכס','מזונות','מתנות','השקעות','אחר'];
```

- [ ] **Step 2: Create `advisor-app/src/budget/useClientBudget.js`**

```javascript
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';

const EMPTY = { transactions: [], budgets: {}, goals: [], subscriptions: [], loans: [], fixed_expenses: [] };

export function useClientBudget(clientUserId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!clientUserId) return;
    setLoading(true);
    const { data: row, error } = await supabase
      .from('budget_data')
      .select('*')
      .eq('user_id', clientUserId)
      .maybeSingle();
    if (error) { setError(error); setLoading(false); return; }
    setData(row || { user_id: clientUserId, ...EMPTY });
    setError(null);
    setLoading(false);
  }, [clientUserId]);

  useEffect(() => { reload(); }, [reload]);

  const save = useCallback(async (patch) => {
    if (!clientUserId) return;
    const next = { ...(data || EMPTY), ...patch };
    setData(next);
    const { error } = await supabase
      .from('budget_data')
      .update(patch)
      .eq('user_id', clientUserId);
    if (error) setError(error);
  }, [clientUserId, data]);

  return { data, loading, error, save, reload };
}
```

- [ ] **Step 3: Verify with Playwright**

Temporarily mount a scratch component in `App.jsx` that calls
`useClientBudget('00000000-0000-0000-0000-000000000000')` and renders
`JSON.stringify(data)`; navigate with Playwright, confirm no console errors
and that the rendered text shows the `EMPTY`-shaped fallback object (since
that UUID has no `budget_data` row). Revert `App.jsx` afterward — this hook
has no UI of its own; Tasks 8-10 are its real consumers.

- [ ] **Step 4: Commit**

```bash
git add advisor-app/src/budget/useClientBudget.js advisor-app/src/categories.js
git commit -m "add client budget data hook and category constants"
```

---

### Task 8: Dashboard screen

**Files:**
- Create: `advisor-app/src/budget/Dashboard.jsx`
- Create: `advisor-app/src/budget/Dashboard.module.css`
- Create: `advisor-app/src/budget/monthUtils.js`
- Modify: `advisor-app/src/App.jsx`

**Interfaces:**
- Consumes: `useClientBudget()` (Task 7).
- Produces: `mk(year, month)` and `getMonthTx(transactions, year, month)`
  helpers (mirroring `index.html:2549`'s logic exactly — `date.startsWith`
  on a `'YYYY-MM'` prefix), `<Dashboard clientUserId>` component showing
  current-month income total, expense total, and net.

- [ ] **Step 1: Create `advisor-app/src/budget/monthUtils.js`**

```javascript
export function mk(y, m) {
  return y + '-' + String(m + 1).padStart(2, '0');
}

export function getMonthTx(transactions, y, m) {
  const prefix = mk(y, m);
  return (transactions || []).filter(t => t.date && t.date.startsWith(prefix));
}
```

- [ ] **Step 2: Create `advisor-app/src/budget/Dashboard.module.css`**

```css
.cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-top: 20px;
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 20px;
}

.label {
  color: var(--text2);
  font-size: 0.82rem;
  margin-bottom: 8px;
}

.value {
  font-size: 1.6rem;
  font-weight: 800;
}

.income { color: var(--green); }
.expense { color: var(--red); }
```

- [ ] **Step 3: Create `advisor-app/src/budget/Dashboard.jsx`**

```javascript
import { useClientBudget } from './useClientBudget.js';
import { getMonthTx } from './monthUtils.js';
import styles from './Dashboard.module.css';

const fmt = n => '₪' + Math.round(n).toLocaleString('he-IL');

export default function Dashboard({ clientUserId }) {
  const { data, loading } = useClientBudget(clientUserId);
  if (loading || !data) return null;

  const now = new Date();
  const monthTx = getMonthTx(data.transactions, now.getFullYear(), now.getMonth());
  const income = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  return (
    <div className={styles.cards}>
      <div className={styles.card}>
        <div className={styles.label}>הכנסות החודש</div>
        <div className={styles.value + ' ' + styles.income}>{fmt(income)}</div>
      </div>
      <div className={styles.card}>
        <div className={styles.label}>הוצאות החודש</div>
        <div className={styles.value + ' ' + styles.expense}>{fmt(expense)}</div>
      </div>
      <div className={styles.card}>
        <div className={styles.label}>מאזן</div>
        <div className={styles.value}>{fmt(income - expense)}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire into `App.jsx`, replacing the "בקרוב" placeholder**

```javascript
import { useState } from 'react';
import { useSession } from './auth/useSession.js';
import Login from './auth/Login.jsx';
import Shell from './components/Shell.jsx';
import ClientList from './clients/ClientList.jsx';
import Dashboard from './budget/Dashboard.jsx';

export default function App() {
  const { session, loading } = useSession();
  const [selectedClient, setSelectedClient] = useState(null);

  if (loading) return null;
  if (!session) return <Login />;

  if (!selectedClient) {
    return (
      <Shell title="לקוחות">
        <ClientList
          advisorId={session.user.id}
          onSelect={(clientId, clientEmail) => setSelectedClient({ id: clientId, email: clientEmail })}
        />
      </Shell>
    );
  }

  return (
    <Shell
      title={selectedClient.email}
      right={<button onClick={() => setSelectedClient(null)}>← חזרה ללקוחות</button>}
    >
      <Dashboard clientUserId={selectedClient.id} />
    </Shell>
  );
}
```

- [ ] **Step 5: Verify with Playwright**

Same scratch-mount technique as Task 7: temporarily render
`<Dashboard clientUserId="00000000-0000-0000-0000-000000000000" />` directly
in `App.jsx`, navigate, screenshot, confirm three cards render with `₪0`
values (no transactions for that UUID) and no console errors. Revert to the
real Step 4 `App.jsx`.

- [ ] **Step 6: Commit**

```bash
git add advisor-app/src/budget/Dashboard.jsx advisor-app/src/budget/Dashboard.module.css advisor-app/src/budget/monthUtils.js advisor-app/src/App.jsx
git commit -m "add client dashboard screen to advisor-app"
```

---

### Task 9: Expenses screen (list + add + delete transactions)

**Files:**
- Create: `advisor-app/src/budget/Expenses.jsx`
- Create: `advisor-app/src/budget/Expenses.module.css`
- Modify: `advisor-app/src/components/Shell.jsx` (add a simple tab nav)
- Modify: `advisor-app/src/components/Shell.module.css`
- Modify: `advisor-app/src/App.jsx`

**Interfaces:**
- Consumes: `useClientBudget()`, `EXPENSE_CATS`/`INCOME_CATS` from `categories.js`.
- Produces: `<Expenses clientUserId>` — lists current-month transactions
  (newest first), a form to add one, a delete action per row. `<Shell>`
  gains a `tabs`/`activeTab`/`onTabChange` prop so `App.jsx` can switch
  between "דשבורד" / "הוצאות" / "תקציב" / "ניתוח" for the selected client.

- [ ] **Step 1: Add tab support to `Shell.jsx`**

```javascript
import styles from './Shell.module.css';

export default function Shell({ title, right, tabs, activeTab, onTabChange, children }) {
  return (
    <div className={styles.shell} dir="rtl">
      <div className={styles.topbar}>
        <div className={styles.logo}>Budget Advisor</div>
        {right}
      </div>
      {tabs && (
        <div className={styles.tabs}>
          {tabs.map(t => (
            <button
              key={t}
              className={styles.tab + (t === activeTab ? ' ' + styles.tabActive : '')}
              onClick={() => onTabChange(t)}
            >
              {t}
            </button>
          ))}
        </div>
      )}
      <div className={styles.content}>
        {title && <h1>{title}</h1>}
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add tab styles to `Shell.module.css`**

Append to the existing file:

```css
.tabs {
  display: flex;
  gap: 4px;
  padding: 0 32px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

.tab {
  padding: 12px 18px;
  background: none;
  border: none;
  color: var(--text2);
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  border-bottom: 2px solid transparent;
}

.tabActive {
  color: var(--accent);
  border-bottom-color: var(--accent);
}
```

- [ ] **Step 3: Create `advisor-app/src/budget/Expenses.module.css`**

```css
.form {
  display: flex;
  gap: 8px;
  margin: 20px 0;
  flex-wrap: wrap;
}

.input, .select {
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface2);
  color: var(--text);
  font-size: 0.88rem;
}

.button {
  padding: 10px 18px;
  border-radius: 8px;
  border: none;
  background: var(--accent);
  color: #0b1210;
  font-weight: 700;
  cursor: pointer;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px 16px;
}

.meta {
  color: var(--text2);
  font-size: 0.8rem;
}

.del {
  background: none;
  border: none;
  color: var(--red);
  cursor: pointer;
  font-size: 0.85rem;
}
```

- [ ] **Step 4: Create `advisor-app/src/budget/Expenses.jsx`**

```javascript
import { useState } from 'react';
import { useClientBudget } from './useClientBudget.js';
import { getMonthTx } from './monthUtils.js';
import { EXPENSE_CATS, INCOME_CATS } from '../categories.js';
import styles from './Expenses.module.css';

const fmt = n => '₪' + Math.round(n).toLocaleString('he-IL');

export default function Expenses({ clientUserId }) {
  const { data, loading, save } = useClientBudget(clientUserId);
  const [type, setType] = useState('expense');
  const [cat, setCat] = useState(EXPENSE_CATS[0]);
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');

  if (loading || !data) return null;

  const now = new Date();
  const monthTx = getMonthTx(data.transactions, now.getFullYear(), now.getMonth())
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  async function addTx() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    const tx = {
      id: Date.now() + Math.random(),
      type,
      cat,
      desc: desc.trim() || cat,
      amount: amt,
      date: now.toISOString().slice(0, 10),
      recurring: false,
      fixed: false
    };
    await save({ transactions: [tx, ...(data.transactions || [])] });
    setDesc('');
    setAmount('');
  }

  async function removeTx(id) {
    await save({ transactions: (data.transactions || []).filter(t => t.id !== id) });
  }

  const cats = type === 'expense' ? EXPENSE_CATS : INCOME_CATS;

  return (
    <div>
      <div className={styles.form}>
        <select className={styles.select} value={type} onChange={e => { setType(e.target.value); setCat(e.target.value === 'expense' ? EXPENSE_CATS[0] : INCOME_CATS[0]); }}>
          <option value="expense">הוצאה</option>
          <option value="income">הכנסה</option>
        </select>
        <select className={styles.select} value={cat} onChange={e => setCat(e.target.value)}>
          {cats.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input className={styles.input} placeholder="תיאור" value={desc} onChange={e => setDesc(e.target.value)} />
        <input className={styles.input} type="number" placeholder="סכום" value={amount} onChange={e => setAmount(e.target.value)} />
        <button className={styles.button} onClick={addTx}>הוסף</button>
      </div>
      <div className={styles.list}>
        {monthTx.map(t => (
          <div key={t.id} className={styles.row}>
            <div>
              <div>{t.desc}</div>
              <div className={styles.meta}>{t.cat} · {t.date}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ color: t.type === 'income' ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
              </div>
              <button className={styles.del} onClick={() => removeTx(t.id)}>✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Wire tabs + Expenses into `App.jsx`**

```javascript
import { useState } from 'react';
import { useSession } from './auth/useSession.js';
import Login from './auth/Login.jsx';
import Shell from './components/Shell.jsx';
import ClientList from './clients/ClientList.jsx';
import Dashboard from './budget/Dashboard.jsx';
import Expenses from './budget/Expenses.jsx';

const TABS = ['דשבורד', 'הוצאות', 'תקציב', 'ניתוח'];

export default function App() {
  const { session, loading } = useSession();
  const [selectedClient, setSelectedClient] = useState(null);
  const [tab, setTab] = useState(TABS[0]);

  if (loading) return null;
  if (!session) return <Login />;

  if (!selectedClient) {
    return (
      <Shell title="לקוחות">
        <ClientList
          advisorId={session.user.id}
          onSelect={(clientId, clientEmail) => setSelectedClient({ id: clientId, email: clientEmail })}
        />
      </Shell>
    );
  }

  return (
    <Shell
      title={selectedClient.email}
      right={<button onClick={() => setSelectedClient(null)}>← חזרה ללקוחות</button>}
      tabs={TABS}
      activeTab={tab}
      onTabChange={setTab}
    >
      {tab === 'דשבורד' && <Dashboard clientUserId={selectedClient.id} />}
      {tab === 'הוצאות' && <Expenses clientUserId={selectedClient.id} />}
    </Shell>
  );
}
```

- [ ] **Step 6: Verify with Playwright**

Scratch-mount `<Expenses clientUserId="00000000-0000-0000-0000-000000000000" />`
directly, navigate, confirm the add-transaction form renders (type/category
selects, description/amount inputs, "הוסף" button) and the list is empty.
Fill the form (`mcp__playwright__browser_type`/`browser_select_option`) and
click "הוסף"; confirm a new row appears with the entered description and
amount, then click "✕" and confirm it's removed. Revert `App.jsx` to the
real Step 5 version afterward.

- [ ] **Step 7: Commit**

```bash
git add advisor-app/src/budget/Expenses.jsx advisor-app/src/budget/Expenses.module.css advisor-app/src/components/Shell.jsx advisor-app/src/components/Shell.module.css advisor-app/src/App.jsx
git commit -m "add expenses screen and tab navigation to advisor-app"
```

---

### Task 10: Budget screen (per-category limits, current month spent-vs-limit)

**Files:**
- Create: `advisor-app/src/budget/Budget.jsx`
- Create: `advisor-app/src/budget/Budget.module.css`
- Modify: `advisor-app/src/App.jsx`

**Interfaces:**
- Consumes: `useClientBudget()`, `BUDGET_CATS` from `categories.js`, `getMonthTx()`.
- Produces: `<Budget clientUserId>` — a form to set/update a category's
  monthly limit, a list of categories with a limit showing spent vs. limit
  for the current month (no rollover — see Global Constraints).

- [ ] **Step 1: Create `advisor-app/src/budget/Budget.module.css`**

```css
.form {
  display: flex;
  gap: 8px;
  margin: 20px 0;
}

.select, .input {
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface2);
  color: var(--text);
  font-size: 0.88rem;
}

.button {
  padding: 10px 18px;
  border-radius: 8px;
  border: none;
  background: var(--accent);
  color: #0b1210;
  font-weight: 700;
  cursor: pointer;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.item {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px 18px;
}

.itemTop {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-weight: 700;
}

.bar {
  height: 6px;
  border-radius: 3px;
  background: var(--surface2);
  overflow: hidden;
}

.fill {
  height: 100%;
}
```

- [ ] **Step 2: Create `advisor-app/src/budget/Budget.jsx`**

```javascript
import { useState } from 'react';
import { useClientBudget } from './useClientBudget.js';
import { getMonthTx } from './monthUtils.js';
import { BUDGET_CATS } from '../categories.js';
import styles from './Budget.module.css';

const fmt = n => '₪' + Math.round(n).toLocaleString('he-IL');

export default function Budget({ clientUserId }) {
  const { data, loading, save } = useClientBudget(clientUserId);
  const [cat, setCat] = useState(BUDGET_CATS[0]);
  const [limit, setLimit] = useState('');

  if (loading || !data) return null;

  const budgets = data.budgets || {};
  const now = new Date();
  const monthTx = getMonthTx(data.transactions, now.getFullYear(), now.getMonth());
  const spentByCat = {};
  monthTx.filter(t => t.type === 'expense').forEach(t => {
    spentByCat[t.cat] = (spentByCat[t.cat] || 0) + t.amount;
  });

  async function setBudget() {
    const amt = parseFloat(limit);
    if (!amt || amt <= 0) return;
    await save({ budgets: { ...budgets, [cat]: amt } });
    setLimit('');
  }

  const activeCats = Object.keys(budgets).filter(c => budgets[c]).sort();

  return (
    <div>
      <div className={styles.form}>
        <select className={styles.select} value={cat} onChange={e => setCat(e.target.value)}>
          {BUDGET_CATS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input className={styles.input} type="number" placeholder="תקרה חודשית" value={limit} onChange={e => setLimit(e.target.value)} />
        <button className={styles.button} onClick={setBudget}>שמור תקציב</button>
      </div>
      <div className={styles.list}>
        {activeCats.map(c => {
          const s = spentByCat[c] || 0;
          const l = budgets[c];
          const pct = Math.min(Math.round((s / l) * 100), 100);
          const color = pct >= 100 ? 'var(--red)' : pct >= 80 ? 'var(--yellow)' : 'var(--green)';
          return (
            <div key={c} className={styles.item}>
              <div className={styles.itemTop}>
                <span>{c}</span>
                <span>{fmt(s)} / {fmt(l)}</span>
              </div>
              <div className={styles.bar}>
                <div className={styles.fill} style={{ width: pct + '%', background: color }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire into `App.jsx`**

Add the import and render branch:

```javascript
import Budget from './budget/Budget.jsx';
```

and inside the tab-content block:

```javascript
      {tab === 'תקציב' && <Budget clientUserId={selectedClient.id} />}
```

- [ ] **Step 4: Verify with Playwright**

Scratch-mount `<Budget clientUserId="00000000-0000-0000-0000-000000000000" />`,
navigate, confirm the "set budget" form renders and the list is empty
(no budgets for that UUID). Select a category, type a limit, click "שמור
תקציב"; confirm a new item appears showing `₪0 / ₪<limit>` with a green
progress bar at 0%. Revert `App.jsx` afterward.

- [ ] **Step 5: Commit**

```bash
git add advisor-app/src/budget/Budget.jsx advisor-app/src/budget/Budget.module.css advisor-app/src/App.jsx
git commit -m "add budget screen to advisor-app"
```

---

### Task 11: Analysis screen (category breakdown chart)

**Files:**
- Create: `advisor-app/src/budget/Analysis.jsx`
- Create: `advisor-app/src/budget/Analysis.module.css`
- Modify: `advisor-app/src/App.jsx`

**Interfaces:**
- Consumes: `useClientBudget()`, `getMonthTx()`, `react-chartjs-2`'s `Pie` component.
- Produces: `<Analysis clientUserId>` — a pie chart of current-month expense
  totals grouped by category.

- [ ] **Step 1: Create `advisor-app/src/budget/Analysis.module.css`**

```css
.wrap {
  max-width: 480px;
  margin: 20px auto;
}

.empty {
  color: var(--text2);
  text-align: center;
  padding: 60px 0;
}
```

- [ ] **Step 2: Create `advisor-app/src/budget/Analysis.jsx`**

```javascript
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { useClientBudget } from './useClientBudget.js';
import { getMonthTx } from './monthUtils.js';
import styles from './Analysis.module.css';

ChartJS.register(ArcElement, Tooltip, Legend);

const PALETTE = ['#2dd4bf', '#f87171', '#fbbf24', '#60a5fa', '#a78bfa', '#f472b6', '#34d399', '#fb923c'];

export default function Analysis({ clientUserId }) {
  const { data, loading } = useClientBudget(clientUserId);
  if (loading || !data) return null;

  const now = new Date();
  const monthTx = getMonthTx(data.transactions, now.getFullYear(), now.getMonth())
    .filter(t => t.type === 'expense');

  if (!monthTx.length) {
    return <div className={styles.empty}>אין הוצאות החודש</div>;
  }

  const byCat = {};
  monthTx.forEach(t => { byCat[t.cat] = (byCat[t.cat] || 0) + t.amount; });
  const labels = Object.keys(byCat);
  const values = labels.map(l => byCat[l]);

  const chartData = {
    labels,
    datasets: [{
      data: values,
      backgroundColor: labels.map((_, i) => PALETTE[i % PALETTE.length])
    }]
  };

  return (
    <div className={styles.wrap}>
      <Pie data={chartData} options={{ plugins: { legend: { labels: { color: '#f2f5f4' } } } }} />
    </div>
  );
}
```

- [ ] **Step 3: Wire into `App.jsx`**

Add the import and render branch:

```javascript
import Analysis from './budget/Analysis.jsx';
```

```javascript
      {tab === 'ניתוח' && <Analysis clientUserId={selectedClient.id} />}
```

- [ ] **Step 4: Verify with Playwright**

Scratch-mount `<Analysis clientUserId="00000000-0000-0000-0000-000000000000" />`,
navigate, confirm the "אין הוצאות החודש" empty state renders (no
transactions for that UUID) with no console errors. Revert `App.jsx`
afterward.

- [ ] **Step 5: Commit**

```bash
git add advisor-app/src/budget/Analysis.jsx advisor-app/src/budget/Analysis.module.css advisor-app/src/App.jsx
git commit -m "add analysis screen to advisor-app"
```

---

### Task 12: Remove the desktop-advisor code from `index.html`

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: nothing new.
- Produces: `index.html` with all desktop-sidebar/client-console code
  removed, while keeping the client-side invite-generation and
  redeem-code UI (per the design spec's "Cleanup" section).

- [ ] **Step 1: Locate and remove the desktop sidebar CSS**

Find the `@media(min-width:1024px)` block gated on `body.is-advisor`
(around `index.html:100-111`, containing rules for `.bottom-nav`,
`.nav-item`, `.fab`, `main`, `.cards-row`, `#page-dashboard .grid-cols-2`)
and the `body.is-advisor.advisor-viewing-client .advisor-view-bar` rule
just above it. Remove both.

- [ ] **Step 2: Remove the nav-visibility toggle from `_applyAdvisorGate()`**

Find `_applyAdvisorGate()` (added across the prior desktop-layout and
advisor-core plans). It currently does:
```javascript
function _applyAdvisorGate(){
  document.body.classList.toggle('is-advisor', _isAdvisor);
  const navBtn=document.getElementById('nav-advisorClients');
  if(navBtn)navBtn.style.display=_isAdvisor?'':'none';
}
```
Simplify it to just the class toggle (keep `_isAdvisor`/`_loadAdvisorStatus()`
themselves — still meaningful per the design spec):
```javascript
function _applyAdvisorGate(){
  document.body.classList.toggle('is-advisor', _isAdvisor);
}
```

- [ ] **Step 3: Remove the advisor nav button and page markup**

Find and delete the `<button ... id="nav-advisorClients" ...>` element
(inserted into `<nav class="bottom-nav">`) and the
`<div id="page-advisorClients" class="page">...</div>` block.

- [ ] **Step 4: Remove the advisor-view-bar markup**

Find and delete the `<div class="advisor-view-bar" id="advisorViewBar">...</div>` element.

- [ ] **Step 5: Remove `renderAdvisorClients()`, `enterClientBudget()`, `exitClientBudget()`, and their globals**

Find and delete:
- `async function renderAdvisorClients(){...}`
- `let _advisorViewingClient=null;`
- `let _advisorPriorHouseholdOwner=null;`
- `async function enterClientBudget(clientUserId,clientName){...}`
- `async function exitClientBudget(){...}`

- [ ] **Step 6: Remove the `showPage()` branch for `advisorClients`**

Find `if(name==='advisorClients') renderAdvisorClients();` inside
`showPage()` and delete that line.

- [ ] **Step 7: Verify what remains — invite/redeem UI must still be intact**

Grep the file for `createAdvisorInvite`, `renderAdvisorLinkSection`,
`redeemAdvisorInvite`, `#advisorLinkSection`, `#advisorRedeemCodeInput` —
all must still be present (untouched by this task). Grep for
`renderAdvisorClients`, `enterClientBudget`, `exitClientBudget`,
`nav-advisorClients`, `page-advisorClients`, `advisor-view-bar` — all must
return zero matches.

- [ ] **Step 8: Verify mobile rendering is unaffected**

Start a static server rooted at the project directory. `python -m
http.server` is unreliable on Windows in this environment — use a small
Node one-liner instead:

```bash
node -e "require('http').createServer((req,res)=>{const fs=require('fs'),path=require('path');let p=path.join(process.cwd(),req.url==='/'?'/index.html':req.url);fs.readFile(p,(e,d)=>{if(e){res.writeHead(404);res.end();return;}res.end(d);});}).listen(8123)" &
```

Navigate to `http://localhost:8123/index.html` with
`mcp__playwright__browser_navigate`, then bypass the auth/onboarding gate
by running this in the page console via `mcp__playwright__browser_evaluate`:

```javascript
() => {
  if (typeof authSkip === 'function') authSkip();
  localStorage.setItem('budget_onboarded', '1');
  document.getElementById('onboardOverlay')?.classList.remove('open');
  document.getElementById('installBanner')?.classList.remove('show');
}
```

Reload the page, resize the viewport to a mobile width (e.g. 390x844 via
`mcp__playwright__browser_resize`), take a screenshot, and confirm the
dashboard page still renders normally (same layout as before this task's
edit) with no console errors (`mcp__playwright__browser_console_messages`).
Stop the background static server afterward.

- [ ] **Step 9: Commit**

```bash
git add index.html
git commit -m "remove desktop-advisor code from index.html, superseded by advisor-app"
```

---

### Task 13: Deploy verification

**Files:** none (verification only).

- [ ] **Step 1: Confirm CI secret availability**

Confirm the `SUPABASE_ANON` GitHub Actions secret referenced by Task 3's
workflow step already exists (it's used today by the pre-existing "Inject
Supabase anon key" step) — no new secret needs to be created.

- [ ] **Step 2: Push and monitor the deploy**

After all prior tasks are committed and pushed to `main` (per this
project's deploy trigger), confirm the GitHub Actions workflow run
succeeds (both the `advisor-app` build step and the Pages deploy step).

- [ ] **Step 3: Verify the deployed advisor app**

```bash
curl -s -o /dev/null -w "%{http_code}" https://davidtheking28-oss.github.io/budget-app/advisor/
```
Expected: `200`.

```bash
curl -s https://davidtheking28-oss.github.io/budget-app/advisor/ | grep -c "Budget Advisor"
```
Expected: non-zero (the Vite dev-server HTML title/shell references the app name, or check for the built asset script tag instead if the title isn't present in the static shell — confirm by reading the actual built `advisor/index.html` output from Task 1 Step 9 first to know exactly what string to grep for).

- [ ] **Step 4: Verify `index.html` still deploys correctly**

```bash
curl -s https://davidtheking28-oss.github.io/budget-app/index.html | grep -c "nav-advisorClients"
```
Expected: `0` (confirms Task 12's cleanup deployed correctly).

- [ ] **Step 5: Report final URLs to the user**

State both live URLs: `https://davidtheking28-oss.github.io/budget-app/`
(client app, unchanged) and `https://davidtheking28-oss.github.io/budget-app/advisor/`
(new advisor app).
