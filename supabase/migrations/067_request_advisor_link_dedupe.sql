create unique index if not exists advisor_clients_pending_pair_uidx
  on public.advisor_clients (advisor_id, client_id)
  where status = 'pending' and advisor_id is not null and client_id is not null;
-- request_advisor_link now returns 'already_linked' on unique_violation (applied via MCP as request_advisor_link_dedupe).
