begin;
set local lock_timeout='5s';

-- Native revision rows own recovery provenance. Legacy rows deliberately retain
-- unknown provenance: an old withdrawn reason cannot prove absence of moderation.
alter table public.cardforge_contributor_asset_submissions
 add column revision_recovery_version bigint not null default 0 check (revision_recovery_version>=0),
 add column revision_trash_actor_id text,
 add column revision_trash_actor_role text check (revision_trash_actor_role in ('owner','contributor'));

create function public.cardforge_guard_revision_recovery_provenance()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 -- Existing updated_at triggers use transaction time; a retained monotonic
 -- row generation prevents restore-to-same-state replay even in one transaction.
 new.revision_recovery_version:=old.revision_recovery_version+1;
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
 return new;
end $$;
create trigger zz_cardforge_revision_recovery_provenance
before update on public.cardforge_contributor_asset_submissions
for each row execute function public.cardforge_guard_revision_recovery_provenance();

create function public.cardforge_read_revision_recovery(p_submission_id uuid,p_actor_user_id text,p_is_owner boolean)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.cardforge_contributor_asset_submissions%rowtype;
 l public.cardforge_pipeline_asset_lineages%rowtype; r public.cardforge_asset_registry%rowtype;
 days integer; blocked text[]:='{}'; entry text[]:='{}'; recovery text[]:='{}'; published boolean;
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
   entry:=public.cardforge_catalog_trash_entry_reasons(l.id);
 end if;
 entry:=blocked||entry;
 if s.trashed_at is not null then entry:=array_append(entry,'revision_already_trashed'); end if;
 recovery:=blocked;
 if s.retention_hold then recovery:=array_append(recovery,'retention_hold'); end if;
 if s.trashed_at is null then recovery:=array_append(recovery,'revision_not_trashed'); end if;
 if not p_is_owner and (s.revision_trash_actor_role is distinct from 'contributor'
   or s.revision_trash_actor_id is distinct from p_actor_user_id) then
   recovery:=array_append(recovery,'owner_recovery_required'); end if;
 -- Retention evidence is deliberately broader than render/adoption authority.
 published:=s.published_at is not null or s.status='published' or s.contributor_lifecycle_state='retired'
   or exists(select 1 from public.cardforge_asset_registry registry where registry.contributor_submission_id=s.id)
   or exists(select 1 from public.cardforge_pipeline_publication_events e where e.published_submission_id=s.id);
 return jsonb_build_object('name',s.name,'retentionDays',days,'trashActor',s.revision_trash_actor_role,
 'trashReasons',to_jsonb(entry),'restoreReasons',to_jsonb(recovery),'canHold',p_is_owner and s.trashed_at is not null and cardinality(blocked)=0,
 'publicationRetained',published,
 'state',jsonb_build_object('scope','revision','submissionId',s.id,'lineageId',s.lineage_id,'revisionNumber',s.revision_number,
   'registrySubmissionId',r.contributor_submission_id,'revisionHighWater',l.revision_high_water,
   'recoveryVersion',s.revision_recovery_version::text,'status',s.status,'updatedAt',s.updated_at,'trashedAt',s.trashed_at,'purgeAfter',s.purge_after,'held',s.retention_hold));
end $$;

create function public.cardforge_change_revision_recovery(p_actor_user_id text,p_is_owner boolean,p_action text,p_expected jsonb,p_held boolean default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare snapshot jsonb; result jsonb; target uuid; days integer;
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
   days:=(snapshot->>'retentionDays')::integer;
   update public.cardforge_contributor_asset_submissions set
     status='archived',automated_status='archived',calculated_access_tier='hidden',automated_access_tier='hidden',
     contributor_lifecycle_state=case when (snapshot->>'publicationRetained')::boolean then 'retired' else 'withdrawn' end,
     trashed_at=clock_timestamp(),purge_after=clock_timestamp()+make_interval(days=>days),
     trash_reason=case when p_is_owner then 'declined' else 'withdrawn' end,
     revision_trash_actor_id=p_actor_user_id,revision_trash_actor_role=case when p_is_owner then 'owner' else 'contributor' end,
     decision_reason='revision_trashed',updated_at=clock_timestamp() where id=target;
   update public.cardforge_asset_registry set status='archived',access_tier='hidden',updated_at=clock_timestamp()
     where contributor_submission_id=target;
 elsif p_action='restore' then
   if jsonb_array_length(snapshot->'restoreReasons')>0 then raise exception 'revision_recovery_blocked'; end if;
   -- Recovery is never publication or reopening submitted immutable content.
   -- Keep the native contributor lifecycle fence and existing registry pointer.
   update public.cardforge_contributor_asset_submissions set status='archived',automated_status='archived',
     calculated_access_tier='hidden',automated_access_tier='hidden',
     contributor_lifecycle_state=case when (snapshot->>'publicationRetained')::boolean then 'retired' else 'withdrawn' end,
     trashed_at=null,purge_after=null,trash_reason=null,updated_at=clock_timestamp() where id=target;
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

-- All browser/OAuth callers still pass through CardForge account authorization;
-- these RPCs expose no browser-direct database capability.
revoke all on function public.cardforge_guard_revision_recovery_provenance() from public,anon,authenticated;
revoke all on function public.cardforge_read_revision_recovery(uuid,text,boolean) from public,anon,authenticated;
revoke all on function public.cardforge_change_revision_recovery(text,boolean,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.cardforge_guard_revision_recovery_provenance() to service_role;
grant execute on function public.cardforge_read_revision_recovery(uuid,text,boolean) to service_role;
grant execute on function public.cardforge_change_revision_recovery(text,boolean,text,jsonb,boolean) to service_role;
-- Recovery generations/provenance are operational state, never authored parent
-- content. Preserve existing correction pins and their original source hashes.
create or replace function public.cardforge_media_parent_content_version(p_submission_id uuid)
returns text language sql stable security invoker set search_path = '' as $$
  select pg_catalog.md5((pg_catalog.to_jsonb(submission) - array[
    'updated_at','positive_votes','negative_votes','quality_score','status','contributor_lifecycle_state',
    'automated_status','owner_status_override','calculated_access_tier','automated_access_tier','owner_access_tier_override',
    'tier_decision_reason','owner_note','decision_reason','editorial_review_status','editorial_review_note',
    'editorial_reviewed_by','editorial_reviewed_at','published_at','purge_state','trashed_at','purge_after',
    'trash_reason','retention_hold','purge_claimed_at','template_review_context','source_review_evidence','owner_purge_requested_at','purge_claim_token','catalog_dependencies','source_content_sha256','revision_recovery_version','revision_trash_actor_id','revision_trash_actor_role'])::text)
  from public.cardforge_contributor_asset_submissions as submission where id=p_submission_id;
$$;
commit;
