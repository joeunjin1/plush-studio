-- STAGING READ-ONLY UAT VERIFICATION.
-- This query intentionally excludes personalisation text, buyer email, contact details,
-- image object keys, URLs, and all binary data.

begin read only;

select
  id as request_id,
  reference_product_sku,
  reference_product_version,
  model_version,
  case
    when model_checksum_sha256 is null then 'not-recorded'
    when model_checksum_sha256 ~ '^[a-f0-9]{64}$' then 'sha256-recorded'
    else 'invalid'
  end as model_checksum_state,
  personalization_profile_code,
  placement_label,
  case
    when personalization_text is not null and personalization_image_path is null then 'text-metadata-only'
    when personalization_text is null and personalization_image_path is not null then 'private-image-metadata-only'
    when personalization_text is not null and personalization_image_path is not null then 'text-and-private-image-metadata'
    else 'invalid'
  end as personalization_storage_state,
  quantity,
  desired_delivery_date,
  purpose,
  status,
  created_at
from public.reference_product_order_requests
where id = 'ea24e2bc-2a05-4c33-88ca-e4a194dfdaaf'::uuid;

select
  count(*) as matching_request_count
from public.reference_product_order_requests
where id = 'ea24e2bc-2a05-4c33-88ca-e4a194dfdaaf'::uuid;

rollback;
