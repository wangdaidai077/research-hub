-- =====================================================================
-- Private image storage (backgrounds, project covers, icons, avatar)
-- Files live at:  user-media/<user_id>/<kind>/<random>.webp
-- Only the owner can read, upload, replace or delete files in their folder.
-- Images are displayed through short-lived signed URLs, never public links.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('user-media', 'user-media', false, 5242880,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "user_media_select" on storage.objects;
drop policy if exists "user_media_insert" on storage.objects;
drop policy if exists "user_media_update" on storage.objects;
drop policy if exists "user_media_delete" on storage.objects;

create policy "user_media_select" on storage.objects for select to authenticated
  using (bucket_id = 'user-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "user_media_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'user-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "user_media_update" on storage.objects for update to authenticated
  using (bucket_id = 'user-media' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'user-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "user_media_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'user-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
