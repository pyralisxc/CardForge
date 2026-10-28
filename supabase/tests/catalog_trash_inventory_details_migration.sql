-- Proposed forward migration body; native CLI filename generation pending.
-- Diagnostics only. Admission predicates, mutation commands and locks unchanged.
begin;
set local lock_timeout='5s';
create function public.cardforge_catalog_trash_inventory_details(p_lineage_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
with target as (
 select l.id,r.asset_id,r.url,r.preview_url from public.cardforge_pipeline_asset_lineages l
 left join public.cardforge_asset_registry r on r.asset_id=l.registry_asset_id where l.id=p_lineage_id
), aliases as (
 select array_remove(array[t.asset_id,t.id::text],null) ids,
 array(select distinct u from (
 select t.url u union all select t.preview_url union all
 select s.source_url from public.cardforge_contributor_asset_submissions s where s.lineage_id=t.id union all
 select s.preview_url from public.cardforge_contributor_asset_submissions s where s.lineage_id=t.id
 ) urls where nullif(u,'') is not null) sources from target t
), consumers as (
 select 'registry' origin,a.asset_id record_id,a.asset_type kind,
 case when a.asset_type='elementPreset' then coalesce(nullif(s.source_payload,'null'::jsonb),nullif(a.metadata->'style','null'::jsonb),nullif(a.metadata->'elementPreset','null'::jsonb),nullif(a.metadata->'payload','null'::jsonb)) else s.source_payload end payload
 from public.cardforge_asset_registry a left join public.cardforge_contributor_asset_submissions s on s.id=a.contributor_submission_id
 where a.asset_type in ('elementPreset','template','set')
 union all
 select 'submission',s.id::text,s.asset_type,s.source_payload from public.cardforge_contributor_asset_submissions s
 where s.lineage_id is distinct from p_lineage_id and not exists(
 select 1 from public.cardforge_asset_registry a where a.contributor_submission_id=s.id and a.asset_type in ('elementPreset','template','set'))
 union all select 'studio',id::text,'studio',document_payload from public.cardforge_studio_documents
), evaluated as (
 select c.*,public.cardforge_catalog_consumer_mentions(payload,a.ids,a.sources) referenced,
 case when kind in ('set','sets') then 'set_package_not_natively_decoded'
 when kind='studio' then 'studio_wrapper_not_supported'
 when kind in ('elementPreset','elementPresets','template','templates') then
 case when payload is null or payload='null'::jsonb then 'missing_native_payload_external_fallback_possible'
 when jsonb_typeof(payload)<>'object' then 'non_object_payload'
 when kind in ('elementPreset','elementPresets') and public.cardforge_valid_style_review_payload(payload) is not true then 'invalid_native_style_payload'
 when not public.cardforge_catalog_consumer_inspectable(payload,case when kind in ('elementPreset','elementPresets') then 'style' else 'template' end) then 'outside_supported_native_payload_subset' end
 when payload is not null then 'unsupported_payload_kind' end condition
 from consumers c cross join aliases a
)
select coalesce(jsonb_agg(jsonb_build_object('origin',origin,'recordId',record_id,'payloadKind',kind,
 'conditions',to_jsonb(array_remove(array[
 case when referenced then 'target_identity_or_source_reference' end,
 -- Match the existing Studio gate: a reference is blocking in its own right.
 case when origin='studio' and referenced then null else condition end],null)))
 order by origin,record_id),'[]'::jsonb)
from evaluated where referenced or condition is not null;
$$;
revoke all on function public.cardforge_catalog_trash_inventory_details(uuid) from public,anon,authenticated;
grant execute on function public.cardforge_catalog_trash_inventory_details(uuid) to service_role;

create or replace function public.cardforge_read_catalog_trash(p_submission_id uuid)
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
    'inventoryDetails',public.cardforge_catalog_trash_inventory_details(l.id),
    'reasons',jsonb_build_array('physical_expiry_unavailable_complete_reference_and_worker_proof_required'),
    'state',jsonb_build_object('identity',jsonb_build_object('lineageId',l.id,'submissionId',s.id,
      'registrySubmissionId',r.contributor_submission_id,'revisionHighWater',l.revision_high_water),
      'trashedAt',l.catalog_trashed_at,'purgeAfter',l.catalog_purge_after,'held',l.catalog_retention_hold));
end $$;


commit;
