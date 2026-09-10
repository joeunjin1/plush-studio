-- STAGING REPAIR ONLY. Apply after 013 when 013 has already been run.
-- Grants authenticated callers the schema usage required by the public order-submit wrapper.

begin;
revoke all on schema reference_order_private from public, anon;
grant usage on schema reference_order_private to authenticated;
commit;
