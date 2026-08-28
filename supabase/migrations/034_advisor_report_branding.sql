alter table public.advisors add column display_name text, add column logo_url text;

insert into storage.buckets (id, name, public) values ('advisor-logos', 'advisor-logos', true)
  on conflict (id) do nothing;

create policy "advisor manages own logo" on storage.objects for all
  using (bucket_id = 'advisor-logos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'advisor-logos' and (storage.foldername(name))[1] = auth.uid()::text);
