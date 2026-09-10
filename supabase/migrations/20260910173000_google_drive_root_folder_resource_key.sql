alter table public.cardforge_project_storage_connections
  add column if not exists root_folder_resource_key text;

alter table public.cardforge_project_storage_connections
  drop constraint if exists cardforge_project_storage_connections_root_folder_resource_key_check;

alter table public.cardforge_project_storage_connections
  add constraint cardforge_project_storage_connections_root_folder_resource_key_check
  check (
    root_folder_resource_key is null
    or (
      char_length(root_folder_resource_key) between 1 and 255
      and root_folder_resource_key !~ '[[:cntrl:]]'
    )
  );
