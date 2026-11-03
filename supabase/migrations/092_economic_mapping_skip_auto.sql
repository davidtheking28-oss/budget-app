alter table public.economic_mappings
  add column if not exists skip_auto boolean not null default false;
