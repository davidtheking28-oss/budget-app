---
name: verify
description: How to run and drive this app locally for runtime verification (bypassing auth, reaching the main UI)
---

# Verifying budget-app locally

Single HTML file, no build. Serve and drive with Playwright.

```bash
npx -y http-server "c:/Users/david/projects/ai-budget" -p 8642 --silent   # run_in_background
```

Playwright is not a dependency of the repo root — run driver scripts from
`advisor-app/`, which has it installed.

## Reaching the app with data

There is **no `loadDemo()`** — the app reads its state from `localStorage` once at
module init, so seed the keys in an init script and let the normal boot path load
them. Mutating the live `transactions`/`budgets` bindings after load leaves the
already-rendered DOM stale.

Keys (personal mode; other modes suffix `_<mode>` via `_modeKey`):
`budget_tx`, `budget_goals`, `budget_subs`, `budget_limits`, `budget_fixed`,
`budget_settings`. Transaction shape:
`{id, type:'income'|'expense', cat, desc, amount, date:'YYYY-MM-DD', recurring}` —
`cat` must come from `EXPENSE_CATS`/`FIXED_CATS`/`INCOME_CATS`, and the date must
fall in the month under test or the dashboard reads empty.

```js
await page.addInitScript(seed => {
  for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
  localStorage.setItem('auth_skipped', '1');
  localStorage.setItem('budget_onboarded', '1');   // suppresses #onboardOverlay
}, seed);

await page.goto('http://localhost:8642/index.html');
await page.waitForLoadState('networkidle');
await page.evaluate(() => authSkip()).catch(() => {});   // may race a navigation
await page.waitForSelector('#authScreen', { state: 'hidden' });
```

`auth_skipped` alone is **not** enough: it lets the app boot, but `#authScreen`
stays on top until `authSkip()` runs `hideAuthScreen()`. That hide is animated to
`visibility:hidden; opacity:0` and the element keeps `display:flex` at full
viewport size — so assert on `visibility`, never on `display:none`, and don't use
`getBoundingClientRect()` to decide whether it's gone.

Tabs: `ראשי`, `הוצאות`, `תקציב`, `ניתוח`, `הגדרות`. Quick-add wizard: `#fab`.
Dark mode: `document.body.classList.add('dark')` (persisted as `budget_theme`).

## Gotchas

- Toasts (`#toast.show`) intercept pointer events while visible — wait them out
  before clicking near the bottom.
- Typing in `#txDesc` fires the `parse-expense` edge function → 401 when
  unauthenticated; harmless locally.
- Theme and contrast must be checked on a **real page load**. Toggling `body.dark`
  mid-session and reading computed styles in the same tick reports false failures.
- Filter emoji out of any contrast sweep — they are colour glyphs, not text, and
  measuring them manufactures failures.
- Screenshots: write to the session scratchpad dir, not the repo. The Playwright
  **MCP** refuses paths outside the repo root and drops them in `.playwright-mcp/`
  — delete that directory afterwards. A plain `playwright` driver script has no
  such restriction, so prefer it.
- Stop only the PIDs you started. Never `taskkill /IM node.exe` — it kills the
  user's other sessions.
- Verify a Pages deploy by grepping the live URL for a marker from the diff.

## advisor-app

Auth is Supabase and not automatable. Use the mock-Supabase harness:
`npx vite --config vite.audit.config.js` (stubs the client via a `resolve.alias`
so every screen renders with fake data from `src/__audit/`). The alias pattern
must be `/^.*\/supabaseClient\.js$/` — a bare `/supabaseClient\.js$/` replaces
only the matched fragment and produces a broken absolute path.

Theme is applied at module load, so set `localStorage.advisor_theme = 'dark'`
**before** navigating, then reload. Toggling it mid-session gives false readings.
