-- Buyer download audit events contain metadata only; generated file bytes remain in browser or private storage.
create table if not exists public.buyer_download_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid,
  project_revision integer,
  artifact_type text not null check (artifact_type in (
    'preview_png', 'proof_png_3view', 'parted_glb', 'proof_pdf', 'proof_json', 'full_backup_json'
  )),
  created_at timestamptz not null default now()
);

alter table public.buyer_download_events enable row level security;

drop policy if exists buyer_download_events_insert_own on public.buyer_download_events;
create policy buyer_download_events_insert_own
  on public.buyer_download_events
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists buyer_download_events_select_own on public.buyer_download_events;
create policy buyer_download_events_select_own
  on public.buyer_download_events
  for select to authenticated
  using (user_id = auth.uid());

create index if not exists buyer_download_events_user_created_idx
  on public.buyer_download_events (user_id, created_at desc);
