-- Auth applies admin app_metadata after the initial insert in the same transaction.
create or replace function private.new_profile() returns trigger language plpgsql security definer set search_path = '' as $$
declare account auth.users;
begin
  select * into account from auth.users where id = new.id;
  if account.raw_app_meta_data->>'e_binder_account' is distinct from 'true' then raise exception 'Use the E-Binder registration endpoint'; end if;
  perform pg_catalog.pg_advisory_xact_lock(74255931);
  if (select count(*) from public.profiles) >= 16 then raise exception 'Pilot capacity reached'; end if;
  if account.email is distinct from ((account.raw_user_meta_data->>'username') || '@users.e-binder.invalid') then raise exception 'Invalid username'; end if;
  insert into public.profiles(id,username) values(account.id,account.raw_user_meta_data->>'username');
  return new;
end; $$;
revoke all on function private.new_profile() from public, anon, authenticated;
drop trigger e_binder_profile on auth.users;
create constraint trigger e_binder_profile after insert on auth.users deferrable initially deferred for each row execute function private.new_profile();
