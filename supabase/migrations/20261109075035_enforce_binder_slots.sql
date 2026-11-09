create policy signup_service on private.signup_attempts for all to service_role using (true) with check (true);
create function private.check_slot() returns trigger language plpgsql security invoker set search_path = '' as $$
declare size int;
begin
  select grid_size into size from public.binders where id = new.binder_id;
  if size is null or new.slot_index >= size then raise exception 'Slot outside binder grid'; end if;
  new.updated_at := now();
  return new;
end; $$;
revoke all on function private.check_slot() from public, anon, authenticated;
create trigger binder_card_bounds before insert or update on public.binder_cards for each row execute function private.check_slot();
create function private.check_grid_resize() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if exists(select 1 from public.binder_cards where binder_id = new.id and slot_index >= new.grid_size) then raise exception 'Move cards before changing grid size'; end if;
  return new;
end; $$;
revoke all on function private.check_grid_resize() from public, anon, authenticated;
create trigger binder_grid_bounds before update of grid_size on public.binders for each row execute function private.check_grid_resize();
