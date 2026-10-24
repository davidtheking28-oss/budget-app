create table public.advisor_biz_records (
  id uuid primary key default gen_random_uuid(),
  advisor_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('task', 'project', 'system', 'marketing_month', 'video_idea', 'finance_entry')),
  period text check (period is null or period ~ '^\d{4}-\d{2}$'),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.advisor_biz_records enable row level security;

create policy "advisor manages own biz records" on public.advisor_biz_records
  for all
  using (auth.uid() = advisor_id)
  with check (auth.uid() = advisor_id);

revoke all on public.advisor_biz_records from anon;

create index advisor_biz_records_lookup_idx on public.advisor_biz_records(advisor_id, kind, period);
