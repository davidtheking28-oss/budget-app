-- applied to Supabase as migration 20260723124919 add_insurances_column_to_budget_data

ALTER TABLE budget_data ADD COLUMN IF NOT EXISTS insurances jsonb DEFAULT '[]'::jsonb;
