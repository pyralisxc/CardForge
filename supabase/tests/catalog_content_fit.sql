-- Run after the catalog-content and public description migrations. Probe mutations are rolled back.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
set local role service_role;
do $$
declare
  item record;
  registry public.cardforge_asset_registry%rowtype;
  submission public.cardforge_contributor_asset_submissions%rowtype;
  revision integer;
begin
  for item in select * from (values
    ('default-name-card-theme', 'business', 'business-card'),
    ('default-cardforge-studio-back-us-business', 'business', 'business-card'),
    ('default-event-badge-theme', 'events', 'event-badge'),
    ('default-cardforge-studio-back-event-badge', 'events', 'event-badge')
  ) as expected(asset_id, specialty, use_case)
  loop
    select * into registry from public.cardforge_asset_registry where asset_id = item.asset_id;
    if not found then raise exception 'Missing Template fixture: %', item.asset_id; end if;
    select * into submission from public.cardforge_contributor_asset_submissions where id = registry.contributor_submission_id;
    if submission.specialty_tags is distinct from array[item.specialty]::text[]
      or submission.use_case_tags is distinct from array[item.use_case]::text[]
      or registry.specialty_tags is distinct from submission.specialty_tags
      or registry.use_case_tags is distinct from submission.use_case_tags
    then raise exception 'Template classification did not project to Library'; end if;
    revision := (registry.metadata ->> 'revisionNumber')::integer;
    perform public.cardforge_classify_published_pipeline_asset(
      registry.asset_id, submission.id, submission.lineage_id, revision,
      submission.specialty_tags, submission.use_case_tags,
      submission.specialty_tags, submission.use_case_tags);
    begin
      perform public.cardforge_classify_published_pipeline_asset(
        registry.asset_id, submission.id, submission.lineage_id, revision,
        submission.specialty_tags, submission.use_case_tags,
        submission.specialty_tags, array['unknown-content-kind']::text[]);
      raise exception 'Unknown use case was accepted';
    exception when raise_exception then
      if sqlerrm <> 'pipeline_classification_invalid' then raise; end if;
    end;
    begin
      perform public.cardforge_classify_published_pipeline_asset(
        registry.asset_id, submission.id, submission.lineage_id, revision + 1,
        submission.specialty_tags, submission.use_case_tags,
        submission.specialty_tags, submission.use_case_tags);
      raise exception 'Stale revision was accepted';
    exception when raise_exception then
      if sqlerrm <> 'pipeline_classification_conflict' then raise; end if;
    end;
  end loop;

  for item in select * from (values
    ('default-name-card-theme', 'Business card front for staff introductions and networking. Personalize the name, role, company logo, and contact details; pair it with CardForge Studio Business Back.'),
    ('default-cardforge-studio-back-us-business', 'Fantasy artwork for the reverse of a horizontal business card. Pair it with Name Card Theme for a two-sided card.'),
    ('default-event-badge-theme', 'Event badge front for conferences, workshops, and team events. Fill in attendee and event details, then pair it with CardForge Studio Event Badge Back.'),
    ('default-cardforge-studio-back-event-badge', 'Fantasy artwork for the reverse of a portrait event badge. Pair it with Event Badge Theme for a two-sided pass.')
  ) as expected(asset_id, description)
  loop
    if not exists (
      select 1 from public.cardforge_asset_registry r
      join public.cardforge_contributor_asset_submissions s on s.id = r.contributor_submission_id
      where r.asset_id = item.asset_id and s.description = item.description
    ) then raise exception 'Public Template usage description missing: %', item.asset_id; end if;
  end loop;

  if (select count(*) from public.cardforge_asset_registry r
    join public.cardforge_contributor_asset_submissions s on s.id=r.contributor_submission_id
    where s.source_url like '%forge-demo-202605260814-%'
      and s.name in ('Ember Vein Texture','Sunforged Divider','Crowned Flame Icon','Arcane Corner Overlay','Floating Crystal Relic')
      and r.name=s.name and s.specialty_tags=array['general']::text[] and s.use_case_tags='{}'::text[]
      and r.specialty_tags=s.specialty_tags and r.use_case_tags=s.use_case_tags
      and r.studio_destinations=array[s.requested_studio_destination]::text[]
      and r.status='published' and s.status='published' and r.url=s.source_url
  ) <> 5 then raise exception 'Curated original resource projection is incomplete'; end if;
  if has_function_privilege('anon', 'public.cardforge_classify_published_pipeline_asset(text,uuid,uuid,integer,text[],text[],text[],text[])', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.cardforge_classify_published_pipeline_asset(text,uuid,uuid,integer,text[],text[],text[],text[])', 'EXECUTE')
  then raise exception 'Owner classification must remain service-only'; end if;
end;
$$;
rollback;
