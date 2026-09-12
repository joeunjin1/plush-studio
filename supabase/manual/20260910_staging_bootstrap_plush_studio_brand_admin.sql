-- STAGING ONLY — one-time bootstrap after the read-only preflight confirmed
-- public.organizations has zero rows. Do not run in Production.
-- Creates exactly one staging organization and one membership; it does not
-- create an Auth user, change passwords, alter Auth settings, or touch storage.

do $$
declare
  target_user_id uuid;
  new_organization_id uuid;
  existing_organization_count integer;
begin
  select id
    into strict target_user_id
  from auth.users
  where email = 'gjtrade@naver.com';

  select count(*)::integer
    into existing_organization_count
  from public.organizations;

  if existing_organization_count <> 0 then
    raise exception 'STAGING_BOOTSTRAP_REQUIRES_EMPTY_ORGANIZATIONS';
  end if;

  insert into public.organizations (name, slug, created_by)
  values ('Plush Studio Staging', 'plush-studio-staging', target_user_id)
  returning id into new_organization_id;

  insert into public.organization_members (organization_id, user_id, role, invited_by)
  values (new_organization_id, target_user_id, 'brand_admin', target_user_id);
end;
$$;

-- The final statement intentionally returns one non-sensitive verification row.
select
  organization.id as organization_id,
  organization.name as organization_name,
  organization.slug as organization_slug,
  member.role::text as target_user_role,
  (
    select count(*)::integer
    from public.reference_products product
    where product.organization_id = organization.id
  ) as reference_product_count
from public.organizations organization
join public.organization_members member
  on member.organization_id = organization.id
join auth.users target_user
  on target_user.id = member.user_id
where organization.slug = 'plush-studio-staging'
  and target_user.email = 'gjtrade@naver.com';
