begin;

set local lock_timeout = '5s';

alter table public.cardforge_developer_asset_submissions
  add column if not exists source_payload jsonb,
  add column if not exists target_registry_asset_id text,
  add column if not exists base_revision_number integer check (base_revision_number is null or base_revision_number >= 0),
  add column if not exists revision_number integer check (revision_number is null or revision_number > 0),
  add column if not exists submission_key text,
  add column if not exists published_at timestamptz;

create unique index if not exists cardforge_developer_asset_submission_key_idx
  on public.cardforge_developer_asset_submissions (
    developer_id,
    target_registry_asset_id,
    submission_key
  )
  where submission_key is not null;

create index if not exists cardforge_template_revision_target_idx
  on public.cardforge_developer_asset_submissions (target_registry_asset_id, revision_number desc)
  where asset_type = 'templates' and source_payload is not null;

create or replace function public.cardforge_submit_template_revision(
  p_asset_id text,
  p_name text,
  p_description text,
  p_developer_id text,
  p_developer_email text,
  p_template_payload jsonb,
  p_expected_revision integer,
  p_submission_key text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_revision integer := 0;
  existing_submission_id uuid;
  next_submission_id uuid;
begin
  if nullif(pg_catalog.btrim(p_asset_id), '') is null
    or nullif(pg_catalog.btrim(p_name), '') is null
    or nullif(pg_catalog.btrim(p_developer_id), '') is null
    or nullif(pg_catalog.btrim(p_submission_key), '') is null
    or p_template_payload is null
    or pg_catalog.jsonb_typeof(p_template_payload) <> 'object'
  then
    raise exception 'invalid_template_revision';
  end if;

  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'invalid_template_revision';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_asset_id, 0));

  select submission.id
  into existing_submission_id
  from public.cardforge_developer_asset_submissions as submission
  where submission.submission_key = p_submission_key
    and submission.developer_id = p_developer_id
    and submission.target_registry_asset_id = p_asset_id
  limit 1;

  if existing_submission_id is not null then
    return existing_submission_id;
  end if;

  select case
    when registry.metadata ->> 'revisionNumber' ~ '^[0-9]+$'
      then (registry.metadata ->> 'revisionNumber')::integer
    else 0
  end
  into current_revision
  from public.cardforge_asset_registry as registry
  where registry.asset_id = p_asset_id;

  current_revision := coalesce(current_revision, 0);
  if current_revision <> p_expected_revision then
    raise exception 'template_revision_conflict';
  end if;

  insert into public.cardforge_developer_asset_submissions (
    developer_id,
    developer_email,
    asset_type,
    name,
    description,
    preview_url,
    source_url,
    source_file_size_bytes,
    source_mime_type,
    status,
    calculated_access_tier,
    decision_reason,
    source_payload,
    target_registry_asset_id,
    base_revision_number,
    revision_number,
    submission_key
  )
  values (
    p_developer_id,
    nullif(pg_catalog.btrim(p_developer_email), ''),
    'templates',
    p_name,
    coalesce(p_description, ''),
    '/api/templates#' || p_asset_id,
    '/api/templates#' || p_asset_id,
    pg_catalog.octet_length(pg_catalog.convert_to(p_template_payload::text, 'UTF8')),
    'application/json',
    'submitted',
    'developer',
    'template_revision_submitted',
    p_template_payload,
    p_asset_id,
    current_revision,
    current_revision + 1,
    p_submission_key
  )
  returning id into next_submission_id;

  return next_submission_id;
end;
$$;

revoke execute on function public.cardforge_submit_template_revision(
  text, text, text, text, text, jsonb, integer, text
) from public, anon, authenticated;
grant execute on function public.cardforge_submit_template_revision(
  text, text, text, text, text, jsonb, integer, text
) to service_role;

comment on function public.cardforge_submit_template_revision(
  text, text, text, text, text, jsonb, integer, text
) is 'Creates one idempotent, optimistic-concurrency-protected template revision for owner review.';

create or replace function public.cardforge_transition_developer_asset(
  p_submission_id uuid,
  p_status text,
  p_owner_note text,
  p_owner_access_tier_override text,
  p_has_owner_access_tier_override boolean,
  p_calculated_access_tier text,
  p_quality_score integer,
  p_tier_decision_reason text,
  p_registry_metadata jsonb
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  submission public.cardforge_developer_asset_submissions%rowtype;
  next_registry_asset_id text;
  registry_asset_type text;
  registry_access_tier text;
  registry_library_source text;
  next_registry_metadata jsonb;
  current_revision integer := 0;
begin
  select *
  into submission
  from public.cardforge_developer_asset_submissions
  where id = p_submission_id
  for update;

  if not found then
    raise exception 'developer_asset_not_found';
  end if;

  next_registry_asset_id := coalesce(
    submission.target_registry_asset_id,
    submission.registry_asset_id,
    'developer-' || submission.asset_type || '-' || submission.id::text
  );

  registry_asset_type := case submission.asset_type
    when 'templates' then 'template'
    when 'elementPresets' then 'elementPreset'
    when 'textures' then 'texture'
    when 'dividers' then 'divider'
    when 'icons' then 'icon'
    when 'imageAssets' then 'image'
    when 'fonts' then 'font'
    else 'part'
  end;

  if p_status = 'published' and nullif(submission.source_url, '') is null then
    raise exception 'developer_asset_source_required';
  end if;

  if p_status = 'published' and submission.source_payload is not null then
    if submission.asset_type <> 'templates'
      or submission.base_revision_number is null
      or submission.revision_number is null
    then
      raise exception 'invalid_template_revision';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(next_registry_asset_id, 0));
    select case
      when registry.metadata ->> 'revisionNumber' ~ '^[0-9]+$'
        then (registry.metadata ->> 'revisionNumber')::integer
      else 0
    end
    into current_revision
    from public.cardforge_asset_registry as registry
    where registry.asset_id = next_registry_asset_id;

    current_revision := coalesce(current_revision, 0);
    if current_revision <> submission.base_revision_number then
      raise exception 'template_revision_conflict';
    end if;
  end if;

  update public.cardforge_developer_asset_submissions
  set
    status = p_status,
    owner_note = coalesce(p_owner_note, ''),
    owner_access_tier_override = case
      when p_has_owner_access_tier_override then p_owner_access_tier_override
      else owner_access_tier_override
    end,
    calculated_access_tier = p_calculated_access_tier,
    quality_score = p_quality_score,
    tier_decision_reason = p_tier_decision_reason,
    decision_reason = p_status,
    published_at = case when p_status = 'published' then pg_catalog.now() else published_at end
  where id = p_submission_id;

  if p_status = 'published' then
    registry_access_tier := case when submission.source_payload is not null then 'free' else p_calculated_access_tier end;
    registry_library_source := case when submission.source_payload is not null then 'official' else 'developer' end;
    next_registry_metadata := coalesce(p_registry_metadata, '{}'::jsonb);
    if submission.source_payload is not null then
      next_registry_metadata := next_registry_metadata || pg_catalog.jsonb_build_object(
        'template', submission.source_payload,
        'revisionNumber', submission.revision_number,
        'revisionId', submission.id,
        'revisionAuthor', coalesce(submission.developer_email, submission.developer_id),
        'revisionPublishedAt', pg_catalog.now()
      );
    end if;

    insert into public.cardforge_asset_registry (
      asset_id,
      name,
      asset_type,
      url,
      preview_url,
      status,
      access_tier,
      library_source,
      developer_submission_id,
      storage_bucket,
      storage_path,
      file_size_bytes,
      metadata
    )
    values (
      next_registry_asset_id,
      submission.name,
      registry_asset_type,
      submission.source_url,
      coalesce(nullif(submission.preview_url, ''), submission.source_url),
      'published',
      registry_access_tier,
      registry_library_source,
      submission.id,
      submission.source_storage_bucket,
      submission.source_storage_path,
      submission.source_file_size_bytes,
      next_registry_metadata
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
      developer_submission_id = excluded.developer_submission_id,
      storage_bucket = excluded.storage_bucket,
      storage_path = excluded.storage_path,
      file_size_bytes = excluded.file_size_bytes,
      metadata = public.cardforge_asset_registry.metadata || excluded.metadata;

    update public.cardforge_developer_asset_submissions
    set registry_asset_id = next_registry_asset_id
    where id = p_submission_id;
  elsif submission.source_payload is null and submission.registry_asset_id is not null then
    update public.cardforge_asset_registry
    set
      status = p_status,
      access_tier = case
        when p_status in ('archived', 'rejected') then 'hidden'
        when p_calculated_access_tier = 'hidden' then 'hidden'
        else 'developer'
      end
    where asset_id = submission.registry_asset_id;
  end if;

  return next_registry_asset_id;
end;
$$;

revoke execute on function public.cardforge_transition_developer_asset(
  uuid, text, text, text, boolean, text, integer, text, jsonb
) from public, anon, authenticated;
grant execute on function public.cardforge_transition_developer_asset(
  uuid, text, text, text, boolean, text, integer, text, jsonb
) to service_role;

comment on function public.cardforge_transition_developer_asset(
  uuid, text, text, text, boolean, text, integer, text, jsonb
) is 'Atomically owns asset review, template revision publication, and shared registry visibility.';

commit;
