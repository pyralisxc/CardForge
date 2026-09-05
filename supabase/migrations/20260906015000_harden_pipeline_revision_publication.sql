begin;

-- One publication owner for Templates, Styles, media, fonts, and Sets.
-- Archived or superseded revisions must never change a newer active pointer.
create or replace function public.cardforge_sync_contributor_asset_registry(
  p_submission_id uuid
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  submission public.cardforge_contributor_asset_submissions%rowtype;
  next_registry_asset_id text;
  registry_asset_type text;
  registry_library_source text;
  next_registry_metadata jsonb;
  current_revision integer := 0;
  current_revision_id text;
  current_active_submission_id uuid;
begin
  select *
  into submission
  from public.cardforge_contributor_asset_submissions
  where id = p_submission_id
  for update;

  if not found then
    raise exception 'contributor_asset_not_found';
  end if;

  next_registry_asset_id := coalesce(
    submission.target_registry_asset_id,
    submission.registry_asset_id,
    'contributor-' || submission.asset_type || '-' || submission.id::text
  );
  registry_asset_type := case submission.asset_type
    when 'templates' then 'template'
    when 'elementPresets' then 'elementPreset'
    when 'textures' then 'texture'
    when 'dividers' then 'divider'
    when 'icons' then 'icon'
    when 'imageAssets' then 'image'
    when 'fonts' then 'font'
    when 'sets' then 'set'
    else null
  end;

  -- Serialize every input type on its stable registry identity.
  -- Bootstrap takes this lock before submission rows. Never wait here while
  -- holding the reverse order; roll back and let the caller retry instead.
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(next_registry_asset_id, 0)) then
    raise exception 'pipeline_publication_unavailable' using errcode = '55P03';
  end if;
  select
    registry.contributor_submission_id,
    case when registry.metadata ->> 'revisionNumber' ~ '^[0-9]+$'
      then (registry.metadata ->> 'revisionNumber')::integer else 0 end,
    registry.metadata ->> 'revisionId'
  into current_active_submission_id, current_revision, current_revision_id
  from public.cardforge_asset_registry as registry
  where registry.asset_id = next_registry_asset_id;

  current_revision := coalesce(current_revision, 0);
  if current_active_submission_id is not null
    and current_active_submission_id <> submission.id
    and (
      submission.revision_number is null
      or submission.revision_number <= current_revision
    )
  then
    update public.cardforge_contributor_asset_submissions
    set
      status = 'archived',
      calculated_access_tier = 'hidden',
      decision_reason = 'superseded_revision',
      tier_decision_reason = 'superseded_revision'
    where id = submission.id;
    return next_registry_asset_id;
  end if;

  if current_active_submission_id is not null
    and current_active_submission_id <> submission.id
    and submission.revision_number is not null
    and submission.revision_number > current_revision
    and submission.status <> 'published'
  then
    return next_registry_asset_id;
  end if;

  if submission.status = 'published' and nullif(submission.source_url, '') is null then
    raise exception 'contributor_asset_source_required';
  end if;

  if submission.status = 'published' and submission.asset_type = 'sets'
    and (submission.source_mime_type is null or submission.source_mime_type not in ('application/vnd.cardforge.project+zip', 'application/octet-stream'))
  then
    raise exception 'published_set_package_required';
  end if;

  if submission.status = 'published' then
    next_registry_metadata := case submission.asset_type
      when 'textures' then pg_catalog.jsonb_build_object(
        'sourceMimeType', submission.source_mime_type,
        'tileMode', 'repeat', 'seamless', true,
        'allowedTargets', pg_catalog.jsonb_build_array('text', 'shape', 'template'),
        'defaultBlendMode', 'multiply', 'defaultOpacity', 42, 'defaultScale', 160
      )
      when 'dividers' then pg_catalog.jsonb_build_object(
        'sourceMimeType', submission.source_mime_type,
        'tileMode', 'stretch', 'seamless', false,
        'allowedTargets', pg_catalog.jsonb_build_array('divider'),
        'defaultBlendMode', 'normal', 'defaultOpacity', 100, 'defaultScale', 100
      )
      when 'icons' then pg_catalog.jsonb_build_object(
        'sourceMimeType', submission.source_mime_type,
        'tileMode', 'contain', 'seamless', false,
        'allowedTargets', pg_catalog.jsonb_build_array('icon'),
        'defaultBlendMode', 'normal', 'defaultOpacity', 100, 'defaultScale', 100,
        'defaultWidth', 64, 'defaultHeight', 64
      )
      when 'imageAssets' then pg_catalog.jsonb_build_object(
        'sourceMimeType', submission.source_mime_type,
        'tileMode', 'contain', 'seamless', false,
        'allowedTargets', pg_catalog.jsonb_build_array('image', 'imageFrame', 'template'),
        'defaultBlendMode', 'normal', 'defaultOpacity', 100, 'defaultScale', 100,
        'defaultWidth', 300, 'defaultHeight', 180
      )
      when 'sets' then pg_catalog.jsonb_build_object(
        'sourceMimeType', submission.source_mime_type, 'portableProject', true,
        'description', submission.description,
        'specialtyTags', to_jsonb(submission.specialty_tags),
        'useCaseTags', to_jsonb(submission.use_case_tags)
      )
      when 'fonts' then pg_catalog.jsonb_build_object(
        'sourceMimeType', submission.source_mime_type,
        'category', 'Utility', 'fallback', 'serif', 'fontDisplay', 'swap'
      )
      else pg_catalog.jsonb_build_object('sourceMimeType', submission.source_mime_type)
    end;

    next_registry_metadata := next_registry_metadata || pg_catalog.jsonb_build_object(
      'revisionNumber', coalesce(submission.revision_number, 1),
      'revisionId', submission.id,
      'revisionPublishedAt', coalesce(submission.published_at, pg_catalog.now())
    );

    registry_library_source := case when submission.source_payload is not null then 'official' else 'contributor' end;
    if submission.asset_type = 'templates' and submission.source_payload is not null then
      if submission.base_revision_number is null
        or submission.revision_number is null
      then
        raise exception 'invalid_template_revision';
      end if;

      select
        case when registry.metadata ->> 'revisionNumber' ~ '^[0-9]+$'
          then (registry.metadata ->> 'revisionNumber')::integer else 0 end,
        registry.metadata ->> 'revisionId'
      into current_revision, current_revision_id
      from public.cardforge_asset_registry as registry
      where registry.asset_id = next_registry_asset_id;

      current_revision := coalesce(current_revision, 0);
      if not (
        current_revision = submission.base_revision_number
        or (
          current_revision = submission.revision_number
          and current_revision_id = submission.id::text
        )
      ) then
        raise exception 'template_revision_conflict';
      end if;

      next_registry_metadata := next_registry_metadata || pg_catalog.jsonb_strip_nulls(
        pg_catalog.jsonb_build_object(
          'revisionNumber', submission.revision_number,
          'revisionId', submission.id,
          'revisionPublishedAt', coalesce(submission.published_at, pg_catalog.now()),
          'templateUsage', submission.source_payload ->> 'templateUsage',
          'templateOrder', submission.source_payload -> 'templateOrder'
        )
      );
    end if;

    insert into public.cardforge_asset_registry (
      asset_id, name, asset_type, url, preview_url, status, access_tier,
      library_source, contributor_submission_id, storage_bucket, storage_path,
      file_size_bytes, metadata, specialty_tags, use_case_tags
    )
    values (
      next_registry_asset_id, submission.name, registry_asset_type,
      submission.source_url, coalesce(nullif(submission.preview_url, ''), submission.source_url),
      'published', submission.calculated_access_tier, registry_library_source,
      submission.id, submission.source_storage_bucket, submission.source_storage_path,
      submission.source_file_size_bytes, next_registry_metadata, submission.specialty_tags, submission.use_case_tags
    )
    on conflict (asset_id) do update
    set
      name = excluded.name,
      asset_type = excluded.asset_type,
      url = excluded.url,
      preview_url = excluded.preview_url,
      status = excluded.status,
      access_tier = excluded.access_tier,
      library_source = excluded.library_source,
      contributor_submission_id = excluded.contributor_submission_id,
      storage_bucket = excluded.storage_bucket,
      storage_path = excluded.storage_path,
      file_size_bytes = excluded.file_size_bytes,
      specialty_tags = excluded.specialty_tags,
      use_case_tags = excluded.use_case_tags,
      metadata = (public.cardforge_asset_registry.metadata - 'template' - 'contributorEmail' - 'contributorId' - 'revisionAuthor') || excluded.metadata;

    update public.cardforge_contributor_asset_submissions
    set registry_asset_id = next_registry_asset_id
    where id = submission.id;
  elsif submission.registry_asset_id is not null then
    update public.cardforge_asset_registry
    set
      status = submission.status,
      access_tier = case
        when submission.status in ('archived', 'rejected') then 'hidden'
        else 'contributor'
      end,
      metadata = metadata - 'template' - 'contributorEmail' - 'contributorId' - 'revisionAuthor'
    where asset_id = submission.registry_asset_id
      and contributor_submission_id = submission.id;
  end if;

  return next_registry_asset_id;
end;
$$;


revoke execute on function public.cardforge_sync_contributor_asset_registry(uuid) from public, anon, authenticated;
grant execute on function public.cardforge_sync_contributor_asset_registry(uuid) to service_role;
drop function public.cardforge_sync_studio_asset_registry(uuid);

-- Repair current publications using their existing immutable revisions and access decisions.
do $$
declare current_publication record;
begin
  for current_publication in
    select s.id from public.cardforge_asset_registry r
    join public.cardforge_contributor_asset_submissions s on s.id = r.contributor_submission_id
    where s.asset_type = 'sets' and s.status = 'published'
      and s.contributor_lifecycle_state is null and s.purge_state is null
  loop
    perform public.cardforge_sync_contributor_asset_registry(current_publication.id);
  end loop;
end;
$$;

commit;
