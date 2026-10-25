alter table public.advisor_client_deals
  add column if not exists journey jsonb not null default '{}'::jsonb;
