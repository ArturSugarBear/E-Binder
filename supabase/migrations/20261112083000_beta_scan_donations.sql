-- Optional private beta-photo donation with explicit, per-account consent.
-- Images are not public; labels are untrusted until independently reviewed.
create table if not exists public.beta_scan_consents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  consent_version text not null check (consent_version ~ '^[a-zA-Z0-9-]{1,40}$'),
  consented_at timestamptz,
  withdrawn_at timestamptz,
  updated_at timestamptz not null default now()
);
create or replace function public.beta_scan_stamp_consent()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  if new.enabled then
    if tg_op = 'INSERT' or old.enabled is distinct from true
       or old.consent_version is distinct from new.consent_version then
      new.consented_at := now();
    end if;
    new.withdrawn_at := null;
  else
    if tg_op = 'UPDATE' and old.enabled is true then
      new.withdrawn_at := now();
    end if;
    new.consented_at := null;
  end if;
  return new;
end;
$$;
drop trigger if exists beta_scan_stamp_consent on public.beta_scan_consents;
create trigger beta_scan_stamp_consent before insert or update
on public.beta_scan_consents for each row
execute function public.beta_scan_stamp_consent();
alter table public.beta_scan_consents enable row level security;
revoke all on public.beta_scan_consents from public, anon, authenticated;
grant select, insert, update on public.beta_scan_consents to authenticated;
create policy beta_scan_consent_read on public.beta_scan_consents
  for select to authenticated using ((select auth.uid()) = user_id);
create policy beta_scan_consent_insert on public.beta_scan_consents
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy beta_scan_consent_update on public.beta_scan_consents
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table if not exists public.beta_scan_samples (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  object_path text not null unique,
  source_kind text not null check (source_kind in ('card', 'page')),
  consent_version text not null check (consent_version = '2026-11-photo-v1'),
  byte_count integer not null check (byte_count between 1 and 1500000),
  review_status text not null default 'pending'
    check (review_status in ('pending', 'accepted', 'rejected')),
  verified_card_id text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint beta_scan_path_owned check (
    object_path = user_id::text || '/' || id::text || '.jpg'
  ),
  constraint beta_scan_trusted_label check (
    (review_status = 'pending' and verified_card_id is null and reviewed_at is null)
    or (review_status = 'rejected' and verified_card_id is null and reviewed_at is not null)
    or (review_status = 'accepted' and verified_card_id is not null and reviewed_at is not null)
  )
);
create index beta_scan_samples_review_time
  on public.beta_scan_samples (review_status, created_at);
create index beta_scan_samples_owner_time
  on public.beta_scan_samples (user_id, created_at desc);
alter table public.beta_scan_samples enable row level security;
revoke all on public.beta_scan_samples from public, anon, authenticated;
grant select, insert, delete on public.beta_scan_samples to authenticated;
create policy beta_scan_samples_read on public.beta_scan_samples
  for select to authenticated using ((select auth.uid()) = user_id);
create policy beta_scan_samples_insert on public.beta_scan_samples
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and review_status = 'pending'
    and exists (
      select 1 from public.beta_scan_consents c
      where c.user_id = (select auth.uid())
        and c.enabled
        and c.consent_version = '2026-11-photo-v1'
    )
  );
create policy beta_scan_samples_delete on public.beta_scan_samples
  for delete to authenticated using ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('beta-scan-donations', 'beta-scan-donations', false, 1500000, array['image/jpeg'])
on conflict (id) do update
set public = false, file_size_limit = 1500000, allowed_mime_types = array['image/jpeg'];

create policy beta_scan_images_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'beta-scan-donations'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f-]{36}\.jpg$')
    and exists (
      select 1 from public.beta_scan_consents c
      where c.user_id = (select auth.uid()) and c.enabled
        and c.consent_version = '2026-11-photo-v1'
    )
  );
create policy beta_scan_images_owner_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'beta-scan-donations'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy beta_scan_images_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'beta-scan-donations'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
