-- STAGING READ-ONLY PREFLIGHT.
-- This query does not create or modify users, organizations, memberships, products, storage, or Auth settings.
-- It deliberately omits email addresses, raw request data, and asset paths.

begin read only;

with target_user as (
  select id from auth.users where email = 'gjtrade@naver.com'
)
select
  organization.id as organization_id,
  organization.name as organization_name,
  organization.slug as organization_slug,
  exists (
    select 1
    from public.organization_members member
    cross join target_user
    where member.organization_id = organization.id
      and member.user_id = target_user.id
  ) as target_user_is_member,
  coalesce((
    select member.role::text
    from public.organization_members member
    cross join target_user
    where member.organization_id = organization.id
      and member.user_id = target_user.id
    limit 1
  ), 'not_a_member') as target_user_role,
  (
    select count(*)::integer
    from public.reference_products product
    where product.organization_id = organization.id
  ) as reference_product_count
from public.organizations organization
order by organization.created_at asc;

rollback;
