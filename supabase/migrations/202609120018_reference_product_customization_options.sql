-- Per-SKU customization governance. Source files remain in Storage; this stores option metadata only.

begin;

create table if not exists public.reference_product_customization_options (
  id uuid primary key default gen_random_uuid(),
  reference_product_id uuid not null references public.reference_products(id) on delete cascade,
  option_key text not null check (option_key ~ '^[a-z][a-z0-9_]{2,60}$'),
  option_kind text not null check (option_kind in ('color')),
  label text not null check (char_length(btrim(label)) between 2 and 120),
  description text not null default '' check (char_length(description) <= 500),
  placement_label text not null default '' check (char_length(placement_label) <= 160),
  allowed_values jsonb not null default '[]'::jsonb,
  is_required boolean not null default false,
  display_order integer not null default 0 check (display_order between 0 and 10000),
  is_active boolean not null default true,
  factory_review_note text not null default '' check (char_length(factory_review_note) <= 2000),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (reference_product_id, option_key),
  check (jsonb_typeof(allowed_values) = 'array' and jsonb_array_length(allowed_values) between 1 and 24)
);

create index if not exists reference_product_customization_options_product_idx
  on public.reference_product_customization_options (reference_product_id, is_active, display_order);

alter table public.reference_product_customization_options enable row level security;

create policy "reference_product_options_read_buyer_or_admin" on public.reference_product_customization_options
  for select using (exists (
    select 1 from public.reference_products product
    where product.id = reference_product_customization_options.reference_product_id
      and (
        (product.visible_to_buyers and product.review_status = 'approved' and reference_product_customization_options.is_active)
        or public.has_org_role(product.organization_id, array['brand_admin', 'designer']::public.app_role[])
      )
  ));

create policy "reference_product_options_manage_admin" on public.reference_product_customization_options
  for all to authenticated
  using (exists (
    select 1 from public.reference_products product
    where product.id = reference_product_customization_options.reference_product_id
      and public.has_org_role(product.organization_id, array['brand_admin']::public.app_role[])
  ))
  with check (exists (
    select 1 from public.reference_products product
    where product.id = reference_product_customization_options.reference_product_id
      and public.has_org_role(product.organization_id, array['brand_admin']::public.app_role[])
  ));

grant select, insert, update, delete on public.reference_product_customization_options to authenticated;

create trigger set_reference_product_customization_options_updated_at
  before update on public.reference_product_customization_options
  for each row execute procedure public.set_updated_at();

alter table public.reference_product_order_requests
  add column if not exists product_option_selections jsonb not null default '[]'::jsonb;

alter table public.reference_product_order_requests
  drop constraint if exists reference_product_order_requests_product_option_selections_check;
alter table public.reference_product_order_requests
  add constraint reference_product_order_requests_product_option_selections_check
  check (jsonb_typeof(product_option_selections) = 'array' and jsonb_array_length(product_option_selections) <= 12);

create or replace function public.validate_reference_product_option_selections(
  p_reference_product_id uuid,
  p_selections jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  submitted_count integer;
  accepted_count integer;
  required_count integer;
begin
  if jsonb_typeof(coalesce(p_selections, '[]'::jsonb)) <> 'array' then
    raise exception 'PRODUCT_OPTION_SELECTIONS_ARRAY_REQUIRED';
  end if;

  select count(*) into submitted_count
  from jsonb_to_recordset(p_selections) as selection(option_key text, value_id text);

  if submitted_count <> jsonb_array_length(p_selections) then
    raise exception 'PRODUCT_OPTION_SELECTION_FORMAT_INVALID';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_selections) as selection(option_key text, value_id text)
    group by selection.option_key
    having count(*) <> 1
  ) then
    raise exception 'PRODUCT_OPTION_SELECTION_DUPLICATE';
  end if;

  select count(*) into accepted_count
  from jsonb_to_recordset(p_selections) as selection(option_key text, value_id text)
  join public.reference_product_customization_options option
    on option.reference_product_id = p_reference_product_id
    and option.option_key = selection.option_key
    and option.option_kind = 'color'
    and option.is_active
    and option.allowed_values @> jsonb_build_array(jsonb_build_object('id', selection.value_id));

  if accepted_count <> submitted_count then
    raise exception 'PRODUCT_OPTION_SELECTION_NOT_ALLOWED';
  end if;

  select count(*) into required_count
  from public.reference_product_customization_options option
  where option.reference_product_id = p_reference_product_id
    and option.is_active
    and option.is_required;

  if required_count <> (
    select count(*)
    from public.reference_product_customization_options option
    join jsonb_to_recordset(p_selections) as selection(option_key text, value_id text)
      on selection.option_key = option.option_key
    where option.reference_product_id = p_reference_product_id
      and option.is_active
      and option.is_required
  ) then
    raise exception 'PRODUCT_OPTION_SELECTION_REQUIRED';
  end if;
end;
$$;

create or replace function reference_order_private.submit_reference_product_order_with_options(
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
  p_order_note text,
  p_product_option_selections jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_product_id uuid;
  previous_options jsonb;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if jsonb_typeof(coalesce(p_product_option_selections, '[]'::jsonb)) <> 'array' then
    raise exception 'PRODUCT_OPTION_SELECTIONS_ARRAY_REQUIRED';
  end if;

  select product_option_selections into previous_options
  from public.reference_product_order_requests
  where id = p_id and buyer_user_id = auth.uid();

  if found then
    if previous_options <> coalesce(p_product_option_selections, '[]'::jsonb) then
      raise exception 'ORDER_OPTION_SELECTIONS_IMMUTABLE';
    end if;
    return p_id;
  end if;

  if p_reference_product_source_id ~ '^[a-f0-9-]{36}$' then
    target_product_id := p_reference_product_source_id::uuid;
    if not exists (
      select 1 from public.reference_products product
      where product.id = target_product_id
        and product.visible_to_buyers
        and product.review_status = 'approved'
    ) then
      raise exception 'REFERENCE_PRODUCT_NOT_BUYER_VISIBLE';
    end if;
    perform public.validate_reference_product_option_selections(target_product_id, coalesce(p_product_option_selections, '[]'::jsonb));
  elsif jsonb_array_length(coalesce(p_product_option_selections, '[]'::jsonb)) > 0 then
    raise exception 'PRODUCT_OPTION_SELECTIONS_REQUIRE_DB_PRODUCT';
  end if;

  perform reference_order_private.submit_reference_product_order(
    p_id, p_company_name, p_contact_name, p_contact_phone,
    p_reference_product_source_id, p_reference_product_sku, p_reference_product_title, p_reference_product_version,
    p_model_version, p_model_checksum_sha256,
    p_personalization_profile_code, p_personalization_label, p_personalization_safe_area, p_personalization_text,
    p_personalization_image_path, p_personalization_image_name, p_personalization_image_mime, p_personalization_image_bytes,
    p_placement_label, p_quantity, p_desired_delivery_date, p_purpose, p_order_note
  );

  update public.reference_product_order_requests
  set product_option_selections = coalesce(p_product_option_selections, '[]'::jsonb)
  where id = p_id and buyer_user_id = auth.uid();

  return p_id;
end;
$$;

revoke all on function reference_order_private.submit_reference_product_order_with_options(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, bigint, text, integer, date, text, text, jsonb
) from public, anon;
grant usage on schema reference_order_private to authenticated;
grant execute on function reference_order_private.submit_reference_product_order_with_options(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, bigint, text, integer, date, text, text, jsonb
) to authenticated;

create or replace function public.submit_reference_product_order_with_options(
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
  p_order_note text,
  p_product_option_selections jsonb
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select reference_order_private.submit_reference_product_order_with_options(
    p_id, p_company_name, p_contact_name, p_contact_phone,
    p_reference_product_source_id, p_reference_product_sku, p_reference_product_title, p_reference_product_version,
    p_model_version, p_model_checksum_sha256,
    p_personalization_profile_code, p_personalization_label, p_personalization_safe_area, p_personalization_text,
    p_personalization_image_path, p_personalization_image_name, p_personalization_image_mime, p_personalization_image_bytes,
    p_placement_label, p_quantity, p_desired_delivery_date, p_purpose, p_order_note, p_product_option_selections
  );
$$;

revoke all on function public.submit_reference_product_order_with_options(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, bigint, text, integer, date, text, text, jsonb
) from public, anon;
grant execute on function public.submit_reference_product_order_with_options(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, bigint, text, integer, date, text, text, jsonb
) to authenticated;

commit;
