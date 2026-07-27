-- applied to Supabase as migration 20260726134357 add_assets_column_to_budget_data

alter table public.budget_data
  add column if not exists assets jsonb not null default '[]'::jsonb;
