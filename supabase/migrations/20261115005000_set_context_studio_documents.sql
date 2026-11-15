alter table public.cardforge_studio_documents
  drop constraint cardforge_studio_documents_document_version_check,
  drop constraint cardforge_studio_documents_document_payload_check,
  add constraint cardforge_studio_documents_document_version_check
    check (document_version in (1, 2)),
  add constraint cardforge_studio_documents_document_payload_check
    check (
      jsonb_typeof(document_payload) = 'object'
      and document_payload ? 'version'
      and jsonb_typeof(document_payload -> 'version') = 'number'
      and document_payload ->> 'version' = document_version::text
    );
