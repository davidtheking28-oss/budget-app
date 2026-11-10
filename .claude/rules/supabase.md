# Supabase Rules

## Project
- Project ref: `fnklrqxwyeibfptaxewf`
- URL: `https://fnklrqxwyeibfptaxewf.supabase.co`
- Anon key is stored in GitHub Secrets — never hardcoded in repo (placeholder: `__SUPABASE_ANON__`)
- Edge Functions are NOT deployed by CI — ship them via the Supabase MCP. A new public function needs David's explicit approval first
- Migrations live in `supabase/migrations/` (numbered) and are applied via the Supabase MCP `apply_migration`

## Security — Non-Negotiable
- Every user-owned table MUST have RLS enabled
- Every policy MUST scope to the calling user (`user_id`, `advisor_id` or `client_id`)
- In policies always write `(select auth.uid())`, never bare `auth.uid()` — the bare form is re-evaluated per row
- Never use the service role key in frontend code
- Never expose the service role key in any committed file

## RLS Baseline Pattern
```sql
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user owns row" ON table_name
  FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
```
- Index every foreign-key column when creating a table

## Data Operations
- `budget_data` holds one row per user with the whole budget; `index.html` saves through `saveData()` → `scheduleCloudSave()` → `_doCloudSave()`, never by ad-hoc writes
- Always include `.eq('user_id', _cloudUser.id)` on UPDATE and DELETE — even with RLS (defense in depth)
- For row-per-item tables (advisor-app), use `.select().single()` after INSERT and use the returned ID — never a local fake ID

## Edge Functions
- All API keys (Groq etc.) live as Supabase Edge Function secrets — never in frontend
- Rate limit shared keys before forwarding to external APIs (see `checkRateLimit` in the existing functions)
- CORS header: `Access-Control-Allow-Origin: https://davidtheking28-oss.github.io`
