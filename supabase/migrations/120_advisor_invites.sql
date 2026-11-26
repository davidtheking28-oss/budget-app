create table public.advisor_invites (
  id uuid primary key default gen_random_uuid(),
  advisor_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique check (token ~ '^[A-Za-z0-9_-]{12,40}$'),
  name text not null check (length(btrim(name)) between 1 and 80),
  phone text check (phone is null or length(phone) <= 30),
  client_id uuid references auth.users(id) on delete set null,
  signed_up_at timestamptz,
  created_at timestamptz not null default now()
);
create index advisor_invites_advisor_idx on public.advisor_invites(advisor_id);
create index advisor_invites_client_idx on public.advisor_invites(client_id);

alter table public.advisor_invites enable row level security;
create policy "advisor owns invites" on public.advisor_invites for all to authenticated
  using ((select auth.uid()) = advisor_id and public.is_advisor() and public.advisor_mfa_ok())
  with check ((select auth.uid()) = advisor_id and public.is_advisor() and public.advisor_mfa_ok());
revoke all on public.advisor_invites from anon, public;
grant select, insert, update, delete on public.advisor_invites to authenticated;

drop function public.request_advisor_link(uuid);
create function public.request_advisor_link(p_advisor uuid, p_invite text default null)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_email text;
  v_recent int;
  v_name text;
  v_phone text;
begin
  if auth.uid() is null then return 'not_found'; end if;
  if not exists (select 1 from public.advisors where user_id = p_advisor) then return 'not_found'; end if;
  if p_advisor = auth.uid() then return 'self'; end if;
  select lower(email) into v_email from auth.users where id = auth.uid();
  if exists (select 1 from public.advisor_client_archive where advisor_id = p_advisor and client_email = v_email and state = 'blocked') then
    return 'blocked';
  end if;
  if p_invite is not null then
    update public.advisor_invites set client_id = auth.uid(), signed_up_at = now()
      where token = p_invite and advisor_id = p_advisor and client_id is null
      returning name, phone into v_name, v_phone;
  end if;
  if exists (select 1 from public.advisor_clients where client_id = auth.uid() and advisor_id = p_advisor) then
    return 'already_linked';
  end if;
  select count(*) into v_recent from public.advisor_invite_attempts
    where actor = auth.uid() and attempted_at > now() - interval '10 minutes';
  if v_recent >= 10 then return 'rate_limited'; end if;
  insert into public.advisor_invite_attempts(actor) values (auth.uid());
  insert into public.advisor_clients (advisor_id, client_id, client_email, status, requested_by_client, name, phone)
    values (p_advisor, auth.uid(), v_email, 'pending', true, v_name, v_phone);
  return 'ok';
exception when unique_violation then
  return 'already_linked';
end; $$;
revoke all on function public.request_advisor_link(uuid, text) from public, anon;
grant execute on function public.request_advisor_link(uuid, text) to authenticated;
