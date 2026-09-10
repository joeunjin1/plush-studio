-- STAGING FIRST. Apply only after migrations 008 and 010.
-- This stores request metadata and private object keys; it never stores image/GLB bytes.

begin;

create schema if not exists reference_order_private;
revoke all on schema reference_order_private from public, anon;
grant usage on schema reference_order_private to authenticated;

create table if not exists public.reference_product_order_requests (
  id uuid primary key,
  buyer_company_id uuid not null references public.buyer_companies(id) on delete restrict,
  buyer_user_id uuid not null references auth.users(id) on delete restrict,
  reference_product_source_id text not null check (char_length(reference_product_source_id) between 3 and 120),
  reference_product_sku text not null check (char_length(reference_product_sku) between 3 and 80),
  reference_product_title text not null check (char_length(reference_product_title) between 2 and 160),
  reference_product_version text not null check (char_length(reference_product_version) between 1 and 40),
  model_version text check (char_length(coalesce(model_version, '')) <= 40),
  model_checksum_sha256 text check (model_checksum_sha256 is null or model_checksum_sha256 ~ '^[a-f0-9]{64}$'),
  personalization_profile_code text not null check (personalization_profile_code ~ '^[a-z0-9-]{3,80}$'),
  personalization_label text not null check (char_length(personalization_label) between 2 and 120),
  personalization_safe_area text not null default '' check (char_length(personalization_safe_area) <= 300),
  personalization_text text check (char_length(coalesce(personalization_text, '')) <= 500),
  personalization_image_path text,
  personalization_image_name text check (char_length(coalesce(personalization_image_name, '')) <= 255),
  personalization_image_mime text check (personalization_image_mime is null or personalization_image_mime in ('image/png', 'image/jpeg', 'image/webp')),
  personalization_image_bytes bigint check (personalization_image_bytes is null or personalization_image_bytes between 1 and 5242880),
  placement_label text not null default '' check (char_length(placement_label) <= 160),
  quantity integer not null check (quantity between 1 and 100000),
  desired_delivery_date date,
  purpose text not null check (purpose in ('sample', 'production', 'consult')),
  order_note text not null default '' check (char_length(order_note) <= 3000),
  contact_name text not null check (char_length(btrim(contact_name)) between 2 and 80),
  contact_phone text not null default '' check (contact_phone = '' or contact_phone ~ '^[+0-9() -]{7,30}$'),
  consent_version text not null check (consent_version = 'reference-order-v1'),
  consent_at timestamptz not null default now(),
  status text not null default 'received' check (status in ('received', 'reviewing', 'quoted', 'confirmed', 'sample_review', 'production_qa', 'completed', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (personalization_text is not null or personalization_image_path is not null)
);

create index if not exists reference_product_orders_buyer_date_idx
  on public.reference_product_order_requests (buyer_user_id, created_at desc);
create index if not exists reference_product_orders_company_date_idx
  on public.reference_product_order_requests (buyer_company_id, created_at desc);
create index if not exists reference_product_orders_sku_date_idx
  on public.reference_product_order_requests (reference_product_sku, created_at desc);

alter table public.reference_product_order_requests enable row level security;
revoke all on public.reference_product_order_requests from anon, authenticated;
grant select on public.reference_product_order_requests to authenticated;

create policy "reference_orders_read_company_members" on public.reference_product_order_requests
  for select to authenticated
  using (public.is_buyer_company_member(buyer_company_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'buyer-personalization-assets',
  'buyer-personalization-assets',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "buyer_personalization_asset_read_owner" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'buyer-personalization-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "buyer_personalization_asset_create_before_submit" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'buyer-personalization-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (storage.foldername(name))[2] ~ '^[a-f0-9-]{36}$'
    and not exists (
      select 1
      from public.reference_product_order_requests request
      where request.id::text = (storage.foldername(name))[2]
    )
  );

create policy "buyer_personalization_asset_retry_before_submit" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'buyer-personalization-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not exists (
      select 1
      from public.reference_product_order_requests request
      where request.id::text = (storage.foldername(name))[2]
    )
  )
  with check (
    bucket_id = 'buyer-personalization-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (storage.foldername(name))[2] ~ '^[a-f0-9-]{36}$'
  );

create or replace function reference_order_private.submit_reference_product_order(
  p_id uuid,
  p_company_name text,
  p_contact_name text,
  p_contact_phone text,
  p_reference_product_source_id text,
  p_reference_product_sku text,
  p_reference_product_title text,
  p_reference_product_version text,
  p_model_version text,
  p_model_checksum_sha256 text,
  p_personalization_profile_code text,
  p_personalization_label text,
  p_personalization_safe_area text,
  p_personalization_text text,
  p_personalization_image_path text,
  p_personalization_image_name text,
  p_personalization_image_mime text,
  p_personalization_image_bytes bigint,
  p_placement_label text,
  p_quantity integer,
  p_desired_delivery_date date,
  p_purpose text,
  p_order_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  who uuid := auth.uid();
  company_id uuid;
  previous_owner uuid;
begin
  if who is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if char_length(btrim(coalesce(p_company_name, ''))) not between 2 and 160 then
    raise exception 'INVALID_COMPANY_NAME';
  end if;
  if char_length(btrim(coalesce(p_contact_name, ''))) not between 2 and 80 then
    raise exception 'INVALID_CONTACT_NAME';
  end if;
  if p_quantity is null or p_quantity not between 1 and 100000 then
    raise exception 'INVALID_QUANTITY';
  end if;
  if coalesce(p_purpose, '') not in ('sample', 'production', 'consult') then
    raise exception 'INVALID_PURPOSE';
  end if;
  if nullif(btrim(coalesce(p_personalization_text, '')), '') is null
     and nullif(btrim(coalesce(p_personalization_image_path, '')), '') is null then
    raise exception 'PERSONALIZATION_REQUIRED';
  end if;
  if p_personalization_image_path is not null then
    if p_personalization_image_path !~ ('^' || who::text || '/' || p_id::text || '/[a-z0-9_-]{3,80}$') then
      raise exception 'INVALID_PERSONALIZATION_ASSET_PATH';
    end if;
    if not exists (
      select 1
      from storage.objects object
      where object.bucket_id = 'buyer-personalization-assets'
        and object.name = p_personalization_image_path
    ) then
      raise exception 'PERSONALIZATION_ASSET_NOT_FOUND';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_id::text, 3));
  select buyer_user_id into previous_owner
  from public.reference_product_order_requests
  where id = p_id;
  if found then
    if previous_owner <> who then
      raise exception 'FORBIDDEN';
    end if;
    return p_id;
  end if;

  select id into company_id
  from public.buyer_companies
  where created_by = who
    and lower(name) = lower(btrim(p_company_name))
  order by created_at asc
  limit 1;
  if company_id is null then
    insert into public.buyer_companies (name, created_by)
    values (btrim(p_company_name), who)
    returning id into company_id;
  end if;

  insert into public.buyer_company_members (buyer_company_id, user_id, role)
  values (company_id, who, 'owner')
  on conflict (buyer_company_id, user_id) do nothing;

  insert into public.reference_product_order_requests (
    id, buyer_company_id, buyer_user_id,
    reference_product_source_id, reference_product_sku, reference_product_title, reference_product_version,
    model_version, model_checksum_sha256,
    personalization_profile_code, personalization_label, personalization_safe_area, personalization_text,
    personalization_image_path, personalization_image_name, personalization_image_mime, personalization_image_bytes,
    placement_label, quantity, desired_delivery_date, purpose, order_note,
    contact_name, contact_phone, consent_version
  ) values (
    p_id, company_id, who,
    btrim(p_reference_product_source_id), btrim(p_reference_product_sku), btrim(p_reference_product_title), btrim(p_reference_product_version),
    nullif(btrim(coalesce(p_model_version, '')), ''), lower(nullif(btrim(coalesce(p_model_checksum_sha256, '')), '')),
    btrim(p_personalization_profile_code), btrim(p_personalization_label), btrim(coalesce(p_personalization_safe_area, '')), nullif(btrim(coalesce(p_personalization_text, '')), ''),
    nullif(btrim(coalesce(p_personalization_image_path, '')), ''), nullif(btrim(coalesce(p_personalization_image_name, '')), ''), nullif(btrim(coalesce(p_personalization_image_mime, '')), ''), p_personalization_image_bytes,
    btrim(coalesce(p_placement_label, '')), p_quantity, p_desired_delivery_date, p_purpose, left(coalesce(p_order_note, ''), 3000),
    btrim(p_contact_name), btrim(coalesce(p_contact_phone, '')), 'reference-order-v1'
  );

  return p_id;
end;
$$;

revoke all on function reference_order_private.submit_reference_product_order(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, bigint, text, integer, date, text, text
) from public, anon;
grant execute on function reference_order_private.submit_reference_product_order(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, bigint, text, integer, date, text, text
) to authenticated;

create or replace function public.submit_reference_product_order(
  p_id uuid,
  p_company_name text,
  p_contact_name text,
  p_contact_phone text,
  p_reference_product_source_id text,
  p_reference_product_sku text,
  p_reference_product_title text,
  p_reference_product_version text,
  p_model_version text,
  p_model_checksum_sha256 text,
  p_personalization_profile_code text,
  p_personalization_label text,
  p_personalization_safe_area text,
  p_personalization_text text,
  p_personalization_image_path text,
  p_personalization_image_name text,
  p_personalization_image_mime text,
  p_personalization_image_bytes bigint,
  p_placement_label text,
  p_quantity integer,
  p_desired_delivery_date date,
  p_purpose text,
  p_order_note text
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select reference_order_private.submit_reference_product_order(
    p_id, p_company_name, p_contact_name, p_contact_phone,
    p_reference_product_source_id, p_reference_product_sku, p_reference_product_title, p_reference_product_version,
    p_model_version, p_model_checksum_sha256,
    p_personalization_profile_code, p_personalization_label, p_personalization_safe_area, p_personalization_text,
    p_personalization_image_path, p_personalization_image_name, p_personalization_image_mime, p_personalization_image_bytes,
    p_placement_label, p_quantity, p_desired_delivery_date, p_purpose, p_order_note
  );
$$;

revoke all on function public.submit_reference_product_order(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, bigint, text, integer, date, text, text
) from public, anon;
grant execute on function public.submit_reference_product_order(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, bigint, text, integer, date, text, text
) to authenticated;

create trigger set_reference_product_order_requests_updated_at
  before update on public.reference_product_order_requests
  for each row execute procedure public.set_updated_at();

commit;
