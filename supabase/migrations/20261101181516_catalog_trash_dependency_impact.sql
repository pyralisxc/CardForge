begin;
set local lock_timeout='5s';
-- Reversible discovery removal is not physical erasure. Existing erasure
-- inventory/claim/finalizer owners stay unchanged. Typed recognition does not
-- treat a printable URL in text as a runtime dependency.
create function public.cardforge_catalog_known_reference(p jsonb,ids text[],sources text[],field text default '',depth integer default 0)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare k text; v jsonb; value text; source text;
begin
 if depth>80 then return false; end if;
 if jsonb_typeof(p)='object' then
  for k,v in select * from jsonb_each(p) loop
   if k in ('name','label','title','description','contributorName','templateDescription','metadata','mcpOperationReceipts','exportSettings','organization') then continue; end if;
   if k='content' and coalesce(p->>'type','')<>'image' then continue; end if;
   if public.cardforge_catalog_known_reference(v,ids,sources,case when k in ('content','defaultValue','example') and p->>'type'='image' then 'imageSource' else k end,depth+1) then return true; end if;
  end loop;
 elsif jsonb_typeof(p)='array' then
  for v in select * from jsonb_array_elements(p) loop
   if public.cardforge_catalog_known_reference(v,ids,sources,field,depth+1) then return true; end if;
  end loop;
 elsif jsonb_typeof(p)='string' then
  value:=p#>>'{}';
  if field in ('assetId','registryAssetId','templateId','backingTemplateId','templateIds','templateLineageId','templateRevisionId','templateOriginLineageId','templateOriginRevisionId','styleId','presetId','lineageId','parentSubmissionId','assetSource','dividerAsset','imageSource','iconImageSource','backgroundImageUrl','cardBackgroundImageUrl','cardBorderImageSource','url','src','source','previewUrl','preview_url','assetUrl','dataUrl','backgroundImage','borderImageSource') then
   if value=any(ids) then return true; end if;
   foreach source in array coalesce(sources,'{}'::text[]) loop
    if source<>'' and (split_part(value,'#',1)=split_part(source,'#',1) or (field in ('backgroundImage','borderImageSource') and (strpos(value,'url("'||source||'")')>0 or strpos(value,'url('''||source||''')')>0 or strpos(value,'url('||source||')')>0))) then return true; end if;
   end loop;
  end if;
 end if;
 return false;
end $$;

-- Private inventory stays inside the native service boundary. Public/service
-- projections below decide which exact metadata the actor may receive.
create function public.cardforge_catalog_known_dependencies(refs jsonb,ids text[],sources text[])
returns boolean language sql immutable security invoker set search_path='' as $$
 select public.cardforge_catalog_known_reference(jsonb_build_object('assetId',refs->'identities','imageSource',refs->'sources','backgroundImage',refs->'sources'),ids,sources);
$$;

create function public.cardforge_catalog_impact_rows(p_lineage_id uuid)
returns table(origin text,record_id text,object_id text,submission_id text,object_name text,owner_id text,shared boolean,known boolean,evidence text,condition text)
language sql stable security invoker set search_path='' as $$
with aliases as (
 select array_remove(array[l.id::text,l.registry_asset_id],null)||array(select s.id::text from public.cardforge_contributor_asset_submissions s where s.lineage_id=l.id) ids,
 array(select distinct u from (select r.url u union all select r.preview_url union all select s.source_url from public.cardforge_contributor_asset_submissions s where s.lineage_id=l.id union all select s.preview_url from public.cardforge_contributor_asset_submissions s where s.lineage_id=l.id) x where nullif(u,'') is not null) sources
 from public.cardforge_pipeline_asset_lineages l left join public.cardforge_asset_registry r on r.asset_id=l.registry_asset_id where l.id=p_lineage_id
), details as (
 select x->>'origin' origin,x->>'recordId' id,x->'conditions' conditions from jsonb_array_elements(public.cardforge_catalog_trash_inventory_details(p_lineage_id)) x
), rows as (
 select d.origin,d.id record_id,
 case when d.origin='studio' then doc.id::text else coalesce(s.lineage_id::text,s.id::text,r.asset_id) end object_id,
 s.id::text submission_id,coalesce(doc.title,r.name,s.name) object_name,coalesce(doc.owner_user_id,s.contributor_id) owner_id,
 (r.status='published' or s.status in ('submitted','voting','publish_candidate','published') or s.revision_publication_retained or s.published_at is not null) shared,
 case when d.origin='studio' then doc.document_payload
 when r.asset_type='elementPreset' then coalesce(nullif(s.source_payload,'null'::jsonb),nullif(r.metadata->'style','null'::jsonb),nullif(r.metadata->'elementPreset','null'::jsonb),nullif(r.metadata->'payload','null'::jsonb)) else s.source_payload end payload,
 case when d.origin='studio' then doc.catalog_dependencies else s.catalog_dependencies end binding,
 doc.revision, to_jsonb(s) submission,
 jsonb_build_object('source',s.source_payload,'binding',s.catalog_dependencies,'registry',case when r.asset_id is not null then jsonb_build_array(r.asset_id,r.contributor_submission_id,r.status,r.url,r.preview_url) end,'document',doc.document_payload,'revision',doc.revision,'documentBinding',doc.catalog_dependencies,'name',coalesce(doc.title,r.name,s.name)) version,
 case when jsonb_array_length(d.conditions-'target_identity_or_source_reference')>0 then 'incomplete_dependency_coverage' end condition
 from details d
 left join public.cardforge_studio_documents doc on d.origin='studio' and doc.id::text=d.id
 left join public.cardforge_asset_registry r on d.origin='registry' and r.asset_id=d.id
 left join public.cardforge_contributor_asset_submissions s on (d.origin='submission' and s.id::text=d.id) or (d.origin='registry' and s.id=r.contributor_submission_id)
), evaluated as (
 select rows.*,
 public.cardforge_catalog_known_reference(payload,a.ids,a.sources)
 or public.cardforge_catalog_known_reference(jsonb_build_object('imageSource',coalesce(version->'registry'->>4,submission->>'preview_url')),a.ids,a.sources)
 or (origin='studio' and public.cardforge_studio_dependency_binding_valid(payload,revision,binding) and public.cardforge_catalog_known_dependencies(binding->'references',a.ids,a.sources))
 or (public.cardforge_set_dependency_binding_valid(submission) and public.cardforge_catalog_known_dependencies(binding->'references',a.ids,a.sources))
 or (public.cardforge_raster_binding_valid(submission) and (binding->'managedRaster'->>'assetId'=any(a.ids) or binding->'managedRaster'->>'lineageId'=any(a.ids) or binding->'managedRaster'->>'submissionId'=any(a.ids))) as known
 from rows cross join aliases a
)
select origin,record_id,object_id,submission_id,object_name,owner_id,coalesce(shared,false),coalesce(known,false),md5(version::text||coalesce(payload::text,'null')||coalesce(shared::text,'false')||coalesce(owner_id,'')),condition from evaluated;
$$;

create function public.cardforge_catalog_impact_snapshot(p_lineage_id uuid,p_actor_user_id text,p_is_owner boolean)
returns jsonb language sql stable security invoker set search_path='' as $$
with rows as (select * from public.cardforge_catalog_impact_rows(p_lineage_id)), visible as (
 select * from rows where known and (coalesce(p_is_owner or shared or owner_id=p_actor_user_id,false))
), counts as (
 select count(*) filter(where known) affected,count(*) filter(where known and not(coalesce(p_is_owner or shared or owner_id=p_actor_user_id,false))) private_count,
 count(*) filter(where condition is not null and not known) warnings from rows
)
select jsonb_build_object('affectedCount',affected,'privateAffectedCount',private_count,'coverageWarningCount',warnings,
 'confirmationRequired',affected>0,
 'items',coalesce((select jsonb_agg(jsonb_build_object('origin',origin,'recordId',record_id,'objectId',object_id,'submissionId',submission_id,'name',object_name) order by origin,record_id) from visible),'[]'::jsonb),
 'fingerprint',encode(extensions.digest(jsonb_build_object('actor',p_actor_user_id,'owner',p_is_owner,'lineage',p_lineage_id,
 'target',(select jsonb_build_array(l.registry_asset_id,r.contributor_submission_id,r.url,r.preview_url,r.status,r.name,r.asset_type,r.access_tier,l.revision_high_water,public.cardforge_media_parent_content_version(r.contributor_submission_id)) from public.cardforge_pipeline_asset_lineages l left join public.cardforge_asset_registry r on r.asset_id=l.registry_asset_id where l.id=p_lineage_id),
 'days',(select trash_retention_days from public.cardforge_contributor_program_settings where id='default'),
 'impacts',(select coalesce(jsonb_agg(jsonb_build_array(origin,record_id,evidence) order by origin,record_id),'[]'::jsonb) from rows where known))::text,'sha256'),'hex')) from counts;
$$;

-- Read-through projection: only currently published exact Pipeline consumers.
-- Restore or a corrected source reevaluates this; no second repair queue exists.
create function public.cardforge_pipeline_dependency_health()
returns jsonb language sql stable security invoker set search_path='' as $$
with unavailable as materialized (
 select l.id,l.registry_asset_id,source.name,
 array_remove(array[l.id::text,l.registry_asset_id],null)||array(select s.id::text from public.cardforge_contributor_asset_submissions s where s.lineage_id=l.id) ids,
 array(select distinct u from (select source.url u union all select source.preview_url union all select s.source_url from public.cardforge_contributor_asset_submissions s where s.lineage_id=l.id union all select s.preview_url from public.cardforge_contributor_asset_submissions s where s.lineage_id=l.id) x where nullif(u,'') is not null) sources
 from public.cardforge_pipeline_asset_lineages l join public.cardforge_asset_registry source on source.asset_id=l.registry_asset_id
 where l.catalog_trashed_at is not null or source.status<>'published' or source.access_tier='hidden' or exists(select 1 from public.cardforge_contributor_asset_submissions s where s.id=source.contributor_submission_id and s.trashed_at is not null)
), consumers as materialized (
 select r.asset_id,r.name,s.id submission_id,s.lineage_id,
 case when r.asset_type='elementPreset' then coalesce(nullif(s.source_payload,'null'::jsonb),nullif(r.metadata->'style','null'::jsonb),nullif(r.metadata->'elementPreset','null'::jsonb),nullif(r.metadata->'payload','null'::jsonb)) else s.source_payload end payload,
 r.preview_url,to_jsonb(s) submission,s.catalog_dependencies binding
 from public.cardforge_asset_registry r join public.cardforge_contributor_asset_submissions s on s.id=r.contributor_submission_id
 where r.status='published' and not exists(select 1 from public.cardforge_pipeline_asset_lineages own where own.id=s.lineage_id and own.catalog_trashed_at is not null)
)
select coalesce(jsonb_agg(jsonb_build_object('objectId',c.lineage_id,'objectName',c.name,'sourceAssetId',u.registry_asset_id,'sourceAssetName',u.name,'submissionId',c.submission_id) order by u.id,c.asset_id),'[]'::jsonb)
from unavailable u cross join consumers c
where public.cardforge_catalog_known_reference(c.payload,u.ids,u.sources)
 or public.cardforge_catalog_known_reference(jsonb_build_object('imageSource',c.preview_url),u.ids,u.sources)
 or (public.cardforge_set_dependency_binding_valid(c.submission) and public.cardforge_catalog_known_dependencies(c.binding->'references',u.ids,u.sources))
 or (public.cardforge_raster_binding_valid(c.submission) and (c.binding->'managedRaster'->>'assetId'=any(u.ids) or c.binding->'managedRaster'->>'lineageId'=any(u.ids) or c.binding->'managedRaster'->>'submissionId'=any(u.ids)));
$$;
create or replace function public.cardforge_read_catalog_trash(p_submission_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare l public.cardforge_pipeline_asset_lineages%rowtype; s public.cardforge_contributor_asset_submissions%rowtype;
  r public.cardforge_asset_registry%rowtype; days integer; reasons text[]; impact jsonb;
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
  impact:=public.cardforge_catalog_impact_snapshot(l.id,null,true);
  return jsonb_build_object('impact',impact,'recoveryReasons',to_jsonb(array(select x from unnest(reasons) x where x not in ('json_consumer_inventory_unverified','pipeline_identity_consumer_requires_resolution','studio_identity_consumer_requires_resolution'))),'name',s.name,'retentionDays',days,
    'entryReasons',to_jsonb(reasons),
    'inventoryDetails',public.cardforge_catalog_trash_inventory_details(l.id),
    'reasons',jsonb_build_array('physical_expiry_unavailable_complete_reference_and_worker_proof_required'),
    'state',jsonb_build_object('identity',jsonb_build_object('lineageId',l.id,'submissionId',s.id,
      'registrySubmissionId',r.contributor_submission_id,'revisionHighWater',l.revision_high_water),
      'trashedAt',l.catalog_trashed_at,'purgeAfter',l.catalog_purge_after,'held',l.catalog_retention_hold,'impactFingerprint',impact->>'fingerprint'));
end $$;
create or replace function public.cardforge_read_revision_recovery(p_submission_id uuid,p_actor_user_id text,p_is_owner boolean)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.cardforge_contributor_asset_submissions%rowtype;
 l public.cardforge_pipeline_asset_lineages%rowtype; r public.cardforge_asset_registry%rowtype;
 days integer; blocked text[]:='{}'; entry text[]:='{}'; recovery text[]:='{}'; published boolean; impact jsonb;
begin
 if nullif(btrim(p_actor_user_id),'') is null or p_is_owner is null then raise exception 'revision_recovery_not_permitted'; end if;
 select * into s from public.cardforge_contributor_asset_submissions where id=p_submission_id;
 -- A contributor cannot distinguish another account's private UUID from absence.
 if not found then
   if not p_is_owner then raise exception 'revision_recovery_not_permitted'; end if;
   raise exception 'revision_recovery_not_found';
 end if;
 if not p_is_owner and s.contributor_id is distinct from p_actor_user_id then raise exception 'revision_recovery_not_permitted'; end if;
 select * into l from public.cardforge_pipeline_asset_lineages where id=s.lineage_id;
 if not found then raise exception 'revision_recovery_inventory_unavailable'; end if;
 select * into r from public.cardforge_asset_registry where asset_id=l.registry_asset_id;
 select trash_retention_days into days from public.cardforge_contributor_program_settings where id='default';
 if days is null or days<1 then raise exception 'revision_recovery_inventory_unavailable'; end if;
 if l.catalog_trashed_at is not null then blocked:=array_append(blocked,'catalog_recovery_active'); end if;
 if l.purge_state is not null or l.catalog_claim_token is not null or l.catalog_claimed_at is not null
   or s.purge_state is not null or s.purge_claim_token is not null or s.purge_claimed_at is not null or s.owner_purge_requested_at is not null
 then blocked:=array_append(blocked,'destructive_attempt_requires_reconciliation'); end if;
 -- Only exact-current removal changes runtime discovery. Reuse its proven native
 -- inventory; historical recovery never claims that it can clear catalog holds.
 if r.contributor_submission_id=s.id and s.trashed_at is null then
   entry:=array(select x from unnest(public.cardforge_catalog_trash_entry_reasons(l.id)) x where x not in ('json_consumer_inventory_unverified','pipeline_identity_consumer_requires_resolution','studio_identity_consumer_requires_resolution')); 
 end if;
 entry:=blocked||entry;
 if s.trashed_at is not null then entry:=array_append(entry,'revision_already_trashed'); end if;
 recovery:=blocked;
 if s.retention_hold then recovery:=array_append(recovery,'retention_hold'); end if;
 if s.trashed_at is null then recovery:=array_append(recovery,'revision_not_trashed'); end if;
 if not p_is_owner and (s.revision_trash_actor_role is distinct from 'voting' and (s.revision_trash_actor_role is distinct from 'contributor'
   or s.revision_trash_actor_id is distinct from p_actor_user_id)) then
   recovery:=array_append(recovery,'owner_recovery_required'); end if;
 -- Retention evidence is deliberately broader than render/adoption authority.
 published:=s.revision_publication_retained or s.published_at is not null or s.status='published' or coalesce(s.contributor_lifecycle_state='retired',false)
   or exists(select 1 from public.cardforge_asset_registry registry where registry.contributor_submission_id=s.id)
   or exists(select 1 from public.cardforge_pipeline_publication_events e where e.published_submission_id=s.id);
 if s.trashed_at is not null and (s.revision_trash_previous_status is null or s.revision_trash_previous_status='archived') and not published and s.revision_trash_actor_role is distinct from 'voting' then recovery:=array_append(recovery,'prior_visibility_unavailable'); end if;
 impact:=public.cardforge_catalog_impact_snapshot(l.id,p_actor_user_id,p_is_owner);
 -- Historical/private revision removal does not remove the current source.
 if r.contributor_submission_id is distinct from s.id then impact:=impact||jsonb_build_object('affectedCount',0,'privateAffectedCount',0,'items','[]'::jsonb,'confirmationRequired',false,'fingerprint',encode(extensions.digest(s.id::text,'sha256'),'hex')); end if;
 return jsonb_build_object('impact',impact,'name',s.name,'retentionDays',days,'trashActor',s.revision_trash_actor_role,
 'trashReasons',to_jsonb(entry),'restoreReasons',to_jsonb(recovery),'canHold',p_is_owner and s.trashed_at is not null and cardinality(blocked)=0,
 'publicationRetained',published,'sourceUncertainty',l.catalog_destructive_uncertainty,
 'state',jsonb_build_object('scope','revision','submissionId',s.id,'lineageId',s.lineage_id,'revisionNumber',s.revision_number,
   'registrySubmissionId',r.contributor_submission_id,'revisionHighWater',l.revision_high_water,
   'recoveryVersion',s.revision_recovery_version::text,'status',s.status,'updatedAt',s.updated_at,'trashedAt',s.trashed_at,'purgeAfter',s.purge_after,'held',s.retention_hold,'impactFingerprint',impact->>'fingerprint'));
end $$;
create or replace function public.cardforge_change_catalog_trash(p_actor_user_id text,p_action text,p_expected jsonb,p_held boolean,p_confirmation text)
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
    if (snapshot->'impact'->>'confirmationRequired')::boolean and p_confirmation is distinct from snapshot->'state'->>'impactFingerprint' then raise exception 'catalog_trash_dependency_blocked'; end if;
    if jsonb_array_length(snapshot->'recoveryReasons')>0 then raise exception 'catalog_trash_dependency_blocked'; end if;
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
create or replace function public.cardforge_change_catalog_trash(p_actor_user_id text,p_action text,p_expected jsonb,p_held boolean default null)
returns jsonb language sql security invoker set search_path='' as $$ select public.cardforge_change_catalog_trash(p_actor_user_id,p_action,p_expected,p_held,null); $$;
create or replace function public.cardforge_change_revision_recovery(p_actor_user_id text,p_is_owner boolean,p_action text,p_expected jsonb,p_held boolean,p_confirmation text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare snapshot jsonb; result jsonb; target uuid; days integer; epoch timestamptz;
 s public.cardforge_contributor_asset_submissions%rowtype; l public.cardforge_pipeline_asset_lineages%rowtype;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'revision_recovery_state_changed'; end if;
 if p_action is null or p_action not in ('trash','restore','hold') or p_is_owner is null
   or nullif(btrim(p_actor_user_id),'') is null then raise exception 'revision_recovery_not_permitted'; end if;
 if p_action='hold' and not p_is_owner then raise exception 'revision_recovery_not_permitted'; end if;
 target:=(p_expected->>'submissionId')::uuid;
 -- Authorize before returning inventory, locking private targets or comparing CAS.
 perform public.cardforge_read_revision_recovery(target,p_actor_user_id,p_is_owner);
 perform pg_advisory_xact_lock(hashtextextended('cardforge-contributor-pipeline',0));
 lock table public.cardforge_contributor_asset_submissions, public.cardforge_asset_registry,
   public.cardforge_studio_documents in share mode nowait;
 select lineage.* into l from public.cardforge_pipeline_asset_lineages lineage
   where lineage.id=(select revision.lineage_id from public.cardforge_contributor_asset_submissions revision where revision.id=target)
   for update nowait;
 if not found then raise exception 'revision_recovery_state_changed'; end if;
 select * into s from public.cardforge_contributor_asset_submissions where id=target for update nowait;
 snapshot:=public.cardforge_read_revision_recovery(target,p_actor_user_id,p_is_owner);
 if snapshot->'state' is distinct from p_expected then raise exception 'revision_recovery_state_changed'; end if;
 if p_action='trash' then
   if jsonb_array_length(snapshot->'trashReasons')>0 then raise exception 'revision_recovery_blocked'; end if;
   if (snapshot->'impact'->>'confirmationRequired')::boolean and p_confirmation is distinct from snapshot->'state'->>'impactFingerprint' then raise exception 'revision_recovery_blocked'; end if;
   days:=(snapshot->>'retentionDays')::integer; epoch:=clock_timestamp();
   update public.cardforge_contributor_asset_submissions set
     status='archived',automated_status='archived',calculated_access_tier='hidden',automated_access_tier='hidden',
     contributor_lifecycle_state=case when (snapshot->>'publicationRetained')::boolean then 'retired' else 'withdrawn' end,
     trashed_at=epoch,purge_after=epoch+make_interval(days=>days),
     trash_reason=case when p_is_owner then 'declined' else 'withdrawn' end,
     revision_trash_actor_id=p_actor_user_id,revision_trash_actor_role=case when p_is_owner then 'owner' else 'contributor' end,
     decision_reason='revision_trashed',updated_at=clock_timestamp() where id=target;
   update public.cardforge_asset_registry set status='archived',access_tier='hidden',updated_at=clock_timestamp()
     where contributor_submission_id=target;
 elsif p_action='restore' then
   if jsonb_array_length(snapshot->'restoreReasons')>0 then raise exception 'revision_recovery_blocked'; end if;
   -- Re-enter ordinary policy with the same immutable payload. Existing scoring
   -- and registry publication locks decide eligibility; a newer live pointer wins.
   update public.cardforge_contributor_asset_submissions set
     status=case when revision_trash_previous_status='draft' then 'draft' else 'voting' end,
     automated_status='voting',calculated_access_tier='contributor',automated_access_tier='contributor',
     contributor_lifecycle_state=null,
     owner_status_override=case when p_is_owner and owner_status_override in ('archived','rejected') then null else owner_status_override end,
     revision_vote_trash_fingerprint=public.cardforge_revision_vote_decision_fingerprint(target),
     trashed_at=null,purge_after=null,trash_reason=null,updated_at=clock_timestamp() where id=target;
   perform public.cardforge_rebalance_contributor_asset_pipeline(case when p_is_owner then p_actor_user_id else null end);
 else
   if not (snapshot->>'canHold')::boolean or p_held is null then raise exception 'revision_recovery_blocked'; end if;
   update public.cardforge_contributor_asset_submissions set retention_hold=p_held,updated_at=clock_timestamp() where id=target;
 end if;
 result:=public.cardforge_read_revision_recovery(target,p_actor_user_id,p_is_owner);
 if p_is_owner then
   insert into public.cardforge_owner_activity(actor_user_id,action,target_type,target_id,summary,outcome,metadata)
    values(p_actor_user_id,'library.revision.'||p_action,'contributor_asset_revision',target::text,
      'Owner revision recovery: '||p_action,'succeeded',jsonb_build_object('before',p_expected,'after',result->'state'));
 end if;
 return result;
end $$;
create or replace function public.cardforge_change_revision_recovery(p_actor_user_id text,p_is_owner boolean,p_action text,p_expected jsonb,p_held boolean default null)
returns jsonb language sql security invoker set search_path='' as $$ select public.cardforge_change_revision_recovery(p_actor_user_id,p_is_owner,p_action,p_expected,p_held,null); $$;
create or replace function public.cardforge_guard_revision_recovery_provenance()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 -- Existing updated_at triggers use transaction time; a retained monotonic
 -- row generation prevents restore-to-same-state replay even in one transaction.
 
 -- Preserve real retained publication evidence before Trash changes status.
 -- This certifies no historical date, event, source bytes or render authority.
 new.revision_publication_retained:=old.revision_publication_retained
   or old.published_at is not null or old.status='published'
   or coalesce(old.contributor_lifecycle_state='retired',false)
   or exists(select 1 from public.cardforge_asset_registry r where r.contributor_submission_id=old.id)
   or exists(select 1 from public.cardforge_pipeline_publication_events e where e.published_submission_id=old.id);
 if new.purge_state='pending' and new.revision_publication_retained
   and not exists(select 1 from public.cardforge_pipeline_asset_lineages l
     where l.id=new.lineage_id and l.purge_state='pending'
       and (l.registry_asset_id is null or exists(
         select 1 from public.cardforge_pipeline_asset_tombstones t
         where t.lineage_id=l.id and t.asset_id=l.registry_asset_id
           and t.identity_captured_at is not null and t.deletion_reason='owner_permanent_deletion'))) then
   -- A single-revision claim cannot erase retained publication. The separate
   -- already-prepared Owner lineage transaction retains its existing authority.
   raise exception 'pipeline_revision_publication_retained'; end if;
 -- Ordinary rebalance may project archived never-published rows back into
 -- Trash. A recovered contributor lifecycle remains outside Trash unless an
 -- explicit new recovery command supplies its durable actor provenance.
 if old.contributor_lifecycle_state is not null
   and new.contributor_lifecycle_state is not distinct from old.contributor_lifecycle_state
   and new.owner_status_override is not distinct from old.owner_status_override
   and old.trashed_at is null and new.trashed_at is not null
   and new.revision_trash_actor_role is null then
   new.trashed_at:=old.trashed_at; new.purge_after:=old.purge_after; new.trash_reason:=old.trash_reason;
 end if;
 if new.trashed_at is null then
   new.revision_trash_actor_id:=null; new.revision_trash_actor_role:=null;
 elsif old.trashed_at is not null and (
   new.owner_status_override is distinct from old.owner_status_override
   or new.editorial_review_status is distinct from old.editorial_review_status
   or new.editorial_reviewed_at is distinct from old.editorial_reviewed_at) then
   -- Subsequent Owner moderation supersedes any contributor recovery authority,
   -- even when the old Trash epoch/reason survives the existing override command.
   new.revision_trash_actor_id:=null; new.revision_trash_actor_role:='owner';
 end if;
 if old.status='draft' and old.trashed_at is null and new.trashed_at is null and new.status in ('submitted','voting','publish_candidate') then new.revision_trash_previous_status:=null; end if;
 if old.trashed_at is null and new.trashed_at is not null then
   new.revision_trash_previous_status:=old.status;
   if new.revision_trash_actor_role is null and new.decision_reason='below_free_threshold'
      and new.owner_status_override is null then
     new.revision_trash_actor_role:='voting';
     new.revision_vote_trash_fingerprint:=public.cardforge_revision_vote_decision_fingerprint(new.id);
   end if;
 end if;
 if (to_jsonb(new)-array['updated_at','revision_recovery_version','revision_publication_retained','automated_status','automated_access_tier','tier_decision_reason','decision_reason','quality_score']) is not distinct from (to_jsonb(old)-array['updated_at','revision_recovery_version','revision_publication_retained','automated_status','automated_access_tier','tier_decision_reason','decision_reason','quality_score']) then
  new.updated_at:=old.updated_at; new.revision_recovery_version:=old.revision_recovery_version;
 else new.revision_recovery_version:=old.revision_recovery_version+1; end if;
 return new;
end $$;
create or replace function public.cardforge_guard_studio_catalog_dependencies()
returns trigger language plpgsql security invoker set search_path='' as $$
declare request jsonb; target record; aliases text[]; ids text[]; old_mentions boolean:=false;
begin
 if tg_op='UPDATE' and new.document_payload is not distinct from old.document_payload
   and new.revision=old.revision and new.catalog_dependencies is not distinct from old.catalog_dependencies then return new; end if;
 -- The native Studio/PostgREST writer uses READ COMMITTED. A pre-existing
 -- repeatable snapshot cannot establish absence of a newly committed Trash.
 -- Refuse that unsupported write boundary rather than claim NOWAIT refreshes it.
 if current_setting('transaction_isolation')<>'read committed' then
   raise exception 'studio_catalog_isolation_unsupported';
 end if;
 request:=new.catalog_dependencies;
 -- Only the trusted Studio writer sends the exact final payload alongside its
 -- interpretation. Ordinary/direct payload writers invalidate inherited proof.
 if request->'sourcePayload' is not distinct from new.document_payload
   and request->>'contractVersion'='1' and jsonb_typeof(request->'complete')='boolean'
   and jsonb_typeof(request->'references')='object'
   and jsonb_typeof(request->'references'->'identities')='array'
   and jsonb_typeof(request->'references'->'sources')='array'
   and jsonb_typeof(request->'opaqueReasons')='array'
   and not exists(select 1 from jsonb_array_elements((request->'references'->'identities')||(request->'references'->'sources')) v where jsonb_typeof(v)<>'string') then
   new.catalog_dependencies:=(request-'sourcePayload')||jsonb_build_object('revision',new.revision,
     'payloadDigest',encode(extensions.digest(new.document_payload::text,'sha256'),'hex'));
 else new.catalog_dependencies:=null;
 end if;
 -- ROW EXCLUSIVE has already been acquired on Studio. Catalog admission takes
 -- SHARE NOWAIT before lineage NOWAIT. Never wait on a lineage while retaining
 -- this writer lock; inspect retained state, not filtered discovery views.
 for target in select l.id,l.registry_asset_id,l.catalog_claim_token,l.catalog_claimed_at from public.cardforge_pipeline_asset_lineages l
   where l.catalog_trashed_at is not null or l.catalog_claim_token is not null or l.catalog_claimed_at is not null or exists(select 1 from public.cardforge_asset_registry live join public.cardforge_contributor_asset_submissions revision on revision.id=live.contributor_submission_id where live.asset_id=l.registry_asset_id and revision.trashed_at is not null)
   for share nowait loop
   select coalesce(array_agg(distinct u) filter(where nullif(u,'') is not null),'{}') into aliases from (
     select r.url u from public.cardforge_asset_registry r where r.asset_id=target.registry_asset_id
     union all select r.preview_url from public.cardforge_asset_registry r where r.asset_id=target.registry_asset_id
     union all select s.source_url from public.cardforge_contributor_asset_submissions s where s.lineage_id=target.id
     union all select s.preview_url from public.cardforge_contributor_asset_submissions s where s.lineage_id=target.id
   ) sources;
   ids:=array_remove(array[target.id::text,target.registry_asset_id],null)||array(select id::text from public.cardforge_contributor_asset_submissions where lineage_id=target.id);
   if not public.cardforge_studio_dependency_binding_valid(new.document_payload,new.revision,new.catalog_dependencies)
      or ((target.catalog_claim_token is not null or target.catalog_claimed_at is not null) and new.catalog_dependencies->'complete' is distinct from 'true'::jsonb) then
     raise exception 'studio_catalog_dependency_unverified';
   end if;
   old_mentions:=false;
   if tg_op='UPDATE' then old_mentions:=(case when target.catalog_claim_token is not null or target.catalog_claimed_at is not null then public.cardforge_catalog_consumer_mentions(old.document_payload,ids,aliases) else public.cardforge_catalog_known_reference(old.document_payload,ids,aliases) end)
     or (public.cardforge_studio_dependency_binding_valid(old.document_payload,old.revision,old.catalog_dependencies)
       and (case when target.catalog_claim_token is not null or target.catalog_claimed_at is not null then public.cardforge_studio_dependencies_mention(old.catalog_dependencies->'references',ids,aliases) else public.cardforge_catalog_known_dependencies(old.catalog_dependencies->'references',ids,aliases) end)); end if;
   if ((case when target.catalog_claim_token is not null or target.catalog_claimed_at is not null then public.cardforge_catalog_consumer_mentions(new.document_payload,ids,aliases) else public.cardforge_catalog_known_reference(new.document_payload,ids,aliases) end)
     or (case when target.catalog_claim_token is not null or target.catalog_claimed_at is not null then public.cardforge_studio_dependencies_mention(new.catalog_dependencies->'references',ids,aliases) else public.cardforge_catalog_known_dependencies(new.catalog_dependencies->'references',ids,aliases) end)) and not old_mentions then
     raise exception 'studio_catalog_reference_unavailable';
   end if;
 end loop;
 return new;
end $$;
create or replace function public.cardforge_check_set_dependency_write(p_source jsonb,p_prior jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare target record; ids text[]; aliases text[]; prior_mentions boolean;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'set_catalog_isolation_unsupported'; end if;
 for target in select l.id,l.registry_asset_id,l.catalog_claim_token,l.catalog_claimed_at from public.cardforge_pipeline_asset_lineages l
 where l.catalog_trashed_at is not null or l.catalog_claim_token is not null or l.catalog_claimed_at is not null or exists(select 1 from public.cardforge_asset_registry live join public.cardforge_contributor_asset_submissions revision on revision.id=live.contributor_submission_id where live.asset_id=l.registry_asset_id and revision.trashed_at is not null) for share nowait loop
  ids:=array_remove(array[target.id::text,target.registry_asset_id],null)||array(select s.id::text from public.cardforge_contributor_asset_submissions s where s.lineage_id=target.id);
  select coalesce(array_agg(distinct u) filter(where nullif(u,'') is not null),'{}') into aliases from (
   select r.url u from public.cardforge_asset_registry r where r.asset_id=target.registry_asset_id
   union all select r.preview_url from public.cardforge_asset_registry r where r.asset_id=target.registry_asset_id
   union all select s.source_url from public.cardforge_contributor_asset_submissions s where s.lineage_id=target.id
   union all select s.preview_url from public.cardforge_contributor_asset_submissions s where s.lineage_id=target.id
  ) sources;
  if not public.cardforge_set_dependency_binding_valid(p_source)
    or ((target.catalog_claim_token is not null or target.catalog_claimed_at is not null) and p_source->'catalog_dependencies'->'complete' is distinct from 'true'::jsonb) then raise exception 'set_catalog_dependency_unverified'; end if;
  prior_mentions:=(case when target.catalog_claim_token is not null or target.catalog_claimed_at is not null then public.cardforge_catalog_consumer_mentions(p_prior,ids,aliases) else public.cardforge_catalog_known_reference(p_prior,ids,aliases) end)
   or (public.cardforge_set_dependency_binding_valid(p_prior) and (case when target.catalog_claim_token is not null or target.catalog_claimed_at is not null then public.cardforge_studio_dependencies_mention(p_prior->'catalog_dependencies'->'references',ids,aliases) else public.cardforge_catalog_known_dependencies(p_prior->'catalog_dependencies'->'references',ids,aliases) end));
  if ((case when target.catalog_claim_token is not null or target.catalog_claimed_at is not null then public.cardforge_catalog_consumer_mentions(p_source,ids,aliases) else public.cardforge_catalog_known_reference(p_source,ids,aliases) end)
    or (case when target.catalog_claim_token is not null or target.catalog_claimed_at is not null then public.cardforge_studio_dependencies_mention(p_source->'catalog_dependencies'->'references',ids,aliases) else public.cardforge_catalog_known_dependencies(p_source->'catalog_dependencies'->'references',ids,aliases) end)) and not coalesce(prior_mentions,false)
    then raise exception 'set_catalog_reference_unavailable'; end if;
 end loop;
end $$;
create or replace function public.cardforge_guard_set_registry_source()
returns trigger language plpgsql security invoker set search_path='' as $$
declare source jsonb; prior jsonb;
begin
 if tg_op='UPDATE' and old.asset_type='set' and new.asset_type<>'set' then raise exception 'set_registry_kind_immutable'; end if;
 if new.asset_type<>'set' then return new; end if;
 if tg_op='UPDATE' and row(new.asset_type,new.url,new.preview_url,new.storage_bucket,new.storage_path,new.contributor_submission_id)
   is not distinct from row(old.asset_type,old.url,old.preview_url,old.storage_bucket,old.storage_path,old.contributor_submission_id) then return new; end if;
 select to_jsonb(s) into source from public.cardforge_contributor_asset_submissions s where s.id=new.contributor_submission_id;
 if source->>'source_url' is distinct from new.url or source->>'source_storage_bucket' is distinct from new.storage_bucket
   or source->>'source_storage_path' is distinct from new.storage_path then source:=null; end if;
 if tg_op='UPDATE' then select to_jsonb(s) into prior from public.cardforge_contributor_asset_submissions s where s.id=old.contributor_submission_id; end if;
 -- Include the actual selected preview, not only the package interpretation.
 source:=source||jsonb_build_object('preview_url',new.preview_url);
 perform public.cardforge_check_set_dependency_write(source,case when tg_op='UPDATE' then prior||jsonb_build_object('preview_url',old.preview_url) else prior end);
 return new;
end $$;
revoke all on function public.cardforge_catalog_known_reference(jsonb,text[],text[],text,integer) from public,anon,authenticated;
grant execute on function public.cardforge_catalog_known_reference(jsonb,text[],text[],text,integer) to service_role;
revoke all on function public.cardforge_catalog_known_dependencies(jsonb,text[],text[]) from public,anon,authenticated;
grant execute on function public.cardforge_catalog_known_dependencies(jsonb,text[],text[]) to service_role;
revoke all on function public.cardforge_catalog_impact_rows(uuid) from public,anon,authenticated;
grant execute on function public.cardforge_catalog_impact_rows(uuid) to service_role;
revoke all on function public.cardforge_catalog_impact_snapshot(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.cardforge_catalog_impact_snapshot(uuid,text,boolean) to service_role;
revoke all on function public.cardforge_pipeline_dependency_health() from public,anon,authenticated;
grant execute on function public.cardforge_pipeline_dependency_health() to service_role;
revoke all on function public.cardforge_change_catalog_trash(text,text,jsonb,boolean,text) from public,anon,authenticated;
grant execute on function public.cardforge_change_catalog_trash(text,text,jsonb,boolean,text) to service_role;
revoke all on function public.cardforge_change_revision_recovery(text,boolean,text,jsonb,boolean,text) from public,anon,authenticated;
grant execute on function public.cardforge_change_revision_recovery(text,boolean,text,jsonb,boolean,text) to service_role;
commit;
