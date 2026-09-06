-- Requires 202609060003_customer_requests.sql. Additive migration; run once.
begin;
create schema if not exists atelier_private;
revoke all on schema atelier_private from public,anon;
grant usage on schema atelier_private to authenticated;
create table public.atelier_projects (
 id uuid primary key, owner_id uuid not null references auth.users(id) on delete restrict,
 name text not null check(char_length(name) between 1 and 100),
 revision integer not null check(revision > 0), snapshot jsonb not null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.atelier_project_versions (
 project_id uuid not null references public.atelier_projects(id) on delete restrict,
 revision integer not null,owner_id uuid not null references auth.users(id) on delete restrict,
 snapshot jsonb not null,created_at timestamptz not null default now(),primary key(project_id,revision)
);
alter table public.atelier_projects enable row level security;
alter table public.atelier_project_versions enable row level security;
revoke all on public.atelier_projects,public.atelier_project_versions from anon,authenticated;
grant select on public.atelier_projects,public.atelier_project_versions to authenticated;
create policy "atelier_own_projects" on public.atelier_projects for select to authenticated using(owner_id=auth.uid());
create policy "atelier_own_versions" on public.atelier_project_versions for select to authenticated using(owner_id=auth.uid());
create index atelier_owner_updated on public.atelier_projects(owner_id,updated_at desc);

create function atelier_private.save_atelier_project(p_id uuid,p_name text,p_snapshot jsonb,p_expected_revision integer)
returns integer language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); existing public.atelier_projects; asset jsonb; next_revision integer;
begin
 if who is null then raise exception 'AUTH_REQUIRED'; end if;
 if not coalesce((jsonb_typeof(p_snapshot)='object' and octet_length(p_snapshot::text)<=100000
 and char_length(btrim(p_name)) between 1 and 100 and p_expected_revision>=0
 and p_snapshot->>'id'=p_id::text and p_snapshot->>'version'='1'
 and p_snapshot->>'cloudOwner'=who::text and (p_snapshot->>'revision')::integer=p_expected_revision+1
 and p_snapshot->>'product' in ('plush','bag','shirt')
 and (p_snapshot->>'width')::numeric between .1 and 200 and (p_snapshot->>'height')::numeric between .1 and 200 and (p_snapshot->>'depth')::numeric between .1 and 200
 and p_snapshot->>'color' ~ '^#[0-9a-fA-F]{6}$'
 and jsonb_typeof(p_snapshot->'assets')='array' and jsonb_array_length(p_snapshot->'assets')<=12
 and jsonb_typeof(p_snapshot->'parts')='array' and jsonb_array_length(p_snapshot->'parts')<=12
 and jsonb_typeof(p_snapshot->'decals')='array' and jsonb_array_length(p_snapshot->'decals')<=6),false) then raise exception 'INVALID_PROJECT'; end if;
 for asset in select * from jsonb_array_elements(p_snapshot->'assets') loop
  if asset ? 'data' or not coalesce(asset->>'path' ~ ('^'||who::text||'/'||p_id::text||'/[a-f0-9-]{36}$'),false)
  or not exists(select 1 from storage.objects where bucket_id='atelier-assets' and name=asset->>'path') then raise exception 'INVALID_ASSET'; end if;
 end loop;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,1));
 select * into existing from public.atelier_projects where id=p_id for update;
 if found then
  if existing.owner_id<>who then raise exception 'FORBIDDEN'; end if;
  if existing.revision<>p_expected_revision then raise exception 'REVISION_CONFLICT'; end if;
 else
  if p_expected_revision<>0 then raise exception 'REVISION_CONFLICT'; end if;
  if (select count(*) from public.atelier_projects where owner_id=who)>=100 then raise exception 'PROJECT_LIMIT'; end if;
 end if;
 next_revision:=p_expected_revision+1;
 insert into public.atelier_projects(id,owner_id,name,revision,snapshot) values(p_id,who,btrim(p_name),next_revision,p_snapshot)
 on conflict(id) do update set name=excluded.name,revision=excluded.revision,snapshot=excluded.snapshot,updated_at=now();
 insert into public.atelier_project_versions(project_id,revision,owner_id,snapshot) values(p_id,next_revision,who,p_snapshot);
 return next_revision;
end; $$;
revoke all on function atelier_private.save_atelier_project(uuid,text,jsonb,integer) from public,anon;
grant execute on function atelier_private.save_atelier_project(uuid,text,jsonb,integer) to authenticated;
create function public.save_atelier_project(p_id uuid,p_name text,p_snapshot jsonb,p_expected_revision integer) returns integer language sql security invoker set search_path='' as $$ select atelier_private.save_atelier_project(p_id,p_name,p_snapshot,p_expected_revision); $$;
revoke all on function public.save_atelier_project(uuid,text,jsonb,integer) from public,anon;
grant execute on function public.save_atelier_project(uuid,text,jsonb,integer) to authenticated;

alter table public.customer_requests add column product_snapshot jsonb;
alter table public.customer_requests add column project_id uuid;
alter table public.customer_requests add column project_revision integer;
alter table public.customer_requests add constraint customer_request_project_version foreign key(project_id,project_revision) references public.atelier_project_versions(project_id,revision) on delete restrict;
-- No direct client INSERT/UPDATE grants are added for these columns.
create function atelier_private.submit_atelier_request(p_id uuid,p_project_id uuid,p_revision integer,p_name text,p_phone text,p_quantity integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); snap jsonb; old_owner uuid;
begin
 if who is null then raise exception 'AUTH_REQUIRED'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,2));
 select customer_id into old_owner from public.customer_requests where id=p_id;
 if found then if old_owner<>who then raise exception 'FORBIDDEN'; end if;return p_id;end if;
 select snapshot into snap from public.atelier_project_versions where project_id=p_project_id and revision=p_revision and owner_id=who;
 if snap is null then raise exception 'PROJECT_VERSION_NOT_FOUND'; end if;
 insert into public.customer_requests(id,customer_id,customer_name,contact_email,phone,design,quantity,material,purpose,notes,consent_version,product_snapshot,project_id,project_revision)
 values(p_id,who,p_name,auth.jwt()->>'email',coalesce(p_phone,''),jsonb_build_object('name',snap->>'name','kind','bear','heightCm',greatest(8,least(100,(snap->>'height')::numeric)),'headScale',1,'bodyScale',1,'earScale',1,'color',snap->>'color','accent','#ffffff','keyring',false),p_quantity,'consult','sample',left(coalesce(snap->>'notes',''),3000),'request-v1',snap,p_project_id,p_revision);
 return p_id;
end; $$;
revoke all on function atelier_private.submit_atelier_request(uuid,uuid,integer,text,text,integer) from public,anon;
grant execute on function atelier_private.submit_atelier_request(uuid,uuid,integer,text,text,integer) to authenticated;
create function public.submit_atelier_request(p_id uuid,p_project_id uuid,p_revision integer,p_name text,p_phone text,p_quantity integer) returns uuid language sql security invoker set search_path='' as $$ select atelier_private.submit_atelier_request(p_id,p_project_id,p_revision,p_name,p_phone,p_quantity); $$;
revoke all on function public.submit_atelier_request(uuid,uuid,integer,text,text,integer) from public,anon;
grant execute on function public.submit_atelier_request(uuid,uuid,integer,text,text,integer) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('atelier-assets','atelier-assets',false,2250000,array['image/png','image/jpeg','image/webp']);
create policy "atelier_asset_owner_read" on storage.objects for select to authenticated using(bucket_id='atelier-assets' and ((storage.foldername(name))[1]=auth.uid()::text or exists(select 1 from public.customer_requests r where r.product_snapshot->'assets' @> jsonb_build_array(jsonb_build_object('path',storage.objects.name)))));
create policy "atelier_asset_owner_insert" on storage.objects for insert to authenticated with check(bucket_id='atelier-assets' and (storage.foldername(name))[1]=auth.uid()::text and name ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}/[a-f0-9-]{36}$');
-- No client update/delete policies: submitted file bytes cannot be changed later.
create table public.customer_request_events(
 id bigint generated always as identity primary key,request_id uuid not null references public.customer_requests(id),
 old_status text,new_status text not null,actor_id uuid,created_at timestamptz not null default now()
);
alter table public.customer_request_events enable row level security;
revoke all on public.customer_request_events from anon,authenticated;
grant select on public.customer_request_events to authenticated;
create policy "request_events_visible" on public.customer_request_events for select to authenticated using(exists(select 1 from public.customer_requests r where r.id=request_id));
create function atelier_private.log_customer_request_status() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='INSERT' or new.status is distinct from old.status then
 insert into public.customer_request_events(request_id,old_status,new_status,actor_id) values(new.id,case when TG_OP='INSERT' then null else old.status end,new.status,auth.uid());
 end if;return new;
end; $$;
create trigger customer_request_status_log after insert or update on public.customer_requests for each row execute function atelier_private.log_customer_request_status();

alter table public.customer_requests add column quote_amount_krw numeric(12,0) check(quote_amount_krw between 1 and 1000000000);
alter table public.customer_requests add column quote_lead_days integer check(quote_lead_days between 1 and 730);
alter table public.customer_requests add column quote_note text check(char_length(quote_note)<=2000);
alter table public.customer_requests add column quote_version integer not null default 0;
alter table public.customer_requests add column accepted_quote_version integer;
alter table public.customer_requests add column accepted_at timestamptz;
create function atelier_private.offer_customer_quote(p_request_id uuid,p_amount_krw numeric,p_lead_days integer,p_note text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.customer_request_staff where user_id=auth.uid()) then raise exception 'FORBIDDEN'; end if;
 if p_amount_krw is null or p_amount_krw<>trunc(p_amount_krw) or p_lead_days is null then raise exception 'INVALID_QUOTE'; end if;
 update public.customer_requests set quote_amount_krw=p_amount_krw,quote_lead_days=p_lead_days,quote_note=coalesce(p_note,''),quote_version=quote_version+1,accepted_quote_version=null,accepted_at=null,status='quoted'
 where id=p_request_id and status not in ('confirmed','closed');
 if not found then raise exception 'REQUEST_NOT_EDITABLE'; end if;
end; $$;
create function atelier_private.accept_customer_quote(p_request_id uuid,p_quote_version integer)
returns void language plpgsql security definer set search_path='' as $$
begin
 update public.customer_requests set accepted_quote_version=quote_version,accepted_at=now(),status='confirmed'
 where id=p_request_id and customer_id=auth.uid() and status='quoted' and quote_version=p_quote_version and quote_amount_krw is not null;
 if not found then raise exception 'QUOTE_CHANGED_OR_FORBIDDEN'; end if;
end; $$;
revoke all on function atelier_private.offer_customer_quote(uuid,numeric,integer,text) from public,anon;
grant execute on function atelier_private.offer_customer_quote(uuid,numeric,integer,text) to authenticated;
create function public.offer_customer_quote(p_request_id uuid,p_amount_krw numeric,p_lead_days integer,p_note text) returns void language sql security invoker set search_path='' as $$ select atelier_private.offer_customer_quote(p_request_id,p_amount_krw,p_lead_days,p_note); $$;
revoke all on function atelier_private.accept_customer_quote(uuid,integer) from public,anon;
grant execute on function atelier_private.accept_customer_quote(uuid,integer) to authenticated;
create function public.accept_customer_quote(p_request_id uuid,p_quote_version integer) returns void language sql security invoker set search_path='' as $$ select atelier_private.accept_customer_quote(p_request_id,p_quote_version); $$;
revoke all on function public.offer_customer_quote(uuid,numeric,integer,text),public.accept_customer_quote(uuid,integer) from public,anon;
grant execute on function public.offer_customer_quote(uuid,numeric,integer,text),public.accept_customer_quote(uuid,integer) to authenticated;
create function public.enforce_customer_quote_gate() returns trigger language plpgsql set search_path='' as $$
begin
 if new.status is distinct from old.status and new.status='quoted' and new.quote_amount_krw is null then raise exception 'QUOTE_REQUIRED'; end if;
 if new.status is distinct from old.status and new.status='confirmed' and (new.accepted_quote_version is null or new.accepted_quote_version<>new.quote_version or new.quote_amount_krw is null or new.accepted_at is null) then raise exception 'CUSTOMER_ACCEPTANCE_REQUIRED'; end if;
 return new;
end; $$;
create trigger customer_quote_gate before update on public.customer_requests for each row execute function public.enforce_customer_quote_gate();
revoke all on function atelier_private.log_customer_request_status() from public,anon,authenticated;
commit;
