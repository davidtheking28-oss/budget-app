insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-documents', 'client-documents', false, 10485760,
  array['application/pdf','image/png','image/jpeg','image/webp','image/heic','text/csv','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
) on conflict (id) do nothing;

create table public.client_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('bank','credit')),
  period_month date not null check (period_month = date_trunc('month', period_month)::date),
  path text not null,
  file_name text not null,
  mime text,
  size bigint,
  created_at timestamptz not null default now(),
  unique (client_id, path)
);

create index client_documents_client_id_idx on public.client_documents (client_id);

alter table public.client_documents enable row level security;
revoke all on public.client_documents from anon;

create policy "client reads own documents" on public.client_documents for select
  using ((select auth.uid()) = client_id);
create policy "client adds own documents" on public.client_documents for insert
  with check ((select auth.uid()) = client_id and path like (select auth.uid())::text || '/%');
create policy "client deletes own documents" on public.client_documents for delete
  using ((select auth.uid()) = client_id);
create policy "advisor reads client documents" on public.client_documents for select
  using (
    public.is_advisor() and public.advisor_mfa_ok()
    and exists (
      select 1 from public.advisor_clients ac
      where ac.advisor_id = (select auth.uid()) and ac.client_id = client_documents.client_id and ac.status = 'active'
    )
  );

create policy "client manages own document files" on storage.objects for all
  using (bucket_id = 'client-documents' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'client-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "advisor reads client document files" on storage.objects for select
  using (
    bucket_id = 'client-documents'
    and public.is_advisor() and public.advisor_mfa_ok()
    and exists (
      select 1 from public.advisor_clients ac
      where ac.advisor_id = (select auth.uid()) and ac.client_id::text = (storage.foldername(name))[1] and ac.status = 'active'
    )
  );
