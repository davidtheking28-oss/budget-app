alter table public.advisor_prospects add column if not exists closed_at date;
update public.advisor_prospects set closed_at = coalesce(meeting_date, contacted_at) where closed and closed_at is null;
