-- STAGING ONLY. Run after migrations 010, 015, and 016.
-- Seeds only two reusable bag personalization profiles needed for logo UAT.
-- It creates no buyer order, no product, no storage object, and no Auth identity.

begin;

do $$
declare
  target_organization_id uuid;
  target_user_id uuid;
begin
  select id
    into target_organization_id
  from public.organizations
  where slug = 'plush-studio-staging';

  if target_organization_id is null then
    raise exception 'STAGING_ORGANIZATION_NOT_FOUND';
  end if;

  select id
    into target_user_id
  from auth.users
  where email = 'gjtrade@naver.com';

  if target_user_id is null then
    raise exception 'TARGET_USER_NOT_FOUND';
  end if;

  if not exists (
    select 1
    from public.organization_members member
    where member.organization_id = target_organization_id
      and member.user_id = target_user_id
      and member.role = 'brand_admin'
  ) then
    raise exception 'TARGET_USER_IS_NOT_BRAND_ADMIN';
  end if;

  insert into public.personalization_method_profiles (
    organization_id,
    code,
    label,
    method,
    input_mode,
    supported_families,
    constraints,
    factory_review_note,
    is_active,
    created_by
  )
  values
    (
      target_organization_id,
      'FRONT_SCREEN_PRINT_V01',
      '전면 실크스크린 인쇄',
      'screen_print',
      'image',
      array['bag']::text[],
      jsonb_build_object(
        'acceptedMimeTypes', jsonb_build_array('image/png', 'image/jpeg', 'image/webp'),
        'maximumFileMegabytes', 5,
        'safeAreaLabel', '전면 인쇄 안전 영역'
      ),
      '원본 벡터 파일, 인쇄 색상, 판수 및 원단 적합성은 견적·샘플 단계에서 검토합니다.',
      true,
      target_user_id
    ),
    (
      target_organization_id,
      'FRONT_EMBROIDERY_V01',
      '전면 자수',
      'embroidery',
      'text_or_image',
      array['bag']::text[],
      jsonb_build_object(
        'maxCharacters', 18,
        'maxLines', 2,
        'acceptedMimeTypes', jsonb_build_array('image/png', 'image/jpeg', 'image/webp'),
        'maximumFileMegabytes', 5,
        'safeAreaLabel', '자수 가능 안전 영역'
      ),
      '자수 파일 펀칭, 실 색상, 최소 선폭, 원단 수축은 공장 검토 후 확정합니다.',
      true,
      target_user_id
    )
  on conflict (organization_id, code) do nothing;
end
$$;

select
  profile.code,
  profile.label,
  profile.method,
  profile.input_mode,
  profile.supported_families,
  profile.is_active
from public.personalization_method_profiles profile
join public.organizations organization on organization.id = profile.organization_id
where organization.slug = 'plush-studio-staging'
  and profile.code in ('FRONT_SCREEN_PRINT_V01', 'FRONT_EMBROIDERY_V01')
order by profile.code;

commit;
