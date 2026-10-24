create table public.advisor_client_deals (
  link_id uuid primary key references public.advisor_clients(id) on delete cascade,
  advisor_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  price numeric(12,2) check (price is null or price >= 0),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'partial', 'paid')),
  payment_method text check (payment_method is null or char_length(payment_method) <= 40),
  receipt_issued boolean not null default false,
  source text check (source is null or char_length(source) <= 60),
  ends_at date,
  updated_at timestamptz not null default now()
);

alter table public.advisor_client_deals enable row level security;

create policy "advisor manages own client deals" on public.advisor_client_deals
  for all
  using (auth.uid() = advisor_id and exists (select 1 from public.advisor_clients c where c.id = link_id and c.advisor_id = auth.uid()))
  with check (auth.uid() = advisor_id and exists (select 1 from public.advisor_clients c where c.id = link_id and c.advisor_id = auth.uid()));

revoke all on public.advisor_client_deals from anon;

create index advisor_client_deals_advisor_idx on public.advisor_client_deals(advisor_id);
