-- Security review of 040_report_shares.sql found two real issues:
--
-- 1. The "for all using/with check (auth.uid() = advisor_id)" policy applied
--    to INSERT too, via PostgREST directly on the table — not just through
--    create_report_share(). Since Supabase's default grants give
--    authenticated/anon INSERT on public tables, any signed-in user (advisor
--    or not) could insert their own report_shares row naming ANY client_id,
--    bypassing is_advisor() and the active advisor_clients check that
--    create_report_share() performs, then use the returned id as a valid
--    public token. Fix: SELECT-only policy, matching the advisor_clients
--    pattern (022/028) where every write goes through a SECURITY DEFINER
--    function, never a table-level write policy.
--
-- 2. get_shared_report() returned the client's entire transactions/goals/
--    settings, not scoped to the shared month, so the public link leaked the
--    client's whole financial history, not the one month the advisor shared.
--    Fix: filter transactions to the shared year/month, and stop returning
--    settings at all (it's account config, not report content — the report's
--    monthSummary() tolerates its absence, just without rollover-carry, which
--    would otherwise require exposing prior months' transactions too).

drop policy "advisor manages own report shares" on public.report_shares;

create policy "advisor can view own report shares"
  on public.report_shares for select
  using (auth.uid() = advisor_id);

create or replace function public.get_shared_report(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_share public.report_shares%rowtype;
  v_row public.budget_data%rowtype;
  v_advisor record;
  v_client_email text;
  v_data jsonb;
  v_month_prefix text;
  v_tx jsonb;
  v_filtered_tx jsonb;
begin
  select * into v_share from public.report_shares
    where id = p_token and revoked_at is null;
  if not found then
    return jsonb_build_object('found', false);
  end if;

  select * into v_row from public.budget_data where user_id = v_share.client_id;

  select display_name, logo_url into v_advisor from public.advisors where user_id = v_share.advisor_id;

  select client_email into v_client_email from public.advisor_clients
    where advisor_id = v_share.advisor_id and client_id = v_share.client_id
    limit 1;

  v_month_prefix := v_share.year || '-' || lpad((v_share.month + 1)::text, 2, '0');

  v_tx := case when v_share.budget_mode = 'business'
    then coalesce(v_row.business -> 'transactions', '[]'::jsonb)
    else coalesce(v_row.transactions, '[]'::jsonb) end;

  select coalesce(jsonb_agg(elem), '[]'::jsonb) into v_filtered_tx
    from jsonb_array_elements(v_tx) elem
    where elem ->> 'date' like v_month_prefix || '%';

  if v_share.budget_mode = 'business' then
    v_data := jsonb_build_object(
      'budgets', coalesce(v_row.business -> 'budgets', '{}'::jsonb),
      'transactions', v_filtered_tx,
      'goals', coalesce(v_row.business -> 'goals', '[]'::jsonb)
    );
  else
    v_data := jsonb_build_object(
      'budgets', coalesce(v_row.budgets, '{}'::jsonb),
      'transactions', v_filtered_tx,
      'goals', coalesce(v_row.goals, '[]'::jsonb)
    );
  end if;

  return jsonb_build_object(
    'found', true,
    'year', v_share.year,
    'month', v_share.month,
    'client_email', v_client_email,
    'advisor_display_name', v_advisor.display_name,
    'advisor_logo_url', v_advisor.logo_url,
    'data', v_data
  );
end;
$function$;
