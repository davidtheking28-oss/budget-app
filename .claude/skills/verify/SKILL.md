---
name: verify
description: How to run and drive this app locally for runtime verification (bypassing auth, reaching the main UI)
---

# Verifying budget-app locally

Single HTML file, no build. Serve and drive with Playwright at mobile viewport (390x844).

```bash
npx -y http-server "c:/Users/david/projects/ai-budget" -p 8642 --silent   # run_in_background
```

Navigate to `http://localhost:8642/index.html`, then:

1. **Auth gate**: Gmail-only login screen, not automatable (see memory). Bypass:
   `page.evaluate(() => authSkip())` — hides `#authScreen`, proceeds with local-only data.
2. **Demo data**: `page.evaluate(() => loadDemo())` — populates transactions/goals/subs so the dashboard has real-looking numbers.
3. **Onboarding overlay** (`#onboardOverlay`) blocks clicks on first run — click the "דלג ›" button.
4. Quick-add wizard opens via `#fab`. Dark mode: `document.body.classList.add('dark')`.

Gotchas:
- Toasts (`#toast.show`) intercept pointer events while visible — wait them out before clicking near the bottom.
- Typing in `#txDesc` fires the `parse-expense` edge function → 401 when unauthenticated; harmless locally.
- Playwright screenshots land in the repo root — delete them after.
- Verify a Pages deploy by grepping the live URL for a marker string from the diff.
