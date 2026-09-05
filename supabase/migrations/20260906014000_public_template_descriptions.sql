begin;
set local lock_timeout = '5s';

-- Replace known bootstrap descriptions with public usage guidance. The linked
-- submission remains the sole description owner; authored Template JSON is intact.
do $$
declare
  item record;
  registry public.cardforge_asset_registry%rowtype;
  submission public.cardforge_contributor_asset_submissions%rowtype;
begin
  for item in select * from (values
    ('default-name-card-theme',
      array['A business/name card for staff cards, networking cards, and branded handouts.', 'Official CardForge layout/preset default seeded into continuous developer review.'],
      'Business card front for staff introductions and networking. Personalize the name, role, company logo, and contact details; pair it with CardForge Studio Business Back.'),
    ('default-cardforge-studio-back-us-business',
      array['The official CardForge Studio fantasy back for horizontal US business cards.'],
      'Fantasy artwork for the reverse of a horizontal business card. Pair it with Name Card Theme for a two-sided card.'),
    ('default-event-badge-theme',
      array['A conference or convention badge useful for teams, playtest events, workshops, and launches.', 'Official CardForge layout/preset default seeded into continuous developer review.'],
      'Event badge front for conferences, workshops, and team events. Fill in attendee and event details, then pair it with CardForge Studio Event Badge Back.'),
    ('default-cardforge-studio-back-event-badge',
      array['The official CardForge Studio fantasy back for portrait event badges.'],
      'Fantasy artwork for the reverse of a portrait event badge. Pair it with Event Badge Theme for a two-sided pass.')
  ) as curated(asset_id, original_descriptions, description)
  loop
    select * into registry from public.cardforge_asset_registry where asset_id = item.asset_id;
    if not found then continue; end if;
    select * into submission from public.cardforge_contributor_asset_submissions
      where id = registry.contributor_submission_id for update;
    if not found then raise exception 'template_description_submission_missing: %', item.asset_id; end if;
    if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(item.asset_id, 0)) then
      raise exception 'template_description_busy: %', item.asset_id;
    end if;
    select * into registry from public.cardforge_asset_registry where asset_id = item.asset_id for update;
    if not found or registry.contributor_submission_id is distinct from submission.id
      or registry.asset_type <> 'template' or registry.status <> 'published'
      or submission.asset_type <> 'templates' or submission.status <> 'published'
      or submission.lineage_id is null or submission.purge_state is not null
    then raise exception 'template_description_publication_changed: %', item.asset_id; end if;
    if submission.description = item.description then continue; end if;
    if submission.description is null or not (submission.description = any(item.original_descriptions)) then
      raise exception 'template_description_authored_change: %', item.asset_id;
    end if;
    update public.cardforge_contributor_asset_submissions
      set description = item.description where id = submission.id;
  end loop;
end;
$$;
commit;
