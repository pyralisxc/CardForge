begin;

set local lock_timeout = '5s';

-- Complete the initial-revision contract already used by the native bootstrap
-- importer. Preserve the original submission, payload, lineage and vote history.
do $$
declare
  asset_key text;
  registry public.cardforge_asset_registry%rowtype;
  submission public.cardforge_contributor_asset_submissions%rowtype;
  publication_time timestamptz;
begin
  foreach asset_key in array array[
    'default-name-card-theme',
    'default-event-badge-theme',
    'default-obsidian-neon-card-back',
    'default-playing-card-theme',
    'default-mtg-theme',
    'default-ttrpg-stat-sheet',
    'default-cardforge-studio-back-us-business',
    'default-cardforge-studio-back-bridge',
    'default-cardforge-studio-back-poker',
    'default-cardforge-studio-back-tarot',
    'default-cardforge-studio-back-ttrpg-reference',
    'default-cardforge-studio-back-event-badge'
  ] loop
    select * into registry from public.cardforge_asset_registry where asset_id = asset_key;
    -- A database without these optional bootstrap objects needs no data repair.
    if not found then continue; end if;

    select * into submission from public.cardforge_contributor_asset_submissions
      where id = registry.contributor_submission_id for update;
    if not found then raise exception 'bootstrap_template_submission_missing: %', asset_key; end if;
    if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(asset_key, 0)) then
      raise exception 'bootstrap_template_busy: %', asset_key;
    end if;
    select * into registry from public.cardforge_asset_registry where asset_id = asset_key for update;
    if not found or registry.contributor_submission_id is distinct from submission.id then
      raise exception 'bootstrap_template_identity_changed: %', asset_key;
    end if;
    if registry.asset_type <> 'template' or registry.status <> 'published'
      or submission.asset_type <> 'templates' or submission.status <> 'published'
      or submission.registry_asset_id is distinct from asset_key
      or submission.lineage_id is null or submission.purge_state is not null
      or pg_catalog.jsonb_typeof(submission.source_payload) is distinct from 'object'
    then raise exception 'bootstrap_template_contract_conflict: %', asset_key; end if;

    -- A completed initial revision or a later authored revision is already native.
    if submission.target_registry_asset_id = asset_key
      and submission.revision_number >= 1
      and submission.base_revision_number = submission.revision_number - 1
      and registry.metadata ->> 'revisionNumber' = submission.revision_number::text
      and registry.metadata ->> 'revisionId' = submission.id::text
      and submission.published_at is not null
      and registry.metadata ->> 'revisionPublishedAt' is not null
    then continue; end if;

    if submission.target_registry_asset_id is not null
      or submission.base_revision_number is not null or submission.revision_number is not null
      or submission.submission_key is not null
      or registry.metadata ->> 'revisionNumber' is not null
      or registry.metadata ->> 'revisionId' is not null
      or registry.metadata ->> 'revisionPublishedAt' is not null
      or exists (
        select 1 from public.cardforge_contributor_asset_submissions as other
        where other.id <> submission.id
          and (other.registry_asset_id = asset_key or other.target_registry_asset_id = asset_key)
      )
    then raise exception 'bootstrap_template_revision_conflict: %', asset_key; end if;

    publication_time := coalesce(submission.published_at, registry.created_at, submission.submitted_at);
    update public.cardforge_contributor_asset_submissions
      set target_registry_asset_id = asset_key, base_revision_number = 0,
        revision_number = 1, published_at = publication_time
      where id = submission.id;
    update public.cardforge_asset_registry
      set metadata = coalesce(metadata, '{}'::jsonb) || pg_catalog.jsonb_build_object(
        'revisionNumber', 1, 'revisionId', submission.id, 'revisionPublishedAt', publication_time
      )
      where asset_id = asset_key;
  end loop;
end;
$$;

commit;
