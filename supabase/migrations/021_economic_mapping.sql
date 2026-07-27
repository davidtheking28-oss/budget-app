create table public.economic_mappings (
  id uuid primary key default gen_random_uuid(),
  advisor_id uuid not null references auth.users(id),
  client_id uuid not null references auth.users(id),
  period_start date not null,
  period_end date not null,
  transactions jsonb not null default '[]'::jsonb,
  category_averages jsonb not null default '{}'::jsonb,
  months_covered int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (advisor_id, client_id)
);

alter table public.economic_mappings enable row level security;

create policy "advisor owns their mappings" on public.economic_mappings
  for all
  using (auth.uid() = advisor_id and exists (
    select 1 from public.advisor_clients ac
    where ac.advisor_id = auth.uid() and ac.client_id = economic_mappings.client_id and ac.status = 'active'
  ))
  with check (auth.uid() = advisor_id and exists (
    select 1 from public.advisor_clients ac
    where ac.advisor_id = auth.uid() and ac.client_id = economic_mappings.client_id and ac.status = 'active'
  ));

create index economic_mappings_advisor_client_idx on public.economic_mappings (advisor_id, client_id);
