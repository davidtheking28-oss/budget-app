create or replace function public.lock_meeting_cols_for_client() returns trigger language plpgsql security invoker set search_path to 'public' as $$
begin
  if current_user in ('authenticated','anon') and auth.uid() is distinct from old.advisor_id and (
    new.advisor_id is distinct from old.advisor_id or
    new.client_id is distinct from old.client_id or
    new.scheduled_at is distinct from old.scheduled_at or
    new.notes is distinct from old.notes or
    new.for_client is distinct from old.for_client or
    new.summary is distinct from old.summary or
    new.decisions is distinct from old.decisions
  ) then
    raise exception 'client may change only status and decline_note' using errcode = '42501';
  end if;
  return new;
end; $$;
revoke execute on function public.lock_meeting_cols_for_client() from public, anon, authenticated;
create trigger lock_meeting_cols before update on public.advisor_meetings for each row execute function public.lock_meeting_cols_for_client();
