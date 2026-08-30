begin;

-- A published Set is the existing portable CardForge package promoted through
-- Forge Review. The registry owns discovery and the immutable submission owns
-- the source package; no second starter document or storage lane is introduced.
alter table public.cardforge_developer_asset_submissions
  drop constraint if exists cardforge_developer_asset_submissions_asset_type_check;
alter table public.cardforge_developer_asset_submissions
  add constraint cardforge_developer_asset_submissions_asset_type_check
  check (asset_type in ('templates', 'elementPresets', 'textures', 'dividers', 'icons', 'imageAssets', 'fonts', 'sets'));

alter table public.cardforge_asset_registry
  drop constraint if exists cardforge_asset_registry_asset_type_check;
alter table public.cardforge_asset_registry
  add constraint cardforge_asset_registry_asset_type_check
  check (asset_type in ('texture', 'divider', 'icon', 'image', 'template', 'elementPreset', 'font', 'set'));

update public.cardforge_developer_program_settings
set
  publish_caps_by_type = publish_caps_by_type || '{"sets": 6}'::jsonb,
  tier_caps_by_type = tier_caps_by_type || '{"sets": {"free": 4, "paid": 2}}'::jsonb
where not (publish_caps_by_type ? 'sets')
   or not (tier_caps_by_type ? 'sets');

alter table public.cardforge_developer_program_settings
  alter column publish_caps_by_type set default '{
    "templates": 9,
    "elementPresets": 24,
    "textures": 24,
    "dividers": 24,
    "icons": 30,
    "imageAssets": 24,
    "fonts": 12,
    "sets": 6
  }'::jsonb,
  alter column tier_caps_by_type set default '{
    "templates": { "free": 6, "paid": 3 },
    "elementPresets": { "free": 16, "paid": 8 },
    "textures": { "free": 16, "paid": 8 },
    "dividers": { "free": 16, "paid": 8 },
    "icons": { "free": 20, "paid": 10 },
    "imageAssets": { "free": 16, "paid": 8 },
    "fonts": { "free": 8, "paid": 4 },
    "sets": { "free": 4, "paid": 2 }
  }'::jsonb;

alter function public.cardforge_sync_developer_asset_registry(uuid)
  rename to cardforge_sync_studio_asset_registry;

revoke execute on function public.cardforge_sync_studio_asset_registry(uuid)
  from public, anon, authenticated;
grant execute on function public.cardforge_sync_studio_asset_registry(uuid)
  to service_role;

create function public.cardforge_sync_developer_asset_registry(
  p_submission_id uuid
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  submission public.cardforge_developer_asset_submissions%rowtype;
  next_registry_asset_id text;
  next_registry_metadata jsonb;
begin
  select *
  into submission
  from public.cardforge_developer_asset_submissions
  where id = p_submission_id
  for update;

  if not found then
    raise exception 'developer_asset_not_found';
  end if;

  if submission.asset_type <> 'sets' then
    return public.cardforge_sync_studio_asset_registry(p_submission_id);
  end if;

  next_registry_asset_id := coalesce(
    submission.target_registry_asset_id,
    submission.registry_asset_id,
    'developer-sets-' || submission.id::text
  );

  if submission.status = 'published' then
    if nullif(submission.source_url, '') is null
      or submission.source_mime_type not in ('application/vnd.cardforge.project+zip', 'application/octet-stream')
    then
      raise exception 'published_set_package_required';
    end if;

    next_registry_metadata := pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'description', submission.description,
      'revisionNumber', coalesce(submission.revision_number, 1),
      'revisionId', submission.id,
      'revisionPublishedAt', coalesce(submission.published_at, pg_catalog.now()),
      'specialtyTags', to_jsonb(submission.specialty_tags),
      'useCaseTags', to_jsonb(submission.use_case_tags),
      'sourceMimeType', submission.source_mime_type,
      'portableProject', true
    ));

    insert into public.cardforge_asset_registry (
      asset_id, name, asset_type, url, preview_url, status, access_tier,
      library_source, developer_submission_id, storage_bucket, storage_path,
      file_size_bytes, metadata, specialty_tags, use_case_tags,
      studio_destinations, studio_routing_mode
    )
    values (
      next_registry_asset_id, submission.name, 'set', submission.source_url,
      nullif(submission.preview_url, ''), 'published', submission.calculated_access_tier,
      'developer', submission.id, submission.source_storage_bucket,
      submission.source_storage_path, submission.source_file_size_bytes,
      next_registry_metadata, submission.specialty_tags, submission.use_case_tags,
      '{}'::text[], 'automatic'
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
      metadata = excluded.metadata,
      specialty_tags = excluded.specialty_tags,
      use_case_tags = excluded.use_case_tags,
      studio_destinations = '{}'::text[],
      studio_routing_mode = 'automatic';

    update public.cardforge_developer_asset_submissions
    set registry_asset_id = next_registry_asset_id
    where id = submission.id;
  elsif submission.registry_asset_id is not null then
    update public.cardforge_asset_registry
    set
      status = submission.status,
      access_tier = case
        when submission.status in ('archived', 'rejected') then 'hidden'
        else 'developer'
      end
    where asset_id = submission.registry_asset_id;
  end if;

  return next_registry_asset_id;
end;
$$;

revoke execute on function public.cardforge_sync_developer_asset_registry(uuid)
  from public, anon, authenticated;
grant execute on function public.cardforge_sync_developer_asset_registry(uuid)
  to service_role;

comment on function public.cardforge_sync_developer_asset_registry(uuid) is
  'Routes Studio assets through the existing registry sync and publishes portable Set packages without duplicating their document or storage model.';

commit;
