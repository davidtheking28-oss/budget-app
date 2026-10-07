revoke update on public.advisor_clients from public, anon, authenticated;
grant update (name, phone, background, tags, is_vip) on public.advisor_clients to authenticated;
