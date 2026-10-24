alter table public.advisor_prospects add column if not exists meeting_date date;
alter table public.advisor_prospects add column if not exists meeting_time text check (meeting_time is null or meeting_time ~ '^\d{2}:\d{2}$');
alter table public.advisor_prospects add column if not exists attempts integer not null default 0 check (attempts between 0 and 50);
alter table public.advisor_prospects add column if not exists attendance_confirmed boolean not null default false;
