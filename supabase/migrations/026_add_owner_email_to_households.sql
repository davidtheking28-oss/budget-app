-- households already captures member_email when a member joins (011_secure_households_join.sql),
-- but never captured the owner's email, so an advisor viewing a client who joined SOMEONE
-- ELSE's household (i.e. the client is `member_id`, not `owner_id`) had no way to identify
-- the partner — only a bare owner_id uuid. Mirrors member_email's shape and backfills existing
-- rows the same way join_household() derives member_email.

alter table public.households
  add column if not exists owner_email text;

update public.households h
set owner_email = u.email
from auth.users u
where h.owner_id = u.id
  and h.owner_email is null;
