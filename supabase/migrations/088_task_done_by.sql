alter table public.advisor_tasks
  add column if not exists done_at timestamptz,
  add column if not exists done_by text check (done_by in ('client', 'advisor'));

create or replace function public.set_task_done(p_task_id uuid, p_done boolean)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_updated int;
begin
  update public.advisor_tasks t
  set done = p_done,
      done_at = case when p_done then now() else null end,
      done_by = case when p_done then 'client' else null end
  where t.id = p_task_id
    and t.client_id = auth.uid()
    and t.for_client
    and exists (
      select 1 from public.advisor_clients ac
      where ac.client_id = auth.uid()
        and ac.advisor_id = t.advisor_id
        and ac.status = 'active'
    );
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$function$;
