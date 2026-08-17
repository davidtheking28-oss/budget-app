-- Adds the missing direction: advisor-initiated "add client by email", alongside
-- the existing client-initiated invite-code flow (untouched, still works as-is).
--
-- Two cases, both represented as a normal advisor_clients row with advisor_id
-- already set and status='pending' (client must accept):
--  1. Email belongs to an existing auth user -> client_id set immediately, the
--     client sees a pending invite next time they load the app.
--  2. No account yet -> client_id left null, invited_email holds the lowercased
--     email. A trigger on auth.users attaches client_id the moment that email
--     signs up, so by the time the client is ever looking at the UI the row
--     already has client_id set like case 1.

alter table public.advisor_clients alter column client_id drop not null;
alter table public.advisor_clients alter column invite_code drop not null;
alter table public.advisor_clients add column if not exists invited_email text;

alter table public.advisor_clients
  drop constraint if exists advisor_clients_client_id_or_invited_email_chk;
alter table public.advisor_clients
  add constraint advisor_clients_client_id_or_invited_email_chk
  check (client_id is not null or invited_email is not null);

-- Client-side visibility already covers client_id = auth.uid(); add the narrow
-- not-yet-signed-up case defensively (should normally never be hit since the
-- attach trigger below runs before the client can ever query as that user, but
-- it's a cheap belt-and-suspenders using the caller's own JWT email claim, not
-- a cross-user auth.users lookup).
drop policy if exists "user can read own advisor_clients rows" on public.advisor_clients;
create policy "user can read own advisor_clients rows"
  on public.advisor_clients for select
  using (
    auth.uid() = client_id
    or auth.uid() = advisor_id
    or (client_id is null and invited_email = lower(auth.jwt()->>'email'))
  );

-- Advisor creates an invite by email. Mirrors claim_advisor_invite's shape:
-- is_advisor() gate, same 10/10min rate limit table, SECURITY DEFINER so it can
-- insert regardless of the client-only insert policy and (for case 1) look up
-- the target's user id in auth.users, which RLS-scoped code can't query.
create or replace function public.invite_client_by_email(p_email text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_email text := lower(trim(p_email));
  v_client_id uuid;
  v_recent int;
begin
  if auth.uid() is null then
    return 'not_found';
  end if;

  if not public.is_advisor() then
    return 'not_advisor';
  end if;

  if v_email is null or v_email = '' or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return 'invalid_email';
  end if;

  select count(*) into v_recent from public.advisor_invite_attempts
    where actor = auth.uid() and attempted_at > now() - interval '10 minutes';
  if v_recent >= 10 then
    return 'rate_limited';
  end if;
  insert into public.advisor_invite_attempts(actor) values (auth.uid());

  select id into v_client_id from auth.users where lower(email) = v_email limit 1;

  if v_client_id is not null and v_client_id = auth.uid() then
    return 'self';
  end if;

  if v_client_id is not null and exists (
    select 1 from public.advisor_clients
      where advisor_id = auth.uid() and client_id = v_client_id and status = 'active'
  ) then
    return 'already_linked';
  end if;

  if exists (
    select 1 from public.advisor_clients
      where advisor_id = auth.uid()
        and status = 'pending'
        and (client_id = v_client_id or (client_id is null and invited_email = v_email))
  ) then
    return 'already_invited';
  end if;

  insert into public.advisor_clients (advisor_id, client_id, client_email, invited_email, status)
    values (auth.uid(), v_client_id, v_email, case when v_client_id is null then v_email else null end, 'pending');

  return 'ok';
end;
$function$;

grant execute on function public.invite_client_by_email(text) to authenticated;
revoke execute on function public.invite_client_by_email(text) from public, anon;

-- Client accepts/declines an advisor-initiated invite. Only touches rows where
-- they are the client and the invite actually came from the advisor side
-- (advisor_id already set) so this can't be used to short-circuit the
-- claim_advisor_invite code-claim flow (that one relies on advisor_id is null).
create or replace function public.respond_advisor_invite(p_id uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_updated int;
begin
  if auth.uid() is null then
    return 'not_found';
  end if;

  if p_accept then
    update public.advisor_clients
      set status = 'active'
      where id = p_id and client_id = auth.uid() and status = 'pending' and advisor_id is not null;
  else
    delete from public.advisor_clients
      where id = p_id and client_id = auth.uid() and status = 'pending' and advisor_id is not null;
  end if;
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    return 'not_found';
  end if;
  return 'ok';
end;
$function$;

grant execute on function public.respond_advisor_invite(uuid, boolean) to authenticated;
revoke execute on function public.respond_advisor_invite(uuid, boolean) from public, anon;

-- Auto-attach: when a not-yet-registered invited email finally signs up, wire
-- their new user id into any matching pending-by-email invite so it shows up
-- for them exactly like case 1 (an advisor already knowing their account).
create or replace function public.attach_pending_advisor_invite()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update public.advisor_clients
    set client_id = new.id, invited_email = null
    where invited_email = lower(new.email)
      and client_id is null
      and status = 'pending';
  return new;
end;
$function$;

drop trigger if exists on_auth_user_created_attach_advisor_invite on auth.users;
create trigger on_auth_user_created_attach_advisor_invite
  after insert on auth.users
  for each row execute function public.attach_pending_advisor_invite();
