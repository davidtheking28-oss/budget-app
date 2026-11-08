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
  meeting_number int;
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
  select count(*) + 1 into meeting_number from public.advisor_meetings where advisor_id = p_advisor_id and client_id = client and status <> 'declined';
  auto_confirm := coalesce((public.advisor_availability(p_advisor_id)->>'auto')::boolean, false);
  insert into public.advisor_meetings(id,advisor_id,client_id,scheduled_at,notes,for_client,status,requested_by_client)
  values(p_request_id,p_advisor_id,client,p_starts_at,'פגישה ' || meeting_number,true,case when auto_confirm then 'confirmed' else 'pending' end,true)
  returning * into meeting;
  return to_jsonb(meeting);
end;
$$;
revoke all on function public.request_client_meeting(uuid,timestamptz,text,uuid) from public, anon;
grant execute on function public.request_client_meeting(uuid,timestamptz,text,uuid) to authenticated;
