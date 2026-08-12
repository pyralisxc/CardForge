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
    decision_reason = p_status
  where id = p_submission_id;

  if p_status = 'published' then
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
      p_calculated_access_tier,
      'developer',
      submission.id,
      submission.source_storage_bucket,
      submission.source_storage_path,
      submission.source_file_size_bytes,
      coalesce(p_registry_metadata, '{}'::jsonb)
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
  elsif submission.registry_asset_id is not null then
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
) is 'Atomically owns developer submission status and shared registry visibility.';

create or replace function public.cardforge_upsert_pipeline_registry_asset(
  p_asset_id text,
  p_name text,
  p_submission_asset_type text,
  p_registry_asset_type text,
  p_url text,
  p_preview_url text,
  p_description text,
  p_developer_id text,
  p_developer_email text,
  p_file_size_bytes bigint,
  p_source_mime_type text,
  p_storage_bucket text,
  p_storage_path text,
  p_metadata jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  next_submission_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_asset_id, 0));

  select registry.developer_submission_id
  into next_submission_id
  from public.cardforge_asset_registry as registry
  where registry.asset_id = p_asset_id
  for update;

  if next_submission_id is null then
    select submission.id
    into next_submission_id
    from public.cardforge_developer_asset_submissions as submission
    where submission.registry_asset_id = p_asset_id
    order by submission.submitted_at asc
    limit 1
    for update;
  end if;

  if next_submission_id is null then
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
      source_storage_bucket,
      source_storage_path,
      status,
      calculated_access_tier,
      owner_access_tier_override,
      decision_reason
    )
    values (
      p_developer_id,
      p_developer_email,
      p_submission_asset_type,
      p_name,
      p_description,
      p_preview_url,
      p_url,
      p_file_size_bytes,
      p_source_mime_type,
      p_storage_bucket,
      p_storage_path,
      'published',
      'free',
      null,
      'pipeline_owner_edit'
    )
    returning id into next_submission_id;
  else
    update public.cardforge_developer_asset_submissions
    set
      developer_id = p_developer_id,
      developer_email = p_developer_email,
      asset_type = p_submission_asset_type,
      name = p_name,
      description = p_description,
      preview_url = p_preview_url,
      source_url = p_url,
      source_file_size_bytes = p_file_size_bytes,
      source_mime_type = p_source_mime_type,
      source_storage_bucket = p_storage_bucket,
      source_storage_path = p_storage_path,
      status = 'published',
      calculated_access_tier = 'free',
      owner_access_tier_override = null,
      decision_reason = 'pipeline_owner_edit'
    where id = next_submission_id;
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
    p_asset_id,
    p_name,
    p_registry_asset_type,
    p_url,
    p_preview_url,
    'published',
    'free',
    'developer',
    next_submission_id,
    p_storage_bucket,
    p_storage_path,
    p_file_size_bytes,
    coalesce(p_metadata, '{}'::jsonb)
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
    metadata = excluded.metadata;

  update public.cardforge_developer_asset_submissions
  set registry_asset_id = p_asset_id
  where id = next_submission_id;

  return next_submission_id;
end;
$$;

revoke execute on function public.cardforge_upsert_pipeline_registry_asset(
  text, text, text, text, text, text, text, text, text, bigint, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.cardforge_upsert_pipeline_registry_asset(
  text, text, text, text, text, text, text, text, text, bigint, text, text, text, jsonb
) to service_role;

comment on function public.cardforge_upsert_pipeline_registry_asset(
  text, text, text, text, text, text, text, text, text, bigint, text, text, text, jsonb
) is 'Atomically owns Forge Pipeline submission and shared registry persistence.';

create or replace function public.cardforge_archive_pipeline_registry_asset(p_asset_id text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  linked_submission_id uuid;
begin
  select registry.developer_submission_id
  into linked_submission_id
  from public.cardforge_asset_registry as registry
  where registry.asset_id = p_asset_id
  for update;

  if not found then
    raise exception 'pipeline_asset_not_found';
  end if;

  update public.cardforge_developer_asset_submissions
  set
    status = 'archived',
    calculated_access_tier = 'hidden',
    decision_reason = 'owner_deleted_from_library'
  where registry_asset_id = p_asset_id
    or id = linked_submission_id;

  update public.cardforge_asset_registry
  set
    status = 'archived',
    access_tier = 'hidden'
  where asset_id = p_asset_id;

  return true;
end;
$$;

revoke execute on function public.cardforge_archive_pipeline_registry_asset(text)
  from public, anon, authenticated;
grant execute on function public.cardforge_archive_pipeline_registry_asset(text)
  to service_role;

comment on function public.cardforge_archive_pipeline_registry_asset(text)
  is 'Atomically hides a Forge Pipeline asset and its review submission.';
