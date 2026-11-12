-- Beta photo labels are unverified user reports, never training ground truth.
-- Anonymous Auth users have the 'authenticated' database role, but RLS
-- requires the same explicit server-side photo consent as account users.
alter table public.beta_scan_samples
  add column if not exists capture_key uuid;

create unique index if not exists beta_scan_samples_capture_owner_unique
  on public.beta_scan_samples (user_id, capture_key)
  where capture_key is not null;

create table if not exists public.beta_scan_feedback (
  user_id uuid not null references auth.users(id) on delete cascade,
  capture_key uuid not null,
  selected_printing text not null
    check (selected_printing ~ '^tcgdex:(de|en|ja):[A-Za-z0-9_.+-]{3,160}$'),
  reported_at timestamptz not null default now(),
  primary key (user_id, capture_key)
);
comment on table public.beta_scan_feedback is
  'Optional collector-confirmed printing suggestion. Untrusted until independent image, edition, rights and catalogue review. Link to beta_scan_samples by (user_id,capture_key) when present.';

alter table public.beta_scan_feedback enable row level security;
revoke all on public.beta_scan_feedback from public, anon, authenticated;
grant select, insert, delete on public.beta_scan_feedback to authenticated;

drop policy if exists beta_scan_feedback_select on public.beta_scan_feedback;
create policy beta_scan_feedback_select on public.beta_scan_feedback
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists beta_scan_feedback_insert on public.beta_scan_feedback;
create policy beta_scan_feedback_insert on public.beta_scan_feedback
  for insert to authenticated with check (
    (select auth.uid()) = user_id and
    exists (
      select 1 from public.beta_scan_consents c
      where c.user_id = (select auth.uid())
      and c.enabled and c.consent_version = '2026-11-photo-v1'
    )
  );

drop policy if exists beta_scan_feedback_delete on public.beta_scan_feedback;
create policy beta_scan_feedback_delete on public.beta_scan_feedback
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Keep the existing E-Binder registration gate for permanent accounts.
-- Anonymous photo-donation identities MUST NOT create a collection profile.
-- The trigger is private/SECURITY DEFINER and not exposed as a public RPC.
create or replace function private.new_profile()
returns trigger
language plpgsql security definer set search_path = ''
as $fn$
declare account auth.users;
begin
  if new.is_anonymous is true then
    return new;
  end if;
  select * into account from auth.users where id = new.id;
  if account.raw_app_meta_data->>'e_binder_account' is distinct from 'true' then
    raise exception 'Use the E-Binder registration endpoint';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(74255931);
  if (select count(*) from public.profiles) >= 16 then
    raise exception 'Pilot capacity reached';
  end if;
  if account.email is distinct from
      ((account.raw_user_meta_data->>'username') || '@users.e-binder.invalid') then
    raise exception 'Invalid username';
  end if;
  insert into public.profiles(id, username)
  values (account.id, account.raw_user_meta_data->>'username');
  return new;
end;
$fn$;
