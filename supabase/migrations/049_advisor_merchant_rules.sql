create table if not exists public.advisor_merchant_rules (
  advisor_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  merchant text not null check (char_length(merchant) between 2 and 120),
  category text not null check (char_length(category) between 1 and 60),
  updated_at timestamptz not null default now(),
  primary key (advisor_id, merchant)
);

alter table public.advisor_merchant_rules enable row level security;

create policy "advisor owns merchant rules" on public.advisor_merchant_rules
  for all
  using (auth.uid() = advisor_id)
  with check (auth.uid() = advisor_id);

revoke all on public.advisor_merchant_rules from anon;
