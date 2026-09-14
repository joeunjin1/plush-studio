-- STAGING ONLY. Apply after 202609120018_reference_product_customization_options.sql.
-- This does not modify reference products, buyer artwork, public catalog assets, or existing orders.

begin;

alter table public.reference_product_customization_options
  alter column created_by set default auth.uid();

create or replace function public.prevent_reference_product_customization_option_creator_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'REFERENCE_PRODUCT_OPTION_CREATOR_IMMUTABLE';
  end if;
  return new;
end;
$$;

drop trigger if exists reference_product_customization_options_creator_immutable
  on public.reference_product_customization_options;

create trigger reference_product_customization_options_creator_immutable
  before update on public.reference_product_customization_options
  for each row execute procedure public.prevent_reference_product_customization_option_creator_change();

commit;
