-- ai_requests is an append-only rate-limit counter shared by the budget app and
-- the trading journal. A single FOR ALL policy let a user DELETE their own rows
-- from the browser console and reset their own quota on a shared paid API key.
-- Reads and inserts are all either app needs; updates and deletes are nobody's.
drop policy if exists "own_requests" on public.ai_requests;

create policy "own_requests_read" on public.ai_requests
  for select using ((select auth.uid()) = user_id);

create policy "own_requests_insert" on public.ai_requests
  for insert with check ((select auth.uid()) = user_id);

revoke update, delete on public.ai_requests from anon, authenticated;
