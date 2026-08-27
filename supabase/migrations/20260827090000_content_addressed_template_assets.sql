begin;

set local lock_timeout = '5s';

create table if not exists public.cardforge_pipeline_template_assets (
  asset_id text primary key check (asset_id ~ '^[a-f0-9]{64}$'),
  storage_bucket text not null default 'cardforge-developer-assets',
  storage_path text not null unique,
  mime_type text not null check (mime_type = 'image/webp'),
  byte_count bigint not null check (byte_count > 0),
  created_at timestamptz not null default pg_catalog.now()
);

alter table public.cardforge_pipeline_template_assets enable row level security;
revoke all on table public.cardforge_pipeline_template_assets from public, anon, authenticated;
grant select, insert, update, delete on table public.cardforge_pipeline_template_assets to service_role;

comment on table public.cardforge_pipeline_template_assets is
  'Content-addressed WebP media owned once for immutable Forge Pipeline Template revisions.';
comment on column public.cardforge_pipeline_template_assets.asset_id is
  'SHA-256 of the normalized WebP bytes; Template JSON stores cardforge-pipeline-asset:// references.';

-- Older official bootstrap Templates were published before submission revisions became
-- the payload owner. Recover those authored revisions before removing the registry copy.
update public.cardforge_developer_asset_submissions as submission
set
  source_payload = registry.metadata -> 'template',
  source_file_size_bytes = pg_catalog.octet_length(
    pg_catalog.convert_to((registry.metadata -> 'template')::text, 'UTF8')
  )
from public.cardforge_asset_registry as registry
where registry.asset_type = 'template'
  and registry.developer_submission_id = submission.id
  and submission.source_payload is null
  and pg_catalog.jsonb_typeof(registry.metadata -> 'template') = 'object';

-- Registry rows are routing/revision indexes, not a second Template document store.
update public.cardforge_asset_registry
set metadata = pg_catalog.jsonb_strip_nulls(
  (metadata - 'template') || pg_catalog.jsonb_build_object(
    'templateUsage', metadata #>> '{template,templateUsage}',
    'templateOrder', metadata #> '{template,templateOrder}'
  )
)
where asset_type = 'template'
  and metadata ? 'template';

alter table public.cardforge_developer_asset_submissions
  drop constraint if exists cardforge_template_payload_has_no_embedded_media;
alter table public.cardforge_developer_asset_submissions
  add constraint cardforge_template_payload_has_no_embedded_media
  check (
    asset_type <> 'templates'
    or source_payload is null
    or source_payload::text not like '%data:image/%'
  ) not valid;

comment on column public.cardforge_developer_asset_submissions.source_payload is
  'Authoritative immutable structured revision. Binary media is referenced by content hash, never embedded as Base64.';
comment on column public.cardforge_asset_registry.developer_submission_id is
  'Pointer to the active immutable revision; registry metadata must not clone source_payload.';

-- The automatic Pipeline replaced this earlier command path. Keeping both publication
-- owners would allow the retired function to recreate registry payload copies.
drop function if exists public.cardforge_transition_developer_asset(
  uuid, text, text, text, boolean, text, integer, text, jsonb
);

create or replace function public.cardforge_default_studio_destinations(
  p_asset_type text,
  p_metadata jsonb
)
returns text[]
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
    when p_asset_type = 'image'
      and p_metadata ->> 'studioDefaultDestination' in ('image.picture', 'image.frame.front', 'image.frame.back')
      then array[p_metadata ->> 'studioDefaultDestination']::text[]
    when p_asset_type = 'template'
      and coalesce(
        p_metadata ->> 'templateUsage',
        p_metadata -> 'template' ->> 'templateUsage',
        p_metadata -> 'payload' ->> 'templateUsage'
      ) = 'back-preset'
      then array['template.back']::text[]
    when p_asset_type = 'template' then array['template.front']::text[]
    when p_asset_type = 'image' then array['image.picture']::text[]
    when p_asset_type = 'texture' then array['appearance.texture']::text[]
    when p_asset_type = 'divider' then array['element.divider']::text[]
    when p_asset_type = 'icon' then array['element.icon']::text[]
    when p_asset_type = 'font' then array['typography.font']::text[]
    when p_asset_type = 'elementPreset' then case coalesce(
      p_metadata -> 'style' ->> 'kind',
      p_metadata -> 'elementPreset' ->> 'kind',
      p_metadata -> 'payload' ->> 'kind',
      'material'
    )
      when 'border' then array['style.border']::text[]
      when 'textFrame' then array['style.textFrame']::text[]
      when 'shapeRole' then array['style.shape']::text[]
      when 'divider' then array['style.divider']::text[]
      when 'icon' then array['style.icon']::text[]
      else array['style.material']::text[]
    end
    else '{}'::text[]
  end;
$$;

create or replace function public.cardforge_studio_destinations_are_compatible(
  p_asset_type text,
  p_metadata jsonb,
  p_destinations text[]
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select coalesce(p_destinations, '{}'::text[]) <@ case
    when p_asset_type = 'template' then array['template.front', 'template.back']::text[]
    when p_asset_type = 'image' then array['image.picture', 'image.frame.front', 'image.frame.back']::text[]
    when p_asset_type = 'texture' then array['appearance.texture']::text[]
    when p_asset_type = 'divider' then array['element.divider']::text[]
    when p_asset_type = 'icon' then array['element.icon']::text[]
    when p_asset_type = 'font' then array['typography.font']::text[]
    when p_asset_type = 'elementPreset' then public.cardforge_default_studio_destinations(p_asset_type, p_metadata)
    else '{}'::text[]
  end;
$$;

create or replace function public.cardforge_sync_developer_asset_registry(
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
  registry_asset_type text;
  registry_library_source text;
  next_registry_metadata jsonb;
  current_revision integer := 0;
  current_revision_id text;
  current_active_submission_id uuid;
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

  select
    registry.developer_submission_id,
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
      submission.source_payload is null
      or submission.revision_number is null
      or submission.revision_number <= current_revision
    )
  then
    update public.cardforge_developer_asset_submissions
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
    and submission.source_payload is not null
    and submission.revision_number is not null
    and submission.revision_number > current_revision
    and submission.status <> 'published'
  then
    return next_registry_asset_id;
  end if;

  if submission.status = 'published' and nullif(submission.source_url, '') is null then
    raise exception 'developer_asset_source_required';
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
      when 'parts' then pg_catalog.jsonb_build_object(
        'sourceMimeType', submission.source_mime_type,
        'tileMode', 'contain', 'seamless', false,
        'allowedTargets', pg_catalog.jsonb_build_array('imageFrame', 'shape', 'template'),
        'defaultBlendMode', 'normal', 'defaultOpacity', 100, 'defaultScale', 100,
        'partRole', 'ornament', 'defaultWidth', 220, 'defaultHeight', 120
      )
      when 'fonts' then pg_catalog.jsonb_build_object(
        'sourceMimeType', submission.source_mime_type,
        'category', 'Utility', 'fallback', 'serif', 'fontDisplay', 'swap'
      )
      else pg_catalog.jsonb_build_object('sourceMimeType', submission.source_mime_type)
    end;

    registry_library_source := case when submission.source_payload is not null then 'official' else 'developer' end;
    if submission.source_payload is not null then
      if submission.asset_type <> 'templates'
        or submission.base_revision_number is null
        or submission.revision_number is null
      then
        raise exception 'invalid_template_revision';
      end if;

      perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(next_registry_asset_id, 0));
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
      library_source, developer_submission_id, storage_bucket, storage_path,
      file_size_bytes, metadata
    )
    values (
      next_registry_asset_id, submission.name, registry_asset_type,
      submission.source_url, coalesce(nullif(submission.preview_url, ''), submission.source_url),
      'published', submission.calculated_access_tier, registry_library_source,
      submission.id, submission.source_storage_bucket, submission.source_storage_path,
      submission.source_file_size_bytes, next_registry_metadata
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
      metadata = (public.cardforge_asset_registry.metadata - 'template' - 'developerEmail' - 'developerId' - 'revisionAuthor') || excluded.metadata;

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
      end,
      metadata = metadata - 'template' - 'developerEmail' - 'developerId' - 'revisionAuthor'
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
  'Publishes registry index metadata while the linked immutable submission remains the sole structured revision owner.';

commit;
