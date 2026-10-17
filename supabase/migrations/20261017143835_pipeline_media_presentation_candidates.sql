begin;
set local lock_timeout = '5s';

-- The native lineage remembers allocated ordinals after unpublished retention
-- removes a child. Backfill only retained history; unknown purged history is not invented.
alter table public.cardforge_pipeline_asset_lineages
  add column revision_high_water integer not null default 0 check (revision_high_water >= 0);
update public.cardforge_pipeline_asset_lineages as lineage
set revision_high_water = history.high_water
from (select lineage_id, greatest(coalesce(max(revision_number),0),0) as high_water
  from public.cardforge_contributor_asset_submissions group by lineage_id) as history
where lineage.id=history.lineage_id;

-- The submission owns the immutable presentation candidate, never the live registry.
alter table public.cardforge_contributor_asset_submissions add column media_presentation jsonb;
create unique index cardforge_media_revision_key_idx
  on public.cardforge_contributor_asset_submissions(target_registry_asset_id, submission_key)
  where media_presentation is not null;
create unique index cardforge_media_revision_ordinal_idx
  on public.cardforge_contributor_asset_submissions(lineage_id, revision_number)
  where media_presentation is not null;

-- Versions protect authored/source/classification and registry presentation/routing
-- facts, not votes, editorial decisions or automatic timestamp churn.
create function public.cardforge_media_parent_content_version(p_submission_id uuid)
returns text language sql stable security invoker set search_path = '' as $$
  select pg_catalog.md5((pg_catalog.to_jsonb(submission) - array[
    'updated_at','positive_votes','negative_votes','quality_score','status','contributor_lifecycle_state',
    'automated_status','owner_status_override','calculated_access_tier','automated_access_tier','owner_access_tier_override',
    'tier_decision_reason','owner_note','decision_reason','editorial_review_status','editorial_review_note',
    'editorial_reviewed_by','editorial_reviewed_at','published_at','purge_state','trashed_at','purge_after',
    'trash_reason','retention_hold','purge_claimed_at'])::text)
  from public.cardforge_contributor_asset_submissions as submission where id=p_submission_id;
$$;
create function public.cardforge_media_registry_content_version(p_asset_id text)
returns text language sql stable security invoker set search_path = '' as $$
  select pg_catalog.md5(pg_catalog.jsonb_set(pg_catalog.to_jsonb(registry)-'updated_at',
    '{metadata}',registry.metadata-'revisionPublishedAt')::text)
  from public.cardforge_asset_registry as registry where asset_id=p_asset_id;
$$;

create function public.cardforge_read_media_revision_base(p_asset_id text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  registry public.cardforge_asset_registry%rowtype;
  base public.cardforge_contributor_asset_submissions%rowtype;
begin
  select * into registry from public.cardforge_asset_registry where asset_id = p_asset_id;
  if not found then raise exception 'pipeline_media_not_found'; end if;
  select * into base from public.cardforge_contributor_asset_submissions where id = registry.contributor_submission_id;
  if not found or registry.status <> 'published' or registry.asset_type <> 'texture'
    or base.status <> 'published' or base.asset_type <> 'textures'
    or base.lineage_id is null or base.purge_state is not null or base.trashed_at is not null
    or base.contributor_lifecycle_state is not null or base.source_payload is not null
    or nullif(base.source_storage_bucket, '') is null or nullif(base.source_storage_path, '') is null
    or nullif(base.source_url, '') is null or base.source_file_size_bytes not between 1 and 52428800
    or base.source_file_size_bytes is null or base.source_mime_type is null or base.source_mime_type not like 'image/%'
    or coalesce(registry.metadata->>'tileMode','') not in ('repeat','stretch','contain')
    or pg_catalog.jsonb_typeof(registry.metadata->'seamless') is distinct from 'boolean'
    or registry.url is distinct from base.source_url
    or base.revision_number is null
    or coalesce(registry.metadata->>'revisionNumber','') !~ '^[0-9]+$'
    or registry.metadata->>'revisionNumber' is distinct from base.revision_number::text
    or registry.metadata->>'revisionId' is distinct from base.id::text
    or exists(select 1 from public.cardforge_pipeline_asset_lineages l where l.id=base.lineage_id and l.purge_state is not null)
  then raise exception 'pipeline_media_not_permitted'; end if;
  return pg_catalog.jsonb_build_object(
    'assetId',p_asset_id,'name',base.name,'parentSubmissionId',base.id,'lineageId',base.lineage_id,
    'baseRevisionNumber',coalesce(base.revision_number,0),
    'baseVersion',public.cardforge_media_parent_content_version(base.id),
    'registryVersion',public.cardforge_media_registry_content_version(p_asset_id),'intendedAccessTier',registry.access_tier,
    'baseline',pg_catalog.jsonb_build_object('tileMode',registry.metadata->'tileMode','seamless',registry.metadata->'seamless'),
    'sourceBucket',base.source_storage_bucket,'sourcePath',base.source_storage_path,'sourceUrl',base.source_url,
    'sourceMimeType',base.source_mime_type,'sourceSize',base.source_file_size_bytes);
end; $$;

create function public.cardforge_create_media_presentation_revision(
  p_asset_id text, p_submission_key text, p_candidate_id uuid, p_presentation jsonb,
  p_source_url text, p_source_path text
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  snapshot jsonb;
  base public.cardforge_contributor_asset_submissions%rowtype;
  prior public.cardforge_contributor_asset_submissions%rowtype;
  next_revision integer;
  expected_path text;
begin
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(p_asset_id,0)) then
    raise exception 'pipeline_media_unavailable' using errcode='55P03';
  end if;
  select * into prior from public.cardforge_contributor_asset_submissions
    where target_registry_asset_id=p_asset_id and submission_key=p_submission_key and media_presentation is not null for update nowait;
  if found then
    if prior.media_presentation is distinct from p_presentation or prior.purge_state is not null or prior.trashed_at is not null then
      raise exception 'pipeline_media_conflict';
    end if;
    return prior.id;
  end if;
  perform 1 from public.cardforge_asset_registry where asset_id=p_asset_id for update nowait;
  select * into base from public.cardforge_contributor_asset_submissions
    where id=(select contributor_submission_id from public.cardforge_asset_registry where asset_id=p_asset_id) for update nowait;
  perform 1 from public.cardforge_pipeline_asset_lineages where id=base.lineage_id for update nowait;
  snapshot := public.cardforge_read_media_revision_base(p_asset_id);
  if p_presentation->>'parentSubmissionId' is distinct from snapshot->>'parentSubmissionId'
    or p_presentation->>'lineageId' is distinct from snapshot->>'lineageId'
    or p_presentation->'baseRevisionNumber' is distinct from snapshot->'baseRevisionNumber'
    or p_presentation->>'baseVersion' is distinct from snapshot->>'baseVersion'
    or p_presentation->>'registryVersion' is distinct from snapshot->>'registryVersion'
    or p_presentation->'baseline' is distinct from snapshot->'baseline'
    or p_presentation->'intendedAccessTier' is distinct from snapshot->'intendedAccessTier'
  then raise exception 'pipeline_media_conflict'; end if;
  expected_path := 'media-revisions/' || p_candidate_id::text || '/' || (p_presentation->>'sourceSha256') || '.' ||
    (case base.source_mime_type when 'image/svg+xml' then 'svg' when 'image/png' then 'png'
      when 'image/jpeg' then 'jpg' when 'image/webp' then 'webp' when 'image/avif' then 'avif' else 'bin' end);
  if p_presentation->'schemaVersion' is distinct from '1'::jsonb
    or coalesce(p_presentation->>'sourceSha256','') !~ '^[a-f0-9]{64}$'
    or coalesce(p_presentation->'proposed'->>'tileMode','') not in ('repeat','stretch','contain')
    or pg_catalog.jsonb_typeof(p_presentation->'proposed'->'seamless') is distinct from 'boolean'
    or p_presentation->'proposed' = p_presentation->'baseline'
    or coalesce(p_submission_key,'') !~ '^[a-f0-9-]{36}$'
    or p_source_path is distinct from expected_path
    or nullif(p_source_url,'') is null or p_source_url=base.source_url
    or exists(select 1 from public.cardforge_contributor_asset_submissions where source_storage_bucket=base.source_storage_bucket and source_storage_path=p_source_path)
  then raise exception 'pipeline_media_invalid'; end if;
  if exists(select 1 from public.cardforge_contributor_asset_submissions
    where lineage_id=base.lineage_id and id<>base.id and published_at is null and trashed_at is null
      and purge_state is null and status in ('draft','submitted','voting','publish_candidate'))
    or exists(select 1 from public.cardforge_contributor_asset_submissions
      where lineage_id=base.lineage_id group by revision_number having count(*)>1 and revision_number is not null)
  then raise exception 'pipeline_media_conflict'; end if;
  select greatest(coalesce(max(revision_number),0),
    (select revision_high_water from public.cardforge_pipeline_asset_lineages where id=base.lineage_id))+1
    into next_revision from public.cardforge_contributor_asset_submissions where lineage_id=base.lineage_id;
  update public.cardforge_pipeline_asset_lineages set revision_high_water=next_revision where id=base.lineage_id;
  insert into public.cardforge_contributor_asset_submissions(
    id,lineage_id,contributor_id,contributor_email,asset_type,name,description,preview_url,
    source_url,source_file_size_bytes,source_mime_type,source_storage_bucket,source_storage_path,
    requested_studio_destination,specialty_tags,use_case_tags,semantic_role,visual_family,variant_kind,variant_label,compatibility_tags,source_notes,
    status,automated_status,calculated_access_tier,automated_access_tier,source_payload,
    target_registry_asset_id,base_revision_number,revision_number,submission_key,media_presentation,
    editorial_review_status,editorial_review_note,editorial_reviewed_by,editorial_reviewed_at,published_at
  ) values (
    p_candidate_id,base.lineage_id,base.contributor_id,base.contributor_email,base.asset_type,base.name,base.description,base.preview_url,
    p_source_url,base.source_file_size_bytes,base.source_mime_type,base.source_storage_bucket,p_source_path,
    base.requested_studio_destination,base.specialty_tags,base.use_case_tags,base.semantic_role,base.visual_family,base.variant_kind,base.variant_label,base.compatibility_tags,base.source_notes,
    'submitted','voting','contributor','contributor',null,
    p_asset_id,coalesce(base.revision_number,0),next_revision,p_submission_key,p_presentation,
    'pending','',null,null,null
  );
  return p_candidate_id;
end; $$;

-- Inherited candidate content is immutable. Existing review/lifecycle decisions
-- remain governed separately; Publish cannot approve a pending media child.
create function public.cardforge_guard_media_presentation_revision()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op='UPDATE' and old.media_presentation is not null
    and new.owner_status_override='published' and old.owner_status_override is distinct from 'published'
    and old.editorial_review_status<>'approved'
  then raise exception 'pipeline_media_editorial_review_required'; end if;
  if tg_op='UPDATE' and old.media_presentation is not null and (
    new.media_presentation is distinct from old.media_presentation
    or new.source_url is distinct from old.source_url
    or new.source_storage_bucket is distinct from old.source_storage_bucket
    or new.source_storage_path is distinct from old.source_storage_path
    or new.source_file_size_bytes is distinct from old.source_file_size_bytes
    or new.source_mime_type is distinct from old.source_mime_type
    or new.lineage_id is distinct from old.lineage_id
    or new.revision_number is distinct from old.revision_number
    or row(new.id,new.contributor_id,new.contributor_email,new.asset_type,new.name,new.description,new.preview_url,
      new.source_notes,new.requested_studio_destination,new.source_payload,
      new.target_registry_asset_id,new.base_revision_number,new.submission_key)
      is distinct from row(old.id,old.contributor_id,old.contributor_email,old.asset_type,old.name,old.description,old.preview_url,
      old.source_notes,old.requested_studio_destination,old.source_payload,
      old.target_registry_asset_id,old.base_revision_number,old.submission_key)
  ) then raise exception 'pipeline_media_revision_immutable'; end if;
  if tg_op='UPDATE' and old.media_presentation is not null
    and row(new.specialty_tags,new.use_case_tags,new.semantic_role,new.visual_family,new.variant_kind,new.variant_label,new.compatibility_tags)
      is distinct from row(old.specialty_tags,old.use_case_tags,old.semantic_role,old.visual_family,old.variant_kind,old.variant_label,old.compatibility_tags)
    and not(old.status='published' and new.status='published' and exists(
      select 1 from public.cardforge_asset_registry registry where registry.contributor_submission_id=old.id and registry.status='published'))
  then raise exception 'pipeline_media_revision_immutable'; end if;
  return new;
end; $$;
create trigger cardforge_00_media_presentation_guard before insert or update
  on public.cardforge_contributor_asset_submissions for each row execute function public.cardforge_guard_media_presentation_revision();
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
  media_registry public.cardforge_asset_registry%rowtype;
  media_base jsonb;
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

  -- Rebalance visits the active parent before its proposed child. When its
  -- authored/source and public registry facts are exactly unchanged, do not
  -- re-synthesize legacy texture defaults or attribution over that snapshot.
  if submission.media_presentation is null and submission.asset_type='textures'
    and submission.status='published' and current_active_submission_id=submission.id
    and exists(select 1 from public.cardforge_asset_registry registry where registry.asset_id=next_registry_asset_id
      and registry.access_tier=submission.calculated_access_tier)
    and exists(select 1 from public.cardforge_contributor_asset_submissions candidate
      where candidate.media_presentation->>'parentSubmissionId'=submission.id::text
        and candidate.purge_state is null and candidate.trashed_at is null
        and candidate.media_presentation->>'baseVersion'=public.cardforge_media_parent_content_version(submission.id)
        and candidate.media_presentation->>'registryVersion'=public.cardforge_media_registry_content_version(next_registry_asset_id))
  then return next_registry_asset_id; end if;

  if submission.media_presentation is not null and submission.status='published' then
    select * into media_registry from public.cardforge_asset_registry where asset_id=next_registry_asset_id for update nowait;
    if media_registry.contributor_submission_id=submission.id then
      if media_registry.metadata->'tileMode' is distinct from submission.media_presentation->'proposed'->'tileMode'
        or media_registry.metadata->'seamless' is distinct from submission.media_presentation->'proposed'->'seamless'
        or media_registry.metadata->>'revisionId' is distinct from submission.id::text
        or media_registry.metadata->>'revisionNumber' is distinct from submission.revision_number::text
      then raise exception 'pipeline_media_conflict'; end if;
    else
    if submission.editorial_review_status<>'approved' then raise exception 'pipeline_media_editorial_review_required'; end if;
    perform 1 from public.cardforge_contributor_asset_submissions
      where id=media_registry.contributor_submission_id for update nowait;
    media_base := public.cardforge_read_media_revision_base(next_registry_asset_id);
    if submission.media_presentation->'schemaVersion' is distinct from '1'::jsonb
      or coalesce(submission.media_presentation->>'sourceSha256','') !~ '^[a-f0-9]{64}$'
      or coalesce(submission.media_presentation->'proposed'->>'tileMode','') not in ('repeat','stretch','contain')
      or pg_catalog.jsonb_typeof(submission.media_presentation->'proposed'->'seamless') is distinct from 'boolean'
      or submission.media_presentation->>'parentSubmissionId' is distinct from media_base->>'parentSubmissionId'
      or submission.media_presentation->>'lineageId' is distinct from media_base->>'lineageId'
      or submission.lineage_id::text is distinct from media_base->>'lineageId'
      or submission.media_presentation->'baseRevisionNumber' is distinct from media_base->'baseRevisionNumber'
      or submission.base_revision_number::text is distinct from media_base->>'baseRevisionNumber'
      or submission.media_presentation->>'baseVersion' is distinct from media_base->>'baseVersion'
      or submission.media_presentation->>'registryVersion' is distinct from media_base->>'registryVersion'
      or submission.media_presentation->'baseline' is distinct from media_base->'baseline'
      or submission.media_presentation->'intendedAccessTier' is distinct from media_base->'intendedAccessTier'
      or submission.source_storage_bucket is distinct from media_base->>'sourceBucket'
      or submission.source_storage_path is not distinct from media_base->>'sourcePath'
      or submission.source_url is not distinct from media_base->>'sourceUrl'
      or submission.source_mime_type is distinct from media_base->>'sourceMimeType'
      or pg_catalog.to_jsonb(submission.source_file_size_bytes) is distinct from media_base->'sourceSize'
    then raise exception 'pipeline_media_conflict'; end if;
    end if;
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

    if submission.media_presentation is not null then
      -- Preserve the approved parent's unrelated provenance, defaults and routing
      -- metadata. This lane changes only fit/seamless and normal revision pointers.
      next_registry_metadata := media_registry.metadata || pg_catalog.jsonb_build_object(
        'tileMode',submission.media_presentation->'proposed'->'tileMode',
        'seamless',submission.media_presentation->'proposed'->'seamless');
    end if;

    next_registry_metadata := next_registry_metadata || pg_catalog.jsonb_build_object(
      'revisionNumber', coalesce(submission.revision_number, 1),
      'revisionId', submission.id,
      'revisionPublishedAt', coalesce(submission.published_at, pg_catalog.now())
    );

    registry_library_source := case when submission.media_presentation is not null then media_registry.library_source
      when submission.source_payload is not null then 'official' else 'contributor' end;
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

create or replace function public.cardforge_set_contributor_asset_owner_override(
  p_submission_id uuid,
  p_update_status_override boolean,
  p_status_override text,
  p_update_tier_override boolean,
  p_tier_override text,
  p_owner_note text,
  p_owner_contributor_id text default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  changed_count integer;
begin
  if p_update_status_override
    and p_status_override is not null
    and p_status_override not in ('voting', 'publish_candidate', 'published', 'archived', 'rejected')
  then
    raise exception 'invalid_owner_status_override';
  end if;
  if p_update_tier_override
    and p_tier_override is not null
    and p_tier_override not in ('hidden', 'free', 'paid')
  then
    raise exception 'invalid_owner_tier_override';
  end if;
  if p_update_status_override
    and p_status_override = 'published'
    and (
      nullif(pg_catalog.btrim(coalesce(p_owner_note, '')), '') is null
      or nullif(pg_catalog.btrim(coalesce(p_owner_contributor_id, '')), '') is null
    )
  then
    raise exception 'editorial_review_reason_required';
  end if;

  update public.cardforge_contributor_asset_submissions
  set
    owner_status_override = case when p_update_status_override then p_status_override else owner_status_override end,
    owner_access_tier_override = case when p_update_tier_override then p_tier_override else owner_access_tier_override end,
    owner_note = coalesce(p_owner_note, ''),
    editorial_review_status = case
      when p_update_status_override and p_status_override = 'published' and media_presentation is null then 'approved'
      else editorial_review_status
    end,
    editorial_review_note = case
      when p_update_status_override and p_status_override = 'published' and media_presentation is null then pg_catalog.btrim(p_owner_note)
      else editorial_review_note
    end,
    editorial_reviewed_by = case
      when p_update_status_override and p_status_override = 'published' and media_presentation is null then pg_catalog.btrim(p_owner_contributor_id)
      else editorial_reviewed_by
    end,
    editorial_reviewed_at = case
      when p_update_status_override and p_status_override = 'published' and media_presentation is null then pg_catalog.now()
      else editorial_reviewed_at
    end
  where id = p_submission_id
    and purge_state is null;

  if not found then
    raise exception 'contributor_asset_not_found';
  end if;

  changed_count := public.cardforge_rebalance_contributor_asset_pipeline(p_owner_contributor_id);
  perform public.cardforge_sync_contributor_asset_registry(p_submission_id);

  return changed_count;
end;
$$;

-- COALESCE is SQL syntax, not a schema-qualified function; preserve all native evidence gates.
create or replace function public.cardforge_set_contributor_asset_editorial_review(
  p_submission_id uuid,
  p_review_status text,
  p_review_note text,
  p_reviewer_contributor_id text
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  submission public.cardforge_contributor_asset_submissions%rowtype;
  normalized_note text := pg_catalog.btrim(coalesce(p_review_note, ''));
  normalized_reviewer text := pg_catalog.btrim(coalesce(p_reviewer_contributor_id, ''));
  changed_count integer;
begin
  if p_review_status not in ('pending', 'approved', 'revise', 'quarantine', 'retire') then
    raise exception 'invalid_editorial_review_status';
  end if;
  if p_review_status <> 'pending'
    and (normalized_note = '' or normalized_reviewer = '')
  then
    raise exception 'editorial_review_reason_required';
  end if;

  select * into submission
  from public.cardforge_contributor_asset_submissions
  where id = p_submission_id and purge_state is null
  for update;
  if not found then raise exception 'contributor_asset_not_found'; end if;

  if submission.status = 'published' and p_review_status = 'revise' then
    raise exception 'editorial_review_live_requires_quarantine';
  end if;

  if p_review_status = 'approved' then
    if nullif(pg_catalog.btrim(coalesce(submission.source_notes, '')), '') is null then
      raise exception 'editorial_review_source_notes_required';
    end if;
    if nullif(pg_catalog.btrim(coalesce(submission.preview_url, '')), '') is null then
      raise exception 'editorial_review_preview_required';
    end if;
    if coalesce(pg_catalog.array_length(submission.specialty_tags, 1), 0) = 0
      or not public.cardforge_valid_pipeline_semantic_role(submission.asset_type, submission.semantic_role)
    then
      raise exception 'editorial_review_classification_required';
    end if;
    if submission.asset_type in ('templates', 'sets')
      and coalesce(pg_catalog.array_length(submission.use_case_tags, 1), 0) = 0
    then
      raise exception 'editorial_review_classification_required';
    end if;
  end if;

  update public.cardforge_contributor_asset_submissions
  set
    editorial_review_status = p_review_status,
    editorial_review_note = case when p_review_status = 'pending' then '' else normalized_note end,
    editorial_reviewed_by = case when p_review_status = 'pending' then null else normalized_reviewer end,
    editorial_reviewed_at = case when p_review_status = 'pending' then null else pg_catalog.now() end,
    owner_status_override = case when p_review_status in ('quarantine', 'retire') then 'archived' else owner_status_override end,
    owner_access_tier_override = case when p_review_status in ('quarantine', 'retire') then 'hidden' else owner_access_tier_override end,
    owner_note = case when p_review_status in ('quarantine', 'retire') then normalized_note else owner_note end
  where id = p_submission_id;

  changed_count := public.cardforge_rebalance_contributor_asset_pipeline(normalized_reviewer);
  perform public.cardforge_sync_contributor_asset_registry(p_submission_id);
  return changed_count;
end;
$$;

revoke execute on function public.cardforge_read_media_revision_base(text) from public,anon,authenticated;
revoke execute on function public.cardforge_create_media_presentation_revision(text,text,uuid,jsonb,text,text) from public,anon,authenticated;
revoke execute on function public.cardforge_guard_media_presentation_revision() from public,anon,authenticated;
grant execute on function public.cardforge_read_media_revision_base(text) to service_role;
grant execute on function public.cardforge_create_media_presentation_revision(text,text,uuid,jsonb,text,text) to service_role;
revoke execute on function public.cardforge_media_parent_content_version(uuid) from public,anon,authenticated;
revoke execute on function public.cardforge_media_registry_content_version(text) from public,anon,authenticated;
grant execute on function public.cardforge_media_parent_content_version(uuid) to service_role;
grant execute on function public.cardforge_media_registry_content_version(text) to service_role;
commit;
