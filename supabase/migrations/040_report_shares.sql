-- Lets an advisor share a read-only view of a client's monthly report via a
-- public link, without the client needing an account or session. No table is
-- directly readable by anon/public — the only public entry point is
-- get_shared_report(), a SECURITY DEFINER RPC that validates the token and
-- returns just the report fields, mirroring the pattern in
-- 022_require_advisor_role_to_claim_invite.sql / 028_advisor_initiated_invite_by_email.sql.

create table public.report_shares (
  id uuid primary key default gen_random_uuid(),
  advisor_id uuid not null references auth.users(id),
  client_id uuid not null references auth.users(id),
  year int not null,
  month int not null,
  budget_mode text not null default 'personal' check (budget_mode in ('personal', 'business')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

alter table public.report_shares enable row level security;

-- The advisor can see/manage their own share rows (to list or revoke them).
-- No policy grants anon/authenticated a general select — public access goes
-- only through get_shared_report() below, so the token can't be enumerated.
create policy "advisor manages own report shares"
  on public.report_shares for all
  using (auth.uid() = advisor_id)
  with check (auth.uid() = advisor_id);

create or replace function public.create_report_share(p_client_id uuid, p_year int, p_month int, p_mode text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid;
begin
  if auth.uid() is null or not public.is_advisor() then
    return null;
  end if;

  if not exists (
    select 1 from public.advisor_clients
    where advisor_id = auth.uid() and client_id = p_client_id and status = 'active'
  ) then
    return null;
  end if;

  insert into public.report_shares (advisor_id, client_id, year, month, budget_mode)
    values (auth.uid(), p_client_id, p_year, p_month, coalesce(p_mode, 'personal'))
    returning id into v_id;
  return v_id;
end;
$function$;

grant execute on function public.create_report_share(uuid, int, int, text) to authenticated;
revoke execute on function public.create_report_share(uuid, int, int, text) from public, anon;

create or replace function public.revoke_report_share(p_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update public.report_shares set revoked_at = now()
    where id = p_id and advisor_id = auth.uid();
  return 'ok';
end;
$function$;

grant execute on function public.revoke_report_share(uuid) to authenticated;
revoke execute on function public.revoke_report_share(uuid) from public, anon;

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

  if v_share.budget_mode = 'business' then
    v_data := jsonb_build_object(
      'budgets', coalesce(v_row.business -> 'budgets', '{}'::jsonb),
      'transactions', coalesce(v_row.business -> 'transactions', '[]'::jsonb),
      'goals', coalesce(v_row.business -> 'goals', '[]'::jsonb),
      'settings', coalesce(v_row.business -> 'settings', '{}'::jsonb)
    );
  else
    v_data := jsonb_build_object(
      'budgets', coalesce(v_row.budgets, '{}'::jsonb),
      'transactions', coalesce(v_row.transactions, '[]'::jsonb),
      'goals', coalesce(v_row.goals, '[]'::jsonb),
      'settings', coalesce(v_row.settings, '{}'::jsonb)
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

grant execute on function public.get_shared_report(uuid) to anon, authenticated;
