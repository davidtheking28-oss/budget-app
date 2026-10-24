alter table public.advisor_prospects add column if not exists showed boolean not null default false;
alter table public.advisor_prospects add column if not exists relevant boolean not null default false;
alter table public.advisor_prospects add column if not exists closed boolean not null default false;
