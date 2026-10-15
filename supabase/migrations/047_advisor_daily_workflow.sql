alter table public.advisor_tasks add column if not exists responsible text not null default 'advisor' check (responsible in ('advisor', 'client'));
alter table public.advisor_tasks add column if not exists task_kind text not null default 'action' check (task_kind in ('action', 'document'));
alter table public.advisor_tasks add column if not exists meeting_id uuid references public.advisor_meetings(id) on delete set null;
alter table public.advisor_meetings add column if not exists decisions text;
create index if not exists advisor_tasks_work_queue_idx on public.advisor_tasks(advisor_id, done, due_date);
