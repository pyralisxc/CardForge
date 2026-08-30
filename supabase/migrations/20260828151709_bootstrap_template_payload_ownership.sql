begin;

set local lock_timeout = '5s';

-- Bootstrap Templates follow the same ownership contract as authored revisions:
-- the immutable submission owns the document and the registry owns only its
-- active pointer plus compact discovery metadata.
create or replace function public.cardforge_upsert_pipeline_template_asset(
  p_asset_id text,
  p_name text,
  p_url text,
  p_preview_url text,
  p_description text,
  p_developer_id text,
  p_developer_email text,
  p_file_size_bytes bigint,
  p_source_mime_type text,
  p_metadata jsonb,
  p_template_payload jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  next_submission_id uuid;
  publication_time timestamptz := pg_catalog.now();
  compact_metadata jsonb;
begin
  if pg_catalog.jsonb_typeof(p_template_payload) <> 'object' then
    raise exception 'pipeline_template_payload_required';
  end if;

  if p_template_payload::text like '%data:image/%' then
    raise exception 'pipeline_template_embedded_media_not_allowed';
  end if;

  compact_metadata := (
    coalesce(p_metadata, '{}'::jsonb) - 'template' - 'payload'
  ) || pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'revisionNumber', 1,
    'templateUsage', p_template_payload ->> 'templateUsage',
    'templateOrder', p_template_payload -> 'templateOrder'
  ));

  next_submission_id := public.cardforge_upsert_pipeline_registry_asset(
    p_asset_id,
    p_name,
    'templates',
    'template',
    p_url,
    p_preview_url,
    p_description,
    p_developer_id,
    p_developer_email,
    p_file_size_bytes,
    p_source_mime_type,
    null,
    null,
    compact_metadata
  );

  update public.cardforge_developer_asset_submissions
  set
    source_payload = p_template_payload,
    target_registry_asset_id = p_asset_id,
    base_revision_number = 0,
    revision_number = 1,
    published_at = coalesce(published_at, publication_time)
  where id = next_submission_id;

  update public.cardforge_asset_registry
  set
    library_source = 'official',
    metadata = compact_metadata || pg_catalog.jsonb_build_object(
      'revisionId', next_submission_id,
      'revisionPublishedAt', publication_time
    )
  where asset_id = p_asset_id
    and developer_submission_id = next_submission_id;

  return next_submission_id;
end;
$$;

revoke execute on function public.cardforge_upsert_pipeline_template_asset(
  text, text, text, text, text, text, text, bigint, text, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.cardforge_upsert_pipeline_template_asset(
  text, text, text, text, text, text, text, bigint, text, jsonb, jsonb
) to service_role;

comment on function public.cardforge_upsert_pipeline_template_asset(
  text, text, text, text, text, text, text, bigint, text, jsonb, jsonb
) is 'Atomically imports an official bootstrap Template while preserving submission-owned revision payloads.';

commit;
