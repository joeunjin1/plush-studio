-- Apply manually to both staging and Production only after reviewing the access policy.
-- This migration stores metadata and storage paths only; image bytes remain in object storage.

create table if not exists public.reference_products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sku text not null check (sku ~ '^[A-Z0-9][A-Z0-9_-]{2,60}$'),
  title text not null check (char_length(title) between 2 and 160),
  product_family text not null check (product_family in ('plush', 'bag', 'shirt', 'other')),
  color_option text not null default '',
  source_status text not null default 'seller_supplied' check (source_status in ('seller_supplied', 'factory_supplied', 'licensed', 'generated_reference')),
  review_status text not null default 'draft' check (review_status in ('draft', 'pending_review', 'approved', 'rejected', 'archived')),
  visible_to_buyers boolean not null default false,
  physical_width_cm numeric(10,2) check (physical_width_cm > 0),
  physical_height_cm numeric(10,2) check (physical_height_cm > 0),
  physical_depth_cm numeric(10,2) check (physical_depth_cm > 0),
  carton_width_cm numeric(10,2) check (carton_width_cm > 0),
  carton_height_cm numeric(10,2) check (carton_height_cm > 0),
  carton_depth_cm numeric(10,2) check (carton_depth_cm > 0),
  carton_cbm numeric(14,6) generated always as (
    case
      when carton_width_cm is not null and carton_height_cm is not null and carton_depth_cm is not null
      then carton_width_cm * carton_height_cm * carton_depth_cm / 1000000
      else null
    end
  ) stored,
  target_template_id text,
  rights_confirmed_at timestamptz,
  rights_confirmation_note text check (char_length(coalesce(rights_confirmation_note, '')) <= 500),
  review_note text check (char_length(coalesce(review_note, '')) <= 2000),
  created_by uuid not null references auth.users(id) on delete restrict,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, sku),
  check (
    (visible_to_buyers = false)
    or (review_status = 'approved' and rights_confirmed_at is not null and reviewed_at is not null)
  )
);

create table if not exists public.reference_product_images (
  id uuid primary key default gen_random_uuid(),
  reference_product_id uuid not null references public.reference_products(id) on delete cascade,
  view_key text not null check (view_key in ('front', 'left', 'rear', 'right', 'top', 'detail')),
  storage_path text not null unique,
  original_filename text not null check (char_length(original_filename) between 1 and 255),
  mime_type text not null check (mime_type in ('image/png', 'image/jpeg', 'image/webp')),
  pixel_width integer not null check (pixel_width between 1 and 10000),
  pixel_height integer not null check (pixel_height between 1 and 10000),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (reference_product_id, view_key, sort_order)
);

create table if not exists public.reference_product_tag_templates (
  id uuid primary key default gen_random_uuid(),
  reference_product_id uuid not null references public.reference_products(id) on delete cascade,
  side text not null check (side in ('front', 'back')),
  storage_path text not null unique,
  max_characters integer not null default 36 check (max_characters between 1 and 120),
  max_lines integer not null default 3 check (max_lines between 1 and 6),
  print_method text,
  safe_area jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (reference_product_id, side)
);

create index if not exists reference_products_public_catalog_idx
  on public.reference_products (product_family, review_status)
  where visible_to_buyers = true;
create index if not exists reference_product_images_product_idx
  on public.reference_product_images (reference_product_id, view_key);

alter table public.reference_products enable row level security;
alter table public.reference_product_images enable row level security;
alter table public.reference_product_tag_templates enable row level security;

create policy "reference_products_read_public_or_admin" on public.reference_products
  for select using (
    (visible_to_buyers and review_status = 'approved')
    or public.has_org_role(organization_id, array['brand_admin', 'designer']::public.app_role[])
  );
create policy "reference_products_manage_admin" on public.reference_products
  for all to authenticated
  using (public.has_org_role(organization_id, array['brand_admin']::public.app_role[]))
  with check (public.has_org_role(organization_id, array['brand_admin']::public.app_role[]));

create policy "reference_images_read_public_or_admin" on public.reference_product_images
  for select using (
    exists (
      select 1 from public.reference_products product
      where product.id = reference_product_images.reference_product_id
        and (
          (product.visible_to_buyers and product.review_status = 'approved')
          or public.has_org_role(product.organization_id, array['brand_admin', 'designer']::public.app_role[])
        )
    )
  );
create policy "reference_images_manage_admin" on public.reference_product_images
  for all to authenticated
  using (exists (
    select 1 from public.reference_products product
    where product.id = reference_product_images.reference_product_id
      and public.has_org_role(product.organization_id, array['brand_admin']::public.app_role[])
  ))
  with check (exists (
    select 1 from public.reference_products product
    where product.id = reference_product_images.reference_product_id
      and public.has_org_role(product.organization_id, array['brand_admin']::public.app_role[])
  ));

create policy "reference_tag_templates_read_public_or_admin" on public.reference_product_tag_templates
  for select using (
    exists (
      select 1 from public.reference_products product
      where product.id = reference_product_tag_templates.reference_product_id
        and (
          (product.visible_to_buyers and product.review_status = 'approved')
          or public.has_org_role(product.organization_id, array['brand_admin', 'designer']::public.app_role[])
        )
    )
  );
create policy "reference_tag_templates_manage_admin" on public.reference_product_tag_templates
  for all to authenticated
  using (exists (
    select 1 from public.reference_products product
    where product.id = reference_product_tag_templates.reference_product_id
      and public.has_org_role(product.organization_id, array['brand_admin']::public.app_role[])
  ))
  with check (exists (
    select 1 from public.reference_products product
    where product.id = reference_product_tag_templates.reference_product_id
      and public.has_org_role(product.organization_id, array['brand_admin']::public.app_role[])
  ));

grant select on public.reference_products, public.reference_product_images, public.reference_product_tag_templates to anon, authenticated;
grant insert, update, delete on public.reference_products, public.reference_product_images, public.reference_product_tag_templates to authenticated;

create trigger set_reference_products_updated_at
  before update on public.reference_products
  for each row execute procedure public.set_updated_at();
