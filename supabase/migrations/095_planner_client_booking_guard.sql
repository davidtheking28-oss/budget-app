create or replace function public.guard_planner_client_bookings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_events jsonb;
  old_events jsonb := '{}'::jsonb;
  day_entry record;
  event jsonb;
  day date;
  starts timestamptz;
  ends timestamptz;
begin
  if new.kind <> 'planner' then return new; end if;
  if auth.uid() is not null and auth.uid() is distinct from new.advisor_id then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('advisor-booking:' || new.advisor_id::text, 0));
  new_events := case when jsonb_typeof(new.data->'events') = 'object' then new.data->'events' else '{}'::jsonb end;
  if tg_op = 'UPDATE' and old.kind = 'planner' and old.advisor_id = new.advisor_id then
    old_events := case when jsonb_typeof(old.data->'events') = 'object' then old.data->'events' else '{}'::jsonb end;
  end if;
  for day_entry in select * from jsonb_each(new_events) loop
    if day_entry.key !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or jsonb_typeof(day_entry.value) <> 'array' then continue; end if;
    begin
      day := day_entry.key::date;
    exception when invalid_datetime_format or datetime_field_overflow then
      continue;
    end;
    for event in select * from jsonb_array_elements(day_entry.value) loop
      if event->>'s' is null or event->>'e' is null
        or event->>'s' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        or event->>'e' !~ '^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$' then continue; end if;
      if exists (
        select 1 from jsonb_array_elements(case when jsonb_typeof(old_events->day_entry.key) = 'array' then old_events->day_entry.key else '[]'::jsonb end) previous
        where previous->>'s' = event->>'s' and previous->>'e' = event->>'e'
      ) then continue; end if;
      starts := (day + (event->>'s')::time) at time zone 'Asia/Jerusalem';
      ends := (day + (event->>'e')::time) at time zone 'Asia/Jerusalem';
      if ends <= starts then continue; end if;
      if exists (
        select 1 from public.advisor_meetings meeting
        where meeting.advisor_id = new.advisor_id and meeting.requested_by_client and meeting.status <> 'declined'
          and meeting.scheduled_at < ends and meeting.scheduled_at + interval '1 hour' > starts
      ) then
        raise exception 'planner event overlaps a client booking' using errcode = '23P01';
      end if;
    end loop;
  end loop;
  return new;
end;
$$;
revoke all on function public.guard_planner_client_bookings() from public, anon, authenticated;
create trigger planner_client_booking_guard before insert or update on public.advisor_biz_records for each row execute function public.guard_planner_client_bookings();
