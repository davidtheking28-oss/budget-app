alter table public.advisor_clients add column if not exists requested_by_client boolean not null default false;

create or replace function public.request_advisor_link(p_advisor uuid)
returns text language plpgsql security definer set search_path to 'public' as $$
declare
  v_email text;
  v_recent int;
begin
  if auth.uid() is null then return 'not_found'; end if;
  if not exists (select 1 from public.advisors where user_id = p_advisor) then return 'not_found'; end if;
  if p_advisor = auth.uid() then return 'self'; end if;
  select lower(email) into v_email from auth.users where id = auth.uid();
  if exists (select 1 from public.advisor_client_archive where advisor_id = p_advisor and client_email = v_email and state = 'blocked') then
    return 'blocked';
  end if;
  if exists (select 1 from public.advisor_clients where client_id = auth.uid() and advisor_id = p_advisor) then
    return 'already_linked';
  end if;
  select count(*) into v_recent from public.advisor_invite_attempts
    where actor = auth.uid() and attempted_at > now() - interval '10 minutes';
  if v_recent >= 10 then return 'rate_limited'; end if;
  insert into public.advisor_invite_attempts(actor) values (auth.uid());
  insert into public.advisor_clients (advisor_id, client_id, client_email, status, requested_by_client)
    values (p_advisor, auth.uid(), v_email, 'pending', true);
  return 'ok';
end; $$;

create or replace function public.approve_advisor_client(p_link uuid)
returns text language plpgsql security definer set search_path to 'public' as $$
declare v_updated int;
begin
  if auth.uid() is null or not public.is_advisor() then return 'not_advisor'; end if;
  update public.advisor_clients set status = 'active'
    where id = p_link and advisor_id = auth.uid() and status = 'pending' and requested_by_client;
  get diagnostics v_updated = row_count;
  if v_updated = 0 then return 'not_found'; end if;
  return 'ok';
exception when unique_violation then
  return 'already_linked';
end; $$;

create or replace function public.respond_advisor_invite(p_id uuid, p_accept boolean)
returns text language plpgsql security definer set search_path to 'public' as $$
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
  return 'ok';
end; $$;

revoke all on function public.request_advisor_link(uuid) from public, anon;
revoke all on function public.approve_advisor_client(uuid) from public, anon;
grant execute on function public.request_advisor_link(uuid) to authenticated;
grant execute on function public.approve_advisor_client(uuid) to authenticated;
