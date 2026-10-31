select cron.schedule('advisor-archive-trash-cleanup', '17 3 * * *', $$delete from public.advisor_client_archive where state = 'trashed' and created_at < now() - interval '30 days'$$);

drop policy if exists "record own access request" on public.advisor_access_requests;
create policy "record own access request" on public.advisor_access_requests for insert to authenticated with check (user_id = auth.uid() and status = 'pending');
