-- Avoid SHARE-table / lineage-row inversion with revision claims and legacy
-- writers. Busy native state fails with 55P03; no retry or claim is synthesized.
begin;
set local lock_timeout='5s';

create or replace function public.cardforge_change_catalog_trash(p_actor_user_id text,p_action text,p_expected jsonb,p_held boolean default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare snapshot jsonb; l public.cardforge_pipeline_asset_lineages%rowtype; r public.cardforge_asset_registry%rowtype;
  target uuid; days integer;
begin
  if nullif(btrim(p_actor_user_id),'') is null or p_action is null or p_action not in ('trash','restore','hold') then
    raise exception 'catalog_trash_state_changed'; end if;
  -- Match the pipeline owner ordering. Inventory-bearing tables are stabilized
  -- before lineage acquisition, never while waiting behind a row-first writer.
  perform pg_advisory_xact_lock(hashtextextended('cardforge-contributor-pipeline',0));
  lock table public.cardforge_contributor_asset_submissions, public.cardforge_asset_registry,
    public.cardforge_studio_documents in share mode nowait;
  target:=(p_expected->'identity'->>'submissionId')::uuid;
  -- A claim can own the lineage before requesting ROW EXCLUSIVE on
  -- submissions. Never wait for it while retaining our SHARE table locks.
  perform 1 from public.cardforge_pipeline_asset_lineages lineage
    where lineage.id=(select s.lineage_id from public.cardforge_contributor_asset_submissions s where s.id=target)
    for update nowait;
  if not found then raise exception 'catalog_trash_not_found'; end if;
  snapshot:=public.cardforge_read_catalog_trash(target);
  if snapshot->'state' is distinct from p_expected then raise exception 'catalog_trash_state_changed'; end if;
  select * into l from public.cardforge_pipeline_asset_lineages where id=(p_expected->'identity'->>'lineageId')::uuid for update;
  if not found then raise exception 'catalog_trash_identity_changed'; end if;
  if l.catalog_destructive_uncertainty is not null or l.catalog_claim_token is not null or l.catalog_claimed_at is not null or l.purge_state is not null then
    raise exception 'catalog_trash_already_claimed'; end if;
  if exists(select 1 from public.cardforge_contributor_asset_submissions s where s.lineage_id=l.id
    and (s.purge_state is not null or s.purge_claim_token is not null or s.purge_claimed_at is not null or s.owner_purge_requested_at is not null)) then
    raise exception 'catalog_trash_already_claimed'; end if;
  if p_action='trash' then
    if l.catalog_trashed_at is not null then raise exception 'catalog_trash_state_changed'; end if;
    if jsonb_array_length(snapshot->'entryReasons')>0 then raise exception 'catalog_trash_dependency_blocked'; end if;
    select * into r from public.cardforge_asset_registry where asset_id=l.registry_asset_id;
    -- Require the selected currently-published revision, not an arbitrary old
    -- revision in the same lineage. The high-water CAS includes pending work.
    if r.contributor_submission_id is distinct from target then raise exception 'catalog_trash_identity_changed'; end if;
    days:=(snapshot->>'retentionDays')::integer;
    update public.cardforge_pipeline_asset_lineages set catalog_trashed_at=now(),catalog_purge_after=now()+make_interval(days=>days),
      catalog_retention_hold=false,catalog_trash_registry_submission_id=r.contributor_submission_id,
      catalog_trash_registry_status=r.status,catalog_trash_registry_access_tier=r.access_tier,
      catalog_trash_revision_high_water=revision_high_water where id=l.id;
  else
    if l.catalog_trashed_at is null then raise exception 'catalog_trash_state_changed'; end if;
    if p_action='hold' then
      if p_held is null then raise exception 'catalog_trash_state_changed'; end if;
      update public.cardforge_pipeline_asset_lineages set catalog_retention_hold=p_held where id=l.id;
    else
      -- A deadline is eligibility, not deletion proof. Restore remains safe
      -- after it only while this locked lineage has no destructive commitment.
      update public.cardforge_pipeline_asset_lineages set catalog_trashed_at=null,catalog_purge_after=null,
        catalog_retention_hold=false,catalog_trash_registry_submission_id=null,catalog_trash_registry_status=null,
        catalog_trash_registry_access_tier=null,catalog_trash_revision_high_water=null where id=l.id;
    end if;
  end if;
  snapshot:=public.cardforge_read_catalog_trash(target);
  insert into public.cardforge_owner_activity(actor_user_id,action,target_type,target_id,summary,outcome,metadata)
    values(p_actor_user_id,'library.catalog.'||p_action,'pipeline_asset_lineage',l.id::text,
      'Owner catalog recovery: '||p_action,'succeeded',jsonb_build_object('before',p_expected,'after',snapshot->'state'));
  return snapshot;
end $$;
commit;
