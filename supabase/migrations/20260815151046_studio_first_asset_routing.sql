begin;

alter table public.cardforge_asset_registry
  add column if not exists studio_destinations text[] not null default '{}'::text[],
  add column if not exists studio_sort_order integer not null default 100,
  add column if not exists studio_featured boolean not null default false,
  add column if not exists studio_routing_mode text not null default 'automatic';

alter table public.cardforge_developer_asset_submissions
  add column if not exists requested_studio_destination text;

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
    when p_asset_type = 'part' then case
      when coalesce(p_metadata ->> 'partRole', '') in ('titlePlate', 'rulesBox', 'panel')
        then array['element.divider']::text[]
      else array['element.icon']::text[]
    end
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
    when p_asset_type = 'template' then public.cardforge_default_studio_destinations(p_asset_type, p_metadata)
    when p_asset_type = 'image' then array['image.picture', 'image.frame.front', 'image.frame.back']::text[]
    when p_asset_type = 'texture' then array['appearance.texture']::text[]
    when p_asset_type = 'divider' then array['element.divider']::text[]
    when p_asset_type = 'icon' then array['element.icon']::text[]
    when p_asset_type = 'font' then array['typography.font']::text[]
    when p_asset_type = 'part' then array['element.icon', 'element.divider']::text[]
    when p_asset_type = 'elementPreset' then public.cardforge_default_studio_destinations(p_asset_type, p_metadata)
    else '{}'::text[]
  end;
$$;

revoke execute on function public.cardforge_default_studio_destinations(text, jsonb)
  from public, anon, authenticated;
grant execute on function public.cardforge_default_studio_destinations(text, jsonb)
  to service_role;
revoke execute on function public.cardforge_studio_destinations_are_compatible(text, jsonb, text[])
  from public, anon, authenticated;
grant execute on function public.cardforge_studio_destinations_are_compatible(text, jsonb, text[])
  to service_role;

create temporary table cardforge_studio_asset_reclassification
on commit drop
as
select
  registry.asset_id,
  case
    when registry.asset_type = 'texture' then 'image'
    when coalesce(registry.metadata ->> 'partRole', '') in ('corner', 'statGem', 'ornament', 'overlay')
      or registry.name ilike '%corner%'
      or registry.name ilike '%gem%'
      then 'icon'
    else 'divider'
  end as next_registry_type,
  case
    when registry.asset_type = 'texture' then 'imageAssets'
    when coalesce(registry.metadata ->> 'partRole', '') in ('corner', 'statGem', 'ornament', 'overlay')
      or registry.name ilike '%corner%'
      or registry.name ilike '%gem%'
      then 'icons'
    else 'dividers'
  end as next_submission_type,
  case
    when registry.asset_id like 'arcane-forge-frame-%' then array['image.frame.front']::text[]
    when registry.asset_id like 'arcane-forge-back-%' then array['image.frame.back']::text[]
    when coalesce(registry.metadata ->> 'partRole', '') in ('corner', 'statGem', 'ornament', 'overlay')
      or registry.name ilike '%corner%'
      or registry.name ilike '%gem%'
      then array['element.icon']::text[]
    else array['element.divider']::text[]
  end as studio_destinations
from public.cardforge_asset_registry as registry
where registry.asset_type = 'part'
  or (
    registry.asset_type = 'icon'
    and registry.asset_id in (
      'arcane-forge-ember-title-plate',
      'arcane-forge-rules-vellum-panel'
    )
    and registry.metadata ->> 'sourceKind' = 'pipeline-owner-import'
    and registry.studio_routing_mode = 'automatic'
  )
  or (
    registry.asset_type = 'texture'
    and (
      registry.asset_id like 'arcane-forge-frame-%'
      or registry.asset_id like 'arcane-forge-back-%'
    )
  );

update public.cardforge_asset_registry as registry
set
  asset_type = reclassification.next_registry_type,
  studio_destinations = reclassification.studio_destinations,
  studio_routing_mode = 'automatic',
  metadata = case reclassification.next_registry_type
    when 'image' then (registry.metadata - 'partRole') || pg_catalog.jsonb_build_object(
      'tileMode', 'contain',
      'seamless', false,
      'allowedTargets', pg_catalog.jsonb_build_array('template', 'imageFrame'),
      'defaultBlendMode', 'normal',
      'defaultOpacity', 100,
      'defaultScale', 100,
      'studioDefaultDestination', reclassification.studio_destinations[1]
    )
    when 'icon' then (registry.metadata - 'partRole') || pg_catalog.jsonb_build_object(
      'tileMode', 'contain',
      'seamless', false,
      'allowedTargets', pg_catalog.jsonb_build_array('icon'),
      'defaultBlendMode', 'normal',
      'defaultOpacity', 100,
      'defaultScale', 100,
      'defaultWidth', case
        when coalesce(registry.metadata ->> 'defaultWidth', '') ~ '^[0-9]+(?:\.[0-9]+)?$'
          then (registry.metadata ->> 'defaultWidth')::numeric
        else 64
      end,
      'defaultHeight', case
        when coalesce(registry.metadata ->> 'defaultHeight', '') ~ '^[0-9]+(?:\.[0-9]+)?$'
          then (registry.metadata ->> 'defaultHeight')::numeric
        else 64
      end
    )
    else (registry.metadata - 'partRole') || pg_catalog.jsonb_build_object(
      'tileMode', 'stretch',
      'seamless', false,
      'allowedTargets', pg_catalog.jsonb_build_array('divider'),
      'defaultBlendMode', 'normal',
      'defaultOpacity', 100,
      'defaultScale', 100,
      'defaultWidth', case registry.asset_id
        when 'arcane-forge-ember-title-plate' then 420
        when 'arcane-forge-rules-vellum-panel' then 450
        else case
          when coalesce(registry.metadata ->> 'defaultWidth', '') ~ '^[0-9]+(?:\.[0-9]+)?$'
            then (registry.metadata ->> 'defaultWidth')::numeric
          else 420
        end
      end,
      'defaultHeight', case registry.asset_id
        when 'arcane-forge-ember-title-plate' then 72
        when 'arcane-forge-rules-vellum-panel' then 230
        else case
          when coalesce(registry.metadata ->> 'defaultHeight', '') ~ '^[0-9]+(?:\.[0-9]+)?$'
            then (registry.metadata ->> 'defaultHeight')::numeric
          else 72
        end
      end
    )
  end
from cardforge_studio_asset_reclassification as reclassification
where registry.asset_id = reclassification.asset_id;

update public.cardforge_developer_asset_submissions as submission
set
  asset_type = reclassification.next_submission_type,
  requested_studio_destination = reclassification.studio_destinations[1]
from cardforge_studio_asset_reclassification as reclassification
where coalesce(submission.target_registry_asset_id, submission.registry_asset_id) = reclassification.asset_id
  and submission.asset_type is distinct from reclassification.next_submission_type;

update public.cardforge_developer_asset_submissions
set
  asset_type = case
    when name ilike '%corner%' or name ilike '%gem%' or name ilike '%ornament%' then 'icons'
    else 'dividers'
  end,
  requested_studio_destination = case
    when name ilike '%corner%' or name ilike '%gem%' or name ilike '%ornament%' then 'element.icon'
    else 'element.divider'
  end
where asset_type = 'parts';

update public.cardforge_developer_program_settings
set
  publish_caps_by_type = publish_caps_by_type - 'parts',
  tier_caps_by_type = tier_caps_by_type - 'parts'
where publish_caps_by_type ? 'parts'
   or tier_caps_by_type ? 'parts';

alter table public.cardforge_developer_program_settings
  alter column publish_caps_by_type set default '{
    "templates": 9,
    "elementPresets": 24,
    "textures": 24,
    "dividers": 24,
    "icons": 30,
    "imageAssets": 24,
    "fonts": 12
  }'::jsonb,
  alter column tier_caps_by_type set default '{
    "templates": { "free": 6, "paid": 3 },
    "elementPresets": { "free": 16, "paid": 8 },
    "textures": { "free": 16, "paid": 8 },
    "dividers": { "free": 16, "paid": 8 },
    "icons": { "free": 20, "paid": 10 },
    "imageAssets": { "free": 16, "paid": 8 },
    "fonts": { "free": 8, "paid": 4 }
  }'::jsonb;

alter table public.cardforge_developer_asset_submissions
  drop constraint if exists cardforge_developer_asset_submissions_asset_type_check;
alter table public.cardforge_developer_asset_submissions
  add constraint cardforge_developer_asset_submissions_asset_type_check
  check (asset_type in ('templates', 'elementPresets', 'textures', 'dividers', 'icons', 'imageAssets', 'fonts'));

alter table public.cardforge_developer_asset_submissions
  drop constraint if exists cardforge_developer_asset_submissions_studio_destination_check;
alter table public.cardforge_developer_asset_submissions
  add constraint cardforge_developer_asset_submissions_studio_destination_check
  check (
    requested_studio_destination is null
    or (asset_type = 'templates' and requested_studio_destination in ('template.front', 'template.back'))
    or (asset_type = 'elementPresets' and requested_studio_destination in ('style.material', 'style.border', 'style.textFrame', 'style.shape', 'style.divider', 'style.icon'))
    or (asset_type = 'textures' and requested_studio_destination = 'appearance.texture')
    or (asset_type = 'dividers' and requested_studio_destination = 'element.divider')
    or (asset_type = 'icons' and requested_studio_destination = 'element.icon')
    or (asset_type = 'imageAssets' and requested_studio_destination in ('image.picture', 'image.frame.front', 'image.frame.back'))
    or (asset_type = 'fonts' and requested_studio_destination = 'typography.font')
  );

alter table public.cardforge_asset_registry
  drop constraint if exists cardforge_asset_registry_asset_type_check;
alter table public.cardforge_asset_registry
  add constraint cardforge_asset_registry_asset_type_check
  check (asset_type in ('texture', 'divider', 'icon', 'image', 'template', 'elementPreset', 'font'));

-- Parts only existed long enough for the one-time reclassification above. Keep
-- the installed routing contract free of the retired category.
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
    when p_asset_type = 'template' then public.cardforge_default_studio_destinations(p_asset_type, p_metadata)
    when p_asset_type = 'image' then array['image.picture', 'image.frame.front', 'image.frame.back']::text[]
    when p_asset_type = 'texture' then array['appearance.texture']::text[]
    when p_asset_type = 'divider' then array['element.divider']::text[]
    when p_asset_type = 'icon' then array['element.icon']::text[]
    when p_asset_type = 'font' then array['typography.font']::text[]
    when p_asset_type = 'elementPreset' then public.cardforge_default_studio_destinations(p_asset_type, p_metadata)
    else '{}'::text[]
  end;
$$;

create or replace function public.cardforge_apply_submission_studio_destination()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Accept writes from the immediately previous application bundle during the
  -- migration-first deployment window, but persist them only in the new model.
  if new.asset_type = 'parts' then
    if new.name ilike '%corner%' or new.name ilike '%gem%' or new.name ilike '%ornament%' then
      new.asset_type := 'icons';
      new.requested_studio_destination := 'element.icon';
    else
      new.asset_type := 'dividers';
      new.requested_studio_destination := 'element.divider';
    end if;
  end if;

  if new.requested_studio_destination is null then
    new.requested_studio_destination := case new.asset_type
      when 'templates' then case
        when new.source_payload ->> 'templateUsage' = 'back-preset' then 'template.back'
        else 'template.front'
      end
      when 'elementPresets' then 'style.material'
      when 'textures' then 'appearance.texture'
      when 'dividers' then 'element.divider'
      when 'icons' then 'element.icon'
      when 'imageAssets' then 'image.picture'
      when 'fonts' then 'typography.font'
      else null
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists cardforge_developer_asset_submission_studio_destination
  on public.cardforge_developer_asset_submissions;
create trigger cardforge_developer_asset_submission_studio_destination
  before insert or update of asset_type, requested_studio_destination, source_payload
  on public.cardforge_developer_asset_submissions
  for each row
  execute function public.cardforge_apply_submission_studio_destination();

revoke execute on function public.cardforge_apply_submission_studio_destination()
  from public, anon, authenticated;
grant execute on function public.cardforge_apply_submission_studio_destination()
  to service_role;

update public.cardforge_asset_registry as registry
set
  studio_destinations = public.cardforge_default_studio_destinations(registry.asset_type, registry.metadata),
  studio_sort_order = case
    when registry.asset_type = 'template'
      and registry.metadata -> 'template' ->> 'templateOrder' ~ '^[0-9]+$'
      then (registry.metadata -> 'template' ->> 'templateOrder')::integer
    else registry.studio_sort_order
  end
where registry.studio_routing_mode = 'automatic'
  and not exists (
  select 1
  from cardforge_studio_asset_reclassification as reclassification
  where reclassification.asset_id = registry.asset_id
)
  and (
    registry.studio_destinations is distinct from public.cardforge_default_studio_destinations(registry.asset_type, registry.metadata)
    or (
      registry.asset_type = 'template'
      and registry.metadata -> 'template' ->> 'templateOrder' ~ '^[0-9]+$'
      and registry.studio_sort_order is distinct from (registry.metadata -> 'template' ->> 'templateOrder')::integer
    )
  );

update public.cardforge_developer_asset_submissions as submission
set requested_studio_destination = registry.studio_destinations[1]
from public.cardforge_asset_registry as registry
where coalesce(submission.target_registry_asset_id, submission.registry_asset_id) = registry.asset_id
  and submission.requested_studio_destination is null
  and pg_catalog.cardinality(registry.studio_destinations) > 0;

alter table public.cardforge_asset_registry
  drop constraint if exists cardforge_asset_registry_studio_routing_mode_check,
  drop constraint if exists cardforge_asset_registry_studio_sort_order_check,
  drop constraint if exists cardforge_asset_registry_studio_destinations_check,
  drop constraint if exists cardforge_asset_registry_studio_compatibility_check;

alter table public.cardforge_asset_registry
  add constraint cardforge_asset_registry_studio_routing_mode_check
    check (studio_routing_mode in ('automatic', 'owner')),
  add constraint cardforge_asset_registry_studio_sort_order_check
    check (studio_sort_order between 0 and 100000),
  add constraint cardforge_asset_registry_studio_destinations_check
    check (studio_destinations <@ array[
      'template.front', 'template.back', 'image.picture', 'image.frame.front', 'image.frame.back',
      'element.icon', 'element.divider', 'appearance.texture', 'style.material', 'style.border',
      'style.textFrame', 'style.shape', 'style.divider', 'style.icon', 'typography.font'
    ]::text[]),
  add constraint cardforge_asset_registry_studio_compatibility_check
    check (public.cardforge_studio_destinations_are_compatible(asset_type, metadata, studio_destinations));

create index if not exists cardforge_asset_registry_studio_destinations_idx
  on public.cardforge_asset_registry using gin (studio_destinations);
create index if not exists cardforge_asset_registry_studio_order_idx
  on public.cardforge_asset_registry (studio_featured desc, studio_sort_order, name);

create or replace function public.cardforge_apply_automatic_studio_routing()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  requested_destination text;
begin
  if new.studio_routing_mode = 'automatic' then
    if new.developer_submission_id is not null then
      select submission.requested_studio_destination
      into requested_destination
      from public.cardforge_developer_asset_submissions as submission
      where submission.id = new.developer_submission_id;
    end if;
    new.studio_destinations := case
      when requested_destination is not null
        and public.cardforge_studio_destinations_are_compatible(
          new.asset_type,
          new.metadata,
          array[requested_destination]::text[]
        )
        then array[requested_destination]::text[]
      else public.cardforge_default_studio_destinations(new.asset_type, new.metadata)
    end;
  elsif not public.cardforge_studio_destinations_are_compatible(
    new.asset_type,
    new.metadata,
    new.studio_destinations
  ) then
    raise exception 'incompatible_studio_asset_destination';
  end if;

  select coalesce(pg_catalog.array_agg(destination order by destination), '{}'::text[])
  into new.studio_destinations
  from (
    select distinct destination
    from pg_catalog.unnest(new.studio_destinations) as destination
  ) as unique_destinations;
  return new;
end;
$$;

drop trigger if exists cardforge_asset_registry_apply_studio_routing
  on public.cardforge_asset_registry;
create trigger cardforge_asset_registry_apply_studio_routing
  before insert or update of asset_type, metadata, studio_destinations, studio_routing_mode
  on public.cardforge_asset_registry
  for each row
  execute function public.cardforge_apply_automatic_studio_routing();

revoke execute on function public.cardforge_apply_automatic_studio_routing()
  from public, anon, authenticated;
grant execute on function public.cardforge_apply_automatic_studio_routing()
  to service_role;

create or replace function public.cardforge_update_asset_studio_routing(
  p_asset_id text,
  p_mode text,
  p_destinations text[],
  p_sort_order integer,
  p_featured boolean
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  registry public.cardforge_asset_registry%rowtype;
  normalized_destinations text[];
begin
  if p_mode not in ('automatic', 'owner') then
    raise exception 'invalid_studio_routing_mode';
  end if;
  if p_sort_order is null or p_sort_order < 0 or p_sort_order > 100000 then
    raise exception 'invalid_studio_sort_order';
  end if;

  select * into registry
  from public.cardforge_asset_registry
  where asset_id = p_asset_id
  for update;
  if not found then
    raise exception 'pipeline_asset_not_found';
  end if;

  select coalesce(pg_catalog.array_agg(destination order by destination), '{}'::text[])
  into normalized_destinations
  from (
    select distinct destination
    from pg_catalog.unnest(coalesce(p_destinations, '{}'::text[])) as destination
  ) as unique_destinations;

  if p_mode = 'automatic' then
    normalized_destinations := public.cardforge_default_studio_destinations(registry.asset_type, registry.metadata);
  elsif not public.cardforge_studio_destinations_are_compatible(
    registry.asset_type,
    registry.metadata,
    normalized_destinations
  ) then
    raise exception 'incompatible_studio_asset_destination';
  end if;

  update public.cardforge_asset_registry
  set
    studio_routing_mode = p_mode,
    studio_destinations = normalized_destinations,
    studio_sort_order = p_sort_order,
    studio_featured = coalesce(p_featured, false)
  where asset_id = p_asset_id;

  return true;
end;
$$;

revoke execute on function public.cardforge_update_asset_studio_routing(text, text, text[], integer, boolean)
  from public, anon, authenticated;
grant execute on function public.cardforge_update_asset_studio_routing(text, text, text[], integer, boolean)
  to service_role;

create or replace function public.cardforge_get_studio_routing_counts()
returns table (
  destination text,
  total_count bigint,
  live_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    destination,
    pg_catalog.count(*)::bigint,
    pg_catalog.count(*) filter (
      where registry.status = 'published'
        and registry.access_tier in ('free', 'paid', 'developer')
    )::bigint
  from public.cardforge_asset_registry as registry
  cross join lateral pg_catalog.unnest(registry.studio_destinations) as destination
  group by destination
  order by destination;
$$;

revoke execute on function public.cardforge_get_studio_routing_counts()
  from public, anon, authenticated;
grant execute on function public.cardforge_get_studio_routing_counts()
  to service_role;

do $$
begin
  if exists (select 1 from cardforge_studio_asset_reclassification) then
    perform public.cardforge_rebalance_developer_asset_pipeline(null);
  end if;
end;
$$;

comment on column public.cardforge_asset_registry.studio_destinations
  is 'Code-validated creator-facing Studio surfaces where this asset is available.';
comment on column public.cardforge_asset_registry.studio_routing_mode
  is 'Automatic uses the asset kind and payload; owner preserves a compatible explicit override.';
comment on function public.cardforge_update_asset_studio_routing(text, text, text[], integer, boolean)
  is 'Atomically applies an owner Studio placement override or restores automatic routing.';
comment on function public.cardforge_apply_submission_studio_destination()
  is 'Adds a truthful default Studio destination to legacy or revision submission writers that omit the new field.';

commit;
