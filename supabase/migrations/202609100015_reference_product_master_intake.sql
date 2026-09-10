-- STAGING ONLY. Product-master metadata and private reference-photo intake.
-- Source bytes remain in Storage. Buyer-visible images are created only after a reviewed public copy is registered.

begin;

alter table public.reference_products
  add column if not exists title_en text,
  add column if not exists category_code text not null default 'general' check (category_code ~ '^[a-z0-9][a-z0-9_-]{1,60}$');

alter table public.reference_products
  drop constraint if exists reference_products_title_en_check;
alter table public.reference_products
  add constraint reference_products_title_en_check
  check (title_en is null or char_length(btrim(title_en)) between 2 and 160);

create table if not exists public.reference_product_image_intakes (
  id uuid primary key default gen_random_uuid(),
  reference_product_id uuid not null references public.reference_products(id) on delete cascade,
  view_key text not null check (view_key in ('front', 'left', 'rear', 'right', 'top', 'detail')),
  source_storage_bucket text not null default 'plush-studio' check (source_storage_bucket = 'plush-studio'),
  source_storage_path text not null unique,
  original_filename text not null check (char_length(original_filename) between 1 and 255),
  mime_type text not null check (mime_type in ('image/png', 'image/jpeg', 'image/webp')),
  byte_size bigint not null check (byte_size between 1 and 10485760),
  pixel_width integer not null check (pixel_width between 1 and 10000),
  pixel_height integer not null check (pixel_height between 1 and 10000),
  review_state text not null default 'draft' check (review_state in ('draft', 'pending_review', 'approved', 'rejected', 'archived')),
  public_storage_path text unique,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (reference_product_id, view_key, review_state) deferrable initially immediate,
  check ((public_storage_path is null) or review_state = 'approved'),
  check ((reviewed_at is null and reviewed_by is null) or (reviewed_at is not null and reviewed_by is not null))
);

create index if not exists reference_product_image_intakes_product_view_idx
  on public.reference_product_image_intakes (reference_product_id, view_key, created_at desc);

create or replace function public.reference_product_has_five_active_views(target_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct image.view_key) = 5
  from public.reference_product_images image
  where image.reference_product_id = target_product_id
    and image.is_active = true
    and image.view_key in ('front', 'left', 'rear', 'right', 'top');
$$;

create or replace function public.enforce_reference_product_publication_gate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.visible_to_buyers then
    if new.review_status <> 'approved'
      or new.rights_confirmed_at is null
      or new.reviewed_at is null
      or nullif(btrim(coalesce(new.title_en, '')), '') is null
      or new.physical_width_cm is null
      or new.physical_height_cm is null
      or new.physical_depth_cm is null
      or new.carton_width_cm is null
      or new.carton_height_cm is null
      or new.carton_depth_cm is null then
      raise exception 'REFERENCE_PRODUCT_PUBLICATION_METADATA_INCOMPLETE';
    end if;
    if not public.reference_product_has_five_active_views(new.id) then
      raise exception 'REFERENCE_PRODUCT_FIVE_APPROVED_VIEWS_REQUIRED';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_reference_product_publication_gate on public.reference_products;
create trigger enforce_reference_product_publication_gate
  before insert or update of visible_to_buyers, review_status, rights_confirmed_at, reviewed_at,
    title_en, physical_width_cm, physical_height_cm, physical_depth_cm,
    carton_width_cm, carton_height_cm, carton_depth_cm
  on public.reference_products
  for each row execute procedure public.enforce_reference_product_publication_gate();

create or replace function public.enforce_reference_product_active_view_retention()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_product_id uuid := coalesce(new.reference_product_id, old.reference_product_id);
  is_visible boolean;
begin
  select visible_to_buyers into is_visible from public.reference_products where id = target_product_id;
  if is_visible and not public.reference_product_has_five_active_views(target_product_id) then
    raise exception 'REFERENCE_PRODUCT_FIVE_APPROVED_VIEWS_REQUIRED';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists enforce_reference_product_active_view_retention on public.reference_product_images;
create constraint trigger enforce_reference_product_active_view_retention
  after update of is_active, view_key or delete on public.reference_product_images
  deferrable initially deferred
  for each row execute procedure public.enforce_reference_product_active_view_retention();

alter table public.reference_product_image_intakes enable row level security;
create policy "reference_image_intakes_read_admin" on public.reference_product_image_intakes
  for select to authenticated
  using (exists (
    select 1 from public.reference_products product
    where product.id = reference_product_image_intakes.reference_product_id
      and public.has_org_role(product.organization_id, array['brand_admin']::public.app_role[])
  ));
create policy "reference_image_intakes_manage_admin" on public.reference_product_image_intakes
  for all to authenticated
  using (exists (
    select 1 from public.reference_products product
    where product.id = reference_product_image_intakes.reference_product_id
      and public.has_org_role(product.organization_id, array['brand_admin']::public.app_role[])
  ))
  with check (exists (
    select 1 from public.reference_products product
    where product.id = reference_product_image_intakes.reference_product_id
      and public.has_org_role(product.organization_id, array['brand_admin']::public.app_role[])
  ));

grant select, insert, update, delete on public.reference_product_image_intakes to authenticated;
grant execute on function public.reference_product_has_five_active_views(uuid) to authenticated;

create trigger set_reference_product_image_intakes_updated_at
  before update on public.reference_product_image_intakes
  for each row execute procedure public.set_updated_at();

commit;
