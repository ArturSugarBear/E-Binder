-- Read-only with rolled-back negative writes; never changes beta ground truth.
begin;
do $$
begin
  if has_table_privilege('anon','public.beta_scan_samples','SELECT') then raise exception 'Anonymous sample access'; end if;
  if has_table_privilege('authenticated','public.beta_scan_samples','UPDATE') then raise exception 'Untrusted label update grant'; end if;
  if exists(select 1 from storage.buckets where id='beta-scan-donations' and public) then raise exception 'Public photo bucket'; end if;
  begin
    update public.beta_scan_samples set review_status='accepted', verified_card_id='tcgdex:ja:M1L-088',reviewed_at=now()
    where id=(select id from public.beta_scan_samples where review_status='pending' limit 1);
    if found then raise exception 'Accepted label without independent evidence'; end if;
  exception when check_violation then null;
  end;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$ begin
  if exists(select 1 from public.beta_scan_samples) then raise exception 'Unrelated account can read private samples'; end if;
  if exists(select 1 from storage.objects where bucket_id='beta-scan-donations') then raise exception 'Unrelated account can read private photo objects'; end if;
end $$;
rollback;
