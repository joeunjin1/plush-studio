-- STAGING ONLY. Apply after 015.
-- Private source images remain in `plush-studio`. This function registers only
-- reviewed copies already uploaded by a brand_admin to `plush-studio-catalog`.

begin;

create or replace function public.publish_reviewed_reference_product_photos(
  p_reference_product_id uuid,
  p_public_assets jsonb,
  p_review_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  target_product public.reference_products%rowtype;
  submitted_count integer;
  eligible_required_count integer;
  verified_public_object_count integer;
begin
  if jsonb_typeof(p_public_assets) <> 'array' then
    raise exception 'REFERENCE_PRODUCT_PUBLIC_ASSETS_ARRAY_REQUIRED';
  end if;

  if char_length(coalesce(p_review_note, '')) > 2000 then
    raise exception 'REFERENCE_PRODUCT_REVIEW_NOTE_TOO_LONG';
  end if;

  select * into target_product
  from public.reference_products
  where id = p_reference_product_id;

  if not found then
    raise exception 'REFERENCE_PRODUCT_NOT_FOUND';
  end if;

  if not public.has_org_role(target_product.organization_id, array['brand_admin']::public.app_role[]) then
    raise exception 'REFERENCE_PRODUCT_ADMIN_REQUIRED';
  end if;

  select count(*) into submitted_count
  from jsonb_to_recordset(p_public_assets) as asset(intake_id uuid, public_storage_path text);

  if submitted_count <> 5 then
    raise exception 'REFERENCE_PRODUCT_FIVE_APPROVED_VIEWS_REQUIRED';
  end if;

  with submitted as (
    select *
    from jsonb_to_recordset(p_public_assets) as asset(intake_id uuid, public_storage_path text)
  ), eligible as (
    select intake.id, intake.view_key, intake.original_filename, intake.mime_type,
      intake.pixel_width, intake.pixel_height, submitted.public_storage_path
    from public.reference_product_image_intakes intake
    join submitted on submitted.intake_id = intake.id
    where intake.reference_product_id = p_reference_product_id
      and intake.review_state in ('draft', 'pending_review')
      and intake.view_key in ('front', 'left', 'rear', 'right', 'top')
      and submitted.public_storage_path like format(
        '%s/reference-products/%s/images/%s/%%',
        target_product.organization_id,
        p_reference_product_id,
        intake.view_key
      )
  )
  select count(distinct view_key) into eligible_required_count from eligible;

  if eligible_required_count <> 5 then
    raise exception 'REFERENCE_PRODUCT_REVIEWED_INTAKES_REQUIRED';
  end if;

  with submitted as (
    select *
    from jsonb_to_recordset(p_public_assets) as asset(intake_id uuid, public_storage_path text)
  )
  select count(*) into verified_public_object_count
  from submitted
  join storage.objects object
    on object.bucket_id = 'plush-studio-catalog'
    and object.name = submitted.public_storage_path;

  if verified_public_object_count <> 5 then
    raise exception 'REFERENCE_PRODUCT_PUBLIC_CATALOG_OBJECTS_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.reference_product_personalization_methods mapping
    join public.personalization_method_profiles profile
      on profile.id = mapping.personalization_method_profile_id
    where mapping.reference_product_id = p_reference_product_id
      and profile.is_active
      and target_product.product_family = any(profile.supported_families)
  ) then
    raise exception 'REFERENCE_PRODUCT_PERSONALIZATION_METHOD_REQUIRED';
  end if;

  insert into public.reference_product_images (
    reference_product_id,
    view_key,
    storage_path,
    original_filename,
    mime_type,
    pixel_width,
    pixel_height,
    sort_order,
    is_active,
    uploaded_by
  )
  select
    p_reference_product_id,
    intake.view_key,
    submitted.public_storage_path,
    intake.original_filename,
    intake.mime_type,
    intake.pixel_width,
    intake.pixel_height,
    case intake.view_key
      when 'front' then 10
      when 'left' then 20
      when 'rear' then 30
      when 'right' then 40
      when 'top' then 50
    end,
    true,
    auth.uid()
  from public.reference_product_image_intakes intake
  join jsonb_to_recordset(p_public_assets) as submitted(intake_id uuid, public_storage_path text)
    on submitted.intake_id = intake.id
  where intake.reference_product_id = p_reference_product_id
    and intake.view_key in ('front', 'left', 'rear', 'right', 'top')
  on conflict (reference_product_id, view_key, sort_order) do update set
    storage_path = excluded.storage_path,
    original_filename = excluded.original_filename,
    mime_type = excluded.mime_type,
    pixel_width = excluded.pixel_width,
    pixel_height = excluded.pixel_height,
    is_active = true,
    uploaded_by = excluded.uploaded_by;

  update public.reference_product_image_intakes intake
  set review_state = 'approved',
    public_storage_path = submitted.public_storage_path,
    reviewed_by = auth.uid(),
    reviewed_at = now()
  from jsonb_to_recordset(p_public_assets) as submitted(intake_id uuid, public_storage_path text)
  where intake.id = submitted.intake_id
    and intake.reference_product_id = p_reference_product_id;

  update public.reference_products
  set review_status = 'approved',
    visible_to_buyers = true,
    review_note = coalesce(p_review_note, review_note),
    reviewed_by = auth.uid(),
    reviewed_at = now()
  where id = p_reference_product_id;

  return p_reference_product_id;
end;
$$;

revoke all on function public.publish_reviewed_reference_product_photos(uuid, jsonb, text) from public, anon;
grant execute on function public.publish_reviewed_reference_product_photos(uuid, jsonb, text) to authenticated;

commit;
