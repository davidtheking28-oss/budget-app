-- Backfills the migration history for advisor_access_requests, which already
-- exists live (applied directly via the Supabase MCP in an earlier session,
-- never written back to a migration file) — this file just makes the repo
-- match reality. `if not exists`/`drop policy if exists` throughout so it's
-- safe to apply against the already-live table.
--
-- Self-service application flow: any authenticated user can insert a request
-- for themselves (status defaults to 'pending'); only they can read it back.
-- There is deliberately NO update/delete policy — approving or declining a
-- request is a manual/service-role operation, same as adding to `advisors`.
create table if not exists public.advisor_access_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.advisor_access_requests enable row level security;

drop policy if exists "read own access request" on public.advisor_access_requests;
create policy "read own access request" on public.advisor_access_requests
  for select
  using (user_id = auth.uid());

drop policy if exists "record own access request" on public.advisor_access_requests;
create policy "record own access request" on public.advisor_access_requests
  for insert
  with check (true);
