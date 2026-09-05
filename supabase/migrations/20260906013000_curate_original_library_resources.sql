begin;
set local lock_timeout = '5s';

-- Curate existing publications only. Resolve imported resources by their original
-- source/name, never by environment-specific submission IDs. No binary is replaced.
do $$
declare
  item record;
  registry public.cardforge_asset_registry%rowtype;
  submission public.cardforge_contributor_asset_submissions%rowtype;
  candidate_ids text[];
  expected_submission_id uuid;
  expected_source_url text;
  expected_name text;
  expected_description text;
  current_revision integer;
begin
  for item in select * from (values
    ('default-name-card-theme', null, null, null, null, 'business', 'business-card'),
    ('default-cardforge-studio-back-us-business', null, null, null, null, 'business', 'business-card'),
    ('default-event-badge-theme', null, null, null, null, 'events', 'event-badge'),
    ('default-cardforge-studio-back-event-badge', null, null, null, null, 'events', 'event-badge'),
    (null, 'Ember Vein Texture', 'texture', 'appearance.texture',
      'Dark ember-vein pattern for card backgrounds, panels, and shapes. Apply from Look > Texture; adjust opacity to keep text readable.', 'general', null),
    (null, 'Sunforged Divider', 'divider', 'element.divider',
      'Gold sun-and-star divider for separating titles, rules text, and stat sections. Add a Divider in Design and select Sunforged Divider.', 'general', null),
    (null, 'Crowned Flame Icon', 'icon', 'element.icon',
      'Gold crown-and-flame emblem for abilities, rarity marks, and faction badges. Add an Icon in Design and select Crowned Flame Icon.', 'general', null),
    (null, 'Arcane Corner Overlay', 'icon', 'element.icon',
      'Transparent gold corner ornament for framing card artwork and panels. Add it as an Icon, resize and rotate it at the corner, then duplicate for matching corners.', 'general', null),
    (null, 'Floating Crystal Relic', 'image', 'image.picture',
      'Transparent crystal illustration for item cards, rewards, and decorative artwork. Choose it from Images for an image element or artwork field.', 'general', null)
  ) as curated(asset_id, clean_name, asset_kind, destination, description, specialty, use_case)
  loop
    if item.asset_id is not null then
      candidate_ids := array[item.asset_id]::text[];
    else
      select array_agg(r.asset_id), min(s.id::text)::uuid, min(s.source_url), min(s.name), min(s.description)
        into candidate_ids, expected_submission_id, expected_source_url, expected_name, expected_description
      from public.cardforge_asset_registry r
      join public.cardforge_contributor_asset_submissions s on s.id = r.contributor_submission_id
      where r.asset_type = item.asset_kind
        and s.source_url like '%forge-demo-202605260814-%'
        and s.name in ('Forge Demo 202605260814 ' || item.clean_name, item.clean_name);
      if coalesce(cardinality(candidate_ids), 0) = 0 then continue; end if;
      if cardinality(candidate_ids) <> 1 then
        raise exception 'catalog_curation_ambiguous_source: %', item.clean_name;
      end if;
    end if;
    select * into registry from public.cardforge_asset_registry where asset_id = candidate_ids[1];
    -- New databases may not contain these optional original publications.
    if not found then continue; end if;
    select * into submission from public.cardforge_contributor_asset_submissions
      where id = registry.contributor_submission_id for update;
    if not found then raise exception 'catalog_curation_submission_missing'; end if;
    if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(registry.asset_id, 0)) then
      raise exception 'catalog_curation_busy';
    end if;
    select * into registry from public.cardforge_asset_registry where asset_id = candidate_ids[1] for update;
    if not found or registry.contributor_submission_id is distinct from submission.id
      or registry.status <> 'published' or submission.status <> 'published'
      or submission.lineage_id is null or submission.purge_state is not null
    then raise exception 'catalog_curation_publication_changed'; end if;
    if item.clean_name is not null and (
      submission.id is distinct from expected_submission_id
      or submission.source_url is distinct from expected_source_url
      or submission.name is distinct from expected_name
      or submission.description is distinct from expected_description
    ) then raise exception 'catalog_curation_source_changed'; end if;
    if not (
      (submission.specialty_tags = '{}'::text[] and submission.use_case_tags = '{}'::text[])
      or (submission.specialty_tags = array[item.specialty]::text[]
        and submission.use_case_tags = case when item.use_case is null then '{}'::text[] else array[item.use_case]::text[] end)
    ) then raise exception 'catalog_curation_classification_changed'; end if;

    current_revision := case when registry.metadata ->> 'revisionNumber' ~ '^[0-9]+$'
      then (registry.metadata ->> 'revisionNumber')::integer else 0 end;
    perform public.cardforge_classify_published_pipeline_asset(
      registry.asset_id, submission.id, submission.lineage_id, current_revision,
      submission.specialty_tags, submission.use_case_tags,
      array[item.specialty]::text[],
      case when item.use_case is null then '{}'::text[] else array[item.use_case]::text[] end
    );

    if item.clean_name is not null then
      if registry.name not in ('Forge Demo 202605260814 ' || item.clean_name, item.clean_name)
        or registry.url is distinct from submission.source_url
        or submission.source_payload is not null
        or submission.requested_studio_destination is distinct from item.destination
        or registry.studio_destinations is distinct from array[item.destination]::text[]
      then raise exception 'catalog_curation_resource_changed'; end if;
      -- Discovery copy changes at its existing source; future native publication
      -- keeps the clean name. Original files, routing, lineage and votes stay put.
      update public.cardforge_contributor_asset_submissions
        set name = item.clean_name, description = item.description
        where id = submission.id
          and (name is distinct from item.clean_name or description is distinct from item.description);
      update public.cardforge_asset_registry set name = item.clean_name
        where asset_id = registry.asset_id and name is distinct from item.clean_name;
    end if;
  end loop;
end;
$$;
commit;
