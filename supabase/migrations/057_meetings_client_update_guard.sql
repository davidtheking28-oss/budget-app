create or replace function public.guard_meeting_client_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null
     and auth.uid() = old.client_id
     and auth.uid() is distinct from old.advisor_id then
    if (new.id, new.advisor_id, new.client_id, new.scheduled_at, new.notes, new.created_at, new.for_client, new.summary, new.decisions)
       is distinct from
       (old.id, old.advisor_id, old.client_id, old.scheduled_at, old.notes, old.created_at, old.for_client, old.summary, old.decisions) then
      raise exception 'clients may only change status and decline_note' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists advisor_meetings_client_update_guard on public.advisor_meetings;
create trigger advisor_meetings_client_update_guard
  before update on public.advisor_meetings
  for each row execute function public.guard_meeting_client_update();
