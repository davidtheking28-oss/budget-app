-- applied to Supabase as migration 20260722094730 enable_realtime_for_budget_data

alter publication supabase_realtime add table public.budget_data;
