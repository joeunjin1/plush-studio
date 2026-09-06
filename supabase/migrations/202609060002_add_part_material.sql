-- plush-studio: part material required by the design workspace save flow.
alter table public.plush_parts
  add column if not exists material text not null default '원단 지정';

comment on column public.plush_parts.material is 'Factory-facing fabric or material specification for the individual plush part.';
