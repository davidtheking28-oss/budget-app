alter table public.economic_mappings
  add column last_upload_error text,
  add column last_upload_at timestamptz;
