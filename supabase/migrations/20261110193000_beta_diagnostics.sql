-- Developer-only beta telemetry. No free-form content or photo/scan payloads.
create table public.beta_diagnostic_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  created_at timestamptz not null default now(),
  event_type text not null check (event_type in ('session','navigation','interaction',
    'state_change','ui_error','runtime_error','scan_result','scan_review')),
  area text not null check (area in ('home','entdecken','binder','sammlung',
    'portfolio','profil','wunschliste','scan','dialog','other')),
  action text not null check (action ~ '^[a-z][a-z0-9_]{0,47}$'),
  outcome text not null default 'ok'
    check (outcome in ('ok','error','cancelled','unknown')),
  card_candidate text
    check (card_candidate ~ '^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,119}$'),
  card_selected text
    check (card_selected ~ '^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,119}$'),
  metric integer check (metric between 0 and 200),
  platform text not null check (platform in ('ios','android','desktop')),
  app_build text not null check (app_build ~ '^[a-zA-Z0-9_.-]{1,32}$')
);
create index beta_diagnostic_events_owner_time
  on public.beta_diagnostic_events (user_id, created_at desc);
create index beta_diagnostic_events_kind_time
  on public.beta_diagnostic_events (event_type, created_at desc);
alter table public.beta_diagnostic_events enable row level security;
revoke all on public.beta_diagnostic_events from public, anon, authenticated;
grant select, insert, delete on public.beta_diagnostic_events to authenticated;
create policy beta_diagnostics_insert on public.beta_diagnostic_events
  for insert to authenticated
  with check ((select auth.uid()) = user_id and
    (select auth.jwt() -> 'app_metadata' ->> 'e_binder_beta_telemetry') = 'true');
create policy beta_diagnostics_read on public.beta_diagnostic_events
  for select to authenticated
  using ((select auth.uid()) = user_id and
    (select auth.jwt() -> 'app_metadata' ->> 'e_binder_beta_telemetry') = 'true');
create policy beta_diagnostics_delete on public.beta_diagnostic_events
  for delete to authenticated using ((select auth.uid()) = user_id);
