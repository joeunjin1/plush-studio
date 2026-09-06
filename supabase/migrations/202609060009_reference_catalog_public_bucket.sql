-- Apply manually to staging and Production after reviewing the public-catalog policy.
-- Public exposure is intentionally limited to approved product reference imagery.
-- Buyer files, project assets, factory materials, and exports remain in the private plush-studio bucket.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'plush-studio-catalog',
  'plush-studio-catalog',
  true,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.is_catalog_asset_admin(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_org_role(
    nullif(split_part(object_name, '/', 1), '')::uuid,
    array['brand_admin']::public.app_role[]
  );
$$;

drop policy if exists "plush_studio_catalog_upload_admin" on storage.objects;
create policy "plush_studio_catalog_upload_admin" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'plush-studio-catalog'
    and public.is_catalog_asset_admin(name)
  );

drop policy if exists "plush_studio_catalog_update_admin" on storage.objects;
create policy "plush_studio_catalog_update_admin" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'plush-studio-catalog'
    and public.is_catalog_asset_admin(name)
  )
  with check (
    bucket_id = 'plush-studio-catalog'
    and public.is_catalog_asset_admin(name)
  );

drop policy if exists "plush_studio_catalog_delete_admin" on storage.objects;
create policy "plush_studio_catalog_delete_admin" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'plush-studio-catalog'
    and public.is_catalog_asset_admin(name)
  );

grant execute on function public.is_catalog_asset_admin(text) to authenticated;
