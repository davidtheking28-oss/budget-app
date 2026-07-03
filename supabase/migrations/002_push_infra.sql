-- Adds business-mode + merge-sync metadata columns to budget_data,
-- and the push notification subscription/log tables.
-- (Applied directly to the live project via MCP on 2026-07-02; this file
-- documents it for local dev / schema history — safe to re-run, all guards are idempotent.)

ALTER TABLE public.budget_data
  ADD COLUMN IF NOT EXISTS business jsonb,
  ADD COLUMN IF NOT EXISTS sync_meta jsonb;

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  prefs jsonb NOT NULL DEFAULT '{"daily":true,"budget":true,"renewals":true,"monthly":true}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user owns row" ON public.push_subscriptions;
CREATE POLICY "user owns row" ON public.push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON public.push_subscriptions (user_id);

CREATE TABLE IF NOT EXISTS public.push_log (
  user_id uuid NOT NULL,
  kind text NOT NULL,
  key text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind, key)
);
ALTER TABLE public.push_log ENABLE ROW LEVEL SECURITY;

DROP INDEX IF EXISTS public.budget_data_updated_by_idx;
DROP INDEX IF EXISTS public.households_member_id_idx;
DROP INDEX IF EXISTS public.idx_missed_opportunities_user_id;
