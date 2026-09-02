create table public.advisor_leads (
  id uuid primary key default gen_random_uuid(),
  advisor_id uuid not null references auth.users(id),
  name text not null,
  case_owner text,
  savings_goal text,
  next_meeting date,
  last_meeting date,
  stage text not null default 'intro_meeting',
  created_at timestamptz not null default now()
);

alter table public.advisor_leads enable row level security;

create policy "advisor manages own leads" on public.advisor_leads
  for all
  using (auth.uid() = advisor_id)
  with check (auth.uid() = advisor_id);

create index advisor_leads_advisor_id_idx on public.advisor_leads(advisor_id);
