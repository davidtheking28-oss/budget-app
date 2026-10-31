alter table public.advisor_clients drop constraint advisor_clients_client_id_or_invited_email_chk;
alter table public.advisor_clients add constraint advisor_clients_client_id_or_invited_email_chk
  check (client_id is not null or invited_email is not null or status = 'manual');

create or replace function public.add_manual_client(p_name text, p_phone text, p_email text)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid;
begin
  if auth.uid() is null or not public.is_advisor() then return null; end if;
  if coalesce(trim(p_name), '') = '' then return null; end if;
  insert into public.advisor_clients (advisor_id, name, phone, client_email, status)
    values (auth.uid(), trim(p_name), nullif(trim(p_phone), ''), nullif(lower(trim(p_email)), ''), 'manual')
    returning id into v_id;
  return v_id;
end; $$;

revoke all on function public.add_manual_client(text, text, text) from public, anon;
grant execute on function public.add_manual_client(text, text, text) to authenticated;
