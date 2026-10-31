create or replace function public.force_server_invite_code() returns trigger language plpgsql security definer set search_path to 'public','extensions' as $$
declare chars constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; b bytea; c text := ''; i int;
begin
  if tg_op = 'UPDATE' and new.invite_code is not distinct from old.invite_code then return new; end if;
  if new.invite_code is null then return new; end if;
  b := gen_random_bytes(9);
  for i in 0..8 loop c := c || substr(chars, (get_byte(b, i) % 31) + 1, 1); end loop;
  new.invite_code := c;
  return new;
end; $$;
revoke execute on function public.force_server_invite_code() from public, anon, authenticated;
create trigger households_server_code before insert or update of invite_code on public.households for each row execute function public.force_server_invite_code();
create trigger advisor_clients_server_code before insert on public.advisor_clients for each row execute function public.force_server_invite_code();

create or replace function public.clamp_client_invite_row() returns trigger language plpgsql security invoker set search_path to 'public' as $$
begin
  if current_user in ('authenticated','anon') then
    new.expires_at := now() + interval '24 hours';
    new.requested_by_client := false;
  end if;
  return new;
end; $$;
revoke execute on function public.clamp_client_invite_row() from public, anon, authenticated;
create trigger advisor_clients_clamp_invite before insert on public.advisor_clients for each row execute function public.clamp_client_invite_row();

create or replace function public.revoke_shares_on_unlink() returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  update public.report_shares set revoked_at = now() where advisor_id = old.advisor_id and client_id = old.client_id and revoked_at is null;
  return old;
end; $$;
revoke execute on function public.revoke_shares_on_unlink() from public, anon, authenticated;
create trigger revoke_shares_on_unlink after delete on public.advisor_clients for each row when (old.advisor_id is not null and old.client_id is not null) execute function public.revoke_shares_on_unlink();

-- get_shared_report now also returns found=false unless the advisor-client link is still active
-- (full body lives in the database; see the applied migration 074).

revoke truncate on all tables in schema public from anon, authenticated;
revoke all on public.advisor_client_archive, public.budget_data, public.households, public.push_subscriptions from anon;
