-- plush-studio: manufacturing collaboration foundation
-- Apply this file once to Supabase project lzrjjfjpatcwsxhjafpy.
-- All primary business records are scoped to an organization and then a project.

create extension if not exists pgcrypto;

create type public.app_role as enum ('brand_admin', 'designer', 'factory', 'qc');
create type public.project_status as enum ('draft', 'internal_review', 'factory_quote', 'sample_review', 'purchase_order', 'production_qa', 'archived');
create type public.design_version_status as enum ('draft', 'frozen', 'approved', 'superseded');
create type public.asset_kind as enum ('reference_sheet', 'part_reference', 'model_glb', 'preview_png', 'tech_pack_pdf', 'tech_pack_xlsx', 'sample_photo', 'qa_photo', 'quote_attachment', 'other');
create type public.approval_status as enum ('pending', 'approved', 'changes_requested', 'rejected');
create type public.qa_status as enum ('not_started', 'pass', 'conditional_pass', 'fail');
create type public.production_status as enum ('pending', 'in_progress', 'inspection', 'completed', 'on_hold');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,60}$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'designer',
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null check (code ~ '^[A-Z0-9][A-Z0-9-]{2,30}$'),
  name text not null check (char_length(name) between 2 and 160),
  brand_name text,
  product_category text not null default 'plush',
  target_market text,
  status public.project_status not null default 'draft',
  target_launch_date date,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create table public.plush_designs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 160),
  character_type text not null default 'bear',
  final_height_cm numeric(8,2) not null default 23 check (final_height_cm > 0 and final_height_cm <= 500),
  editor_state jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.design_versions (
  id uuid primary key default gen_random_uuid(),
  plush_design_id uuid not null references public.plush_designs(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  label text,
  status public.design_version_status not null default 'draft',
  change_summary text,
  editor_snapshot jsonb not null default '{}'::jsonb,
  frozen_at timestamptz,
  approved_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (plush_design_id, version_number)
);

create table public.plush_parts (
  id uuid primary key default gen_random_uuid(),
  design_version_id uuid not null references public.design_versions(id) on delete cascade,
  part_code text not null check (part_code ~ '^[A-Z0-9][A-Z0-9_-]{1,40}$'),
  name text not null check (char_length(name) between 1 and 120),
  part_type text not null default 'body',
  quantity integer not null default 1 check (quantity > 0 and quantity <= 999),
  width_mm numeric(10,2),
  height_mm numeric(10,2),
  depth_mm numeric(10,2),
  transform jsonb not null default '{}'::jsonb,
  contour_data jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (design_version_id, part_code)
);

create table public.project_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  design_version_id uuid references public.design_versions(id) on delete set null,
  part_id uuid references public.plush_parts(id) on delete set null,
  kind public.asset_kind not null,
  storage_path text not null unique check (storage_path ~ '^[a-f0-9-]+/[a-f0-9-]+/.+'),
  original_filename text not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size >= 0),
  metadata jsonb not null default '{}'::jsonb,
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.bom_items (
  id uuid primary key default gen_random_uuid(),
  design_version_id uuid not null references public.design_versions(id) on delete cascade,
  part_id uuid references public.plush_parts(id) on delete set null,
  item_code text not null check (char_length(item_code) between 2 and 60),
  category text not null,
  description text not null,
  supplier_name text,
  material_spec text,
  color_reference text,
  process_notes text,
  unit text not null default 'pc',
  quantity_per_unit numeric(12,4) not null default 1 check (quantity_per_unit >= 0),
  unit_cost_cny numeric(14,4) not null default 0 check (unit_cost_cny >= 0),
  waste_rate numeric(6,4) not null default 0 check (waste_rate >= 0 and waste_rate <= 1),
  tolerance_min_mm numeric(10,2),
  tolerance_max_mm numeric(10,2),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (design_version_id, item_code)
);

create table public.cost_scenarios (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  design_version_id uuid references public.design_versions(id) on delete set null,
  name text not null check (char_length(name) between 2 and 120),
  quantity integer not null check (quantity > 0),
  currency text not null default 'KRW' check (currency in ('KRW', 'CNY', 'USD')),
  exchange_rate numeric(14,6) not null check (exchange_rate > 0),
  target_margin_rate numeric(6,4) not null check (target_margin_rate >= 0 and target_margin_rate < 1),
  input_snapshot jsonb not null default '{}'::jsonb,
  result_snapshot jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.factory_quotes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  factory_name text not null,
  contact_name text,
  quoted_currency text not null default 'CNY' check (quoted_currency in ('CNY', 'USD', 'KRW')),
  quote_quantity integer not null check (quote_quantity > 0),
  unit_price numeric(14,4) check (unit_price >= 0),
  tooling_cost numeric(14,4) not null default 0 check (tooling_cost >= 0),
  packaging_cost numeric(14,4) not null default 0 check (packaging_cost >= 0),
  logistics_cost numeric(14,4) not null default 0 check (logistics_cost >= 0),
  sampling_lead_days integer check (sampling_lead_days >= 0),
  production_lead_days integer check (production_lead_days >= 0),
  moq integer check (moq > 0),
  validity_until date,
  notes text,
  submitted_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.factory_quote_lines (
  id uuid primary key default gen_random_uuid(),
  factory_quote_id uuid not null references public.factory_quotes(id) on delete cascade,
  category text not null,
  description text not null,
  amount numeric(14,4) not null check (amount >= 0),
  created_at timestamptz not null default now()
);

create table public.samples (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  design_version_id uuid references public.design_versions(id) on delete set null,
  factory_quote_id uuid references public.factory_quotes(id) on delete set null,
  sample_round integer not null default 1 check (sample_round > 0),
  status public.qa_status not null default 'not_started',
  received_at date,
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, sample_round)
);

create table public.sample_feedback (
  id uuid primary key default gen_random_uuid(),
  sample_id uuid not null references public.samples(id) on delete cascade,
  part_id uuid references public.plush_parts(id) on delete set null,
  parent_id uuid references public.sample_feedback(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  image_asset_id uuid references public.project_assets(id) on delete set null,
  resolved_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.qa_checklist_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  section_name text not null,
  checkpoint text not null,
  required boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.qa_inspections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  sample_id uuid references public.samples(id) on delete set null,
  production_lot text,
  inspection_date date not null default current_date,
  inspected_quantity integer check (inspected_quantity >= 0),
  defect_quantity integer check (defect_quantity >= 0),
  status public.qa_status not null default 'not_started',
  summary text,
  inspector_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.qa_results (
  id uuid primary key default gen_random_uuid(),
  qa_inspection_id uuid not null references public.qa_inspections(id) on delete cascade,
  checklist_item_id uuid references public.qa_checklist_items(id) on delete set null,
  status public.qa_status not null default 'not_started',
  finding text,
  corrective_action text,
  due_date date,
  resolved_at timestamptz,
  evidence_asset_id uuid references public.project_assets(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.production_orders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  factory_quote_id uuid references public.factory_quotes(id) on delete set null,
  po_number text not null,
  ordered_quantity integer not null check (ordered_quantity > 0),
  status public.production_status not null default 'pending',
  planned_ship_date date,
  actual_ship_date date,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, po_number)
);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  design_version_id uuid references public.design_versions(id) on delete cascade,
  approval_type text not null,
  status public.approval_status not null default 'pending',
  decision_note text,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_org_members_user on public.organization_members(user_id);
create index idx_projects_org_status on public.projects(organization_id, status);
create index idx_project_members_user on public.project_members(user_id);
create index idx_design_versions_design on public.design_versions(plush_design_id, version_number desc);
create index idx_parts_version on public.plush_parts(design_version_id);
create index idx_assets_project_kind on public.project_assets(project_id, kind);
create index idx_bom_version_sort on public.bom_items(design_version_id, sort_order);
create index idx_cost_scenarios_project on public.cost_scenarios(project_id, created_at desc);
create index idx_factory_quotes_project on public.factory_quotes(project_id, created_at desc);
create index idx_samples_project on public.samples(project_id, sample_round desc);
create index idx_feedback_sample on public.sample_feedback(sample_id, created_at);
create index idx_qa_inspections_project on public.qa_inspections(project_id, inspection_date desc);
create index idx_approvals_project on public.approvals(project_id, created_at desc);
create index idx_audit_events_project on public.audit_events(project_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url,
    updated_at = now();
  return new;
end;
$$;

create or replace function public.create_organization_with_owner(organization_name text, organization_slug text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_organization_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  insert into public.organizations (name, slug, created_by)
  values (organization_name, organization_slug, auth.uid())
  returning id into new_organization_id;

  insert into public.organization_members (organization_id, user_id, role, invited_by)
  values (new_organization_id, auth.uid(), 'brand_admin', auth.uid());

  return new_organization_id;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.is_org_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members member
    where member.organization_id = target_organization_id
      and member.user_id = auth.uid()
  );
$$;

create or replace function public.has_org_role(target_organization_id uuid, accepted_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members member
    where member.organization_id = target_organization_id
      and member.user_id = auth.uid()
      and member.role = any (accepted_roles)
  );
$$;

create or replace function public.can_view_project(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects project
    where project.id = target_project_id
      and (
        public.has_org_role(project.organization_id, array['brand_admin']::public.app_role[])
        or exists (
          select 1
          from public.project_members member
          where member.project_id = project.id
            and member.user_id = auth.uid()
        )
      )
  );
$$;

create or replace function public.can_edit_project(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects project
    where project.id = target_project_id
      and (
        public.has_org_role(project.organization_id, array['brand_admin']::public.app_role[])
        or exists (
          select 1
          from public.project_members member
          where member.project_id = project.id
            and member.user_id = auth.uid()
            and member.role in ('brand_admin', 'designer')
        )
      )
  );
$$;

create or replace function public.can_manage_project(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects project
    where project.id = target_project_id
      and (
        public.has_org_role(project.organization_id, array['brand_admin']::public.app_role[])
        or exists (
          select 1
          from public.project_members member
          where member.project_id = project.id
            and member.user_id = auth.uid()
            and member.role = 'brand_admin'
        )
      )
  );
$$;

create or replace function public.can_contribute_to_project(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects project
    where project.id = target_project_id
      and (
        public.has_org_role(project.organization_id, array['brand_admin']::public.app_role[])
        or exists (
          select 1
          from public.project_members member
          where member.project_id = project.id
            and member.user_id = auth.uid()
        )
      )
  );
$$;

create or replace function public.can_inspect_project(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects project
    where project.id = target_project_id
      and (
        public.has_org_role(project.organization_id, array['brand_admin']::public.app_role[])
        or exists (
          select 1
          from public.project_members member
          where member.project_id = project.id
            and member.user_id = auth.uid()
            and member.role in ('brand_admin', 'qc')
        )
      )
  );
$$;

create or replace function public.is_bucket_path_member(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_org_member(nullif(split_part(object_name, '/', 1), '')::uuid);
$$;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.plush_designs enable row level security;
alter table public.design_versions enable row level security;
alter table public.plush_parts enable row level security;
alter table public.project_assets enable row level security;
alter table public.bom_items enable row level security;
alter table public.cost_scenarios enable row level security;
alter table public.factory_quotes enable row level security;
alter table public.factory_quote_lines enable row level security;
alter table public.samples enable row level security;
alter table public.sample_feedback enable row level security;
alter table public.qa_checklist_items enable row level security;
alter table public.qa_inspections enable row level security;
alter table public.qa_results enable row level security;
alter table public.production_orders enable row level security;
alter table public.approvals enable row level security;
alter table public.audit_events enable row level security;

create policy "profiles_select_own_or_colleagues" on public.profiles for select to authenticated
  using (id = auth.uid() or exists (select 1 from public.organization_members member where member.user_id = profiles.id and public.is_org_member(member.organization_id)));
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "organizations_select_member" on public.organizations for select to authenticated using (public.is_org_member(id) or created_by = auth.uid());
create policy "organizations_create_self" on public.organizations for insert to authenticated with check (created_by = auth.uid());
create policy "organizations_update_admin" on public.organizations for update to authenticated using (public.has_org_role(id, array['brand_admin']::public.app_role[]));

create policy "organization_members_select_member" on public.organization_members for select to authenticated using (public.is_org_member(organization_id));
create policy "organization_members_manage_admin" on public.organization_members for all to authenticated using (public.has_org_role(organization_id, array['brand_admin']::public.app_role[])) with check (public.has_org_role(organization_id, array['brand_admin']::public.app_role[]));

create policy "projects_select_member" on public.projects for select to authenticated using (public.can_view_project(id));
create policy "projects_create_org_editor" on public.projects for insert to authenticated with check (public.has_org_role(organization_id, array['brand_admin', 'designer']::public.app_role[]));
create policy "projects_update_editor" on public.projects for update to authenticated using (public.can_edit_project(id)) with check (public.can_edit_project(id));
create policy "projects_delete_admin" on public.projects for delete to authenticated using (public.can_manage_project(id));

create policy "project_members_select_member" on public.project_members for select to authenticated using (public.can_view_project(project_id));
create policy "project_members_manage_admin" on public.project_members for all to authenticated using (public.can_manage_project(project_id)) with check (public.can_manage_project(project_id));

create policy "plush_designs_select_member" on public.plush_designs for select to authenticated using (public.can_view_project(project_id));
create policy "plush_designs_edit_editor" on public.plush_designs for all to authenticated using (public.can_edit_project(project_id)) with check (public.can_edit_project(project_id));
create policy "design_versions_select_member" on public.design_versions for select to authenticated using (exists (select 1 from public.plush_designs design where design.id = plush_design_id and public.can_view_project(design.project_id)));
create policy "design_versions_edit_editor" on public.design_versions for all to authenticated using (exists (select 1 from public.plush_designs design where design.id = plush_design_id and public.can_edit_project(design.project_id))) with check (exists (select 1 from public.plush_designs design where design.id = plush_design_id and public.can_edit_project(design.project_id)));
create policy "plush_parts_select_member" on public.plush_parts for select to authenticated using (exists (select 1 from public.design_versions version join public.plush_designs design on design.id = version.plush_design_id where version.id = design_version_id and public.can_view_project(design.project_id)));
create policy "plush_parts_edit_editor" on public.plush_parts for all to authenticated using (exists (select 1 from public.design_versions version join public.plush_designs design on design.id = version.plush_design_id where version.id = design_version_id and public.can_edit_project(design.project_id))) with check (exists (select 1 from public.design_versions version join public.plush_designs design on design.id = version.plush_design_id where version.id = design_version_id and public.can_edit_project(design.project_id)));

create policy "assets_select_member" on public.project_assets for select to authenticated using (public.can_view_project(project_id));
create policy "assets_upload_contributor" on public.project_assets for insert to authenticated with check (public.can_contribute_to_project(project_id) and uploaded_by = auth.uid());
create policy "assets_update_editor" on public.project_assets for update to authenticated using (public.can_edit_project(project_id)) with check (public.can_edit_project(project_id));
create policy "assets_delete_editor" on public.project_assets for delete to authenticated using (public.can_edit_project(project_id));

create policy "bom_select_member" on public.bom_items for select to authenticated using (exists (select 1 from public.design_versions version join public.plush_designs design on design.id = version.plush_design_id where version.id = design_version_id and public.can_view_project(design.project_id)));
create policy "bom_edit_editor" on public.bom_items for all to authenticated using (exists (select 1 from public.design_versions version join public.plush_designs design on design.id = version.plush_design_id where version.id = design_version_id and public.can_edit_project(design.project_id))) with check (exists (select 1 from public.design_versions version join public.plush_designs design on design.id = version.plush_design_id where version.id = design_version_id and public.can_edit_project(design.project_id)));

create policy "cost_select_member" on public.cost_scenarios for select to authenticated using (public.can_view_project(project_id));
create policy "cost_edit_editor" on public.cost_scenarios for all to authenticated using (public.can_edit_project(project_id)) with check (public.can_edit_project(project_id));

create policy "quotes_select_member" on public.factory_quotes for select to authenticated using (public.can_view_project(project_id));
create policy "quotes_insert_contributor" on public.factory_quotes for insert to authenticated with check (public.can_contribute_to_project(project_id) and submitted_by = auth.uid());
create policy "quotes_update_submitter_or_admin" on public.factory_quotes for update to authenticated using (submitted_by = auth.uid() or public.can_manage_project(project_id)) with check (submitted_by = auth.uid() or public.can_manage_project(project_id));
create policy "quotes_delete_admin" on public.factory_quotes for delete to authenticated using (public.can_manage_project(project_id));
create policy "quote_lines_select_member" on public.factory_quote_lines for select to authenticated using (exists (select 1 from public.factory_quotes quote where quote.id = factory_quote_id and public.can_view_project(quote.project_id)));
create policy "quote_lines_edit_submitter_or_admin" on public.factory_quote_lines for all to authenticated using (exists (select 1 from public.factory_quotes quote where quote.id = factory_quote_id and (quote.submitted_by = auth.uid() or public.can_manage_project(quote.project_id)))) with check (exists (select 1 from public.factory_quotes quote where quote.id = factory_quote_id and (quote.submitted_by = auth.uid() or public.can_manage_project(quote.project_id))));

create policy "samples_select_member" on public.samples for select to authenticated using (public.can_view_project(project_id));
create policy "samples_edit_editor" on public.samples for all to authenticated using (public.can_edit_project(project_id)) with check (public.can_edit_project(project_id));
create policy "feedback_select_member" on public.sample_feedback for select to authenticated using (exists (select 1 from public.samples sample where sample.id = sample_id and public.can_view_project(sample.project_id)));
create policy "feedback_insert_contributor" on public.sample_feedback for insert to authenticated with check (created_by = auth.uid() and exists (select 1 from public.samples sample where sample.id = sample_id and public.can_contribute_to_project(sample.project_id)));
create policy "feedback_update_author_or_editor" on public.sample_feedback for update to authenticated using (created_by = auth.uid() or exists (select 1 from public.samples sample where sample.id = sample_id and public.can_edit_project(sample.project_id))) with check (created_by = auth.uid() or exists (select 1 from public.samples sample where sample.id = sample_id and public.can_edit_project(sample.project_id)));

create policy "qa_checklist_select_member" on public.qa_checklist_items for select to authenticated using (public.can_view_project(project_id));
create policy "qa_checklist_edit_qc" on public.qa_checklist_items for all to authenticated using (public.can_inspect_project(project_id)) with check (public.can_inspect_project(project_id));
create policy "qa_inspections_select_member" on public.qa_inspections for select to authenticated using (public.can_view_project(project_id));
create policy "qa_inspections_edit_qc" on public.qa_inspections for all to authenticated using (public.can_inspect_project(project_id)) with check (public.can_inspect_project(project_id) and inspector_id = auth.uid());
create policy "qa_results_select_member" on public.qa_results for select to authenticated using (exists (select 1 from public.qa_inspections inspection where inspection.id = qa_inspection_id and public.can_view_project(inspection.project_id)));
create policy "qa_results_edit_qc" on public.qa_results for all to authenticated using (exists (select 1 from public.qa_inspections inspection where inspection.id = qa_inspection_id and public.can_inspect_project(inspection.project_id))) with check (exists (select 1 from public.qa_inspections inspection where inspection.id = qa_inspection_id and public.can_inspect_project(inspection.project_id)));

create policy "production_orders_select_member" on public.production_orders for select to authenticated using (public.can_view_project(project_id));
create policy "production_orders_edit_admin" on public.production_orders for all to authenticated using (public.can_manage_project(project_id)) with check (public.can_manage_project(project_id));

create policy "approvals_select_member" on public.approvals for select to authenticated using (public.can_view_project(project_id));
create policy "approvals_create_editor" on public.approvals for insert to authenticated with check (public.can_edit_project(project_id) and created_by = auth.uid());
create policy "approvals_decide_admin" on public.approvals for update to authenticated using (public.can_manage_project(project_id)) with check (public.can_manage_project(project_id));

create policy "audit_events_select_admin" on public.audit_events for select to authenticated using (public.has_org_role(organization_id, array['brand_admin']::public.app_role[]));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'plush-studio',
  'plush-studio',
  false,
  209715200,
  array['image/png', 'image/jpeg', 'image/webp', 'model/gltf-binary', 'application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "plush_studio_storage_select" on storage.objects for select to authenticated
  using (bucket_id = 'plush-studio' and public.is_bucket_path_member(name));
create policy "plush_studio_storage_upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'plush-studio' and public.is_bucket_path_member(name));
create policy "plush_studio_storage_update" on storage.objects for update to authenticated
  using (bucket_id = 'plush-studio' and public.is_bucket_path_member(name))
  with check (bucket_id = 'plush-studio' and public.is_bucket_path_member(name));
create policy "plush_studio_storage_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'plush-studio' and public.is_bucket_path_member(name));

grant usage on schema public to authenticated;
grant execute on function public.create_organization_with_owner(text, text) to authenticated;
grant select, insert, update, delete on table
  public.profiles,
  public.organizations,
  public.organization_members,
  public.projects,
  public.project_members,
  public.plush_designs,
  public.design_versions,
  public.plush_parts,
  public.project_assets,
  public.bom_items,
  public.cost_scenarios,
  public.factory_quotes,
  public.factory_quote_lines,
  public.samples,
  public.sample_feedback,
  public.qa_checklist_items,
  public.qa_inspections,
  public.qa_results,
  public.production_orders,
  public.approvals,
  public.audit_events
to authenticated;

create trigger set_profiles_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
create trigger set_organizations_updated_at before update on public.organizations for each row execute procedure public.set_updated_at();
create trigger set_projects_updated_at before update on public.projects for each row execute procedure public.set_updated_at();
create trigger set_plush_designs_updated_at before update on public.plush_designs for each row execute procedure public.set_updated_at();
create trigger set_plush_parts_updated_at before update on public.plush_parts for each row execute procedure public.set_updated_at();
create trigger set_bom_items_updated_at before update on public.bom_items for each row execute procedure public.set_updated_at();
create trigger set_cost_scenarios_updated_at before update on public.cost_scenarios for each row execute procedure public.set_updated_at();
create trigger set_factory_quotes_updated_at before update on public.factory_quotes for each row execute procedure public.set_updated_at();
create trigger set_samples_updated_at before update on public.samples for each row execute procedure public.set_updated_at();
create trigger set_sample_feedback_updated_at before update on public.sample_feedback for each row execute procedure public.set_updated_at();
create trigger set_qa_inspections_updated_at before update on public.qa_inspections for each row execute procedure public.set_updated_at();
create trigger set_qa_results_updated_at before update on public.qa_results for each row execute procedure public.set_updated_at();
create trigger set_production_orders_updated_at before update on public.production_orders for each row execute procedure public.set_updated_at();
create trigger set_approvals_updated_at before update on public.approvals for each row execute procedure public.set_updated_at();
