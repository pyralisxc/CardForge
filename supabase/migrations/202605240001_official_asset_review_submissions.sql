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
  registry_asset_id,
  status,
  calculated_access_tier,
  owner_access_tier_override,
  quality_score,
  tier_decision_reason,
  decision_reason,
  positive_votes,
  negative_votes
)
select
  'cardforge-official',
  null,
  case registry.asset_type
    when 'template' then 'templates'
    when 'elementPreset' then 'elementPresets'
    when 'texture' then 'textures'
    when 'divider' then 'dividers'
    when 'icon' then 'icons'
    when 'image' then 'imageAssets'
    else 'parts'
  end,
  registry.name,
  coalesce(registry.metadata->>'description', 'Official CardForge default asset seeded for continuous developer review.'),
  coalesce(registry.preview_url, registry.url),
  registry.url,
  registry.file_size_bytes,
  registry.metadata->>'sourceMimeType',
  registry.storage_bucket,
  registry.storage_path,
  registry.asset_id,
  registry.status,
  case
    when registry.access_tier in ('hidden', 'free', 'paid', 'developer', 'official') then registry.access_tier
    else 'official'
  end,
  case
    when registry.access_tier in ('hidden', 'free', 'paid', 'official') then registry.access_tier
    else null
  end,
  0,
  case
    when registry.access_tier in ('hidden', 'free', 'paid', 'official') then concat('owner_forced_', registry.access_tier)
    else 'developer_review'
  end,
  'official_default_seed',
  0,
  0
from public.cardforge_asset_registry registry
where registry.library_source = 'official'
  and registry.asset_type in ('template', 'elementPreset', 'texture', 'divider', 'part', 'icon', 'image')
  and not exists (
    select 1
    from public.cardforge_developer_asset_submissions existing
    where existing.registry_asset_id = registry.asset_id
  );

update public.cardforge_asset_registry registry
set developer_submission_id = submission.id
from public.cardforge_developer_asset_submissions submission
where submission.registry_asset_id = registry.asset_id
  and registry.library_source = 'official'
  and registry.developer_submission_id is null;
