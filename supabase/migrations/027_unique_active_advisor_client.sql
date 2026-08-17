create unique index if not exists advisor_clients_active_pair_uidx
  on advisor_clients (advisor_id, client_id)
  where status = 'active';
