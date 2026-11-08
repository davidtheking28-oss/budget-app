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
    cross join lateral generate_series(((w.s_min + 59) / 60) * 60, w.e_min - 60, 60) minute
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

