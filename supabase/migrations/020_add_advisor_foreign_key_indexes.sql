-- applied to Supabase as migration 20260726135206 add_advisor_foreign_key_indexes

-- The RLS policies on advisor_notes/tasks/meetings evaluate
--   EXISTS (select 1 from advisor_clients ac where ac.advisor_id = auth.uid() and ac.client_id = ...)
-- on every row access, so advisor_clients(advisor_id, client_id) is the hot path.
create index if not exists advisor_clients_advisor_client_idx
  on public.advisor_clients (advisor_id, client_id);
create index if not exists advisor_clients_client_idx
  on public.advisor_clients (client_id);

create index if not exists advisor_notes_advisor_client_idx
  on public.advisor_notes (advisor_id, client_id);
create index if not exists advisor_tasks_advisor_client_idx
  on public.advisor_tasks (advisor_id, client_id);
create index if not exists advisor_meetings_advisor_client_idx
  on public.advisor_meetings (advisor_id, client_id);

create index if not exists budget_data_updated_by_idx
  on public.budget_data (updated_by);
