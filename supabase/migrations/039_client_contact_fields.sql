alter table advisor_leads add column if not exists phone text;
alter table advisor_clients add column if not exists phone text;
alter table advisor_clients add column if not exists background text;

create policy "advisor can update own client contact info" on advisor_clients
  for update
  using (auth.uid() = advisor_id)
  with check (auth.uid() = advisor_id);
