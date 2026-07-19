# Project: AI Budget

## What it is
Personal budget & investment tracking app — single HTML file on GitHub Pages, Supabase backend.

**Stack:**
- Frontend: `index.html` — all CSS, HTML, JS in one file
- Backend: Supabase (auth, database, Edge Functions)
- Hosting: GitHub Pages → `https://davidtheking28-oss.github.io/budget-app/`
- Supabase project ref: `fnklrqxwyeibfptaxewf`

**Advisor platform (`advisor-app/`) is a separate React/Vite app**, branded
"Budget Advisor" — lets an advisor manage multiple clients' budgets. Built by
CI and deployed alongside the main app to `/advisor/` (see below). Local dev:
`cd advisor-app && npm run dev`; tests: `npm run test`.

**The Supabase project is shared with the trading-journal app.** Budget owns
`budget_data`, `households`, `push_subscriptions`, `push_log`, and the
`parse-receipt` / `parse-expense` / `push-daily` edge functions. Everything else
(`trades`, `screener_*`, `investments`, `market_cache`, `app_secrets`, `flex_*`)
belongs to the trading journal — leave it alone. Edge-function secrets are shared;
`parse-expense`/`parse-receipt` use `GROQ_API_KEY` (Groq's free tier — text +
vision via the OpenAI-compatible `/openai/v1/chat/completions` endpoint). The
`GEMINI_API_KEY` path was dropped after the key turned out to have zero free-tier
quota on every model. The separate `inrmnhjxrwlrttbfhbly` project is named
"ai budget" but is unused — secrets added there do nothing.

**Edge functions are not deployed by CI.** Functions ship via the Supabase MCP.
`.github/workflows/deploy.yml` publishes `index.html` (with the Supabase anon
key injected from the `SUPABASE_ANON` secret) *and* builds `advisor-app`
(`npm ci && npm run build`, using the `VITE_SUPABASE_ANON` secret) to `/advisor/`,
then deploys both to Pages together.

**Verify a deploy before claiming it works** — Pages has failed transiently:
`curl -s https://davidtheking28-oss.github.io/budget-app/index.html | grep -c '>v2.8<'`

**Actual theme (overrides the generic dark-navy spec in `frontend.md`, which
describes the trading-journal app instead):** `index.html`'s `:root` is a
light/cream theme (`--bg:#f5f4f1`, `--surface:#fff`, `--accent:#1d4ed8`), with
a `body.dark` override (`--bg:#100f0d`, `--accent:#60a5fa`) toggled via
`budget_theme` in localStorage. `frontend.md`'s "Data Flow" section
(`db.stocks`, `_rowToTrade`, etc.) also doesn't apply here — that's
trading-journal's model, not this app's.

---

## Rules

@C:\Users\david\.claude\rules\behavior.md
@C:\Users\david\.claude\rules\code-style.md
@C:\Users\david\.claude\rules\frontend.md
@C:\Users\david\.claude\rules\git-workflow.md
@C:\Users\david\.claude\rules\supabase.md

---

## Supabase SQL — Use MCP
When SQL needs to run against the Supabase project, use the `supabase` MCP server directly — do not tell the user to paste SQL manually.

## Knowledge Base
Personal prompts, frameworks, and lessons: `C:\Users\david\.claude\knowledge-base.md`
