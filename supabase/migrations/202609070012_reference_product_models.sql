-- Owner-supplied GLB originals stay in the private plush-studio bucket.
-- This table stores version and verification metadata only: never GLB bytes.
-- Apply to staging first. Do not apply to Production without a separate promotion approval.

create table if not exists public.reference_product_models (
  id uuid primary key default gen_random_uuid(),
  reference_product_id uuid not null references public.reference_products(id) on delete cascade,
  model_version text not null check (model_version ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$'),
  source_type text not null default 'seller_supplied' check (source_type in ('seller_supplied', 'factory_supplied', 'licensed')),
  source_filename text not null check (char_length(source_filename) between 1 and 255),
  source_storage_bucket text not null default 'plush-studio' check (source_storage_bucket = 'plush-studio'),
  source_storage_path text not null unique check (source_storage_path ~ '^[a-f0-9-]+/reference-products/models/.+'),
  mime_type text not null default 'model/gltf-binary' check (mime_type = 'model/gltf-binary'),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 209715200),
  checksum_sha256 text not null check (checksum_sha256 ~ '^[a-f0-9]{64}$'),
  checksum_verification_state text not null default 'pending' check (checksum_verification_state in ('pending', 'verified', 'failed')),
  checksum_verified_at timestamptz,
  checksum_verified_by uuid references auth.users(id) on delete set null,
  mesh_count integer check (mesh_count is null or mesh_count >= 0),
  triangle_count integer check (triangle_count is null or triangle_count >= 0),
  material_count integer check (material_count is null or material_count >= 0),
  embedded_texture_count integer check (embedded_texture_count is null or embedded_texture_count >= 0),
  has_animations boolean,
  model_metadata jsonb not null default '{}'::jsonb,
  review_state text not null default 'draft' check (review_state in ('draft', 'pending_review', 'approved', 'changes_requested', 'rejected', 'archived')),
  review_note text not null default '' check (char_length(review_note) <= 2000),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  published_storage_bucket text check (published_storage_bucket is null or published_storage_bucket = 'plush-studio-catalog'),
  published_storage_path text unique,
  is_current boolean not null default false,
  visible_to_buyers boolean not null default false,
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (reference_product_id, model_version),
  check (
    (checksum_verification_state = 'verified' and checksum_verified_at is not null)
    or (checksum_verification_state <> 'verified' and checksum_verified_at is null)
  ),
  check (
    (review_state = 'approved' and reviewed_at is not null)
    or (review_state <> 'approved' and reviewed_at is null)
  ),
  check (
    (not is_current and not visible_to_buyers)
    or (
      review_state = 'approved'
      and checksum_verification_state = 'verified'
      and checksum_verified_at is not null
      and reviewed_at is not null
      and published_storage_bucket = 'plush-studio-catalog'
      and published_storage_path is not null
    )
  )
);

create unique index if not exists reference_product_models_one_current_idx
  on public.reference_product_models (reference_product_id)
  where is_current;
create index if not exists reference_product_models_review_idx
  on public.reference_product_models (reference_product_id, review_state, uploaded_at desc);

alter table public.reference_product_models enable row level security;

drop policy if exists "reference_product_models_read_current_public_or_admin" on public.reference_product_models;
create policy "reference_product_models_read_current_public_or_admin" on public.reference_product_models
  for select using (
    exists (
      select 1
      from public.reference_products product
      where product.id = reference_product_models.reference_product_id
        and product.visible_to_buyers
        and product.review_status = 'approved'
        and reference_product_models.is_current
        and reference_product_models.visible_to_buyers
    )
    or exists (
      select 1
      from public.reference_products product
      where product.id = reference_product_models.reference_product_id
        and public.has_org_role(product.organization_id, array['brand_admin']::public.app_role[])
    )
  );

drop policy if exists "reference_product_models_insert_admin" on public.reference_product_models;
create policy "reference_product_models_insert_admin" on public.reference_product_models
  for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1
      from public.reference_products product
      where product.id = reference_product_models.reference_product_id
        and public.has_org_role(product.organization_id, array['brand_admin']::public.app_role[])
    )
  );

drop policy if exists "reference_product_models_update_admin" on public.reference_product_models;
create policy "reference_product_models_update_admin" on public.reference_product_models
  for update to authenticated
  using (
    exists (
      select 1
      from public.reference_products product
      where product.id = reference_product_models.reference_product_id
        and public.has_org_role(product.organization_id, array['brand_admin']::public.app_role[])
    )
  )
  with check (
    exists (
      select 1
      from public.reference_products product
      where product.id = reference_product_models.reference_product_id
        and public.has_org_role(product.organization_id, array['brand_admin']::public.app_role[])
    )
  );

drop policy if exists "reference_product_models_delete_admin" on public.reference_product_models;
create policy "reference_product_models_delete_admin" on public.reference_product_models
  for delete to authenticated
  using (
    exists (
      select 1
      from public.reference_products product
      where product.id = reference_product_models.reference_product_id
        and public.has_org_role(product.organization_id, array['brand_admin']::public.app_role[])
    )
  );

create or replace function public.publish_reference_product_model(target_model_id uuid)
returns public.reference_product_models
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_model public.reference_product_models%rowtype;
  target_reference_product_id uuid;
  target_model_review_state text;
  target_checksum_verification_state text;
  target_checksum_verified_at timestamptz;
  target_model_reviewed_at timestamptz;
  target_published_storage_bucket text;
  target_published_storage_path text;
  target_organization_id uuid;
  target_product_review_state text;
  target_product_visible boolean;
  target_product_rights_confirmed_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  select
    model.reference_product_id,
    model.review_state,
    model.checksum_verification_state,
    model.checksum_verified_at,
    model.reviewed_at,
    model.published_storage_bucket,
    model.published_storage_path,
    product.organization_id,
    product.review_status,
    product.visible_to_buyers,
    product.rights_confirmed_at
  into
    target_reference_product_id,
    target_model_review_state,
    target_checksum_verification_state,
    target_checksum_verified_at,
    target_model_reviewed_at,
    target_published_storage_bucket,
    target_published_storage_path,
    target_organization_id,
    target_product_review_state,
    target_product_visible,
    target_product_rights_confirmed_at
  from public.reference_product_models model
  join public.reference_products product on product.id = model.reference_product_id
  where model.id = target_model_id
  for update of model;

  if not found then
    raise exception 'Reference product model not found' using errcode = 'P0002';
  end if;

  if not public.has_org_role(target_organization_id, array['brand_admin']::public.app_role[]) then
    raise exception 'Brand-admin permission is required' using errcode = '42501';
  end if;

  if target_product_review_state <> 'approved'
    or not target_product_visible
    or target_product_rights_confirmed_at is null
    or target_model_review_state <> 'approved'
    or target_checksum_verification_state <> 'verified'
    or target_checksum_verified_at is null
    or target_model_reviewed_at is null
    or target_published_storage_bucket <> 'plush-studio-catalog'
    or target_published_storage_path is null then
    raise exception 'Approved product, verified model, and reviewed public catalog path are required before publication' using errcode = '23514';
  end if;

  update public.reference_product_models
  set is_current = false,
      visible_to_buyers = false,
      published_at = null,
      published_by = null
  where reference_product_id = target_reference_product_id
    and id <> target_model_id
    and is_current;

  update public.reference_product_models
  set is_current = true,
      visible_to_buyers = true,
      published_by = auth.uid(),
      published_at = now()
  where id = selected_model.id
  returning * into selected_model;

  return selected_model;
end;
$$;

grant select on public.reference_product_models to anon, authenticated;
grant insert, update, delete on public.reference_product_models to authenticated;
grant execute on function public.publish_reference_product_model(uuid) to authenticated;

drop trigger if exists set_reference_product_models_updated_at on public.reference_product_models;
create trigger set_reference_product_models_updated_at
  before update on public.reference_product_models
  for each row execute procedure public.set_updated_at();
