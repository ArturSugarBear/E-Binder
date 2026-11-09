-- No image bytes or local-photo references are accepted by the cloud store.
-- This bucket was used only by disposable integration fixtures; it is empty.
drop policy if exists originals_read on storage.objects;
drop policy if exists originals_insert on storage.objects;
drop policy if exists originals_update on storage.objects;
drop policy if exists originals_delete on storage.objects;
-- The empty bucket remains disabled; Storage API owns bucket deletion.
alter table public.user_workspaces add constraint workspace_metadata_only check (
  not jsonb_path_exists(state,'$.**.photoId') and state::text !~* 'data:image/'
);
alter table public.binder_cards add constraint card_metadata_only check (
  not jsonb_path_exists(card_data,'$.**.photoId') and card_data::text !~* 'data:image/'
);
