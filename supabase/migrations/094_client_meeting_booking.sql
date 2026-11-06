alter table public.advisor_meetings add column if not exists requested_by_client boolean not null default false;

create or replace function public.client_meeting_slots_internal(p_advisor_id uuid, p_date date)
returns table(starts_at timestamptz, ends_at timestamptz, label text)
language sql
security definer
set search_path = public
as $$
  with candidates as (
    select (p_date::timestamp + make_interval(mins => minute)) at time zone 'Asia/Jerusalem' as starts_at
    from generate_series(540, case when extract(dow from p_date) = 5 then 840 else 1020 end, 30) minute
    where extract(dow from p_date) <> 6
  ), manual_events as (
    select
      case when event->>'s' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then (p_date + (event->>'s')::time) at time zone 'Asia/Jerusalem' end as starts_at,
      case when event->>'e' ~ '^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$' then (p_date + (event->>'e')::time) at time zone 'Asia/Jerusalem' end as ends_at
    from public.advisor_biz_records record
    cross join lateral jsonb_array_elements(case when jsonb_typeof(record.data->'events'->p_date::text) = 'array' then record.data->'events'->p_date::text else '[]'::jsonb end) event
    where record.advisor_id = p_advisor_id and record.kind = 'planner'
  )
  select candidate.starts_at, candidate.starts_at + interval '1 hour',
    to_char(candidate.starts_at at time zone 'Asia/Jerusalem', 'HH24:MI') || '–' || to_char((candidate.starts_at + interval '1 hour') at time zone 'Asia/Jerusalem', 'HH24:MI')
  from candidates candidate
  where candidate.starts_at > clock_timestamp()
    and not exists (
      select 1 from public.advisor_meetings meeting
      where meeting.advisor_id = p_advisor_id and meeting.status <> 'declined'
        and meeting.scheduled_at < candidate.starts_at + interval '1 hour'
        and meeting.scheduled_at + interval '1 hour' > candidate.starts_at
    )
    and not exists (select 1 from manual_events event where event.starts_at < candidate.starts_at + interval '1 hour' and event.ends_at > candidate.starts_at)
  order by candidate.starts_at;
$$;
revoke all on function public.client_meeting_slots_internal(uuid,date) from public, anon, authenticated;

create or replace function public.get_client_meeting_slots(p_advisor_id uuid, p_date date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare result jsonb;
begin
  if auth.uid() is null or not exists (select 1 from public.advisor_clients where advisor_id = p_advisor_id and client_id = auth.uid() and status = 'active') then
    raise exception 'active advisor required' using errcode = '42501';
  end if;
  if p_date is null then raise exception 'date required' using errcode = '22023'; end if;
  select coalesce(jsonb_agg(to_jsonb(slot) order by slot.starts_at), '[]'::jsonb) into result from public.client_meeting_slots_internal(p_advisor_id, p_date) slot;
  return result;
end;
$$;
revoke all on function public.get_client_meeting_slots(uuid,date) from public, anon;
grant execute on function public.get_client_meeting_slots(uuid,date) to authenticated;

create or replace function public.request_client_meeting(p_advisor_id uuid, p_starts_at timestamptz, p_notes text, p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  client uuid := auth.uid();
  meeting public.advisor_meetings;
begin
  if client is null or not exists (select 1 from public.advisor_clients where advisor_id = p_advisor_id and client_id = client and status = 'active') then
    raise exception 'active advisor required' using errcode = '42501';
  end if;
  if p_request_id is null or p_starts_at is null or char_length(coalesce(p_notes,'')) > 500 then raise exception 'invalid meeting' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('advisor-booking:' || p_advisor_id::text, 0));
  select * into meeting from public.advisor_meetings where id = p_request_id;
  if found then
    if meeting.advisor_id = p_advisor_id and meeting.client_id = client and meeting.requested_by_client and meeting.scheduled_at = p_starts_at then return to_jsonb(meeting); end if;
    raise exception 'request unavailable' using errcode = '42501';
  end if;
  if not exists (select 1 from public.client_meeting_slots_internal(p_advisor_id, (p_starts_at at time zone 'Asia/Jerusalem')::date) slot where slot.starts_at = p_starts_at) then
    raise exception 'slot unavailable' using errcode = '23P01';
  end if;
  insert into public.advisor_meetings(id,advisor_id,client_id,scheduled_at,notes,for_client,status,requested_by_client)
  values(p_request_id,p_advisor_id,client,p_starts_at,nullif(btrim(p_notes),''),true,'pending',true)
  returning * into meeting;
  return to_jsonb(meeting);
end;
$$;
revoke all on function public.request_client_meeting(uuid,timestamptz,text,uuid) from public, anon;
grant execute on function public.request_client_meeting(uuid,timestamptz,text,uuid) to authenticated;

create or replace function public.guard_meeting_overlap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'declined' then return new; end if;
  if auth.uid() is not null and auth.uid() is distinct from new.advisor_id and not exists (select 1 from public.advisor_clients where advisor_id = new.advisor_id and client_id = auth.uid() and client_id = new.client_id and status = 'active') then return new; end if;
  if tg_op = 'UPDATE' and new.scheduled_at = old.scheduled_at and new.advisor_id = old.advisor_id and old.status <> 'declined' then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('advisor-booking:' || new.advisor_id::text, 0));
  if exists (select 1 from public.advisor_meetings where advisor_id = new.advisor_id and id <> new.id and status <> 'declined' and scheduled_at < new.scheduled_at + interval '1 hour' and scheduled_at + interval '1 hour' > new.scheduled_at) then
    raise exception 'meeting overlaps an existing appointment' using errcode = '23P01';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_meeting_overlap() from public, anon, authenticated;
create trigger advisor_meeting_overlap_guard before insert or update on public.advisor_meetings for each row execute function public.guard_meeting_overlap();

create or replace function public.guard_client_booking_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.client_id and auth.uid() is distinct from old.advisor_id then
    if new.requested_by_client is distinct from old.requested_by_client or (old.requested_by_client and new.status is distinct from old.status and new.status <> 'declined') then
      raise exception 'advisor approval required' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_client_booking_approval() from public, anon, authenticated;
create trigger client_booking_approval_guard before update on public.advisor_meetings for each row execute function public.guard_client_booking_approval();
