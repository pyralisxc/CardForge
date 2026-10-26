-- Owner-only commands are invoked by the canonical server service, which
-- resolves Clerk Owner access. Browser roles cannot invoke these functions.
begin;
set local lock_timeout='5s';

create function public.cardforge_catalog_trash_entry_reasons(p_lineage_id uuid)
returns text[] language plpgsql security invoker set search_path='' as $$
declare l public.cardforge_pipeline_asset_lineages%rowtype; r public.cardforge_asset_registry%rowtype;
  reasons text[] := '{}';
begin
  select * into l from public.cardforge_pipeline_asset_lineages where id=p_lineage_id;
  select * into r from public.cardforge_asset_registry where asset_id=l.registry_asset_id;
  if l.catalog_destructive_uncertainty is not null then reasons:=array_append(reasons,l.catalog_destructive_uncertainty); end if;
  if l.purge_state is not null or l.catalog_claim_token is not null or l.catalog_claimed_at is not null
    or exists(select 1 from public.cardforge_contributor_asset_submissions s where s.lineage_id=l.id
      and (s.purge_state is not null or s.purge_claim_token is not null or s.purge_claimed_at is not null or s.owner_purge_requested_at is not null))
    then reasons:=array_append(reasons,'destructive_attempt_requires_reconciliation'); end if;
  if r.asset_id is null or r.contributor_submission_id is null then
    reasons:=array_append(reasons,'catalog_registry_identity_unavailable');
  end if;
  if exists(select 1 from public.cardforge_contributor_asset_submissions newer
    join public.cardforge_contributor_asset_submissions published_base on published_base.id=r.contributor_submission_id
    where newer.lineage_id=l.id and newer.revision_number>published_base.revision_number) then
    reasons:=array_append(reasons,'newer_revision_requires_review');
  end if;
  if exists(select 1 from public.cardforge_contributor_asset_submissions source where source.lineage_id=l.id
    and (source.source_storage_bucket is not null or source.source_storage_path is not null)) then
    reasons:=array_append(reasons,'upload_cleanup_commitment_unverified');
  end if;
  -- Templates, fonts and presets also supply the runtime bootstrap. Do not
  -- hide them before installed-resolution compatibility has been established.
  if r.asset_type is null or r.asset_type not in ('image','texture','divider','icon') then
    reasons:=array_append(reasons,'installed_runtime_resolution_unverified');
  end if;
  -- An external JSON fallback is opaque to native dependency inspection. A
  -- failed/inaccessible URL is never proof of no references. Do not fetch it in
  -- SQL or accept a caller-supplied "empty" scan. Native Templates must meet
  -- the actual runtime predicate; ASCII non-whitespace is a conservative subset
  -- of JS trim. Style/Set semantic validation is not yet available natively.
  if exists(select 1 from public.cardforge_asset_registry a
    left join public.cardforge_contributor_asset_submissions s on s.id=a.contributor_submission_id
    where a.asset_type in ('elementPreset','set')
      or (a.asset_type='template' and not coalesce(
        jsonb_typeof(s.source_payload)='object'
        and jsonb_typeof(s.source_payload->'id')='string' and (s.source_payload->>'id') ~ '[!-~]'
        and jsonb_typeof(s.source_payload->'name')='string' and (s.source_payload->>'name') ~ '[!-~]'
        and jsonb_typeof(s.source_payload->'aspectRatio')='string',false))) then
    reasons:=array_append(reasons,'json_consumer_inventory_unverified');
  end if;
  -- Direct media URLs remain valid: no registry mutation and no bytes removed.
  -- Identity-based consumers can depend on discovery; conservatively block
  -- those instead of pretending a URL-only inspection covers their semantics.
  if r.asset_id is not null and exists(select 1 from public.cardforge_studio_documents d
    where strpos(d.document_payload::text,to_jsonb(r.asset_id)::text)>0) then
    reasons:=array_append(reasons,'studio_identity_consumer_requires_resolution');
  end if;
  if r.asset_id is not null and exists(select 1 from public.cardforge_contributor_asset_submissions s
    where s.lineage_id<>l.id and strpos(s.source_payload::text,to_jsonb(r.asset_id)::text)>0) then
    reasons:=array_append(reasons,'pipeline_identity_consumer_requires_resolution');
  end if;
  return reasons;
end $$;

create function public.cardforge_read_catalog_trash(p_submission_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare l public.cardforge_pipeline_asset_lineages%rowtype; s public.cardforge_contributor_asset_submissions%rowtype;
  r public.cardforge_asset_registry%rowtype; days integer; reasons text[];
begin
  select lineage.* into l from public.cardforge_pipeline_asset_lineages lineage
    where lineage.id=(select x.lineage_id from public.cardforge_contributor_asset_submissions x where x.id=p_submission_id)
    for update;
  if not found then raise exception 'catalog_trash_not_found'; end if;
  select * into s from public.cardforge_contributor_asset_submissions where id=p_submission_id;
  select * into r from public.cardforge_asset_registry where asset_id=l.registry_asset_id;
  select trash_retention_days into days from public.cardforge_contributor_program_settings where id='default';
  if days is null or days<=0 then raise exception 'catalog_trash_inventory_unavailable'; end if;
  if (l.catalog_trashed_at is null)<>(l.catalog_purge_after is null)
    or (l.catalog_trashed_at is not null and (not isfinite(l.catalog_trashed_at) or not isfinite(l.catalog_purge_after)
      or l.catalog_purge_after<=l.catalog_trashed_at)) then raise exception 'catalog_trash_state_changed'; end if;
  reasons:=public.cardforge_catalog_trash_entry_reasons(l.id);
  if r.contributor_submission_id is distinct from s.id then reasons:=array_append(reasons,'catalog_registry_identity_unavailable'); end if;
  return jsonb_build_object('name',s.name,'retentionDays',days,
    'entryReasons',to_jsonb(reasons),
    'reasons',jsonb_build_array('physical_expiry_unavailable_complete_reference_and_worker_proof_required'),
    'state',jsonb_build_object('identity',jsonb_build_object('lineageId',l.id,'submissionId',s.id,
      'registrySubmissionId',r.contributor_submission_id,'revisionHighWater',l.revision_high_water),
      'trashedAt',l.catalog_trashed_at,'purgeAfter',l.catalog_purge_after,'held',l.catalog_retention_hold));
end $$;

create function public.cardforge_change_catalog_trash(p_actor_user_id text,p_action text,p_expected jsonb,p_held boolean default null)
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
    public.cardforge_studio_documents in share mode;
  target:=(p_expected->'identity'->>'submissionId')::uuid;
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

-- Discovery projection only; exact registry rows and original URLs survive.
create view public.cardforge_discoverable_asset_registry with (security_invoker=true) as
select r.* from public.cardforge_asset_registry r
where not exists(select 1 from public.cardforge_pipeline_asset_lineages l
  where l.registry_asset_id=r.asset_id and l.catalog_trashed_at is not null);
revoke all on public.cardforge_discoverable_asset_registry from public,anon,authenticated;
grant select on public.cardforge_discoverable_asset_registry to service_role;
revoke all on function public.cardforge_catalog_trash_entry_reasons(uuid) from public,anon,authenticated;
revoke all on function public.cardforge_read_catalog_trash(uuid) from public,anon,authenticated;
revoke all on function public.cardforge_change_catalog_trash(text,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.cardforge_catalog_trash_entry_reasons(uuid) to service_role;
grant execute on function public.cardforge_read_catalog_trash(uuid) to service_role;
grant execute on function public.cardforge_change_catalog_trash(text,text,jsonb,boolean) to service_role;
commit;
