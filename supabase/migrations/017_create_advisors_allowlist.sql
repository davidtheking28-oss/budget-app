-- applied to Supabase as migration 20260726134058 create_advisors_allowlist

create table if not exists public.advisors (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

alter table public.advisors enable row level security;

-- Read-only for the signed-in user: the app checks "am I an advisor".
-- Deliberately NO insert/update/delete policy, so a client account cannot
-- promote itself into the advisor platform. Adding an advisor is a manual/
-- service-role operation.
drop policy if exists "advisor reads own row" on public.advisors;
create policy "advisor reads own row" on public.advisors
  for select
  using (auth.uid() = user_id);
