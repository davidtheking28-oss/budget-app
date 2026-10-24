alter table public.advisor_client_deals
  add column if not exists service_status text not null default 'active'
  check (service_status in ('active', 'frozen', 'ended'));
