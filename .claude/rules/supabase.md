# Supabase Rules

## Project
- Project ref: `fnklrqxwyeibfptaxewf`
- URL: `https://fnklrqxwyeibfptaxewf.supabase.co`
- Anon key is stored in GitHub Secrets — never hardcoded in repo (placeholder: `__SUPABASE_ANON__`)
- Edge Functions deployed automatically via GitHub Actions on push to main

## Security — Non-Negotiable
- Every user-owned table MUST have RLS enabled
- Every policy MUST scope to `auth.uid() = user_id`
- Never use the service role key in frontend code
- Never expose the service role key in any committed file

## RLS Baseline Pattern
```sql
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user owns row" ON table_name
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

## Data Operations
- Always include `.eq('user_id', _currentUser.id)` on UPDATE and DELETE — even with RLS (defense in depth)
- Use `.select().single()` after INSERT to get the real Supabase-generated ID
- Never use local fake IDs for Supabase operations — the real ID comes back from insert
- `saveDB()` in this project is a no-op — all saves go directly through `_sb.from(...)` calls

## Edge Functions
- All API keys (Groq, Finnhub, FMP, etc.) live as Supabase Edge Function secrets — never in frontend
- Rate limit shared keys — check `ai_requests` table before forwarding to external APIs
- CORS header: `Access-Control-Allow-Origin: https://davidtheking28-oss.github.io`
