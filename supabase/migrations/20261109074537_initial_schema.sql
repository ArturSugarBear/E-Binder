-- Private collection snapshots preserve quantities, drafts and capture sessions.
-- Relational binder projections expose only explicitly shared layouts.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9][a-z0-9_-]{2,23}$'),
  avatar_url text check (length(avatar_url) <= 2048),
  created_at timestamptz not null default now()
);
create table public.binders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_id text not null check (length(client_id) between 1 and 250),
  title text not null check (length(title) between 1 and 200),
  description text,
  grid_size int not null default 9 check (grid_size in (4,9,12)),
  is_public boolean not null default true,
  page_titles jsonb not null default '["Seite 1"]'::jsonb check (jsonb_typeof(page_titles) = 'array' and jsonb_array_length(page_titles) between 1 and 200),
  created_at timestamptz not null default now(),
  unique(user_id, client_id)
);
create table public.binder_cards (
  id uuid primary key default gen_random_uuid(),
  binder_id uuid not null references public.binders(id) on delete cascade,
  card_api_id text not null check (length(card_api_id) between 1 and 250),
  page_number int not null default 1 check (page_number between 1 and 200),
  slot_index int not null check (slot_index between 0 and 11),
  condition text not null default 'NM' check (condition in ('NM','LP','MP','HP','DMG')),
  language text not null default 'DE',
  is_foil boolean not null default false,
  notes text check (length(notes) <= 2000),
  card_data jsonb not null,
  slot_kind text not null check (slot_kind in ('owned','planned')),
  updated_at timestamptz not null default now(),
  unique(binder_id, page_number, slot_index)
);
create table public.user_workspaces (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  version bigint not null default 1 check (version > 0),
  state jsonb not null check (jsonb_typeof(state) = 'object' and state->>'mode' = 'personal' and octet_length(state::text) <= 10000000),
  updated_at timestamptz not null default now()
);
create index binders_public on public.binders(id) where is_public;
-- The unique constraints already index owner and parent lookups.
alter table public.profiles enable row level security;
alter table public.binders enable row level security;
alter table public.binder_cards enable row level security;
alter table public.user_workspaces enable row level security;
create policy profiles_read on public.profiles for select to anon, authenticated using (true);
create policy profiles_update on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy binders_read on public.binders for select to anon, authenticated using (is_public or (select auth.uid()) = user_id);
create policy binders_insert on public.binders for insert to authenticated with check ((select auth.uid()) = user_id);
create policy binders_update on public.binders for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy binders_delete on public.binders for delete to authenticated using ((select auth.uid()) = user_id);
create policy cards_read on public.binder_cards for select to anon, authenticated using (exists(select 1 from public.binders b where b.id = binder_id and (b.is_public or b.user_id = (select auth.uid()))));
create policy cards_insert on public.binder_cards for insert to authenticated with check (exists(select 1 from public.binders b where b.id = binder_id and b.user_id = (select auth.uid())));
create policy cards_update on public.binder_cards for update to authenticated using (exists(select 1 from public.binders b where b.id = binder_id and b.user_id = (select auth.uid()))) with check (exists(select 1 from public.binders b where b.id = binder_id and b.user_id = (select auth.uid())));
create policy cards_delete on public.binder_cards for delete to authenticated using (exists(select 1 from public.binders b where b.id = binder_id and b.user_id = (select auth.uid())));
create policy workspace_owner on public.user_workspaces for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.profiles, public.binders, public.binder_cards, public.user_workspaces from anon, authenticated;
grant select on public.profiles, public.binders, public.binder_cards to anon, authenticated;
grant update(avatar_url) on public.profiles to authenticated;
grant insert, update, delete on public.binders, public.binder_cards to authenticated;
grant select, insert, update, delete on public.user_workspaces to authenticated;

-- Trigger access is deliberately privileged; clients cannot invoke it or set app_metadata.
create function private.new_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.raw_app_meta_data->>'e_binder_account' is distinct from 'true' then
    raise exception 'Use the E-Binder registration endpoint';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(74255931);
  if (select count(*) from public.profiles) >= 16 then raise exception 'Pilot capacity reached'; end if;
  if new.email is distinct from ((new.raw_user_meta_data->>'username') || '@users.e-binder.invalid') then raise exception 'Invalid username'; end if;
  insert into public.profiles(id, username) values(new.id, new.raw_user_meta_data->>'username');
  return new;
end; $$;
revoke all on function private.new_profile() from public, anon, authenticated;
create trigger e_binder_profile after insert on auth.users for each row execute function private.new_profile();

create table private.signup_attempts (fingerprint text primary key, started_at timestamptz not null, attempts int not null);
alter table private.signup_attempts enable row level security;
grant usage on schema private to service_role;
grant all on private.signup_attempts to service_role;
create function public.reserve_signup(p_fingerprint text) returns boolean language plpgsql security invoker set search_path = '' as $$
declare n int;
begin
  if length(p_fingerprint) <> 64 then return false; end if;
  delete from private.signup_attempts where started_at < now() - interval '1 day';
  insert into private.signup_attempts values(p_fingerprint, now(), 1)
  on conflict(fingerprint) do update set
    attempts = case when private.signup_attempts.started_at < now() - interval '15 minutes' then 1 else private.signup_attempts.attempts + 1 end,
    started_at = case when private.signup_attempts.started_at < now() - interval '15 minutes' then now() else private.signup_attempts.started_at end
  returning attempts into n;
  return n <= 5;
end; $$;
revoke all on function public.reserve_signup(text) from public, anon, authenticated;
grant execute on function public.reserve_signup(text) to service_role;

create function public.save_workspace(p_state jsonb, p_expected_version bigint) returns bigint language plpgsql security invoker set search_path = '' as $$
declare who uuid := auth.uid(); next_version bigint; binder jsonb; page jsonb; slot jsonb; card jsonb; holding jsonb; bid uuid; pn int; sn int;
begin
  if who is null then raise exception 'Authentication required'; end if;
  if p_expected_version < 0 or p_state->>'mode' is distinct from 'personal' or p_state->>'schemaVersion' is distinct from '1'
    or jsonb_typeof(p_state->'binders') is distinct from 'array' or jsonb_typeof(p_state->'holdings') is distinct from 'array'
    or jsonb_array_length(p_state->'binders') > 1000 or octet_length(p_state::text) > 10000000 then raise exception 'Invalid collection'; end if;
  insert into public.user_workspaces(user_id, version, state) select who, 1, p_state where p_expected_version = 0
  on conflict(user_id) do nothing returning version into next_version;
  if next_version is null then
    update public.user_workspaces set state = p_state, version = version + 1, updated_at = now()
    where user_id = who and version = p_expected_version returning version into next_version;
  end if;
  if next_version is null then raise exception 'WORKSPACE_CONFLICT'; end if;
  delete from public.binders where user_id = who and client_id not in (select value->>'id' from jsonb_array_elements(p_state->'binders'));
  for binder in select value from jsonb_array_elements(p_state->'binders') loop
    insert into public.binders(user_id, client_id, title, is_public, page_titles)
      values(who, binder->>'id', binder->>'name', coalesce((binder->>'isPublic')::boolean, false), (select jsonb_agg(value->>'title') from jsonb_array_elements(binder->'pages')))
      on conflict(user_id,client_id) do update set title = excluded.title, is_public = excluded.is_public, page_titles = excluded.page_titles
      returning id into bid;
    delete from public.binder_cards where binder_id = bid;
    pn := 0;
    for page in select value from jsonb_array_elements(binder->'pages') loop
      pn := pn + 1; sn := -1;
      if jsonb_array_length(page->'slots') <> 9 then raise exception 'Invalid page size'; end if;
      for slot in select value from jsonb_array_elements(page->'slots') loop
        sn := sn + 1;
        if slot = 'null'::jsonb then continue; end if;
        holding := null;
        if slot->>'kind' = 'owned' then
          select value into holding from jsonb_array_elements(p_state->'holdings') where value->>'id' = slot->>'holdingId';
          if holding is null then raise exception 'Missing holding'; end if;
          card := holding->'card';
        else card := slot->'card'; end if;
        -- Original photos and private holding notes are never part of public layouts.
        card := card - 'photoId';
        insert into public.binder_cards(binder_id, card_api_id, page_number, slot_index, language, is_foil, card_data, slot_kind)
          values(bid, coalesce(nullif(card->>'sourceId',''),card->>'key'), pn, sn, upper(card->>'language'), coalesce(holding->>'finish' in ('holo','reverse'),false), card, slot->>'kind');
      end loop;
    end loop;
  end loop;
  return next_version;
end; $$;
revoke all on function public.save_workspace(jsonb,bigint) from public, anon;
grant execute on function public.save_workspace(jsonb,bigint) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('originals','originals',false,12000000,array['image/jpeg','image/png','image/webp','image/heic','image/heif']);
create policy originals_read on storage.objects for select to authenticated using (bucket_id = 'originals' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy originals_insert on storage.objects for insert to authenticated with check (bucket_id = 'originals' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy originals_update on storage.objects for update to authenticated using (bucket_id = 'originals' and (storage.foldername(name))[1] = (select auth.uid())::text) with check (bucket_id = 'originals' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy originals_delete on storage.objects for delete to authenticated using (bucket_id = 'originals' and (storage.foldername(name))[1] = (select auth.uid())::text);
