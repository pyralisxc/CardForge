begin;
set local lock_timeout = '5s';

-- A pending correction is another immutable native Template revision, not a
-- new asset or draft store. Its lease/retry context lives on the submission.
alter table public.cardforge_contributor_asset_submissions add column template_review_context jsonb;
create unique index cardforge_template_review_key_idx
  on public.cardforge_contributor_asset_submissions(target_registry_asset_id,submission_key)
  where template_review_context is not null;

create function public.cardforge_read_template_review_base(p_asset_id text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.cardforge_asset_registry%rowtype; b public.cardforge_contributor_asset_submissions%rowtype; high_water integer;
begin
  select * into r from public.cardforge_asset_registry where asset_id=p_asset_id;
  if not found then raise exception 'template_review_not_found'; end if;
  select * into b from public.cardforge_contributor_asset_submissions where id=r.contributor_submission_id;
  if not found or r.status<>'published' or r.asset_type<>'template' or b.status<>'published'
    or b.asset_type<>'templates' or pg_catalog.jsonb_typeof(b.source_payload) is distinct from 'object'
    or b.lineage_id is null or b.revision_number is null or b.purge_state is not null or b.trashed_at is not null
    or b.contributor_lifecycle_state is not null or r.metadata->>'revisionId' is distinct from b.id::text
    or b.source_storage_bucket is not null or b.source_storage_path is not null
    or r.metadata->>'revisionNumber' is distinct from b.revision_number::text
    or b.source_payload->>'id' is distinct from p_asset_id
  then raise exception 'template_review_not_permitted'; end if;
  select revision_high_water into high_water from public.cardforge_pipeline_asset_lineages
    where id=b.lineage_id and purge_state is null;
  if not found then raise exception 'template_review_not_permitted'; end if;
  return pg_catalog.jsonb_build_object('template',b.source_payload,'expectedBase',pg_catalog.jsonb_build_object(
    'assetId',p_asset_id,'parentSubmissionId',b.id,'lineageId',b.lineage_id,'baseRevisionNumber',b.revision_number,
    'revisionHighWater',greatest(high_water,b.revision_number),
    'parentContentVersion',public.cardforge_media_parent_content_version(b.id),
    'registryContentVersion',public.cardforge_media_registry_content_version(p_asset_id)));
end; $$;

-- Review bookkeeping is not authored content; adding this column must not stale
-- the six existing pending media candidates or any unchanged parent.
create or replace function public.cardforge_media_parent_content_version(p_submission_id uuid)
returns text language sql stable security invoker set search_path = '' as $$
  select pg_catalog.md5((pg_catalog.to_jsonb(submission) - array[
    'updated_at','positive_votes','negative_votes','quality_score','status','contributor_lifecycle_state',
    'automated_status','owner_status_override','calculated_access_tier','automated_access_tier','owner_access_tier_override',
    'tier_decision_reason','owner_note','decision_reason','editorial_review_status','editorial_review_note',
    'editorial_reviewed_by','editorial_reviewed_at','published_at','purge_state','trashed_at','purge_after',
    'trash_reason','retention_hold','purge_claimed_at','template_review_context'])::text)
  from public.cardforge_contributor_asset_submissions as submission where id=p_submission_id;
$$;

-- Every Template writer shares the asset lock and retained ordinal allocator.
-- The high-water mark survives candidate purge; stale attempts cannot be
-- silently recreated after their receipt has passed through normal retention.
create function public.cardforge_allocate_template_revision(p_asset_id text)
returns table(lineage_id uuid,revision_number integer)
language plpgsql security invoker set search_path='' as $$
declare l public.cardforge_pipeline_asset_lineages%rowtype; next_number integer;
begin
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(p_asset_id,0)) then
    raise exception 'template_review_unavailable' using errcode='55P03'; end if;
  insert into public.cardforge_pipeline_asset_lineages(registry_asset_id) values(p_asset_id)
    on conflict(registry_asset_id) do nothing;
  select * into l from public.cardforge_pipeline_asset_lineages where registry_asset_id=p_asset_id for update nowait;
  if not found or l.purge_state is not null then raise exception 'template_review_conflict'; end if;
  if exists(select 1 from public.cardforge_contributor_asset_submissions s where s.lineage_id=l.id
    and s.asset_type='templates' and s.published_at is null and s.trashed_at is null and s.purge_state is null
    and s.status in('draft','submitted','voting','publish_candidate'))
    or exists(select 1 from public.cardforge_contributor_asset_submissions s where s.lineage_id=l.id
      and s.revision_number is not null group by s.revision_number having count(*)>1)
  then raise exception 'template_review_conflict'; end if;
  select greatest(coalesce(max(s.revision_number),0),l.revision_high_water)+1 into next_number
    from public.cardforge_contributor_asset_submissions s where s.lineage_id=l.id;
  update public.cardforge_pipeline_asset_lineages set revision_high_water=next_number where id=l.id;
  return query select l.id,next_number;
end; $$;

create function public.cardforge_read_template_review_receipt(p_asset_id text,p_submission_key text,p_actor_id text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.cardforge_contributor_asset_submissions%rowtype;
begin
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(p_asset_id,0)) then
    raise exception 'template_review_unavailable' using errcode='55P03'; end if;
  select * into s from public.cardforge_contributor_asset_submissions
    where target_registry_asset_id=p_asset_id and submission_key=p_submission_key and template_review_context is not null;
  if not found then return null; end if;
  if s.template_review_context->>'actorId' is distinct from p_actor_id then raise exception 'template_review_conflict'; end if;
  return pg_catalog.jsonb_build_object('id',s.id,'assetId',p_asset_id,'revisionNumber',s.revision_number,
    'status',s.status,'editorialReviewStatus',s.editorial_review_status,
    'requestFingerprint',s.template_review_context->>'requestFingerprint');
end; $$;

create function public.cardforge_create_template_review_revision(
  p_asset_id text,p_expected_base jsonb,p_template_payload jsonb,p_actor_id text,p_submission_key text,p_request_fingerprint text
) returns uuid language plpgsql security invoker set search_path='' as $$
declare snapshot jsonb; b public.cardforge_contributor_asset_submissions%rowtype;
  prior public.cardforge_contributor_asset_submissions%rowtype; allocated record; candidate_id uuid;
begin
  if nullif(pg_catalog.btrim(p_actor_id),'') is null or coalesce(p_submission_key,'') !~ '^[A-Za-z0-9_-]{16,160}$'
    or coalesce(p_request_fingerprint,'') !~ '^[a-f0-9]{64}$'
    or pg_catalog.jsonb_typeof(p_template_payload) is distinct from 'object'
    or p_template_payload->>'id' is distinct from p_asset_id or p_template_payload ? 'templatePipelineContext'
  then raise exception 'template_review_invalid'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(p_asset_id,0)) then
    raise exception 'template_review_unavailable' using errcode='55P03'; end if;
  select * into prior from public.cardforge_contributor_asset_submissions where target_registry_asset_id=p_asset_id
    and submission_key=p_submission_key and template_review_context is not null for update nowait;
  if found then
    if prior.template_review_context->'expectedBase' is distinct from p_expected_base
      or prior.template_review_context->>'actorId' is distinct from p_actor_id
      or prior.template_review_context->>'requestFingerprint' is distinct from p_request_fingerprint
      or prior.source_payload is distinct from p_template_payload
    then raise exception 'template_review_conflict'; end if;
    return prior.id;
  end if;
  perform 1 from public.cardforge_asset_registry where asset_id=p_asset_id for update nowait;
  select * into b from public.cardforge_contributor_asset_submissions
    where id=(select contributor_submission_id from public.cardforge_asset_registry where asset_id=p_asset_id) for update nowait;
  perform 1 from public.cardforge_pipeline_asset_lineages where id=b.lineage_id for update nowait;
  snapshot:=public.cardforge_read_template_review_base(p_asset_id);
  if p_expected_base is distinct from snapshot->'expectedBase' then raise exception 'template_review_conflict'; end if;
  select * into allocated from public.cardforge_allocate_template_revision(p_asset_id);
  if allocated.lineage_id is distinct from b.lineage_id then raise exception 'template_review_conflict'; end if;
  insert into public.cardforge_contributor_asset_submissions(
    lineage_id,contributor_id,contributor_email,asset_type,name,description,preview_url,source_url,
    source_file_size_bytes,source_mime_type,source_storage_bucket,source_storage_path,
    requested_studio_destination,specialty_tags,use_case_tags,semantic_role,visual_family,variant_kind,variant_label,compatibility_tags,source_notes,
    status,automated_status,calculated_access_tier,automated_access_tier,source_payload,
    target_registry_asset_id,base_revision_number,revision_number,submission_key,template_review_context,
    editorial_review_status,editorial_review_note,editorial_reviewed_by,editorial_reviewed_at,published_at
  ) values(
    b.lineage_id,b.contributor_id,b.contributor_email,'templates',p_template_payload->>'name',b.description,b.preview_url,b.source_url,
    pg_catalog.octet_length(pg_catalog.convert_to(p_template_payload::text,'UTF8')),'application/json',b.source_storage_bucket,b.source_storage_path,
    b.requested_studio_destination,b.specialty_tags,b.use_case_tags,b.semantic_role,b.visual_family,b.variant_kind,b.variant_label,b.compatibility_tags,b.source_notes,
    'submitted','voting','contributor','contributor',p_template_payload,
    p_asset_id,b.revision_number,allocated.revision_number,p_submission_key,
    pg_catalog.jsonb_build_object('schemaVersion',1,'expectedBase',p_expected_base,'actorId',p_actor_id,'requestFingerprint',p_request_fingerprint),
    'pending','',null,null,null
  ) returning id into candidate_id;
  return candidate_id;
end; $$;

-- Existing submit/direct-publish entry points retain their commitment, but
-- cannot allocate a colliding ordinal or treat a changed keyed request as retry.
create or replace function public.cardforge_submit_template_revision(
  p_asset_id text,p_name text,p_description text,p_contributor_id text,p_contributor_email text,
  p_template_payload jsonb,p_expected_revision integer,p_submission_key text
) returns uuid language plpgsql security invoker set search_path='' as $$
declare current_revision integer; prior public.cardforge_contributor_asset_submissions%rowtype; allocated record; result_id uuid;
begin
  if nullif(pg_catalog.btrim(p_asset_id),'') is null or nullif(pg_catalog.btrim(p_name),'') is null
    or nullif(pg_catalog.btrim(p_contributor_id),'') is null or nullif(pg_catalog.btrim(p_submission_key),'') is null
    or pg_catalog.jsonb_typeof(p_template_payload) is distinct from 'object' or p_expected_revision is null or p_expected_revision<0
  then raise exception 'invalid_template_revision'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(p_asset_id,0)) then
    raise exception 'template_review_unavailable' using errcode='55P03'; end if;
  select * into prior from public.cardforge_contributor_asset_submissions where submission_key=p_submission_key
    and contributor_id=p_contributor_id and target_registry_asset_id=p_asset_id for update nowait;
  if found then
    if prior.name is distinct from p_name or prior.description is distinct from coalesce(p_description,'')
      or prior.source_payload is distinct from p_template_payload or prior.base_revision_number is distinct from p_expected_revision
    then raise exception 'template_revision_conflict'; end if;
    return prior.id;
  end if;
  select case when metadata->>'revisionNumber' ~ '^[0-9]+$' then (metadata->>'revisionNumber')::integer else 0 end
    into current_revision from public.cardforge_asset_registry where asset_id=p_asset_id;
  current_revision:=coalesce(current_revision,0);
  if current_revision<>p_expected_revision then raise exception 'template_revision_conflict'; end if;
  select * into allocated from public.cardforge_allocate_template_revision(p_asset_id);
  insert into public.cardforge_contributor_asset_submissions(
    lineage_id,contributor_id,contributor_email,asset_type,name,description,preview_url,source_url,
    source_file_size_bytes,source_mime_type,status,calculated_access_tier,decision_reason,source_payload,
    target_registry_asset_id,base_revision_number,revision_number,submission_key
  ) values(allocated.lineage_id,p_contributor_id,nullif(pg_catalog.btrim(p_contributor_email),''),'templates',p_name,coalesce(p_description,''),
    '/api/templates#'||p_asset_id,'/api/templates#'||p_asset_id,pg_catalog.octet_length(pg_catalog.convert_to(p_template_payload::text,'UTF8')),
    'application/json','submitted','contributor','template_revision_submitted',p_template_payload,
    p_asset_id,current_revision,allocated.revision_number,p_submission_key) returning id into result_id;
  return result_id;
end; $$;

create or replace function public.cardforge_create_template_pipeline_draft(
  p_asset_id text,
  p_name text,
  p_contributor_id text,
  p_contributor_email text,
  p_template_payload jsonb,
  p_submission_key text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing_submission public.cardforge_contributor_asset_submissions%rowtype;
  next_submission_id uuid;
  authored_destination text;
  allocated record;
begin
  if nullif(pg_catalog.btrim(p_asset_id), '') is null
    or nullif(pg_catalog.btrim(p_name), '') is null
    or nullif(pg_catalog.btrim(p_contributor_id), '') is null
    or nullif(pg_catalog.btrim(p_submission_key), '') is null
    or pg_catalog.length(p_submission_key) > 160
    or p_template_payload is null
    or pg_catalog.jsonb_typeof(p_template_payload) <> 'object'
  then
    raise exception 'invalid_template_pipeline_draft';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_asset_id, 0));

  select submission.*
  into existing_submission
  from public.cardforge_contributor_asset_submissions as submission
  where submission.contributor_id = p_contributor_id
    and submission.target_registry_asset_id = p_asset_id
    and submission.submission_key = p_submission_key
  limit 1;

  if found then
    if existing_submission.source_payload is distinct from p_template_payload or existing_submission.name is distinct from p_name then
      raise exception 'template_revision_conflict';
    end if;
    return existing_submission.id;
  end if;

  if exists (
    select 1 from public.cardforge_asset_registry as registry where registry.asset_id = p_asset_id
  ) then
    raise exception 'template_asset_exists';
  end if;

  authored_destination := case
    when p_template_payload ->> 'templateUsage' = 'back-preset' then 'template.back'
    else null
  end;

  select submission.*
  into existing_submission
  from public.cardforge_contributor_asset_submissions as submission
  where submission.contributor_id = p_contributor_id
    and submission.target_registry_asset_id = p_asset_id
    and submission.status = 'draft'
    and submission.trashed_at is null and submission.purge_state is null
  order by submission.updated_at desc
  limit 1
  for update;

  if found then
    update public.cardforge_contributor_asset_submissions
    set
      contributor_email = nullif(pg_catalog.btrim(p_contributor_email), ''),
      name = p_name,
      preview_url = '/api/templates#' || p_asset_id,
      source_url = '/api/templates#' || p_asset_id,
      source_file_size_bytes = pg_catalog.octet_length(pg_catalog.convert_to(p_template_payload::text, 'UTF8')),
      source_payload = p_template_payload,
      submission_key = p_submission_key,
      requested_studio_destination = coalesce(requested_studio_destination, authored_destination),
      decision_reason = 'template_pipeline_draft'
    where id = existing_submission.id;
    return existing_submission.id;
  end if;

  select * into allocated from public.cardforge_allocate_template_revision(p_asset_id);
  insert into public.cardforge_contributor_asset_submissions (
    lineage_id,
    contributor_id,
    contributor_email,
    asset_type,
    name,
    description,
    preview_url,
    source_url,
    source_file_size_bytes,
    source_mime_type,
    status,
    automated_status,
    calculated_access_tier,
    automated_access_tier,
    decision_reason,
    source_payload,
    target_registry_asset_id,
    base_revision_number,
    revision_number,
    submission_key,
    requested_studio_destination,
    specialty_tags,
    use_case_tags,
    source_notes
  ) values (
    allocated.lineage_id,
    p_contributor_id,
    nullif(pg_catalog.btrim(p_contributor_email), ''),
    'templates',
    p_name,
    '',
    '/api/templates#' || p_asset_id,
    '/api/templates#' || p_asset_id,
    pg_catalog.octet_length(pg_catalog.convert_to(p_template_payload::text, 'UTF8')),
    'application/json',
    'draft',
    'voting',
    'contributor',
    'contributor',
    'template_pipeline_draft',
    p_template_payload,
    p_asset_id,
    0,
    allocated.revision_number,
    p_submission_key,
    authored_destination,
    '{}'::text[],
    '{}'::text[],
    ''
  )
  returning id into next_submission_id;

  return next_submission_id;
end;
$$;

create function public.cardforge_guard_template_review_revision()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if old.template_review_context is not null then
    if new.owner_status_override='published' and old.owner_status_override is distinct from 'published'
      and old.editorial_review_status<>'approved' then raise exception 'template_review_editorial_required'; end if;
    if row(new.template_review_context,new.source_payload,new.contributor_id,new.contributor_email,new.asset_type,
      new.name,new.description,new.preview_url,new.source_url,new.source_file_size_bytes,new.source_mime_type,
      new.source_storage_bucket,new.source_storage_path,new.lineage_id,new.revision_number,new.base_revision_number,
      new.target_registry_asset_id,new.submission_key,new.source_notes,new.requested_studio_destination)
      is distinct from row(old.template_review_context,old.source_payload,old.contributor_id,old.contributor_email,old.asset_type,
      old.name,old.description,old.preview_url,old.source_url,old.source_file_size_bytes,old.source_mime_type,
      old.source_storage_bucket,old.source_storage_path,old.lineage_id,old.revision_number,old.base_revision_number,
      old.target_registry_asset_id,old.submission_key,old.source_notes,old.requested_studio_destination)
    then raise exception 'template_review_immutable'; end if;
    if row(new.specialty_tags,new.use_case_tags,new.semantic_role,new.visual_family,new.variant_kind,new.variant_label,new.compatibility_tags)
      is distinct from row(old.specialty_tags,old.use_case_tags,old.semantic_role,old.visual_family,old.variant_kind,old.variant_label,old.compatibility_tags)
      and not(old.status='published' and new.status='published' and exists(select 1 from public.cardforge_asset_registry r where r.contributor_submission_id=old.id and r.status='published'))
    then raise exception 'template_review_immutable'; end if;
  end if;
  return new;
end; $$;
create trigger cardforge_00_template_review_guard before update on public.cardforge_contributor_asset_submissions
  for each row execute function public.cardforge_guard_template_review_revision();

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
  template_registry public.cardforge_asset_registry%rowtype;
  template_base jsonb;
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

  if submission.asset_type='templates' and submission.template_review_context is null
    and submission.status='published' and current_active_submission_id=submission.id
    and exists(select 1 from public.cardforge_asset_registry r where r.asset_id=next_registry_asset_id and r.access_tier=submission.calculated_access_tier)
    and exists(select 1 from public.cardforge_contributor_asset_submissions c
      where c.template_review_context->'expectedBase'->>'parentSubmissionId'=submission.id::text
        and c.purge_state is null and c.trashed_at is null
        and c.template_review_context->'expectedBase'->>'parentContentVersion'=public.cardforge_media_parent_content_version(submission.id)
        and c.template_review_context->'expectedBase'->>'registryContentVersion'=public.cardforge_media_registry_content_version(next_registry_asset_id))
  then return next_registry_asset_id; end if;

  if submission.template_review_context is not null and submission.status='published' then
    select * into template_registry from public.cardforge_asset_registry where asset_id=next_registry_asset_id for update nowait;
    if template_registry.contributor_submission_id is distinct from submission.id then
      if submission.editorial_review_status<>'approved' then raise exception 'template_review_editorial_required'; end if;
      template_base:=public.cardforge_read_template_review_base(next_registry_asset_id);
      -- Ordinal allocation advances high-water, not the authored/source lease.
      if ((submission.template_review_context->'expectedBase')-'revisionHighWater')
        is distinct from ((template_base->'expectedBase')-'revisionHighWater')
      then raise exception 'template_review_conflict'; end if;
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

    registry_library_source := case when submission.template_review_context is not null then template_registry.library_source
      when submission.media_presentation is not null then media_registry.library_source
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
      when p_update_status_override and p_status_override = 'published' and media_presentation is null and template_review_context is null then 'approved'
      else editorial_review_status
    end,
    editorial_review_note = case
      when p_update_status_override and p_status_override = 'published' and media_presentation is null and template_review_context is null then pg_catalog.btrim(p_owner_note)
      else editorial_review_note
    end,
    editorial_reviewed_by = case
      when p_update_status_override and p_status_override = 'published' and media_presentation is null and template_review_context is null then pg_catalog.btrim(p_owner_contributor_id)
      else editorial_reviewed_by
    end,
    editorial_reviewed_at = case
      when p_update_status_override and p_status_override = 'published' and media_presentation is null and template_review_context is null then pg_catalog.now()
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


revoke execute on function public.cardforge_read_template_review_base(text) from public,anon,authenticated;
grant execute on function public.cardforge_read_template_review_base(text) to service_role;
revoke execute on function public.cardforge_allocate_template_revision(text) from public,anon,authenticated;
grant execute on function public.cardforge_allocate_template_revision(text) to service_role;
revoke execute on function public.cardforge_read_template_review_receipt(text,text,text) from public,anon,authenticated;
grant execute on function public.cardforge_read_template_review_receipt(text,text,text) to service_role;
revoke execute on function public.cardforge_create_template_review_revision(text,jsonb,jsonb,text,text,text) from public,anon,authenticated;
grant execute on function public.cardforge_create_template_review_revision(text,jsonb,jsonb,text,text,text) to service_role;
revoke execute on function public.cardforge_guard_template_review_revision() from public,anon,authenticated;
commit;
