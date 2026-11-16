drop policy "advisor reads client document files" on storage.objects;

create policy "advisor reads client document files" on storage.objects for select
  using (
    bucket_id = 'client-documents'
    and public.is_advisor() and public.advisor_mfa_ok()
    and exists (
      select 1 from public.advisor_clients ac
      where ac.advisor_id = (select auth.uid()) and ac.client_id::text = (storage.foldername(objects.name))[1] and ac.status = 'active'
    )
  );
