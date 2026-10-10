begin;
set local lock_timeout = '5s';

-- Extend the single native first-party/Contributor Pipeline import authority.
-- This changes function behavior only; no content rows or storage files.
CREATE OR REPLACE FUNCTION public.cardforge_upsert_pipeline_registry_asset(p_asset_id text, p_name text, p_submission_asset_type text, p_registry_asset_type text, p_url text, p_preview_url text, p_description text, p_contributor_id text, p_contributor_email text, p_file_size_bytes bigint, p_source_mime_type text, p_storage_bucket text, p_storage_path text, p_metadata jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  next_submission_id uuid;
  reviewed_first_party_font boolean :=
    p_registry_asset_type = 'font'
    and p_submission_asset_type = 'fonts'
    and p_asset_id like 'official-%'
    and p_source_mime_type = 'font/ttf'
    and p_storage_bucket = 'cardforge-contributor-assets'
    and p_storage_path like 'owner-defaults/fonts/%'
    and p_metadata ->> 'sourceKind' = 'reviewed-first-party-original'
    and p_metadata ->> 'sourceRepository' = 'https://github.com/google/fonts'
    and p_metadata ->> 'originalFontUnmodified' = 'true'
    and p_metadata ->> 'license' = 'OFL-1.1'
    and p_metadata ->> 'sourceGitBlobSha' ~ '^[a-f0-9]{40}
  bootstrap_access_tier text := case
    when p_metadata ->> 'bootstrapAccessTier' in ('free', 'paid', 'contributor')
      then p_metadata ->> 'bootstrapAccessTier'
    else 'free'
  end;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_asset_id, 0));

  select registry.contributor_submission_id
  into next_submission_id
  from public.cardforge_asset_registry as registry
  where registry.asset_id = p_asset_id
  for update;

  if next_submission_id is null then
    select submission.id
    into next_submission_id
    from public.cardforge_contributor_asset_submissions as submission
    where submission.registry_asset_id = p_asset_id
    order by submission.submitted_at asc
    limit 1
    for update;
  end if;

  if next_submission_id is null then
    insert into public.cardforge_contributor_asset_submissions (
      contributor_id,
      contributor_email,
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
      automated_status,
      owner_status_override,
      calculated_access_tier,
      automated_access_tier,
      owner_access_tier_override,
      decision_reason,
      tier_decision_reason
    )
    values (
      p_contributor_id,
      p_contributor_email,
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
      'published',
      'published',
      bootstrap_access_tier,
      bootstrap_access_tier,
      bootstrap_access_tier,
      'owner_status_override',
      'owner_forced_' || bootstrap_access_tier
    )
    returning id into next_submission_id;
  else
    update public.cardforge_contributor_asset_submissions
    set
      contributor_id = p_contributor_id,
      contributor_email = p_contributor_email,
      asset_type = p_submission_asset_type,
      name = p_name,
      description = p_description,
      preview_url = p_preview_url,
      source_url = p_url,
      source_file_size_bytes = p_file_size_bytes,
      source_mime_type = p_source_mime_type,
      source_storage_bucket = p_storage_bucket,
      source_storage_path = p_storage_path
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
    contributor_submission_id,
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
    bootstrap_access_tier,
    case when reviewed_first_party_font then 'official' else 'contributor' end,
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
    contributor_submission_id = excluded.contributor_submission_id,
    storage_bucket = excluded.storage_bucket,
    storage_path = excluded.storage_path,
    file_size_bytes = excluded.file_size_bytes,
    metadata = excluded.metadata;

  update public.cardforge_contributor_asset_submissions
  set registry_asset_id = p_asset_id
  where id = next_submission_id;

  return next_submission_id;
end;
$function$

    and p_metadata ->> 'licenseGitBlobSha' ~ '^[a-f0-9]{40}
  bootstrap_access_tier text := case
    when p_metadata ->> 'bootstrapAccessTier' in ('free', 'paid', 'contributor')
      then p_metadata ->> 'bootstrapAccessTier'
    else 'free'
  end;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_asset_id, 0));

  select registry.contributor_submission_id
  into next_submission_id
  from public.cardforge_asset_registry as registry
  where registry.asset_id = p_asset_id
  for update;

  if next_submission_id is null then
    select submission.id
    into next_submission_id
    from public.cardforge_contributor_asset_submissions as submission
    where submission.registry_asset_id = p_asset_id
    order by submission.submitted_at asc
    limit 1
    for update;
  end if;

  if next_submission_id is null then
    insert into public.cardforge_contributor_asset_submissions (
      contributor_id,
      contributor_email,
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
      automated_status,
      owner_status_override,
      calculated_access_tier,
      automated_access_tier,
      owner_access_tier_override,
      decision_reason,
      tier_decision_reason
    )
    values (
      p_contributor_id,
      p_contributor_email,
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
      'published',
      'published',
      bootstrap_access_tier,
      bootstrap_access_tier,
      bootstrap_access_tier,
      'owner_status_override',
      'owner_forced_' || bootstrap_access_tier
    )
    returning id into next_submission_id;
  else
    update public.cardforge_contributor_asset_submissions
    set
      contributor_id = p_contributor_id,
      contributor_email = p_contributor_email,
      asset_type = p_submission_asset_type,
      name = p_name,
      description = p_description,
      preview_url = p_preview_url,
      source_url = p_url,
      source_file_size_bytes = p_file_size_bytes,
      source_mime_type = p_source_mime_type,
      source_storage_bucket = p_storage_bucket,
      source_storage_path = p_storage_path
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
    contributor_submission_id,
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
    bootstrap_access_tier,
    'contributor',
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
    contributor_submission_id = excluded.contributor_submission_id,
    storage_bucket = excluded.storage_bucket,
    storage_path = excluded.storage_path,
    file_size_bytes = excluded.file_size_bytes,
    metadata = excluded.metadata;

  update public.cardforge_contributor_asset_submissions
  set registry_asset_id = p_asset_id
  where id = next_submission_id;

  return next_submission_id;
end;
$function$

    and p_metadata ->> 'reviewedBatchDigest' ~ '^[a-f0-9]{64}
  bootstrap_access_tier text := case
    when p_metadata ->> 'bootstrapAccessTier' in ('free', 'paid', 'contributor')
      then p_metadata ->> 'bootstrapAccessTier'
    else 'free'
  end;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_asset_id, 0));

  select registry.contributor_submission_id
  into next_submission_id
  from public.cardforge_asset_registry as registry
  where registry.asset_id = p_asset_id
  for update;

  if next_submission_id is null then
    select submission.id
    into next_submission_id
    from public.cardforge_contributor_asset_submissions as submission
    where submission.registry_asset_id = p_asset_id
    order by submission.submitted_at asc
    limit 1
    for update;
  end if;

  if next_submission_id is null then
    insert into public.cardforge_contributor_asset_submissions (
      contributor_id,
      contributor_email,
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
      automated_status,
      owner_status_override,
      calculated_access_tier,
      automated_access_tier,
      owner_access_tier_override,
      decision_reason,
      tier_decision_reason
    )
    values (
      p_contributor_id,
      p_contributor_email,
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
      'published',
      'published',
      bootstrap_access_tier,
      bootstrap_access_tier,
      bootstrap_access_tier,
      'owner_status_override',
      'owner_forced_' || bootstrap_access_tier
    )
    returning id into next_submission_id;
  else
    update public.cardforge_contributor_asset_submissions
    set
      contributor_id = p_contributor_id,
      contributor_email = p_contributor_email,
      asset_type = p_submission_asset_type,
      name = p_name,
      description = p_description,
      preview_url = p_preview_url,
      source_url = p_url,
      source_file_size_bytes = p_file_size_bytes,
      source_mime_type = p_source_mime_type,
      source_storage_bucket = p_storage_bucket,
      source_storage_path = p_storage_path
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
    contributor_submission_id,
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
    bootstrap_access_tier,
    'contributor',
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
    contributor_submission_id = excluded.contributor_submission_id,
    storage_bucket = excluded.storage_bucket,
    storage_path = excluded.storage_path,
    file_size_bytes = excluded.file_size_bytes,
    metadata = excluded.metadata;

  update public.cardforge_contributor_asset_submissions
  set registry_asset_id = p_asset_id
  where id = next_submission_id;

  return next_submission_id;
end;
$function$
;
  bootstrap_access_tier text := case
    when p_metadata ->> 'bootstrapAccessTier' in ('free', 'paid', 'contributor')
      then p_metadata ->> 'bootstrapAccessTier'
    else 'free'
  end;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_asset_id, 0));

  select registry.contributor_submission_id
  into next_submission_id
  from public.cardforge_asset_registry as registry
  where registry.asset_id = p_asset_id
  for update;

  if next_submission_id is null then
    select submission.id
    into next_submission_id
    from public.cardforge_contributor_asset_submissions as submission
    where submission.registry_asset_id = p_asset_id
    order by submission.submitted_at asc
    limit 1
    for update;
  end if;

  if next_submission_id is null then
    insert into public.cardforge_contributor_asset_submissions (
      contributor_id,
      contributor_email,
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
      automated_status,
      owner_status_override,
      calculated_access_tier,
      automated_access_tier,
      owner_access_tier_override,
      decision_reason,
      tier_decision_reason
    )
    values (
      p_contributor_id,
      p_contributor_email,
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
      'published',
      'published',
      bootstrap_access_tier,
      bootstrap_access_tier,
      bootstrap_access_tier,
      'owner_status_override',
      'owner_forced_' || bootstrap_access_tier
    )
    returning id into next_submission_id;
  else
    update public.cardforge_contributor_asset_submissions
    set
      contributor_id = p_contributor_id,
      contributor_email = p_contributor_email,
      asset_type = p_submission_asset_type,
      name = p_name,
      description = p_description,
      preview_url = p_preview_url,
      source_url = p_url,
      source_file_size_bytes = p_file_size_bytes,
      source_mime_type = p_source_mime_type,
      source_storage_bucket = p_storage_bucket,
      source_storage_path = p_storage_path
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
    contributor_submission_id,
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
    bootstrap_access_tier,
    'contributor',
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
    contributor_submission_id = excluded.contributor_submission_id,
    storage_bucket = excluded.storage_bucket,
    storage_path = excluded.storage_path,
    file_size_bytes = excluded.file_size_bytes,
    metadata = excluded.metadata;

  update public.cardforge_contributor_asset_submissions
  set registry_asset_id = p_asset_id
  where id = next_submission_id;

  return next_submission_id;
end;
$function$;

revoke execute on function public.cardforge_upsert_pipeline_registry_asset(
  text, text, text, text, text, text, text, text, text, bigint, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.cardforge_upsert_pipeline_registry_asset(
  text, text, text, text, text, text, text, text, text, bigint, text, text, text, jsonb
) to service_role;

comment on function public.cardforge_upsert_pipeline_registry_asset(
  text, text, text, text, text, text, text, text, text, text, bigint, text, text, text, jsonb
) is 'Native first-party and Contributor Pipeline import; source-verified OFL original Fonts are official and all other imports/Owner overrides retain their existing behavior.';

commit;
