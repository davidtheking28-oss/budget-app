-- Lets a client see the tasks their advisor assigned to them, and tick them off.
-- advisor_tasks stays the single source of truth (the advisor CRM, the open-task
-- counts on the client list, and the client app all read the same rows) — tasks are
-- deliberately NOT mirrored into budget_data, so there is nothing to keep in sync.

-- advisor_tasks doubles as the advisor's own private to-do list about a client
-- ("send quarterly report"), so only rows explicitly marked for_client reach the client.
alter table public.advisor_tasks
  add column if not exists for_client boolean not null default false;

drop policy if exists "client reads tasks assigned to them" on public.advisor_tasks;
create policy "client reads tasks assigned to them" on public.advisor_tasks
  for select
  using (
    auth.uid() = client_id
    and for_client
    and exists (
      select 1 from public.advisor_clients ac
      where ac.client_id = auth.uid()
        and ac.advisor_id = advisor_tasks.advisor_id
        and ac.status = 'active'
    )
  );

-- A meeting with the client inherently involves the client, so all of their meetings
-- are readable (including notes, which carry the subject line).
drop policy if exists "client reads their meetings" on public.advisor_meetings;
create policy "client reads their meetings" on public.advisor_meetings
  for select
  using (
    auth.uid() = client_id
    and exists (
      select 1 from public.advisor_clients ac
      where ac.client_id = auth.uid()
        and ac.advisor_id = advisor_meetings.advisor_id
        and ac.status = 'active'
    )
  );

-- The client may flip `done` and nothing else. RLS is row-level and both the advisor
-- and the client authenticate as `authenticated`, so column-level GRANTs can't tell them
-- apart — a security-definer RPC is the only way to scope the write to one column.
create or replace function public.set_task_done(p_task_id uuid, p_done boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
begin
  update public.advisor_tasks t
  set done = p_done
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
$$;

grant execute on function public.set_task_done(uuid, boolean) to authenticated;
