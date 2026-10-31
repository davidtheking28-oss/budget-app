create table public.advisor_families (
  id uuid primary key default gen_random_uuid(),
  advisor_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  include_self boolean not null default false,
  member_links uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  check (cardinality(member_links) + (case when include_self then 1 else 0 end) >= 2)
);
alter table public.advisor_families enable row level security;
create policy "advisor manages own families" on public.advisor_families
  for all
  using (auth.uid() = advisor_id and public.is_advisor())
  with check (
    auth.uid() = advisor_id and public.is_advisor()
    and not exists (
      select 1 from unnest(member_links) m
      where not exists (select 1 from public.advisor_clients c where c.id = m and c.advisor_id = auth.uid())
    )
  );
revoke all on public.advisor_families from anon;
