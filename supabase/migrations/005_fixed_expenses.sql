ALTER TABLE public.budget_data
  ADD COLUMN IF NOT EXISTS fixed_expenses jsonb NOT NULL DEFAULT '[]'::jsonb;
