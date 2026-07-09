# Project: AI Budget

## What it is
Personal budget & investment tracking app — single HTML file on GitHub Pages, Supabase backend.

**Stack:**
- Frontend: `index.html` — all CSS, HTML, JS in one file
- Backend: Supabase (auth, database, Edge Functions)
- Hosting: GitHub Pages → `https://davidtheking28-oss.github.io/budget-app/`
- Supabase project ref: `fnklrqxwyeibfptaxewf`

**The Supabase project is shared with the trading-journal app.** Budget owns
`budget_data`, `households`, `push_subscriptions`, `push_log`, and the
`parse-receipt` / `parse-expense` / `push-daily` edge functions. Everything else
(`trades`, `screener_*`, `investments`, `market_cache`, `app_secrets`, `flex_*`)
belongs to the trading journal — leave it alone. Edge-function secrets are shared,
so `GEMINI_API_KEY` must be set in this project. The separate `inrmnhjxrwlrttbfhbly`
project is named "ai budget" but is unused — secrets added there do nothing.

**Edge functions are not deployed by CI.** `.github/workflows/deploy.yml` only
publishes `index.html` to Pages. Functions ship via the Supabase MCP.

**Verify a deploy before claiming it works** — Pages has failed transiently:
`curl -s https://davidtheking28-oss.github.io/budget-app/index.html | grep -c '>v2.8<'`

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
