-- Forward-only concurrency hardening; no authored legal text is changed.
-- Retire the unguarded overload without deleting immutable history.
revoke execute on function public.publish_cardforge_legal_document(text, text, text, date, integer) from public, anon, authenticated, service_role;

create or replace function public.publish_cardforge_legal_document(
  p_slug text,
  p_title text,
  p_body text,
  p_effective_date date,
  p_expected_identity_version integer,
  p_expected_document_version integer
)
returns public.cardforge_legal_documents
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_identity_version integer;
  v_next_version integer;
  v_publication public.cardforge_legal_documents;
begin
  if p_slug not in (
    'privacy',
    'terms',
    'creator-pass-terms',
    'supporter-terms',
    'refund',
    'contributor-terms',
    'contact',
    'accessibility'
  ) then
    raise exception using errcode = '22023', message = 'cardforge_legal_document_slug_invalid';
  end if;

  if length(btrim(coalesce(p_title, ''))) = 0
    or length(btrim(coalesce(p_body, ''))) = 0
    or p_effective_date is null
    or p_expected_identity_version is null
    or p_expected_identity_version < 1
    or p_expected_document_version is null
    or p_expected_document_version < 0
  then
    raise exception using errcode = '22023', message = 'cardforge_legal_document_input_invalid';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_slug, 0));

  select identity_version
  into v_identity_version
  from public.cardforge_business_identity
  where id = 'cardforge'
  for update;

  if v_identity_version is null then
    raise exception using errcode = 'P0001', message = 'cardforge_business_identity_storage_not_ready';
  end if;

  if v_identity_version <> p_expected_identity_version then
    raise exception using errcode = 'P0001', message = 'cardforge_business_identity_version_conflict';
  end if;

  select coalesce(max(version), 0) + 1
  into v_next_version
  from public.cardforge_legal_documents
  where slug = p_slug;

  if v_next_version - 1 <> p_expected_document_version then
    raise exception using errcode = 'P0001', message = 'cardforge_legal_document_version_conflict';
  end if;

  insert into public.cardforge_legal_documents (
    slug,
    version,
    title,
    body,
    effective_date,
    published_at,
    business_identity_version
  ) values (
    p_slug,
    v_next_version,
    btrim(p_title),
    btrim(p_body),
    p_effective_date,
    now(),
    v_identity_version
  )
  returning * into v_publication;

  return v_publication;
end;
$$;

revoke execute on function public.publish_cardforge_legal_document(text, text, text, date, integer, integer)
  from public, anon, authenticated;
revoke execute on function public.publish_cardforge_legal_document(text, text, text, date, integer, integer)
  from service_role;
grant execute on function public.publish_cardforge_legal_document(text, text, text, date, integer, integer)
  to service_role;
