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

**Do not delete `advisor-app/src/__audit/` or `vite.audit.config.js`.** Supabase
auth is not automatable, so this mock-client harness is the only way to render
the advisor screens for visual/contrast verification
(`npx vite --config vite.audit.config.js`). It has been rebuilt from scratch
twice after being deleted. It carries no credentials and is excluded from the
production build. See the `verify` skill for how to drive both apps.

**The Supabase project is shared with the trading-journal app.** Budget owns
`budget_data`, `households`, `push_subscriptions`, `push_log`, `ai_requests`,
`support_messages`, `client_errors`, `incoming_expenses`, `expense_hooks`,
`economic_mappings`, `report_shares`, every `advisor*` table, and these edge
functions: `parse-receipt`, `parse-expense`, `parse-statement` (statement
pages → transactions), `summarize-meeting` (advisor meeting summaries),
`apple-pay-ingest` (token-authenticated expense webhook), `delete-account`
(uses the service role; deletes only budget-owned rows) and `budget-push`
(renamed from `push-daily`, which the trading-journal CI redeploys over with its own stale copy). Everything else
(`trades`, `screener_*`, `investments`, `market_cache`, `app_secrets`, `flex_*`)
belongs to the trading journal — leave it alone. Edge-function secrets are shared;
`parse-expense`/`parse-receipt`/`parse-statement`/`summarize-meeting` use `GROQ_API_KEY` (Groq's free tier — text +
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

**Theme and data flow** are documented in `.claude/rules/frontend.md`; Supabase
conventions in `.claude/rules/supabase.md`. Both load automatically.

---

## Rules

@C:\Users\david\.claude\rules\behavior.md
@C:\Users\david\.claude\rules\code-style.md
@C:\Users\david\.claude\rules\git-workflow.md

---

## Supabase SQL — Use MCP
When SQL needs to run against the Supabase project, use the `supabase` MCP server directly — do not tell the user to paste SQL manually.

## Knowledge Base
Personal prompts, frameworks, and lessons: `C:\Users\david\.claude\knowledge-base.md`
