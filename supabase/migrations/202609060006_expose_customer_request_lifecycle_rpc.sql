-- plush-studio: expose the guarded lifecycle transition to Supabase Data API.
-- Apply after 202609060005_customer_request_lifecycle.sql.
begin;

create or replace function public.transition_customer_request(
  p_request_id uuid,
  p_to_status text,
  p_note text default ''
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform atelier_private.transition_customer_request(p_request_id, p_to_status, p_note);
end; $$;

revoke all on function public.transition_customer_request(uuid,text,text) from public, anon;
grant execute on function public.transition_customer_request(uuid,text,text) to authenticated;
commit;
