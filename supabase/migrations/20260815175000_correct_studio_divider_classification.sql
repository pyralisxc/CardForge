begin;

do $$
begin
  if exists (
    select 1
    from public.cardforge_asset_registry
    where asset_id in (
      'arcane-forge-ember-title-plate',
      'arcane-forge-rules-vellum-panel'
    )
      and (
        metadata ->> 'sourceKind' is distinct from 'pipeline-owner-import'
        or studio_routing_mode is distinct from 'automatic'
      )
      and (
        asset_type is distinct from 'divider'
        or studio_destinations is distinct from array['element.divider']::text[]
      )
  ) then
    raise exception 'owner_managed_studio_divider_conflict';
  end if;
end;
$$;

update public.cardforge_asset_registry
set
  asset_type = 'divider',
  studio_destinations = array['element.divider']::text[],
  metadata = (metadata - 'partRole') || pg_catalog.jsonb_build_object(
    'tileMode', 'stretch',
    'seamless', false,
    'allowedTargets', pg_catalog.jsonb_build_array('divider'),
    'defaultBlendMode', 'normal',
    'defaultOpacity', 100,
    'defaultScale', 100,
    'defaultWidth', case asset_id
      when 'arcane-forge-ember-title-plate' then 420
      else 450
    end,
    'defaultHeight', case asset_id
      when 'arcane-forge-ember-title-plate' then 72
      else 230
    end
  )
where asset_id in (
    'arcane-forge-ember-title-plate',
    'arcane-forge-rules-vellum-panel'
  )
  and metadata ->> 'sourceKind' = 'pipeline-owner-import'
  and studio_routing_mode = 'automatic'
  and (
    asset_type is distinct from 'divider'
    or studio_destinations is distinct from array['element.divider']::text[]
    or metadata ->> 'tileMode' is distinct from 'stretch'
    or metadata -> 'allowedTargets' is distinct from pg_catalog.jsonb_build_array('divider')
    or metadata ->> 'defaultWidth' is distinct from case asset_id
      when 'arcane-forge-ember-title-plate' then '420'
      else '450'
    end
    or metadata ->> 'defaultHeight' is distinct from case asset_id
      when 'arcane-forge-ember-title-plate' then '72'
      else '230'
    end
  );

update public.cardforge_developer_asset_submissions
set
  asset_type = 'dividers',
  requested_studio_destination = 'element.divider'
where coalesce(target_registry_asset_id, registry_asset_id) in (
    'arcane-forge-ember-title-plate',
    'arcane-forge-rules-vellum-panel'
  )
  and (
    asset_type is distinct from 'dividers'
    or requested_studio_destination is distinct from 'element.divider'
  );

commit;
