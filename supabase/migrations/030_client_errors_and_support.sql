-- Production visibility + the two promises the privacy policy already makes but
-- the app could not keep: a contact channel and a real deletion path.

-- ── client_errors ────────────────────────────────────────────────────────────
-- Write-only from the browser. Nobody reads it through the API; inspection is
-- via the dashboard/service role only. Deliberately carries no financial fields.
create table if not exists public.client_errors (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  user_id     uuid references auth.users(id) on delete set null,
  kind        text not null,
  message     text not null,
  source      text,
  lineno      int,
  colno       int,
  stack       text,
  app         text,
  ua          text
);

create index if not exists client_errors_created_at_idx on public.client_errors (created_at desc);

alter table public.client_errors enable row level security;

-- Reporting must work before login too (a crash on the auth screen is exactly
-- the one you most need to see), so anon may insert — but only rows that either
-- carry no user or carry the caller's own id.
drop policy if exists "report own errors" on public.client_errors;
create policy "report own errors" on public.client_errors
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

revoke select, update, delete on public.client_errors from anon, authenticated;

-- ── support_messages ─────────────────────────────────────────────────────────
-- Contact form. Same shape: users write, only the service role reads.
create table if not exists public.support_messages (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  user_id     uuid references auth.users(id) on delete set null,
  email       text,
  topic       text not null,
  body        text not null,
  app         text,
  ua          text,
  handled     boolean not null default false
);

create index if not exists support_messages_created_at_idx on public.support_messages (created_at desc);

alter table public.support_messages enable row level security;

drop policy if exists "send own support message" on public.support_messages;
create policy "send own support message" on public.support_messages
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

revoke select, update, delete on public.support_messages from anon, authenticated;
