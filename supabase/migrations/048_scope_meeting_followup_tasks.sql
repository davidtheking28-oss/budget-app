create unique index if not exists advisor_meetings_scope_key on public.advisor_meetings(id, advisor_id, client_id);
alter table public.advisor_tasks add constraint advisor_tasks_meeting_scope_fkey foreign key (meeting_id, advisor_id, client_id) references public.advisor_meetings(id, advisor_id, client_id) on delete set null (meeting_id);
