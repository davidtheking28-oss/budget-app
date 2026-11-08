create or replace function public.advisor_availability(p_advisor_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select record.data->'availability'
    from public.advisor_biz_records record
    where record.advisor_id = p_advisor_id and record.kind = 'planner' and jsonb_typeof(record.data->'availability') = 'object'
    order by record.created_at
    limit 1
  ), '{}'::jsonb);
$$;
revoke all on function public.advisor_availability(uuid) from public, anon, authenticated;

create or replace function public.client_meeting_slots_internal(p_advisor_id uuid, p_date date)
returns table(starts_at timestamptz, ends_at timestamptz, label text)
language sql
security definer
set search_path = public
as $$
  with window_for_day as (
    select
      case
        when avail->'days'->(extract(dow from p_date)::int)::text is null then
          case extract(dow from p_date)::int when 6 then null else 540 end
        when coalesce((avail->'days'->(extract(dow from p_date)::int)::text->>'on')::boolean, false) is not true then null
        when avail->'days'->(extract(dow from p_date)::int)::text->>'s' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
          then extract(hour from (avail->'days'->(extract(dow from p_date)::int)::text->>'s')::time)::int * 60 + extract(minute from (avail->'days'->(extract(dow from p_date)::int)::text->>'s')::time)::int
        else null
      end as s_min,
      case
        when avail->'days'->(extract(dow from p_date)::int)::text is null then
          case extract(dow from p_date)::int when 6 then null when 5 then 900 else 1080 end
        when avail->'days'->(extract(dow from p_date)::int)::text->>'e' ~ '^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$'
          then case when avail->'days'->(extract(dow from p_date)::int)::text->>'e' = '24:00' then 1440
            else extract(hour from (avail->'days'->(extract(dow from p_date)::int)::text->>'e')::time)::int * 60 + extract(minute from (avail->'days'->(extract(dow from p_date)::int)::text->>'e')::time)::int end
        else null
      end as e_min
    from (select public.advisor_availability(p_advisor_id) as avail) a
  ), candidates as (
    select (p_date::timestamp + make_interval(mins => minute)) at time zone 'Asia/Jerusalem' as starts_at
    from window_for_day w
    cross join lateral generate_series(w.s_min, w.e_min - 60, 30) minute
    where w.s_min is not null and w.e_min is not null
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

create or replace function public.request_client_meeting(p_advisor_id uuid, p_starts_at timestamptz, p_notes text, p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  client uuid := auth.uid();
  meeting public.advisor_meetings;
  auto_confirm boolean;
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
  auto_confirm := coalesce((public.advisor_availability(p_advisor_id)->>'auto')::boolean, false);
  insert into public.advisor_meetings(id,advisor_id,client_id,scheduled_at,notes,for_client,status,requested_by_client)
  values(p_request_id,p_advisor_id,client,p_starts_at,nullif(btrim(p_notes),''),true,case when auto_confirm then 'confirmed' else 'pending' end,true)
  returning * into meeting;
  return to_jsonb(meeting);
end;
$$;
revoke all on function public.request_client_meeting(uuid,timestamptz,text,uuid) from public, anon;
grant execute on function public.request_client_meeting(uuid,timestamptz,text,uuid) to authenticated;
