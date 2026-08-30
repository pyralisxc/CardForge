begin;

set local lock_timeout = '5s';

-- Bootstrap content is owner-curated before it has Contributor vote history.
-- Its initial tier therefore travels with the bootstrap metadata, while every
-- later owner or voting decision remains authoritative and survives re-sync.
drop trigger if exists cardforge_pipeline_owner_edit_override
  on public.cardforge_developer_asset_submissions;
drop function if exists public.cardforge_apply_pipeline_owner_edit_override();

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
  bootstrap_access_tier text := case
    when p_metadata ->> 'bootstrapAccessTier' in ('free', 'paid', 'developer')
      then p_metadata ->> 'bootstrapAccessTier'
    else 'free'
  end;
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
      automated_status,
      owner_status_override,
      calculated_access_tier,
      automated_access_tier,
      owner_access_tier_override,
      decision_reason,
      tier_decision_reason
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
    bootstrap_access_tier,
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
) is 'Atomically imports bootstrap Pipeline content with an explicit initial access tier while preserving later voting and owner decisions.';

with paid_bootstrap_assets(asset_id) as (
  values
    ('arcane-forge-back-obsidian-neon-premium'),
    ('arcane-forge-frame-creature-premium'),
    ('arcane-forge-frame-playing-premium'),
    ('arcane-forge-frame-ttrpg-premium'),
    ('default-obsidian-neon-card-back'),
    ('material-obsidian-neon-premium')
)
update public.cardforge_developer_asset_submissions as submission
set
  status = 'published',
  owner_status_override = 'published',
  calculated_access_tier = 'paid',
  owner_access_tier_override = 'paid',
  decision_reason = 'owner_status_override',
  tier_decision_reason = 'owner_forced_paid',
  source_payload = case
    when submission.registry_asset_id = 'default-obsidian-neon-card-back'
      and pg_catalog.jsonb_typeof(submission.source_payload) = 'object'
      then pg_catalog.jsonb_set(submission.source_payload, '{templateAccessTier}', '"paid"'::jsonb, true)
    else submission.source_payload
  end
from paid_bootstrap_assets
where submission.registry_asset_id = paid_bootstrap_assets.asset_id;

with paid_bootstrap_assets(asset_id) as (
  values
    ('arcane-forge-back-obsidian-neon-premium'),
    ('arcane-forge-frame-creature-premium'),
    ('arcane-forge-frame-playing-premium'),
    ('arcane-forge-frame-ttrpg-premium'),
    ('default-obsidian-neon-card-back'),
    ('material-obsidian-neon-premium')
)
update public.cardforge_asset_registry as registry
set
  access_tier = 'paid',
  metadata = case
    when registry.asset_id = 'material-obsidian-neon-premium'
      then pg_catalog.jsonb_set(
        pg_catalog.jsonb_set(registry.metadata, '{bootstrapAccessTier}', '"paid"'::jsonb, true),
        '{style,accessTier}',
        '"paid"'::jsonb,
        true
      )
    else pg_catalog.jsonb_set(
      pg_catalog.jsonb_set(registry.metadata, '{bootstrapAccessTier}', '"paid"'::jsonb, true),
      '{accessTier}',
      '"paid"'::jsonb,
      true
    )
  end
from paid_bootstrap_assets
where registry.asset_id = paid_bootstrap_assets.asset_id
  and registry.status = 'published';

commit;
