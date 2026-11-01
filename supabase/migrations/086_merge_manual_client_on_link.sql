create or replace function public.merge_manual_client(p_link uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.advisor_clients;
  m public.advisor_clients;
begin
  select * into v from public.advisor_clients where id = p_link;
  if v.id is null or v.advisor_id is null or coalesce(v.client_email, '') = '' then return; end if;

  select * into m from public.advisor_clients
    where advisor_id = v.advisor_id
      and status = 'manual'
      and lower(client_email) = lower(v.client_email)
      and id <> v.id
    order by created_at
    limit 1;
  if m.id is null then return; end if;

  if exists (select 1 from public.advisor_client_deals where link_id = v.id) then
    delete from public.advisor_client_deals where link_id = m.id;
  else
    update public.advisor_client_deals set link_id = v.id where link_id = m.id;
  end if;

  update public.advisor_clients set
    name = coalesce(name, m.name),
    phone = coalesce(phone, m.phone),
    background = coalesce(background, m.background),
    is_vip = coalesce(is_vip, false) or coalesce(m.is_vip, false),
    tags = case when tags is null or tags = '[]'::jsonb then coalesce(m.tags, '[]'::jsonb) else tags end
  where id = v.id;

  delete from public.advisor_clients where id = m.id;
end;
$$;

revoke all on function public.merge_manual_client(uuid) from public, anon, authenticated;

create or replace function public.approve_advisor_client(p_link uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_updated int;
begin
  if auth.uid() is null or not public.is_advisor() then return 'not_advisor'; end if;
  update public.advisor_clients set status = 'active'
    where id = p_link and advisor_id = auth.uid() and status = 'pending' and requested_by_client;
  get diagnostics v_updated = row_count;
  if v_updated = 0 then return 'not_found'; end if;
  perform public.merge_manual_client(p_link);
  return 'ok';
exception when unique_violation then
  return 'already_linked';
end;
$$;

create or replace function public.respond_advisor_invite(p_id uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_updated int;
begin
  if auth.uid() is null then return 'not_found'; end if;
  if p_accept then
    update public.advisor_clients set status = 'active'
      where id = p_id and client_id = auth.uid() and status = 'pending' and advisor_id is not null and not requested_by_client;
  else
    delete from public.advisor_clients
      where id = p_id and client_id = auth.uid() and status = 'pending' and advisor_id is not null and not requested_by_client;
  end if;
  get diagnostics v_updated = row_count;
  if v_updated = 0 then return 'not_found'; end if;
  if p_accept then perform public.merge_manual_client(p_id); end if;
  return 'ok';
end;
$$;
