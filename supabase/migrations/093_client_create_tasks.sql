create or replace function public.add_client_task(p_advisor_id uuid, p_title text, p_due_date date, p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid := auth.uid();
  v_task public.advisor_tasks;
begin
  if v_client_id is null or p_request_id is null or nullif(btrim(p_title), '') is null or char_length(btrim(p_title)) > 500 then
    raise exception 'invalid task' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.advisor_clients
    where client_id = v_client_id and advisor_id = p_advisor_id and status = 'active'
  ) then
    raise exception 'active advisor required' using errcode = '42501';
  end if;
  insert into public.advisor_tasks (id, advisor_id, client_id, title, due_date, for_client, responsible, task_kind)
  values (p_request_id, p_advisor_id, v_client_id, btrim(p_title), p_due_date, true, 'client', 'action')
  on conflict (id) do nothing;
  select * into v_task from public.advisor_tasks
  where id = p_request_id and client_id = v_client_id and advisor_id = p_advisor_id and for_client and responsible = 'client';
  if not found then
    raise exception 'task unavailable' using errcode = '42501';
  end if;
  return to_jsonb(v_task);
end;
$$;
revoke all on function public.add_client_task(uuid, text, date, uuid) from public, anon;
grant execute on function public.add_client_task(uuid, text, date, uuid) to authenticated;
