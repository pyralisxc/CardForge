alter table public.cardforge_studio_documents
  add column if not exists source_cloud_set_id text,
  add column if not exists source_cloud_revision integer;

alter table public.cardforge_studio_documents
  drop constraint if exists cardforge_studio_documents_source_cloud_revision_check;

alter table public.cardforge_studio_documents
  add constraint cardforge_studio_documents_source_cloud_revision_check
  check (
    (source_cloud_set_id is null and source_cloud_revision is null)
    or (
      char_length(btrim(source_cloud_set_id)) between 1 and 160
      and source_cloud_revision >= 1
    )
  );
