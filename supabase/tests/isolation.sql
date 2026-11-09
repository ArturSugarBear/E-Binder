-- Run as project administrator; every fixture is rolled back.
begin;
insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values
('842d35c3-35fd-41df-9940-733ecb861aa1','test_rls_a@users.e-binder.invalid','{"e_binder_account":true}','{"username":"test_rls_a"}'),
('842d35c3-35fd-41df-9940-733ecb861aa2','test_rls_b@users.e-binder.invalid','{"e_binder_account":true}','{"username":"test_rls_b"}');
set constraints all immediate;
set local role authenticated;
select set_config('request.jwt.claim.sub','842d35c3-35fd-41df-9940-733ecb861aa1',true);
select public.save_workspace('{"schemaVersion":1,"mode":"personal","holdings":[],"binders":[]}',0);
insert into public.binders(id,user_id,client_id,title,is_public) values('842d35c3-35fd-41df-9940-733ecb861bb1','842d35c3-35fd-41df-9940-733ecb861aa1','test-binder','Privat',false);
select set_config('request.jwt.claim.sub','842d35c3-35fd-41df-9940-733ecb861aa2',true);
do $$ begin
  if exists(select 1 from public.user_workspaces) or exists(select 1 from public.binders) then raise exception 'Foreign private rows were visible'; end if;
  begin
    insert into public.user_workspaces(user_id,state) values('842d35c3-35fd-41df-9940-733ecb861aa1','{"mode":"personal"}');
    raise exception 'Foreign insert was allowed';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','842d35c3-35fd-41df-9940-733ecb861aa1',true);
update public.binders set is_public=true where id='842d35c3-35fd-41df-9940-733ecb861bb1';
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
  if not exists(select 1 from public.binders where id='842d35c3-35fd-41df-9940-733ecb861bb1') then raise exception 'Public binder invisible'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','842d35c3-35fd-41df-9940-733ecb861aa2',true);
do $$ declare changed int; begin
  update public.binders set user_id='842d35c3-35fd-41df-9940-733ecb861aa2' where id='842d35c3-35fd-41df-9940-733ecb861bb1';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Foreign ownership reassignment allowed'; end if;
end $$;
select set_config('request.jwt.claim.sub','842d35c3-35fd-41df-9940-733ecb861aa1',true);
do $$ begin
  begin
    perform public.save_workspace('{"schemaVersion":1,"mode":"personal","holdings":[],"binders":[]}',0);
    raise exception 'Stale save allowed';
  exception when raise_exception then if sqlerrm <> 'WORKSPACE_CONFLICT' then raise; end if; end;
end $$;
rollback;
