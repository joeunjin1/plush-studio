-- plush-studio-staging only
-- Purpose: remove the unrelated SENKANG sample-mall RPC if it exists.
-- Safety: no CASCADE. This does not delete tables, rows, buckets, RLS policies,
-- roles, Auth users, or any Plush Studio function. If another object depends on
-- this function, PostgreSQL will reject the transaction instead of deleting it.

begin;

revoke all on function public.buyer_sample_mall_list(text, integer, integer)
  from public, authenticated;

drop function if exists public.buyer_sample_mall_list(text, integer, integer);

commit;

-- Run separately after the transaction. Expected result: function_present = false.
-- select to_regprocedure('public.buyer_sample_mall_list(text,integer,integer)') is not null
--   as function_present;
