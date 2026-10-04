create table public.advisor_prospects (
  id uuid primary key default gen_random_uuid(),
  advisor_id uuid not null references auth.users(id),
  name text not null,
  phone text,
  email text,
  source text,
  notes text,
  contacted_at date not null default current_date,
  follow_up_at date,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

alter table public.advisor_prospects enable row level security;

create policy "advisor manages own prospects" on public.advisor_prospects
  for all
  using (auth.uid() = advisor_id)
  with check (auth.uid() = advisor_id);

create index advisor_prospects_advisor_id_idx on public.advisor_prospects(advisor_id);
