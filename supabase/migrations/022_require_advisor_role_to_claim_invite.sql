-- claim_advisor_invite() let any authenticated user claim an invite code and
-- become the advisor_id on an advisor_clients row, regardless of whether they
-- were actually in the advisors allowlist. Add the same is_advisor() check
-- used elsewhere so only real advisor accounts can claim a code.
CREATE OR REPLACE FUNCTION public.claim_advisor_invite(p_code text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.advisor_clients;
  v_updated int;
  v_recent int;
begin
  if auth.uid() is null then
    return 'not_found';
  end if;

  if not public.is_advisor() then
    return 'not_advisor';
  end if;

  select count(*) into v_recent from public.advisor_invite_attempts
    where actor = auth.uid() and attempted_at > now() - interval '10 minutes';
  if v_recent >= 10 then
    return 'rate_limited';
  end if;
  insert into public.advisor_invite_attempts(actor) values (auth.uid());

  select * into v_row from public.advisor_clients
    where invite_code = p_code
      and status = 'pending'
      and advisor_id is null
      and (expires_at is null or expires_at > now());
  if v_row.id is null then
    return 'not_found';
  end if;
  if v_row.client_id = auth.uid() then
    return 'self';
  end if;

  update public.advisor_clients
    set advisor_id = auth.uid(), status = 'active', expires_at = null
    where id = v_row.id
      and status = 'pending'
      and advisor_id is null
      and (expires_at is null or expires_at > now());
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    return 'not_found';
  end if;

  -- a successful claim clears the caller's throttle budget
  delete from public.advisor_invite_attempts where actor = auth.uid();
  return 'ok';
end;
$function$;
