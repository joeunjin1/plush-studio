-- Customer-facing quotation requests. Additive: does not modify manufacturing records.
-- Run once in Supabase SQL Editor. This migration can also run independently of 001/002.
begin;
create table public.customer_request_staff (
 user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.customer_request_staff enable row level security;
revoke all on public.customer_request_staff from anon, authenticated;
grant select on public.customer_request_staff to authenticated;
create policy "staff_read_self" on public.customer_request_staff for select to authenticated using (user_id = auth.uid());

create table public.customer_requests (
 id uuid primary key,
 customer_id uuid not null references auth.users(id) on delete restrict,
 customer_name text not null check (char_length(btrim(customer_name)) between 2 and 80),
 contact_email text not null check (char_length(contact_email) between 3 and 254),
 phone text not null default '' check (phone = '' or phone ~ '^[+0-9() -]{7,30}$'),
 design jsonb not null check (coalesce((
   jsonb_typeof(design) = 'object' and octet_length(design::text) <= 10000
   and design ?& array['name','kind','heightCm','color','accent','headScale','bodyScale','earScale','keyring']
   and jsonb_typeof(design->'name') = 'string'
   and char_length(btrim(design->>'name')) between 1 and 100
   and design->>'kind' in ('bear','rabbit','cat')
   and jsonb_typeof(design->'heightCm') = 'number' and (design->>'heightCm')::numeric between 8 and 100
   and (design->>'headScale')::numeric between 0.7 and 1.3
   and (design->>'bodyScale')::numeric between 0.7 and 1.3
   and (design->>'earScale')::numeric between 0.5 and 2
   and design->>'color' ~ '^#[a-fA-F0-9]{6}$' and design->>'accent' ~ '^#[a-fA-F0-9]{6}$'
   and jsonb_typeof(design->'keyring') = 'boolean'
 ),false)),
 quantity integer not null check (quantity between 1 and 100000),
 material text not null check (material in ('soft','velvet','consult')),
 purpose text not null check (purpose in ('sample','production')),
 notes text not null default '' check (char_length(notes) <= 3000),
 "references" jsonb not null default '[]' check (jsonb_typeof("references") = 'array' and jsonb_array_length("references") <= 6 and octet_length("references"::text) <= 12000),
 status text not null default 'received' check (status in ('received','reviewing','quoted','confirmed','closed')),
 consent_version text not null check (consent_version = 'request-v1'),
 consent_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index customer_requests_owner_date on public.customer_requests(customer_id, created_at desc);
create index customer_requests_status_date on public.customer_requests(status, created_at desc);
alter table public.customer_requests enable row level security;
revoke all on public.customer_requests from anon, authenticated;
grant select on public.customer_requests to authenticated;
-- Customers cannot supply status/timestamps or later modify submitted records.
grant insert (id,customer_id,customer_name,contact_email,phone,design,quantity,material,purpose,notes,"references",consent_version) on public.customer_requests to authenticated;
grant update (status) on public.customer_requests to authenticated;
create policy "customer_read_own_or_staff" on public.customer_requests for select to authenticated
 using (customer_id = auth.uid() or exists (select 1 from public.customer_request_staff where user_id = auth.uid()));
create policy "customer_submit_own" on public.customer_requests for insert to authenticated
 with check (customer_id = auth.uid() and contact_email = (auth.jwt()->>'email') and status = 'received');
create policy "staff_change_status" on public.customer_requests for update to authenticated
 using (exists (select 1 from public.customer_request_staff where user_id = auth.uid()))
 with check (exists (select 1 from public.customer_request_staff where user_id = auth.uid()));

create function public.validate_customer_request() returns trigger language plpgsql set search_path = '' as $$
declare item jsonb;
begin
 if TG_OP = 'INSERT' then
   -- Serialize submissions per customer to enforce the quota without a race.
   perform pg_advisory_xact_lock(hashtextextended(new.customer_id::text, 0));
   if (select count(*) from public.customer_requests where customer_id = new.customer_id and created_at > now() - interval '1 hour') >= 10 then
     raise exception 'Too many requests. Try again later.';
   end if;
   for item in select * from jsonb_array_elements(new."references") loop
     if jsonb_typeof(item) <> 'object' or not (item ?& array['path','label','name','position'])
       or coalesce(item->>'path','') !~ ('^' || new.customer_id::text || '/' || new.id::text || '/[a-f0-9-]{36}$')
       or char_length(coalesce(item->>'label','')) not between 1 and 30
       or char_length(coalesce(item->>'name','')) not between 1 and 255
       or char_length(coalesce(item->>'position','')) > 200 then
       raise exception 'Invalid reference';
     end if;
   end loop;
 end if;
 new.updated_at = now();
 return new;
end; $$;
create trigger validate_customer_request before insert or update on public.customer_requests for each row execute function public.validate_customer_request();

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
 values ('customer-references','customer-references',false,5242880,array['image/png','image/jpeg','image/webp']);
create policy "customer_reference_read" on storage.objects for select to authenticated using (
 bucket_id = 'customer-references' and ((storage.foldername(name))[1] = auth.uid()::text
 or exists (select 1 from public.customer_request_staff where user_id = auth.uid()))
);
create policy "customer_reference_upload" on storage.objects for insert to authenticated with check (
 bucket_id = 'customer-references' and (storage.foldername(name))[1] = auth.uid()::text
 and not exists (select 1 from public.customer_requests where id::text = (storage.foldername(name))[2])
);
create policy "customer_reference_retry" on storage.objects for update to authenticated using (
 bucket_id = 'customer-references' and (storage.foldername(name))[1] = auth.uid()::text
 and not exists (select 1 from public.customer_requests where id::text = (storage.foldername(name))[2])
) with check (
 bucket_id = 'customer-references' and (storage.foldername(name))[1] = auth.uid()::text
 and not exists (select 1 from public.customer_requests where id::text = (storage.foldername(name))[2])
);
commit;
-- AFTER operator signs in, find their UUID in Authentication > Users. Run separately:
-- insert into public.customer_request_staff(user_id) values ('OPERATOR_AUTH_USER_UUID');
-- Do not grant staff by email domain or to all signed-in users.
