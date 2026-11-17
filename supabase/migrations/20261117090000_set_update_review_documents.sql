alter table public.cardforge_studio_documents
  drop constraint cardforge_studio_documents_document_version_check,
  add constraint cardforge_studio_documents_document_version_check
    check (document_version in (1, 2, 3, 4));
