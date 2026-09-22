alter table public.cardforge_project_storage_connections
  alter column root_folder_id drop not null;

alter table public.cardforge_project_storage_connections
  drop constraint if exists cardforge_project_storage_connections_root_folder_id_check;

alter table public.cardforge_project_storage_connections
  add constraint cardforge_project_storage_connections_root_folder_id_check
  check (
    root_folder_id is null
    or char_length(btrim(root_folder_id)) between 1 and 255
  );
