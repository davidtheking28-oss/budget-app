create or replace function public.lock_advisor_client_access_cols() returns trigger language plpgsql security invoker set search_path to 'public' as $$
begin
  if current_user in ('authenticated','anon') and (
    new.advisor_id is distinct from old.advisor_id or
    new.client_id is distinct from old.client_id or
    new.status is distinct from old.status or
    new.requested_by_client is distinct from old.requested_by_client or
    new.invite_code is distinct from old.invite_code or
    new.invited_email is distinct from old.invited_email or
    new.expires_at is distinct from old.expires_at
  ) then
    raise exception 'access columns are changed only through the approval functions' using errcode = '42501';
  end if;
  return new;
end; $$;
revoke execute on function public.lock_advisor_client_access_cols() from public, anon, authenticated;
create trigger lock_access_cols before update on public.advisor_clients for each row execute function public.lock_advisor_client_access_cols();
