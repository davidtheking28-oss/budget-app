-- applied to Supabase as migration 20260722094050 harden_advisor_clients_security

-- Remove an unused, overly-broad UPDATE policy: no app code ever updates
-- advisor_clients directly (only INSERT/DELETE/SELECT from the client, and
-- claim_advisor_invite() as SECURITY DEFINER for activation). This policy let
-- a client freely set advisor_id/status on their own row via direct table
-- access, bypassing the invite-code RPC's checks entirely (self-claim
-- prevention, single-use pending code, atomic activation).
drop policy if exists "client can update own advisor_clients row" on public.advisor_clients;

-- Harden claim_advisor_invite against a race: two concurrent claims of the
-- same pending code could otherwise both pass the initial SELECT before
-- either UPDATE commits, with the second silently overwriting the first's
-- advisor_id. Re-check status/advisor_id in the UPDATE's WHERE clause so
-- only one claim can actually win.
create or replace function public.claim_advisor_invite(p_code text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_row public.advisor_clients;
  v_updated int;
begin
  select * into v_row from public.advisor_clients
    where invite_code = p_code and status = 'pending' and advisor_id is null;
  if v_row.id is null then
    return 'not_found';
  end if;
  if v_row.client_id = auth.uid() then
    return 'self';
  end if;
  update public.advisor_clients
    set advisor_id = auth.uid(), status = 'active'
    where id = v_row.id and status = 'pending' and advisor_id is null;
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    return 'not_found';
  end if;
  return 'ok';
end;
$function$;
