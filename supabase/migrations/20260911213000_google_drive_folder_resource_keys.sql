alter table public.cardforge_project_storage_connections
  add column if not exists root_folder_resource_key text;

alter table public.cardforge_project_storage_connections
  drop constraint if exists cardforge_project_storage_connections_root_folder_resource_key_check;

alter table public.cardforge_project_storage_connections
  add constraint cardforge_project_storage_connections_root_folder_resource_key_check
  check (
    root_folder_resource_key is null
    or (
      char_length(btrim(root_folder_resource_key)) between 1 and 255
      and root_folder_resource_key !~ '[[:cntrl:]]'
    )
  );

comment on column public.cardforge_project_storage_connections.root_folder_resource_key is
  'Optional Google Drive resource key for the selected project folder. Used on later Drive requests when Google protects a link-shared folder; this is provider metadata, not an OAuth credential.';
