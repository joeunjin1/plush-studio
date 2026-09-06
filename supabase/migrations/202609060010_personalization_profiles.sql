-- Apply manually to staging and Production after 202609060008_reference_product_library.sql.
-- This migration stores profile settings and asset metadata only, never image bytes.

create table if not exists public.personalization_method_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null check (code ~ '^[A-Z][A-Z0-9_]{2,60}$'),
  label text not null check (char_length(label) between 2 and 120),
  method text not null check (method in ('memorial_tag', 'screen_print', 'heat_transfer', 'embroidery', 'woven_label', 'patch')),
  input_mode text not null check (input_mode in ('text', 'image', 'text_or_image')),
  supported_families text[] not null default array[]::text[] check (array_length(supported_families, 1) between 1 and 3),
  constraints jsonb not null default '{}'::jsonb,
  factory_review_note text not null default '' check (char_length(factory_review_note) <= 2000),
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table if not exists public.reference_product_personalization_methods (
  reference_product_id uuid not null references public.reference_products(id) on delete cascade,
  personalization_method_profile_id uuid not null references public.personalization_method_profiles(id) on delete restrict,
  sort_order integer not null default 0,
  is_default boolean not null default false,
  override_constraints jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (reference_product_id, personalization_method_profile_id)
);

create table if not exists public.buyer_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  registration_number text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (created_by, name)
);

create table if not exists public.buyer_company_members (
  buyer_company_id uuid not null references public.buyer_companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (buyer_company_id, user_id)
);

create table if not exists public.buyer_product_personalizations (
  id uuid primary key default gen_random_uuid(),
  buyer_company_id uuid not null references public.buyer_companies(id) on delete restrict,
  reference_product_id uuid not null references public.reference_products(id) on delete restrict,
  personalization_method_profile_id uuid not null references public.personalization_method_profiles(id) on delete restrict,
  reference_product_version text not null default 'v01' check (char_length(reference_product_version) between 1 and 40),
  text_value text check (char_length(coalesce(text_value, '')) <= 500),
  image_storage_path text,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'reviewing', 'approved', 'changes_requested', 'rejected')),
  factory_review_note text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (text_value is not null or image_storage_path is not null)
);

create or replace function public.is_buyer_company_member(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.buyer_company_members member
    where member.buyer_company_id = target_company_id
      and member.user_id = auth.uid()
  );
$$;

alter table public.personalization_method_profiles enable row level security;
alter table public.reference_product_personalization_methods enable row level security;
alter table public.buyer_companies enable row level security;
alter table public.buyer_company_members enable row level security;
alter table public.buyer_product_personalizations enable row level security;

create policy "personalization_profiles_read_active_or_admin" on public.personalization_method_profiles
  for select using (is_active or public.has_org_role(organization_id, array['brand_admin', 'designer']::public.app_role[]));
create policy "personalization_profiles_manage_admin" on public.personalization_method_profiles
  for all to authenticated
  using (public.has_org_role(organization_id, array['brand_admin']::public.app_role[]))
  with check (public.has_org_role(organization_id, array['brand_admin']::public.app_role[]));

create policy "reference_personalization_methods_read" on public.reference_product_personalization_methods
  for select using (exists (
    select 1 from public.reference_products product
    where product.id = reference_product_personalization_methods.reference_product_id
      and (
        (product.visible_to_buyers and product.review_status = 'approved')
        or public.has_org_role(product.organization_id, array['brand_admin', 'designer']::public.app_role[])
      )
  ));
create policy "reference_personalization_methods_manage_admin" on public.reference_product_personalization_methods
  for all to authenticated
  using (exists (
    select 1 from public.reference_products product
    where product.id = reference_product_personalization_methods.reference_product_id
      and public.has_org_role(product.organization_id, array['brand_admin']::public.app_role[])
  ))
  with check (exists (
    select 1 from public.reference_products product
    where product.id = reference_product_personalization_methods.reference_product_id
      and public.has_org_role(product.organization_id, array['brand_admin']::public.app_role[])
  ));

create policy "buyer_companies_read_member" on public.buyer_companies
  for select to authenticated using (public.is_buyer_company_member(id));
create policy "buyer_companies_create_self" on public.buyer_companies
  for insert to authenticated with check (created_by = auth.uid());
create policy "buyer_companies_update_owner" on public.buyer_companies
  for update to authenticated using (exists (
    select 1 from public.buyer_company_members member
    where member.buyer_company_id = buyer_companies.id and member.user_id = auth.uid() and member.role = 'owner'
  ));
create policy "buyer_company_members_read_member" on public.buyer_company_members
  for select to authenticated using (public.is_buyer_company_member(buyer_company_id));

create policy "buyer_personalizations_read_company_or_admin" on public.buyer_product_personalizations
  for select to authenticated using (
    public.is_buyer_company_member(buyer_company_id)
    or exists (select 1 from public.reference_products product where product.id = reference_product_id and public.has_org_role(product.organization_id, array['brand_admin']::public.app_role[]))
  );
create policy "buyer_personalizations_create_company_member" on public.buyer_product_personalizations
  for insert to authenticated with check (
    created_by = auth.uid() and public.is_buyer_company_member(buyer_company_id)
  );
create policy "buyer_personalizations_update_company_member" on public.buyer_product_personalizations
  for update to authenticated using (public.is_buyer_company_member(buyer_company_id))
  with check (public.is_buyer_company_member(buyer_company_id));

grant select on public.personalization_method_profiles, public.reference_product_personalization_methods to anon, authenticated;
grant select, insert, update on public.buyer_companies, public.buyer_company_members, public.buyer_product_personalizations to authenticated;
grant insert, update, delete on public.personalization_method_profiles, public.reference_product_personalization_methods to authenticated;
grant execute on function public.is_buyer_company_member(uuid) to authenticated;

create trigger set_personalization_method_profiles_updated_at before update on public.personalization_method_profiles for each row execute procedure public.set_updated_at();
create trigger set_buyer_companies_updated_at before update on public.buyer_companies for each row execute procedure public.set_updated_at();
create trigger set_buyer_product_personalizations_updated_at before update on public.buyer_product_personalizations for each row execute procedure public.set_updated_at();
