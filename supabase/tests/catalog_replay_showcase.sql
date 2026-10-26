-- Invoked only by the container/loopback-guarded replay bridge after byte proof.
begin;
set local lock_timeout='2s';
select set_config('cardforge.local_replay', :'replay_project', true);
create temporary table replay_showcase_item on commit drop as select :'descriptor'::jsonb as item;
create function pg_temp.initialize_replay_showcase() returns uuid language plpgsql as $$
declare d jsonb; r public.cardforge_asset_registry%rowtype; s public.cardforge_contributor_asset_submissions%rowtype;
l public.cardforge_pipeline_asset_lineages%rowtype; sid uuid; event_time timestamptz;
begin
 select item into strict d from pg_temp.replay_showcase_item;
 if coalesce(current_setting('cardforge.local_replay',true),'') !~ '^cf-trash-[0-9]+-[0-9]+$'
 or (select max(version) from supabase_migrations.schema_migrations) is distinct from '20260923194000'
 or d->>'asset_id' is distinct from 'showcase-playing-cards-ace-of-spades' or d->>'registry_asset_type' is distinct from 'image'
 or d->>'contributor_asset_type' is distinct from 'imageAssets' or d->>'storage_bucket' is distinct from 'cardforge-contributor-assets'
 or d->>'storage_path' is distinct from 'owner-defaults/site-fallbacks/showcase/playing-cards/ace-of-spades.webp'
 or d->>'url' is distinct from 'http://127.0.0.1:54321/storage/v1/object/public/cardforge-contributor-assets/owner-defaults/site-fallbacks/showcase/playing-cards/ace-of-spades.webp'
 or d#>>'{metadata,sourcePath}' is distinct from 'public/site-fallbacks/showcase/playing-cards/ace-of-spades.webp'
 or d#>>'{metadata,sourceKind}' is distinct from 'pipeline-owner-import'
 or not exists(select 1 from storage.objects where bucket_id=d->>'storage_bucket' and name=d->>'storage_path'
   and (metadata->>'size')::bigint=(d->>'file_size_bytes')::bigint)
 then raise exception 'fresh_showcase_descriptor_or_bytes';end if;
 lock table public.cardforge_pipeline_asset_lineages,public.cardforge_contributor_asset_submissions,
 public.cardforge_asset_registry,public.cardforge_pipeline_publication_events in share row exclusive mode nowait;
 if exists(select 1 from public.cardforge_pipeline_asset_tombstones where asset_id=d->>'asset_id') then raise exception 'fresh_showcase_tombstone';end if;
 select * into r from public.cardforge_asset_registry where asset_id=d->>'asset_id';
 if not found then
  if exists(select 1 from public.cardforge_contributor_asset_submissions where registry_asset_id=d->>'asset_id' or target_registry_asset_id=d->>'asset_id')
    or exists(select 1 from public.cardforge_pipeline_asset_lineages where registry_asset_id=d->>'asset_id')
    or exists(select 1 from public.cardforge_pipeline_publication_events where registry_asset_id=d->>'asset_id')
  then raise exception 'fresh_showcase_identity_conflict';end if;
  -- Same native creation owner as the importer, using the existing seed actor.
  sid:=public.cardforge_upsert_pipeline_registry_asset(d->>'asset_id',d->>'name',d->>'contributor_asset_type',
    d->>'registry_asset_type',d->>'url',d->>'preview_url',d->>'description','cardforge-official',null,
    (d->>'file_size_bytes')::bigint,d->>'source_mime_type',d->>'storage_bucket',d->>'storage_path',d->'metadata');
  select published_at into strict event_time from public.cardforge_pipeline_publication_events
    where registry_asset_id=d->>'asset_id' and published_submission_id=sid and previous_submission_id is null;
  if event_time is null or not isfinite(event_time) then raise exception 'fresh_showcase_timestamp';end if;
  update public.cardforge_contributor_asset_submissions set target_registry_asset_id=d->>'asset_id',
    base_revision_number=0,revision_number=1,published_at=event_time where id=sid;
  update public.cardforge_asset_registry set metadata=metadata||jsonb_build_object(
    'revisionNumber',1,'revisionId',sid,'revisionPublishedAt',event_time) where asset_id=d->>'asset_id';
  select * into strict r from public.cardforge_asset_registry where asset_id=d->>'asset_id';
 end if;
 select * into s from public.cardforge_contributor_asset_submissions where id=r.contributor_submission_id;
 if not found then raise exception 'fresh_showcase_identity_conflict';end if;
 select * into l from public.cardforge_pipeline_asset_lineages where id=s.lineage_id;
 if not found or l.registry_asset_id is distinct from r.asset_id or l.purge_state is not null
   or coalesce((to_jsonb(l)->>'revision_high_water')::int,0)>1
   or r.name is distinct from d->>'name' or s.name is distinct from d->>'name'
   or s.description is distinct from d->>'description'
   or s.source_storage_bucket is distinct from d->>'storage_bucket' or s.source_storage_path is distinct from d->>'storage_path'
   or s.source_file_size_bytes is distinct from (d->>'file_size_bytes')::bigint
   or r.status is distinct from 'published' or r.asset_type is distinct from 'image' or r.url is distinct from d->>'url'
   or r.storage_bucket is distinct from d->>'storage_bucket' or r.storage_path is distinct from d->>'storage_path'
   or r.metadata->>'revisionNumber' is distinct from '1' or r.metadata->>'revisionId' is distinct from s.id::text
   or (r.metadata->>'revisionPublishedAt')::timestamptz is distinct from s.published_at
   or s.registry_asset_id is distinct from r.asset_id or s.target_registry_asset_id is distinct from r.asset_id
   or s.status is distinct from 'published' or s.asset_type is distinct from 'imageAssets' or s.contributor_id is distinct from 'cardforge-official'
   or s.contributor_email is not null or s.revision_number is distinct from 1 or s.base_revision_number is distinct from 0
   or s.published_at is null or not isfinite(s.published_at) or s.source_url is distinct from d->>'url'
   or s.purge_state is not null or s.purge_claimed_at is not null or s.trashed_at is not null
   or s.retention_hold or s.submission_key is not null
   or exists(select 1 from public.cardforge_contributor_asset_submissions x where x.id is distinct from s.id
     and (x.lineage_id=l.id or x.registry_asset_id=r.asset_id or x.target_registry_asset_id=r.asset_id))
   or (select count(*) from public.cardforge_pipeline_publication_events where registry_asset_id=r.asset_id) is distinct from 1
   or not exists(select 1 from public.cardforge_pipeline_publication_events where registry_asset_id=r.asset_id
     and lineage_id=l.id and published_submission_id=s.id and previous_submission_id is null
     and published_revision_number is null and decision_source='owner' and published_at=s.published_at)
 then raise exception 'fresh_showcase_identity_conflict';end if;
 return s.id;
end; $$;
select pg_temp.initialize_replay_showcase();
create temporary table showcase_before on commit drop as select
 (select jsonb_agg(to_jsonb(s) order by id) from public.cardforge_contributor_asset_submissions s) as submissions,
 (select jsonb_agg(to_jsonb(r) order by asset_id) from public.cardforge_asset_registry r) as registry,
 (select jsonb_agg(to_jsonb(e) order by id) from public.cardforge_pipeline_publication_events e) as events;
select pg_temp.initialize_replay_showcase();
do $$begin
 if (select submissions from pg_temp.showcase_before) is distinct from (select jsonb_agg(to_jsonb(s) order by id) from public.cardforge_contributor_asset_submissions s)
 or (select registry from pg_temp.showcase_before) is distinct from (select jsonb_agg(to_jsonb(r) order by asset_id) from public.cardforge_asset_registry r)
 or (select events from pg_temp.showcase_before) is distinct from (select jsonb_agg(to_jsonb(e) order by id) from public.cardforge_pipeline_publication_events e)
 then raise exception 'showcase_repeat_changed_state';end if;
 begin
  update public.cardforge_asset_registry set contributor_submission_id=null where asset_id='showcase-playing-cards-ace-of-spades';
  perform pg_temp.initialize_replay_showcase();
  raise exception 'showcase_negative_accepted';
 exception when raise_exception then
  if sqlerrm is distinct from 'fresh_showcase_identity_conflict' then raise;end if;
 end;
end;$$;
commit;
