alter table public.cardforge_studio_documents
  drop constraint cardforge_studio_documents_document_version_check,
  add constraint cardforge_studio_documents_document_version_check
    check (document_version in (1, 2, 3));

create function public.cardforge_guard_studio_document_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.document_version >= 3 and new.document_version < old.document_version then
    raise exception 'This Set requires a newer CardForge document version. Reload before saving; the stored work was left unchanged.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger cardforge_studio_document_version_guard
before update of document_version, document_payload on public.cardforge_studio_documents
for each row execute function public.cardforge_guard_studio_document_version();
