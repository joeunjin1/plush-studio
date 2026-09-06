-- plush-studio: staff-governed customer request lifecycle.
-- Apply after 202609060003_customer_requests.sql and 202609060004_atelier_projects.sql.
begin;

alter table public.customer_requests
  drop constraint if exists customer_requests_status_check;
alter table public.customer_requests
  add constraint customer_requests_status_check check (
    status in ('received', 'reviewing', 'quoted', 'confirmed', 'sample_review', 'production_qa', 'completed', 'closed')
  );

alter table public.customer_request_events
  add column if not exists transition_note text not null default '' check (char_length(transition_note) <= 2000);

revoke update (status) on public.customer_requests from authenticated;
drop policy if exists "staff_change_status" on public.customer_requests;

create or replace function atelier_private.transition_customer_request(
  p_request_id uuid,
  p_to_status text,
  p_note text default ''
) returns void
language plpgsql security definer set search_path = '' as $$
declare current_status text;
begin
  if not exists (select 1 from public.customer_request_staff where user_id = auth.uid()) then
    raise exception 'FORBIDDEN';
  end if;
  if char_length(coalesce(p_note, '')) > 2000 then
    raise exception 'NOTE_TOO_LONG';
  end if;
  select status into current_status from public.customer_requests where id = p_request_id for update;
  if current_status is null then raise exception 'REQUEST_NOT_FOUND'; end if;
  if not (
    (current_status = 'received' and p_to_status in ('reviewing', 'closed')) or
    (current_status = 'reviewing' and p_to_status in ('quoted', 'closed')) or
    (current_status = 'quoted' and p_to_status in ('confirmed', 'closed')) or
    (current_status = 'confirmed' and p_to_status in ('sample_review', 'closed')) or
    (current_status = 'sample_review' and p_to_status in ('production_qa', 'closed')) or
    (current_status = 'production_qa' and p_to_status in ('completed', 'closed'))
  ) then
    raise exception 'INVALID_TRANSITION';
  end if;
  update public.customer_requests set status = p_to_status where id = p_request_id;
  update public.customer_request_events
    set transition_note = coalesce(p_note, '')
    where id = (select max(id) from public.customer_request_events where request_id = p_request_id);
end; $$;

revoke all on function atelier_private.transition_customer_request(uuid,text,text) from public, anon;
grant execute on function atelier_private.transition_customer_request(uuid,text,text) to authenticated;
commit;
