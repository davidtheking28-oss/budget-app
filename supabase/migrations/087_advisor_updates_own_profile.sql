drop policy if exists "advisor updates own row" on public.advisors;
create policy "advisor updates own row" on public.advisors for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke update on public.advisors from authenticated;
grant update (display_name, logo_url, brand_color) on public.advisors to authenticated;
