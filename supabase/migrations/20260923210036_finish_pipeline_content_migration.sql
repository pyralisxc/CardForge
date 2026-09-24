begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Registry recipes are hydrated into Pipeline submissions at read time. Move
-- every nested recipe reference off the retired bucket, not only the primary
-- submission payloads migrated by the preceding change.
update public.cardforge_asset_registry
set metadata = pg_catalog.replace(
  metadata::text,
  '/cardforge-developer-assets/',
  '/cardforge-contributor-assets/'
)::jsonb
where metadata::text like '%/cardforge-developer-assets/%';

-- Old recipe documents predate the official/contributor source vocabulary.
-- Keep the embedded recipe projection aligned with the registry authority.
update public.cardforge_asset_registry
set metadata = pg_catalog.jsonb_set(
  metadata,
  '{style,librarySource}',
  pg_catalog.to_jsonb(library_source),
  true
)
where pg_catalog.jsonb_typeof(metadata -> 'style') = 'object'
  and metadata #>> '{style,librarySource}' is distinct from library_source;

-- Reusable resources are intentionally general-purpose and need no invented
-- use case. This is the canonical classification for the built-in resource
-- library.
update public.cardforge_contributor_asset_submissions
set specialty_tags = array['general']::text[],
    use_case_tags = '{}'::text[]
where status = 'published'
  and asset_type in ('textures', 'dividers', 'icons', 'imageAssets', 'elementPresets', 'fonts')
  and (
    specialty_tags is distinct from array['general']::text[]
    or use_case_tags is distinct from '{}'::text[]
  );

-- Templates need an explicit domain and use case. These stable registry ids
-- are the reviewed built-in foundations, so the mapping is deterministic.
with classification(registry_asset_id, specialty_tags, use_case_tags) as (
  values
    ('default-mtg-theme', array['games']::text[], array['tcg']::text[]),
    ('default-playing-card-theme', array['games']::text[], array['playing-cards']::text[]),
    ('default-ttrpg-stat-sheet', array['games']::text[], array['reference-card']::text[]),
    ('default-cardforge-studio-back-bridge', array['games']::text[], array['playing-cards']::text[]),
    ('default-cardforge-studio-back-poker', array['games']::text[], array['playing-cards']::text[]),
    ('default-cardforge-studio-back-tarot', array['general']::text[], array['tarot']::text[]),
    ('default-cardforge-studio-back-ttrpg-reference', array['games']::text[], array['reference-card']::text[]),
    ('default-obsidian-neon-card-back', array['games']::text[], array['playing-cards']::text[])
)
update public.cardforge_contributor_asset_submissions as submission
set specialty_tags = classification.specialty_tags,
    use_case_tags = classification.use_case_tags
from classification
where submission.status = 'published'
  and submission.registry_asset_id = classification.registry_asset_id
  and (
    submission.specialty_tags is distinct from classification.specialty_tags
    or submission.use_case_tags is distinct from classification.use_case_tags
  );

-- Preserve the same classification in the compact registry projection used by
-- the Studio and public catalog.
update public.cardforge_asset_registry as registry
set specialty_tags = submission.specialty_tags,
    use_case_tags = submission.use_case_tags,
    metadata = registry.metadata || pg_catalog.jsonb_build_object(
      'specialtyTags', submission.specialty_tags,
      'useCaseTags', submission.use_case_tags
    )
from public.cardforge_contributor_asset_submissions as submission
where registry.contributor_submission_id = submission.id
  and submission.status = 'published'
  and (
    registry.specialty_tags is distinct from submission.specialty_tags
    or registry.use_case_tags is distinct from submission.use_case_tags
    or registry.metadata -> 'specialtyTags' is distinct from pg_catalog.to_jsonb(submission.specialty_tags)
    or registry.metadata -> 'useCaseTags' is distinct from pg_catalog.to_jsonb(submission.use_case_tags)
  );

-- Historical bootstrap rows already carry the authoritative revision number in
-- their registry metadata. Complete the submission side only when the lineage
-- contains exactly one row and that authority says this is revision 1.
with safe_initial_revisions as (
  select submission.id
  from public.cardforge_contributor_asset_submissions as submission
  join public.cardforge_asset_registry as registry
    on registry.contributor_submission_id = submission.id
  where submission.status = 'published'
    and submission.revision_number is null
    and submission.lineage_id is not null
    and registry.metadata ->> 'revisionNumber' = '1'
    and not exists (
      select 1
      from public.cardforge_contributor_asset_submissions as sibling
      where sibling.lineage_id = submission.lineage_id
        and sibling.id <> submission.id
    )
)
update public.cardforge_contributor_asset_submissions as submission
set base_revision_number = 0,
    revision_number = 1
from safe_initial_revisions
where submission.id = safe_initial_revisions.id;

do $$
begin
  if exists (
    select 1
    from public.cardforge_asset_registry
    where metadata::text similar to '%(cardforge-developer-assets|bootstrap-media://|site-fallback://|/card-assets/)%'
      or metadata #>> '{style,librarySource}' = 'developer'
  ) then
    raise exception 'pipeline_registry_retains_legacy_content';
  end if;

  if exists (
    select 1
    from public.cardforge_contributor_asset_submissions
    where status = 'published'
      and (
        revision_number is null
        or pg_catalog.cardinality(specialty_tags) = 0
        or (
          asset_type in ('templates', 'sets')
          and pg_catalog.cardinality(use_case_tags) = 0
        )
      )
  ) then
    raise exception 'published_pipeline_content_migration_incomplete';
  end if;
end;
$$;

commit;
