begin;
set local lock_timeout = '5s';

-- This link is review lineage metadata. It remains meaningful even if an
-- Owner later removes a revision through the existing explicit deletion flow.
alter table public.cardforge_contributor_asset_submissions
  add column author_resubmission_parent_id uuid;

create or replace function public.cardforge_media_parent_content_version(p_submission_id uuid)
returns text language sql stable security invoker set search_path = '' as $$
  select pg_catalog.md5((pg_catalog.to_jsonb(submission) - array[
    'updated_at','positive_votes','negative_votes','quality_score','status','contributor_lifecycle_state',
    'automated_status','owner_status_override','calculated_access_tier','automated_access_tier','owner_access_tier_override',
    'tier_decision_reason','owner_note','decision_reason','editorial_review_status','editorial_review_note',
    'editorial_reviewed_by','editorial_reviewed_at','author_review_note','author_resubmission_parent_id','published_at','purge_state','trashed_at','purge_after',
    'trash_reason','retention_hold','purge_claimed_at','template_review_context','source_review_evidence','owner_purge_requested_at','purge_claim_token','catalog_dependencies','source_content_sha256','revision_recovery_version','revision_trash_actor_id','revision_trash_actor_role','revision_publication_retained','revision_trash_previous_status','revision_vote_trash_fingerprint'])::text)
  from public.cardforge_contributor_asset_submissions as submission where id=p_submission_id;
$$;

-- First-Template revisions use the existing native draft allocator. The parent
-- is moved to durable History and the new draft is allocated atomically under
-- the same asset lock, leaving review metadata and feedback on the old row.
create function public.cardforge_create_template_author_revision_draft(
  p_parent_submission_id uuid, p_expected_reviewed_at timestamptz,
  p_expected_parent_version text, p_actor_id text, p_actor_email text,
  p_name text, p_template_payload jsonb, p_submission_key text
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare parent public.cardforge_contributor_asset_submissions%rowtype; locked_asset_id text; locked_lineage_id uuid;
  prior public.cardforge_contributor_asset_submissions%rowtype; created_id uuid;
begin
  if p_parent_submission_id is null or p_expected_reviewed_at is null
    or coalesce(p_expected_parent_version,'') !~ '^[a-f0-9]{32}$'
    or nullif(pg_catalog.btrim(p_actor_id),'') is null
    or nullif(pg_catalog.btrim(p_submission_key),'') is null
    or pg_catalog.length(p_submission_key)>160
    or pg_catalog.jsonb_typeof(p_template_payload) is distinct from 'object'
  then raise exception 'template_author_revision_invalid'; end if;
  select * into parent from public.cardforge_contributor_asset_submissions where id=p_parent_submission_id;
  if not found or parent.contributor_id is distinct from p_actor_id or parent.asset_type<>'templates'
    or parent.target_registry_asset_id is null or parent.lineage_id is null then raise exception 'template_author_revision_not_found'; end if;
  locked_asset_id:=parent.target_registry_asset_id;
  locked_lineage_id:=parent.lineage_id;
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(locked_asset_id,0)) then
    raise exception 'template_review_unavailable' using errcode='55P03'; end if;
  -- Vote/recovery owners lock lineage before revision. Fail rather than wait
  -- under an incompatible lock order; callers retain the same attempt.
  perform 1 from public.cardforge_pipeline_asset_lineages where id=locked_lineage_id and purge_state is null for update nowait;
  if not found then raise exception 'template_author_revision_conflict'; end if;
  select * into parent from public.cardforge_contributor_asset_submissions where id=p_parent_submission_id for update nowait;
  if not found or parent.contributor_id is distinct from p_actor_id or parent.asset_type<>'templates'
    or parent.target_registry_asset_id is distinct from locked_asset_id or parent.lineage_id is distinct from locked_lineage_id
    then raise exception 'template_author_revision_not_found'; end if;
  select * into prior from public.cardforge_contributor_asset_submissions s
    where s.contributor_id=p_actor_id and s.target_registry_asset_id=parent.target_registry_asset_id
      and s.submission_key=p_submission_key limit 1;
  if found then
    if prior.author_resubmission_parent_id is distinct from p_parent_submission_id
      or prior.source_payload is distinct from p_template_payload or prior.name is distinct from p_name
    then raise exception 'template_author_revision_conflict'; end if;
    return prior.id;
  end if;
  if parent.lineage_id is null or parent.revision_number is null or parent.status not in ('submitted','voting','publish_candidate') or parent.published_at is not null
    or parent.trashed_at is not null or parent.purge_state is not null or parent.purge_claim_token is not null
    or parent.purge_claimed_at is not null or parent.owner_purge_requested_at is not null
    or parent.contributor_lifecycle_state is not null or parent.owner_status_override is not null
    or parent.editorial_review_status<>'revise' or parent.editorial_reviewed_at is distinct from p_expected_reviewed_at
    or public.cardforge_media_parent_content_version(parent.id) is distinct from p_expected_parent_version
    or p_template_payload->>'id' is distinct from parent.target_registry_asset_id
    or exists(select 1 from public.cardforge_contributor_asset_submissions s where s.lineage_id=parent.lineage_id
      and s.revision_number>parent.revision_number)
  then raise exception 'template_author_revision_conflict'; end if;
  if parent.template_review_context is not null
    or exists(select 1 from public.cardforge_asset_registry r where r.asset_id=parent.target_registry_asset_id)
  then raise exception 'template_author_revision_live_lineage_unsupported'; end if;
  update public.cardforge_contributor_asset_submissions set status='archived',automated_status='archived',
    calculated_access_tier='hidden',automated_access_tier='hidden',decision_reason='superseded_revision',
    tier_decision_reason='superseded_revision' where id=parent.id;
  created_id:=public.cardforge_create_template_pipeline_draft(parent.target_registry_asset_id,p_name,p_actor_id,
    coalesce(p_actor_email,''),p_template_payload,p_submission_key);
  update public.cardforge_contributor_asset_submissions set author_resubmission_parent_id=parent.id,
    description=parent.description, preview_url=parent.preview_url, source_notes=parent.source_notes,
    specialty_tags=parent.specialty_tags, use_case_tags=parent.use_case_tags,
    semantic_role=parent.semantic_role, visual_family=parent.visual_family, variant_kind=parent.variant_kind,
    variant_label=parent.variant_label, compatibility_tags=parent.compatibility_tags,
    requested_studio_destination=parent.requested_studio_destination where id=created_id;
  return created_id;
end;
$$;
revoke all on function public.cardforge_create_template_author_revision_draft(uuid,timestamptz,text,text,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.cardforge_create_template_author_revision_draft(uuid,timestamptz,text,text,text,text,jsonb,text) to service_role;
commit;
