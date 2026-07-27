-- applied to Supabase as migration 20260720172456 claim_advisor_invite_specific_errors

drop function if exists public.claim_advisor_invite(text);

create function public.claim_advisor_invite(p_code text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_row public.advisor_clients;
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
    where id = v_row.id;
  return 'ok';
end;
$function$;

grant execute on function public.claim_advisor_invite(text) to authenticated;
