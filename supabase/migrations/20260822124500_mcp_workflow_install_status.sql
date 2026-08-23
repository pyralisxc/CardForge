alter table public.cardforge_studio_documents
  add column if not exists last_installed_revision integer,
  add column if not exists last_installed_at timestamptz,
  add column if not exists last_install_summary jsonb;

alter table public.cardforge_studio_documents
  drop constraint if exists cardforge_studio_documents_last_installed_revision_check;

alter table public.cardforge_studio_documents
  add constraint cardforge_studio_documents_last_installed_revision_check
  check (last_installed_revision is null or last_installed_revision >= 1);
