create table public.client_agreement_copy_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  agreement_id uuid not null references public.client_agreements(id),
  requested_at timestamptz not null default now(),
  sent_at timestamptz,
  error text
);
create index client_agreement_copy_requests_user_idx on public.client_agreement_copy_requests (user_id, requested_at desc);
create index client_agreement_copy_requests_agreement_idx on public.client_agreement_copy_requests (agreement_id);

alter table public.client_agreement_copy_requests enable row level security;
create policy "user reads own copy requests" on public.client_agreement_copy_requests
  for select to authenticated using ((select auth.uid()) = user_id);
revoke insert, update, delete, truncate on public.client_agreement_copy_requests from anon, authenticated;
revoke all on public.client_agreement_copy_requests from anon;

create table public.client_agreement_views (
  id uuid primary key default gen_random_uuid(),
  advisor_id uuid not null,
  agreement_id uuid not null references public.client_agreements(id),
  seen_at timestamptz not null default now(),
  unique (advisor_id, agreement_id)
);
create index client_agreement_views_agreement_idx on public.client_agreement_views (agreement_id);

alter table public.client_agreement_views enable row level security;
create policy "advisor reads own agreement views" on public.client_agreement_views
  for select to authenticated using ((select auth.uid()) = advisor_id);
create policy "advisor marks visible agreement seen" on public.client_agreement_views
  for insert to authenticated
  with check (
    (select auth.uid()) = advisor_id
    and exists (select 1 from public.client_agreements a where a.id = agreement_id)
  );
revoke update, delete, truncate on public.client_agreement_views from anon, authenticated;
revoke all on public.client_agreement_views from anon;
