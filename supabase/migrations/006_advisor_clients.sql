create table public.advisor_clients (
  id uuid primary key default gen_random_uuid(),
  advisor_id uuid references auth.users(id),
  client_id uuid not null references auth.users(id),
  client_email text not null,
  invite_code text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.advisor_clients enable row level security;

create policy "auth users can read advisor_clients"
  on public.advisor_clients for select
  using (true);

create policy "client can create advisor invite"
  on public.advisor_clients for insert
  with check (auth.uid() = client_id);

create policy "advisor can claim pending invite, client can update own"
  on public.advisor_clients for update
  using (auth.uid() = client_id or (advisor_id is null and auth.uid() <> client_id))
  with check (auth.uid() = client_id or (advisor_id = auth.uid() and auth.uid() <> client_id));

create policy "client or advisor can remove the link"
  on public.advisor_clients for delete
  using (auth.uid() = client_id or auth.uid() = advisor_id);
