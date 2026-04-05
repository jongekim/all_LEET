-- Community post image attachments

alter table if exists public.community_posts
  add column if not exists image_urls text[] not null default '{}';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-post-images',
  'community-post-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read for image delivery
-- (public bucket usually allows this; policy added for clarity)
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'community_post_images_select_public'
  ) then
    create policy "community_post_images_select_public"
    on storage.objects
    for select
    using (bucket_id = 'community-post-images');
  end if;
end $$;

-- Authenticated users can upload only under their own user-id folder: <uid>/...
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'community_post_images_insert_own'
  ) then
    create policy "community_post_images_insert_own"
    on storage.objects
    for insert
    with check (
      bucket_id = 'community-post-images'
      and auth.role() = 'authenticated'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
  end if;
end $$;

-- Users can update/delete only files in their own folder
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'community_post_images_update_own'
  ) then
    create policy "community_post_images_update_own"
    on storage.objects
    for update
    using (
      bucket_id = 'community-post-images'
      and auth.role() = 'authenticated'
      and (storage.foldername(name))[1] = auth.uid()::text
    )
    with check (
      bucket_id = 'community-post-images'
      and auth.role() = 'authenticated'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'community_post_images_delete_own'
  ) then
    create policy "community_post_images_delete_own"
    on storage.objects
    for delete
    using (
      bucket_id = 'community-post-images'
      and auth.role() = 'authenticated'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
  end if;
end $$;
