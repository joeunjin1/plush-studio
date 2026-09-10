-- STAGING ONLY — Supabase project: trhhgmionyyfnbwhxenn (plush-studio-staging)
-- Do not run in Production. This script does not create a user, change a password,
-- modify Auth settings, or alter any other member role.
--
-- Target account: gjtrade@naver.com
-- Target organization: the sole organization that owns the existing Bernese reference SKU.
-- Safety behavior: it stops without any change if the account or an unambiguous target
-- organization cannot be found.

begin;

do $$
declare
  target_user_id uuid;
  target_organization_id uuid;
  target_organization_count integer;
begin
  select id
    into target_user_id
  from auth.users
  where lower(email) = 'gjtrade@naver.com';

  if target_user_id is null then
    raise exception 'No staging auth user found for gjtrade@naver.com';
  end if;

  select count(distinct organization_id)::integer,
         min(organization_id)
    into target_organization_count,
         target_organization_id
  from public.reference_products
  where sku = 'bernese-memorial-plush-v01';

  if target_organization_count <> 1 then
    raise exception 'Expected exactly one Bernese product organization; found %', target_organization_count;
  end if;

  insert into public.organization_members (
    organization_id,
    user_id,
    role
  )
  values (
    target_organization_id,
    target_user_id,
    'brand_admin'::public.app_role
  )
  on conflict (organization_id, user_id)
  do update set role = excluded.role
  where public.organization_members.role is distinct from 'brand_admin'::public.app_role;
end;
$$;

-- Read-only confirmation. Expect exactly one row and role = brand_admin.
select
  o.name as organization_name,
  o.slug as organization_slug,
  u.email,
  m.role,
  m.created_at as membership_created_at
from public.organization_members m
join public.organizations o on o.id = m.organization_id
join auth.users u on u.id = m.user_id
where lower(u.email) = 'gjtrade@naver.com'
  and exists (
    select 1
    from public.reference_products rp
    where rp.organization_id = m.organization_id
      and rp.sku = 'bernese-memorial-plush-v01'
  );

commit;
