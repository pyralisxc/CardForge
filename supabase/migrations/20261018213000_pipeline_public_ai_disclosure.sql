begin;
set local lock_timeout='5s';
-- Additive opt-in on the existing evidence record. Legacy four-field facts stay valid.
-- Publication reads only the AI text, never the other facts or reviewer identity.
create or replace function public.cardforge_record_source_review_evidence(
 p_submission_id uuid,p_facts jsonb,p_expected_candidate_version text,p_expected_evidence_version integer,p_actor_id text
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.cardforge_contributor_asset_submissions%rowtype; target_asset_id text; parent_id uuid;
 base jsonb; revision integer; key text;
begin
 if pg_catalog.jsonb_typeof(p_facts) is distinct from 'object' or nullif(pg_catalog.btrim(p_actor_id),'') is null
   or coalesce(p_expected_candidate_version,'') !~ '^[a-f0-9]{32}$' or p_expected_evidence_version is null or p_expected_evidence_version<0
   or (select count(*) from pg_catalog.jsonb_object_keys(p_facts))<>(4 + case when p_facts ? 'aiDisclosurePublic' then 1 else 0 end)
   or (p_facts ? 'aiDisclosurePublic' and pg_catalog.jsonb_typeof(p_facts->'aiDisclosurePublic') is distinct from 'boolean')
   or (p_facts->'aiDisclosurePublic' = 'true'::jsonb and nullif(pg_catalog.btrim(p_facts->>'aiFacts'),'') is null)
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

create or replace function public.cardforge_valid_source_review_evidence(p_record jsonb)
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
 if (select count(*) from pg_catalog.jsonb_object_keys(p_record->'facts'))<>(4 + case when (p_record->'facts') ? 'aiDisclosurePublic' then 1 else 0 end)
   or ((p_record->'facts') ? 'aiDisclosurePublic' and pg_catalog.jsonb_typeof(p_record->'facts'->'aiDisclosurePublic') is distinct from 'boolean')
   or (p_record->'facts'->'aiDisclosurePublic' = 'true'::jsonb and nullif(pg_catalog.btrim(p_record->'facts'->>'aiFacts'),'') is null)
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

commit;
