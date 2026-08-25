alter table public.advisor_meetings
  add column if not exists decline_note text;
