create or replace function public.add_manual_client(p_name text, p_phone text, p_email text)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid;
begin
  if auth.uid() is null or not public.is_advisor() then return null; end if;
  if coalesce(trim(p_name), '') = '' then return null; end if;
  insert into public.advisor_clients (advisor_id, name, phone, client_email, status)
    values (auth.uid(), trim(p_name), nullif(trim(p_phone), ''), coalesce(lower(trim(p_email)), ''), 'manual')
    returning id into v_id;
  return v_id;
end; $$;

create or replace function public.archive_advisor_client(p_link uuid, p_state text)
returns text language plpgsql security definer set search_path to 'public' as $$
declare v_row public.advisor_clients;
begin
  if auth.uid() is null or not public.is_advisor() then return 'not_advisor'; end if;
  if p_state not in ('blocked','trashed') then return 'invalid_state'; end if;
  select * into v_row from public.advisor_clients where id = p_link and advisor_id = auth.uid();
  if v_row.id is null then return 'not_found'; end if;
  insert into public.advisor_client_archive (advisor_id, client_id, client_email, state)
    values (auth.uid(), v_row.client_id, coalesce(nullif(lower(v_row.client_email), ''), lower(v_row.invited_email), 'manual:' || v_row.id::text), p_state)
    on conflict (advisor_id, client_email) do update set state = excluded.state, created_at = now();
  delete from public.advisor_clients where id = v_row.id;
  return 'ok';
end; $$;
