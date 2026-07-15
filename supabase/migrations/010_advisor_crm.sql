create table public.advisor_notes (
  id uuid primary key default gen_random_uuid(),
  advisor_id uuid not null references auth.users(id),
  client_id uuid not null references auth.users(id),
  body text not null,
  created_at timestamptz not null default now()
);
alter table public.advisor_notes enable row level security;
create policy "advisor owns their notes"
  on public.advisor_notes for all
  using (auth.uid() = advisor_id)
  with check (auth.uid() = advisor_id);

create table public.advisor_tasks (
  id uuid primary key default gen_random_uuid(),
  advisor_id uuid not null references auth.users(id),
  client_id uuid not null references auth.users(id),
  title text not null,
  done boolean not null default false,
  due_date date,
  created_at timestamptz not null default now()
);
alter table public.advisor_tasks enable row level security;
create policy "advisor owns their tasks"
  on public.advisor_tasks for all
  using (auth.uid() = advisor_id)
  with check (auth.uid() = advisor_id);

create table public.advisor_meetings (
  id uuid primary key default gen_random_uuid(),
  advisor_id uuid not null references auth.users(id),
  client_id uuid not null references auth.users(id),
  scheduled_at timestamptz not null,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.advisor_meetings enable row level security;
create policy "advisor owns their meetings"
  on public.advisor_meetings for all
  using (auth.uid() = advisor_id)
  with check (auth.uid() = advisor_id);
