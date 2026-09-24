begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- The contributor rename moved registry objects but missed URLs nested inside
-- immutable Template documents. Rewrite only known retired prefixes and exact
-- repository-owned aliases; user-authored external URLs remain untouched.
update public.cardforge_contributor_asset_submissions
set source_payload = pg_catalog.replace(
  source_payload::text,
  '/cardforge-developer-assets/',
  '/cardforge-contributor-assets/'
)::jsonb
where source_payload::text like '%/cardforge-developer-assets/%';

do $$
declare
  replacement record;
begin
  for replacement in select * from (values
    ('/card-assets/textures/arcane-forge/frame-creature-premium.webp', 'arcane-forge-frame-creature-premium'),
    ('/card-assets/textures/arcane-forge/frame-playing-premium.webp', 'arcane-forge-frame-playing-premium'),
    ('/card-assets/textures/arcane-forge/frame-ttrpg-premium.webp', 'arcane-forge-frame-ttrpg-premium'),
    ('/card-assets/textures/arcane-forge/back-obsidian-neon-premium.webp', 'arcane-forge-back-obsidian-neon-premium'),
    ('/card-assets/showcase/playing-cards/ace-of-spades.webp', 'showcase-playing-cards-ace-of-spades')
  ) as aliases(retired_url, registry_asset_id)
  loop
    update public.cardforge_contributor_asset_submissions as submission
    set source_payload = pg_catalog.replace(
      submission.source_payload::text,
      replacement.retired_url,
      registry.url
    )::jsonb
    from public.cardforge_asset_registry as registry
    where registry.asset_id = replacement.registry_asset_id
      and submission.source_payload::text like '%' || replacement.retired_url || '%';
  end loop;
end;
$$;

-- Sample logos are optional contributor inputs. The Template's existing
-- gradient treatment is the native empty-state preview, so no code-owned image
-- file is required.
update public.cardforge_contributor_asset_submissions
set source_payload = pg_catalog.replace(
  pg_catalog.replace(
    source_payload::text,
    '/card-assets/images/default-company-logo.svg',
    ''
  ),
  '/card-assets/images/default-event-logo.svg',
  ''
)::jsonb
where source_payload::text like '%/card-assets/images/default-%';

update public.cardforge_contributor_asset_submissions
set source_file_size_bytes = pg_catalog.octet_length(
  pg_catalog.convert_to(source_payload::text, 'UTF8')
)
where source_payload is not null;

-- Compact registry metadata and active immutable revisions must agree about
-- which face a Template represents before automatic routing is recomputed.
update public.cardforge_asset_registry as registry
set metadata = registry.metadata || pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
  'templateUsage', submission.source_payload ->> 'templateUsage'
))
from public.cardforge_contributor_asset_submissions as submission
where registry.asset_type = 'template'
  and registry.contributor_submission_id = submission.id;

update public.cardforge_contributor_asset_submissions as submission
set requested_studio_destination = case
  when submission.source_payload ->> 'templateUsage' = 'back-preset' then 'template.back'
  else 'template.front'
end
from public.cardforge_asset_registry as registry
where registry.contributor_submission_id = submission.id
  and registry.asset_type = 'template'
  and submission.requested_studio_destination is distinct from case
    when submission.source_payload ->> 'templateUsage' = 'back-preset' then 'template.back'
    else 'template.front'
  end;

update public.cardforge_contributor_asset_submissions as submission
set requested_studio_destination = registry.metadata ->> 'studioDefaultDestination'
from public.cardforge_asset_registry as registry
where registry.contributor_submission_id = submission.id
  and registry.asset_type = 'image'
  and registry.metadata ->> 'studioDefaultDestination' in (
    'image.picture', 'image.frame.front', 'image.frame.back',
    'image.border.front', 'image.border.back'
  )
  and submission.requested_studio_destination is distinct from registry.metadata ->> 'studioDefaultDestination';

update public.cardforge_asset_registry as registry
set studio_destinations = public.cardforge_default_studio_destinations(
  registry.asset_type,
  registry.metadata
)
where registry.studio_routing_mode = 'automatic'
  and registry.studio_destinations is distinct from public.cardforge_default_studio_destinations(
    registry.asset_type,
    registry.metadata
  );

-- A Template can only be routed to the face declared by its immutable content.
-- Image foundations remain owner-routable because one reviewed image can be
-- intentionally reused in another compatible image lane.
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
    when p_asset_type = 'image' then array['image.picture', 'image.frame.front', 'image.frame.back', 'image.border.front', 'image.border.back']::text[]
    when p_asset_type = 'texture' then array['appearance.texture']::text[]
    when p_asset_type = 'divider' then array['element.divider']::text[]
    when p_asset_type = 'icon' then array['element.icon']::text[]
    when p_asset_type = 'font' then array['typography.font']::text[]
    when p_asset_type = 'elementPreset' then public.cardforge_default_studio_destinations(p_asset_type, p_metadata)
    else '{}'::text[]
  end;
$$;

revoke execute on function public.cardforge_studio_destinations_are_compatible(text, jsonb, text[])
  from public, anon, authenticated;
grant execute on function public.cardforge_studio_destinations_are_compatible(text, jsonb, text[])
  to service_role;

do $$
begin
  if exists (
    select 1
    from public.cardforge_contributor_asset_submissions
    where status = 'published'
      and source_payload::text similar to '%(cardforge-developer-assets|bootstrap-media://|site-fallback://|/card-assets/)%'
  ) then
    raise exception 'published_pipeline_payload_retains_retired_source';
  end if;
  if exists (
    select 1
    from public.cardforge_asset_registry as registry
    join public.cardforge_contributor_asset_submissions as submission
      on submission.id = registry.contributor_submission_id
    where registry.asset_type = 'template'
      and registry.studio_destinations is distinct from case
        when submission.source_payload ->> 'templateUsage' = 'back-preset'
          then array['template.back']::text[]
        else array['template.front']::text[]
      end
  ) then
    raise exception 'published_template_route_does_not_match_content';
  end if;
end;
$$;

commit;
