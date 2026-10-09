alter table public.report_shares add column if not exists expires_at timestamptz not null default (now() + interval '30 days');
-- get_shared_report now also requires expires_at > now()
