-- CI-only initialization of a proven fresh seed. Never a hosted maintenance RPC.
-- The caller verifies unique Docker identity, loopback, source hashes and prefix.
begin;
set local lock_timeout='2s';
select set_config('cardforge.local_replay', :'replay_project', true);
create temporary table replay_expected (asset_id text primary key,name text,url text,kind text,description text) on commit drop;
insert into replay_expected select * from jsonb_to_recordset($manifest$[{"asset_id": "parchment-grain", "name": "Parchment Grain", "url": "/card-assets/textures/parchment-grain.svg", "kind": "texture", "description": "Official CardForge default asset seeded for continuous developer review."}, {"asset_id": "dark-leather", "name": "Dark Leather", "url": "/card-assets/textures/dark-leather.svg", "kind": "texture", "description": "Official CardForge default asset seeded for continuous developer review."}, {"asset_id": "hammered-metal", "name": "Hammered Metal Surface", "url": "/card-assets/textures/hammered-metal.svg", "kind": "texture", "description": "Official CardForge default asset seeded for continuous developer review."}, {"asset_id": "purple-foil", "name": "Purple Foil Surface", "url": "/card-assets/textures/purple-foil.svg", "kind": "texture", "description": "Official CardForge default asset seeded for continuous developer review."}, {"asset_id": "arcane-hatch", "name": "Arcane Hatch", "url": "/card-assets/textures/arcane-hatch.svg", "kind": "texture", "description": "Official CardForge default asset seeded for continuous developer review."}, {"asset_id": "ink-wash", "name": "Ink Wash Surface", "url": "/card-assets/textures/ink-wash.svg", "kind": "texture", "description": "Official CardForge default asset seeded for continuous developer review."}, {"asset_id": "stone-grain", "name": "Stone Grain", "url": "/card-assets/textures/stone-grain.svg", "kind": "texture", "description": "Official CardForge default asset seeded for continuous developer review."}, {"asset_id": "worn-paper", "name": "Worn Paper", "url": "/card-assets/textures/worn-paper.svg", "kind": "texture", "description": "Official CardForge default asset seeded for continuous developer review."}, {"asset_id": "arcane-forge-astral-paper", "name": "Astral Paper", "url": "/card-assets/textures/arcane-forge/astral-paper.svg", "kind": "texture", "description": "Official CardForge default asset seeded for continuous developer review."}, {"asset_id": "arcane-forge-back-obsidian-neon-premium", "name": "Back Obsidian Neon Premium", "url": "/card-assets/textures/arcane-forge/back-obsidian-neon-premium.webp", "kind": "image", "description": "Official CardForge default asset seeded for continuous developer review."}, {"asset_id": "arcane-forge-ember-leather", "name": "Ember Leather", "url": "/card-assets/textures/arcane-forge/ember-leather.svg", "kind": "texture", "description": "Official CardForge default asset seeded for continuous developer review."}, {"asset_id": "arcane-forge-forged-parchment", "name": "Forged Parchment", "url": "/card-assets/textures/arcane-forge/forged-parchment.svg", "kind": "texture", "description": "Official CardForge default asset seeded for continuous developer review."}, {"asset_id": "arcane-forge-frame-creature-premium", "name": "Frame Creature Premium", "url": "/card-assets/textures/arcane-forge/frame-creature-premium.webp", "kind": "image", "description": "Official CardForge default asset seeded for continuous developer review."}, {"asset_id": "arcane-forge-frame-playing-premium", "name": "Frame Playing Premium", "url": "/card-assets/textures/arcane-forge/frame-playing-premium.webp", "kind": "image", "description": "Official CardForge default asset seeded for continuous developer review."}, {"asset_id": "arcane-forge-frame-ttrpg-premium", "name": "Frame TTRPG Premium", "url": "/card-assets/textures/arcane-forge/frame-ttrpg-premium.webp", "kind": "image", "description": "Official CardForge default asset seeded for continuous developer review."}, {"asset_id": "arcane-forge-guild-slate", "name": "Guild Slate", "url": "/card-assets/textures/arcane-forge/guild-slate.svg", "kind": "texture", "description": "Official CardForge default asset seeded for continuous developer review."}, {"asset_id": "arcane-forge-obsidian-vellum", "name": "Obsidian Vellum", "url": "/card-assets/textures/arcane-forge/obsidian-vellum.svg", "kind": "texture", "description": "Official CardForge default asset seeded for continuous developer review."}, {"asset_id": "arcane-forge-rune-metal", "name": "Rune Metal", "url": "/card-assets/textures/arcane-forge/rune-metal.svg", "kind": "texture", "description": "Official CardForge default asset seeded for continuous developer review."}, {"asset_id": "gilded-filigree", "name": "Gilded Filigree", "url": "/card-assets/dividers/gilded-filigree.svg", "kind": "divider", "description": "Official CardForge default asset seeded for continuous developer review."}, {"asset_id": "gem-center", "name": "Gem Center", "url": "/card-assets/dividers/gem-center.svg", "kind": "divider", "description": "Official CardForge default asset seeded for continuous developer review."}, {"asset_id": "runic-thread", "name": "Runic Thread", "url": "/card-assets/dividers/runic-thread.svg", "kind": "divider", "description": "Official CardForge default asset seeded for continuous developer review."}, {"asset_id": "double-rule", "name": "Double Rule", "url": "/card-assets/dividers/double-rule.svg", "kind": "divider", "description": "Official CardForge default asset seeded for continuous developer review."}, {"asset_id": "vine-rule", "name": "Vine Rule", "url": "/card-assets/dividers/vine-rule.svg", "kind": "divider", "description": "Official CardForge default asset seeded for continuous developer review."}, {"asset_id": "arcane-chevron", "name": "Arcane Chevron", "url": "/card-assets/dividers/arcane-chevron.svg", "kind": "divider", "description": "Official CardForge default asset seeded for continuous developer review."}, {"asset_id": "arcane-forge-corner-flourish", "name": "Corner Flourish", "url": "/card-assets/dividers/arcane-forge/corner-flourish.svg", "kind": "divider", "description": "Official CardForge default asset seeded for continuous developer review."}, {"asset_id": "arcane-forge-gilded-title-plate", "name": "Gilded Title Plate", "url": "/card-assets/dividers/arcane-forge/gilded-title-plate.svg", "kind": "divider", "description": "Official CardForge default asset seeded for continuous developer review."}, {"asset_id": "arcane-forge-mana-gem-rule", "name": "Mana Gem Rule", "url": "/card-assets/dividers/arcane-forge/mana-gem-rule.svg", "kind": "divider", "description": "Official CardForge default asset seeded for continuous developer review."}, {"asset_id": "arcane-forge-neon-sigil-divider", "name": "Neon Sigil Divider", "url": "/card-assets/dividers/arcane-forge/neon-sigil-divider.svg", "kind": "divider", "description": "Official CardForge default asset seeded for continuous developer review."}, {"asset_id": "arcane-forge-rune-rule-separator", "name": "Rune Rule Separator", "url": "/card-assets/dividers/arcane-forge/rune-rule-separator.svg", "kind": "divider", "description": "Official CardForge default asset seeded for continuous developer review."}, {"asset_id": "arcane-forge-stat-rail", "name": "Stat Rail", "url": "/card-assets/dividers/arcane-forge/stat-rail.svg", "kind": "divider", "description": "Official CardForge default asset seeded for continuous developer review."}, {"asset_id": "divider-gem-center", "name": "Gem Center Divider", "url": "/api/styles#divider-gem-center", "kind": "elementPreset", "description": "Official CardForge layout/preset default seeded into continuous developer review."}, {"asset_id": "icon-fire-relic", "name": "Fire Relic Icon", "url": "/api/styles#icon-fire-relic", "kind": "elementPreset", "description": "Official CardForge layout/preset default seeded into continuous developer review."}, {"asset_id": "material-arcane-forge-parchment", "name": "Arcane Forge Parchment", "url": "/api/styles#material-arcane-forge-parchment", "kind": "elementPreset", "description": "Official CardForge layout/preset default seeded into continuous developer review."}, {"asset_id": "material-obsidian-gilt", "name": "Obsidian Gilt", "url": "/api/styles#material-obsidian-gilt", "kind": "elementPreset", "description": "Official CardForge layout/preset default seeded into continuous developer review."}, {"asset_id": "material-obsidian-neon-premium", "name": "Obsidian Neon Premium", "url": "/api/styles#material-obsidian-neon-premium", "kind": "elementPreset", "description": "Official CardForge layout/preset default seeded into continuous developer review."}, {"asset_id": "material-parchment-aged", "name": "Aged Parchment", "url": "/api/styles#material-parchment-aged", "kind": "elementPreset", "description": "Official CardForge layout/preset default seeded into continuous developer review."}, {"asset_id": "material-purple-foil", "name": "Purple Foil", "url": "/api/styles#material-purple-foil", "kind": "elementPreset", "description": "Official CardForge layout/preset default seeded into continuous developer review."}]$manifest$::jsonb) as x(asset_id text,name text,url text,kind text,description text);
create function pg_temp.initialize_fresh_seed() returns integer language plpgsql as $$
declare e record; r public.cardforge_asset_registry%rowtype; s public.cardforge_contributor_asset_submissions%rowtype;
l public.cardforge_pipeline_asset_lineages%rowtype; n integer:=0;
begin
 if coalesce(current_setting('cardforge.local_replay',true),'') !~ '^cf-trash-[0-9]+-[0-9]+$'
 or (select max(version) from supabase_migrations.schema_migrations)  is distinct from  '20260923194000'
 or (select count(*) from pg_temp.replay_expected)  is distinct from  37
 or (select count(*) from public.cardforge_asset_registry)  is distinct from  43
 then raise exception 'fresh_seed_boundary'; end if;
 lock table public.cardforge_pipeline_asset_lineages,public.cardforge_contributor_asset_submissions,
 public.cardforge_asset_registry,public.cardforge_pipeline_publication_events in share row exclusive mode nowait;
 for e in select * from pg_temp.replay_expected order by asset_id loop
  select * into r from public.cardforge_asset_registry where asset_id=e.asset_id;
  if not found then raise exception 'fresh_seed_identity: %',e.asset_id;end if;
  select * into s from public.cardforge_contributor_asset_submissions where id=r.contributor_submission_id;
  if not found then raise exception 'fresh_seed_identity: %',e.asset_id;end if;
  select * into l from public.cardforge_pipeline_asset_lineages where id=s.lineage_id;
  if not found or l.registry_asset_id is distinct from e.asset_id or l.purge_state is not null
    or coalesce((to_jsonb(l)->>'revision_high_water')::int,0)>1
    or r.status is distinct from 'published' or s.status is distinct from 'published' or r.asset_type is distinct from e.kind
    or s.asset_type is distinct from case e.kind when 'texture' then 'textures' when 'divider' then 'dividers' when 'icon' then 'icons' when 'image' then 'imageAssets' when 'elementPreset' then 'elementPresets' end
    or r.name is distinct from e.name or s.name is distinct from e.name or r.url is distinct from e.url or s.source_url is distinct from e.url
    or s.description is distinct from e.description or s.contributor_id is distinct from 'cardforge-official' or s.contributor_email is not null
    or s.registry_asset_id is distinct from e.asset_id or s.source_payload is not null
    or r.storage_bucket is not null or r.storage_path is not null
    or s.source_storage_bucket is not null or s.source_storage_path is not null
    or to_jsonb(s)->>'purge_claim_token' is not null or to_jsonb(s)->>'owner_purge_requested_at' is not null
    or s.purge_state is not null or s.purge_claimed_at is not null or s.trashed_at is not null
    or s.retention_hold or s.submission_key is not null
    or s.submitted_at is null or s.published_at is null or not isfinite(s.published_at) or not isfinite(s.submitted_at)
    or s.published_at<s.submitted_at or s.published_at>now()
    or exists(select 1 from public.cardforge_pipeline_asset_tombstones where asset_id=e.asset_id)
    or exists(select 1 from public.cardforge_contributor_asset_submissions x where x.id is distinct from s.id
      and (x.lineage_id=l.id or x.registry_asset_id=e.asset_id or x.target_registry_asset_id=e.asset_id))
    or (select count(*) from public.cardforge_pipeline_publication_events x where x.registry_asset_id=e.asset_id) is distinct from 1
    or not exists(select 1 from public.cardforge_pipeline_publication_events x where x.registry_asset_id=e.asset_id
      and x.lineage_id=l.id and x.published_submission_id=s.id and x.previous_submission_id is null
      and x.published_revision_number is null and x.decision_source='bootstrap' and x.published_at=s.published_at)
  then raise exception 'fresh_seed_provenance_or_history: %',e.asset_id;end if;
  if s.revision_number=1 and s.base_revision_number=0 and s.target_registry_asset_id=e.asset_id
    and r.metadata->>'revisionNumber'='1' and r.metadata->>'revisionId'=s.id::text
    and (r.metadata->>'revisionPublishedAt')::timestamptz=s.published_at then continue;end if;
  if s.revision_number is not null or s.base_revision_number is not null or s.target_registry_asset_id is not null
    or r.metadata ?| array['revisionNumber','revisionId','revisionPublishedAt']
    or coalesce((to_jsonb(l)->>'revision_high_water')::int,0) is distinct from 0
  then raise exception 'fresh_seed_revision_conflict: %',e.asset_id;end if;
  update public.cardforge_contributor_asset_submissions set target_registry_asset_id=e.asset_id,
    base_revision_number=0,revision_number=1 where id=s.id;
  update public.cardforge_asset_registry set metadata=metadata||jsonb_build_object(
    'revisionNumber',1,'revisionId',s.id,'revisionPublishedAt',s.published_at) where asset_id=e.asset_id;
  n:=n+1;
 end loop;
 return n;
end; $$;
create function pg_temp.reject_seed_mutation(p_sql text) returns void language plpgsql as $$
begin
 execute p_sql;
 perform pg_temp.initialize_fresh_seed();
 raise exception 'negative_case_was_accepted';
exception when raise_exception then
 if sqlerrm not like 'fresh_seed_%' then raise;end if;
end; $$;
-- Each function exception rolls the whole negative-case subtransaction back.
select pg_temp.reject_seed_mutation($q$update public.cardforge_asset_registry set contributor_submission_id=null where asset_id='arcane-hatch'$q$);
select pg_temp.reject_seed_mutation($q$update public.cardforge_contributor_asset_submissions set source_url=null where registry_asset_id='arcane-hatch'$q$);
select pg_temp.reject_seed_mutation($q$update public.cardforge_contributor_asset_submissions set description='unknown provenance' where registry_asset_id='arcane-hatch'$q$);
select pg_temp.reject_seed_mutation($q$update public.cardforge_asset_registry set metadata=metadata||'{"revisionNumber":2}'::jsonb where asset_id='arcane-hatch'$q$);
select pg_temp.reject_seed_mutation($q$insert into public.cardforge_contributor_asset_submissions
 select (jsonb_populate_record(null::public.cardforge_contributor_asset_submissions,to_jsonb(s)||jsonb_build_object('id',gen_random_uuid(),'revision_number',2,'target_registry_asset_id','arcane-hatch'))).* from public.cardforge_contributor_asset_submissions s where registry_asset_id='arcane-hatch'$q$);
create temporary table replay_events_before on commit drop as select * from public.cardforge_pipeline_publication_events;
do $$begin if pg_temp.initialize_fresh_seed() is distinct from 37 then raise exception 'expected37';end if;end;$$;
create temporary table replay_rows_before on commit drop as select to_jsonb(s) as row from public.cardforge_contributor_asset_submissions s;
do $$begin
 if pg_temp.initialize_fresh_seed() is distinct from 0 then raise exception 'repeat_created_revision';end if;
 if exists((select * from pg_temp.replay_events_before except select * from public.cardforge_pipeline_publication_events)
   union all (select * from public.cardforge_pipeline_publication_events except select * from pg_temp.replay_events_before))
 then raise exception 'publication_history_changed';end if;
 if exists((select row from pg_temp.replay_rows_before except select to_jsonb(s) from public.cardforge_contributor_asset_submissions s)
   union all(select to_jsonb(s) from public.cardforge_contributor_asset_submissions s except select row from pg_temp.replay_rows_before))
 then raise exception 'repeat_changed_submission';end if;
end;$$;
commit;
