drop policy if exists "advisor manages own logo" on storage.objects;
create policy "advisor manages own logo" on storage.objects for all
  using (bucket_id = 'advisor-logos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'advisor-logos' and (storage.foldername(name))[1] = (select auth.uid())::text);
