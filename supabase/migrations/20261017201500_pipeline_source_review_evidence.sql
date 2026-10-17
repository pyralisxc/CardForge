begin;
set local lock_timeout='5s';
-- Reviewer evidence is a bounded observation on the existing revision. Original
-- source_notes, artwork, source claims and creator attribution remain immutable.
alter table public.cardforge_contributor_asset_submissions add column source_review_evidence jsonb;

create or replace function public.cardforge_media_parent_content_version(p_submission_id uuid)
returns text language sql stable security invoker set search_path = '' as $$
  select pg_catalog.md5((pg_catalog.to_jsonb(submission) - array[
    'updated_at','positive_votes','negative_votes','quality_score','status','contributor_lifecycle_state',
    'automated_status','owner_status_override','calculated_access_tier','automated_access_tier','owner_access_tier_override',
    'tier_decision_reason','owner_note','decision_reason','editorial_review_status','editorial_review_note',
    'editorial_reviewed_by','editorial_reviewed_at','published_at','purge_state','trashed_at','purge_after',
    'trash_reason','retention_hold','purge_claimed_at','template_review_context','source_review_evidence'])::text)
  from public.cardforge_contributor_asset_submissions as submission where id=p_submission_id;
$$;

create or replace function public.cardforge_set_contributor_asset_editorial_review(
  p_submission_id uuid,
  p_review_status text,
  p_review_note text,
  p_reviewer_contributor_id text,
  p_expected_evidence_version integer
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  submission public.cardforge_contributor_asset_submissions%rowtype;
  normalized_note text := pg_catalog.btrim(coalesce(p_review_note, ''));
  normalized_reviewer text := pg_catalog.btrim(coalesce(p_reviewer_contributor_id, ''));
  changed_count integer;
begin
  if p_review_status not in ('pending', 'approved', 'revise', 'quarantine', 'retire') then
    raise exception 'invalid_editorial_review_status';
  end if;
  if p_review_status <> 'pending'
    and (normalized_note = '' or normalized_reviewer = '')
  then
    raise exception 'editorial_review_reason_required';
  end if;

  select * into submission
  from public.cardforge_contributor_asset_submissions
  where id = p_submission_id and purge_state is null
  for update;
  if not found then raise exception 'contributor_asset_not_found'; end if;

  if p_review_status='approved' and (submission.media_presentation is not null or submission.template_review_context is not null)
    and p_expected_evidence_version is distinct from coalesce((submission.source_review_evidence->>'version')::integer,0)
  then raise exception 'editorial_review_evidence_conflict'; end if;

  if submission.status = 'published' and p_review_status = 'revise' then
    raise exception 'editorial_review_live_requires_quarantine';
  end if;

  if p_review_status = 'approved' then
    if nullif(pg_catalog.btrim(coalesce(submission.source_notes, '')), '') is null
      and (nullif(pg_catalog.btrim(submission.source_review_evidence->'facts'->>'technicalTrace'),'') is null
        or nullif(pg_catalog.btrim(submission.source_review_evidence->'facts'->>'rightsFacts'),'') is null) then
      raise exception 'editorial_review_source_notes_required';
    end if;
    if nullif(pg_catalog.btrim(coalesce(submission.preview_url, '')), '') is null then
      raise exception 'editorial_review_preview_required';
    end if;
    if coalesce(pg_catalog.array_length(submission.specialty_tags, 1), 0) = 0
      or not public.cardforge_valid_pipeline_semantic_role(submission.asset_type, submission.semantic_role)
    then
      raise exception 'editorial_review_classification_required';
    end if;
    if submission.asset_type in ('templates', 'sets')
      and coalesce(pg_catalog.array_length(submission.use_case_tags, 1), 0) = 0
    then
      raise exception 'editorial_review_classification_required';
    end if;
  end if;

  update public.cardforge_contributor_asset_submissions
  set
    editorial_review_status = p_review_status,
    editorial_review_note = case when p_review_status = 'pending' then '' else normalized_note end,
    editorial_reviewed_by = case when p_review_status = 'pending' then null else normalized_reviewer end,
    editorial_reviewed_at = case when p_review_status = 'pending' then null else pg_catalog.now() end,
    owner_status_override = case when p_review_status in ('quarantine', 'retire') then 'archived' else owner_status_override end,
    owner_access_tier_override = case when p_review_status in ('quarantine', 'retire') then 'hidden' else owner_access_tier_override end,
    owner_note = case when p_review_status in ('quarantine', 'retire') then normalized_note else owner_note end
  where id = p_submission_id;

  changed_count := public.cardforge_rebalance_contributor_asset_pipeline(normalized_reviewer);
  perform public.cardforge_sync_contributor_asset_registry(p_submission_id);
  return changed_count;
end;
$$;


-- Existing callers keep their native signature; governed correction approval
-- requires the fifth, exact evidence-version argument rather than guessing it.
create or replace function public.cardforge_set_contributor_asset_editorial_review(
 p_submission_id uuid,p_review_status text,p_review_note text,p_reviewer_contributor_id text
) returns integer language sql security invoker set search_path='' as $$
 select public.cardforge_set_contributor_asset_editorial_review(p_submission_id,p_review_status,p_review_note,p_reviewer_contributor_id,null::integer);
$$;

create function public.cardforge_read_source_review_evidence(p_submission_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.cardforge_contributor_asset_submissions%rowtype;
begin
 select * into s from public.cardforge_contributor_asset_submissions where id=p_submission_id;
 if not found then raise exception 'source_evidence_not_found'; end if;
 if s.media_presentation is null and s.template_review_context is null then raise exception 'source_evidence_not_permitted'; end if;
 return pg_catalog.jsonb_build_object('submissionId',s.id,
   'candidateVersion',public.cardforge_media_parent_content_version(s.id),'evidence',s.source_review_evidence,
   'canRecord',s.published_at is null and s.status in('submitted','voting','publish_candidate')
     and s.trashed_at is null and s.purge_state is null and s.contributor_lifecycle_state is null);
end; $$;

create function public.cardforge_record_source_review_evidence(
 p_submission_id uuid,p_facts jsonb,p_expected_candidate_version text,p_expected_evidence_version integer,p_actor_id text
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.cardforge_contributor_asset_submissions%rowtype; target_asset_id text; parent_id uuid;
 base jsonb; revision integer; key text;
begin
 if pg_catalog.jsonb_typeof(p_facts) is distinct from 'object' or nullif(pg_catalog.btrim(p_actor_id),'') is null
   or coalesce(p_expected_candidate_version,'') !~ '^[a-f0-9]{32}$' or p_expected_evidence_version is null or p_expected_evidence_version<0
   or (select count(*) from pg_catalog.jsonb_object_keys(p_facts))<>4
   or nullif(pg_catalog.btrim(p_facts->>'technicalTrace'),'') is null
   or pg_catalog.length(p_facts->>'technicalTrace')>2400
 then raise exception 'source_evidence_invalid'; end if;
 foreach key in array array['creatorFacts','rightsFacts','aiFacts'] loop
   if not(p_facts ? key) or pg_catalog.jsonb_typeof(p_facts->key) not in('null','string')
     or pg_catalog.length(p_facts->>key)>1200 or p_facts->>key is not null and nullif(pg_catalog.btrim(p_facts->>key),'') is null
   then raise exception 'source_evidence_invalid'; end if;
 end loop;
 if pg_catalog.jsonb_typeof(p_facts->'technicalTrace') is distinct from 'string' then raise exception 'source_evidence_invalid'; end if;
 select target_registry_asset_id into target_asset_id from public.cardforge_contributor_asset_submissions where id=p_submission_id;
 if not found then raise exception 'source_evidence_not_found'; end if;
 if target_asset_id is null then raise exception 'source_evidence_not_permitted'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(target_asset_id,0)) then
   raise exception 'source_evidence_unavailable' using errcode='55P03'; end if;
 select contributor_submission_id into parent_id from public.cardforge_asset_registry where cardforge_asset_registry.asset_id=target_asset_id for update nowait;
 if not found then raise exception 'source_evidence_conflict'; end if;
 perform 1 from public.cardforge_contributor_asset_submissions where id=parent_id for update nowait;
 perform 1 from public.cardforge_pipeline_asset_lineages where registry_asset_id=target_asset_id for update nowait;
 select * into s from public.cardforge_contributor_asset_submissions where id=p_submission_id for update nowait;
 if not found then raise exception 'source_evidence_not_found'; end if;
 if (s.media_presentation is null and s.template_review_context is null) or s.published_at is not null
   or s.status not in('submitted','voting','publish_candidate') or s.trashed_at is not null or s.purge_state is not null
   or s.contributor_lifecycle_state is not null
 then raise exception 'source_evidence_not_permitted'; end if;
 if p_expected_candidate_version is distinct from public.cardforge_media_parent_content_version(s.id)
 then raise exception 'source_evidence_conflict'; end if;
 if s.template_review_context is not null then
   base:=public.cardforge_read_template_review_base(target_asset_id);
   if ((s.template_review_context->'expectedBase')-'revisionHighWater') is distinct from ((base->'expectedBase')-'revisionHighWater')
   then raise exception 'source_evidence_conflict'; end if;
 else
   base:=public.cardforge_read_media_revision_base(target_asset_id);
   if s.media_presentation->>'parentSubmissionId' is distinct from base->>'parentSubmissionId'
     or s.media_presentation->>'lineageId' is distinct from base->>'lineageId'
     or s.media_presentation->'baseRevisionNumber' is distinct from base->'baseRevisionNumber'
     or s.media_presentation->>'baseVersion' is distinct from base->>'baseVersion'
     or s.media_presentation->>'registryVersion' is distinct from base->>'registryVersion'
     or s.media_presentation->'baseline' is distinct from base->'baseline'
     or s.media_presentation->'intendedAccessTier' is distinct from base->'intendedAccessTier'
   then raise exception 'source_evidence_conflict'; end if;
 end if;
 revision:=coalesce((s.source_review_evidence->>'version')::integer,0);
 -- Identical retries neither change evidence attribution nor erase valid review.
 if s.source_review_evidence->'facts'=p_facts then return public.cardforge_read_source_review_evidence(s.id); end if;
 if revision is distinct from p_expected_evidence_version then raise exception 'source_evidence_conflict'; end if;
 update public.cardforge_contributor_asset_submissions set source_review_evidence=pg_catalog.jsonb_build_object(
   'schemaVersion',1,'version',revision+1,'facts',p_facts,'recordedBy',p_actor_id,'recordedAt',pg_catalog.now()),
   editorial_review_status='pending',editorial_review_note='',editorial_reviewed_by=null,editorial_reviewed_at=null
 where id=s.id;
 return public.cardforge_read_source_review_evidence(s.id);
end; $$;

create function public.cardforge_valid_source_review_evidence(p_record jsonb)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare key text;
begin
 if p_record is null then return true; end if;
 if pg_catalog.jsonb_typeof(p_record) is distinct from 'object' then return false; end if;
 if (select count(*) from pg_catalog.jsonb_object_keys(p_record))<>5
   or p_record->'schemaVersion' is distinct from '1'::jsonb
   or pg_catalog.jsonb_typeof(p_record->'version') is distinct from 'number'
   or coalesce(p_record->>'version','') !~ '^[1-9][0-9]{0,9}$'
 then return false; end if;
 if (p_record->>'version')::bigint>2147483647 then return false; end if;
 if pg_catalog.jsonb_typeof(p_record->'facts') is distinct from 'object'
   or pg_catalog.jsonb_typeof(p_record->'recordedBy') is distinct from 'string'
   or pg_catalog.length(p_record->>'recordedBy') not between 1 and 255
   or nullif(pg_catalog.btrim(p_record->>'recordedBy'),'') is null
   or pg_catalog.jsonb_typeof(p_record->'recordedAt') is distinct from 'string'
 then return false; end if;
 if not pg_catalog.isfinite((p_record->>'recordedAt')::timestamp with time zone) then return false; end if;
 if (select count(*) from pg_catalog.jsonb_object_keys(p_record->'facts'))<>4
   or pg_catalog.jsonb_typeof(p_record->'facts'->'technicalTrace') is distinct from 'string'
   or pg_catalog.length(p_record->'facts'->>'technicalTrace') not between 1 and 2400
   or nullif(pg_catalog.btrim(p_record->'facts'->>'technicalTrace'),'') is null
 then return false; end if;
 foreach key in array array['creatorFacts','rightsFacts','aiFacts'] loop
   if not((p_record->'facts') ? key) or pg_catalog.jsonb_typeof(p_record->'facts'->key) not in('null','string')
     or pg_catalog.length(p_record->'facts'->>key)>1200
     or p_record->'facts'->>key is not null and nullif(pg_catalog.btrim(p_record->'facts'->>key),'') is null
   then return false; end if;
 end loop;
 return true;
exception when others then return false;
end; $$;
alter table public.cardforge_contributor_asset_submissions add constraint cardforge_source_review_evidence_valid
 check(public.cardforge_valid_source_review_evidence(source_review_evidence));

create function public.cardforge_guard_source_review_evidence()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='INSERT' then
   if new.source_review_evidence is not null then raise exception 'source_evidence_invalid'; end if;
 elsif new.source_review_evidence is distinct from old.source_review_evidence then
   if (old.media_presentation is null and old.template_review_context is null)
     or old.published_at is not null or old.status not in('submitted','voting','publish_candidate')
     or old.trashed_at is not null or old.purge_state is not null or old.contributor_lifecycle_state is not null
     or new.source_review_evidence is null or new.source_review_evidence->'schemaVersion' is distinct from '1'::jsonb
     or (new.source_review_evidence->>'version')::integer is distinct from coalesce((old.source_review_evidence->>'version')::integer,0)+1
     or new.editorial_review_status is distinct from 'pending' or coalesce(new.editorial_review_note,'')<>''
     or new.editorial_reviewed_by is not null or new.editorial_reviewed_at is not null
   then raise exception 'source_evidence_not_permitted'; end if;
 end if;
 return new;
end; $$;
create trigger cardforge_00_source_review_evidence_guard before insert or update
 on public.cardforge_contributor_asset_submissions for each row execute function public.cardforge_guard_source_review_evidence();

revoke execute on function public.cardforge_read_source_review_evidence(uuid) from public,anon,authenticated;
grant execute on function public.cardforge_read_source_review_evidence(uuid) to service_role;
revoke execute on function public.cardforge_record_source_review_evidence(uuid,jsonb,text,integer,text) from public,anon,authenticated;
grant execute on function public.cardforge_record_source_review_evidence(uuid,jsonb,text,integer,text) to service_role;
revoke execute on function public.cardforge_valid_source_review_evidence(jsonb) from public,anon,authenticated;
grant execute on function public.cardforge_valid_source_review_evidence(jsonb) to service_role;
revoke execute on function public.cardforge_guard_source_review_evidence() from public,anon,authenticated;
revoke execute on function public.cardforge_set_contributor_asset_editorial_review(uuid,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.cardforge_set_contributor_asset_editorial_review(uuid,text,text,text,integer) to service_role;
commit;
