-- Rollback-only native proof; invoked only by the existing disposable runner.
begin;
set local role service_role;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $$
declare
 lineage uuid:=gen_random_uuid(); history uuid:=gen_random_uuid(); live uuid:=gen_random_uuid(); other uuid:=gen_random_uuid();
 snapshot jsonb; trashed jsonb; restored jsonb; stale jsonb; payload jsonb:='{"fixture":"immutable retained content"}';
 published_before integer; highwater integer; current_before uuid; claim uuid; legacy uuid:=gen_random_uuid(); recovered_draft uuid:=gen_random_uuid();
begin
 if exists(select 1 from public.cardforge_asset_registry) then raise exception 'revision_recovery_fixture_requires_isolated_empty_catalog'; end if;
 if has_function_privilege('anon','public.cardforge_read_revision_recovery(uuid,text,boolean)','EXECUTE')
   or has_function_privilege('authenticated','public.cardforge_change_revision_recovery(text,boolean,text,jsonb,boolean)','EXECUTE') then
   raise exception 'revision_recovery_browser_privilege_regression'; end if;
 insert into public.cardforge_pipeline_asset_lineages(id,registry_asset_id,revision_high_water) values(lineage,'recovery-proof',3);
 insert into public.cardforge_contributor_asset_submissions(id,lineage_id,contributor_id,asset_type,name,status,revision_number,published_at,source_payload)
 values(history,lineage,'recovery-a','icons','Retained history','archived',1,now()-interval '3 days',payload),
       (live,lineage,'recovery-b','icons','Newer live','published',2,now()-interval '2 days',null),
       (other,lineage,'recovery-b','icons','Another contributor candidate','voting',3,null,null);
 insert into public.cardforge_asset_registry(asset_id,name,asset_type,url,status,access_tier,library_source,contributor_submission_id)
 values('recovery-proof','Newer live','icon','https://example.invalid/live.svg','published','free','contributor',live);
 select count(*) into published_before from public.cardforge_pipeline_publication_events where lineage_id=lineage;
 select contributor_submission_id into current_before from public.cardforge_asset_registry where asset_id='recovery-proof';
 select revision_high_water into highwater from public.cardforge_pipeline_asset_lineages where id=lineage;
 begin
   perform public.cardforge_read_revision_recovery(history,'recovery-b',false); raise exception 'other_contributor_read_admitted';
 exception when raise_exception then if sqlerrm<>'revision_recovery_not_permitted' then raise; end if; end;
 begin
   perform public.cardforge_read_revision_recovery(gen_random_uuid(),'recovery-b',false); raise exception 'private_uuid_absence_oracle';
 exception when raise_exception then if sqlerrm<>'revision_recovery_not_permitted' then raise; end if; end;
 -- Legacy history can retain published status without timestamp/event. Trash
 -- must keep that retention evidence through the native retired lifecycle.
 insert into public.cardforge_contributor_asset_submissions(id,lineage_id,contributor_id,asset_type,name,status)
 values(legacy,lineage,'recovery-a','icons','Legacy published history','published');
 snapshot:=public.cardforge_read_revision_recovery(legacy,'recovery-a',false);
 if not(snapshot->>'publicationRetained')::boolean then raise exception 'legacy_publication_evidence_lost'; end if;
 snapshot:=public.cardforge_change_revision_recovery('recovery-a',false,'trash',snapshot->'state');
 if not(snapshot->>'publicationRetained')::boolean then raise exception 'trashed_legacy_history_became_disposable'; end if;
 perform public.cardforge_change_revision_recovery('recovery-a',false,'restore',snapshot->'state');
 snapshot:=public.cardforge_read_revision_recovery(history,'recovery-a',false);
 if snapshot->'trashReasons'<>'[]'::jsonb then raise exception 'history_not_recoverable: %',snapshot; end if;
 trashed:=public.cardforge_change_revision_recovery('recovery-a',false,'trash',snapshot->'state');
 if trashed->'state'->>'status'<>'archived' or trashed->'state'->>'trashedAt' is null
   or trashed->>'trashActor'<>'contributor' then raise exception 'history_trash_receipt_invalid'; end if;
 begin
   perform public.cardforge_change_revision_recovery('recovery-b',false,'restore',trashed->'state'); raise exception 'other_contributor_restore_admitted';
 exception when raise_exception then if sqlerrm<>'revision_recovery_not_permitted' then raise; end if; end;
 begin
   perform public.cardforge_change_revision_recovery('recovery-a',false,'hold',trashed->'state',true); raise exception 'contributor_hold_admitted';
 exception when raise_exception then if sqlerrm<>'revision_recovery_not_permitted' then raise; end if; end;
 restored:=public.cardforge_change_revision_recovery('recovery-a',false,'restore',trashed->'state');
 if restored->'state'->>'status'<>'archived' or restored->'state'->>'trashedAt' is not null
   or (select source_payload from public.cardforge_contributor_asset_submissions where id=history) is distinct from payload
   or (select contributor_lifecycle_state from public.cardforge_contributor_asset_submissions where id=history)<>'retired'
   or (select contributor_submission_id from public.cardforge_asset_registry where asset_id='recovery-proof')<>current_before
   or (select revision_high_water from public.cardforge_pipeline_asset_lineages where id=lineage)<>highwater
   or (select count(*) from public.cardforge_pipeline_publication_events where lineage_id=lineage)<>published_before
 then raise exception 'restore_rewrote_or_republished_history'; end if;
 begin
   perform public.cardforge_change_revision_recovery('recovery-a',false,'trash',snapshot->'state'); raise exception 'stale_trash_admitted';
 exception when raise_exception then if sqlerrm<>'revision_recovery_state_changed' then raise; end if; end;
 trashed:=public.cardforge_change_revision_recovery('recovery-a',false,'trash',restored->'state');
 begin
   perform public.cardforge_change_revision_recovery('recovery-a',false,'restore',restored->'state'); raise exception 'old_epoch_restore_admitted';
 exception when raise_exception then if sqlerrm<>'revision_recovery_state_changed' then raise; end if; end;
 -- An Owner review after contributor Trash revokes contributor-origin recovery,
 -- even if existing override logic retains the earlier reason and Trash epoch.
 update public.cardforge_contributor_asset_submissions set owner_status_override='archived' where id=history;
 snapshot:=public.cardforge_read_revision_recovery(history,'recovery-a',false);
 if not (snapshot->'restoreReasons' ? 'owner_recovery_required') then raise exception 'owner_moderation_origin_lost'; end if;
 begin
   perform public.cardforge_change_revision_recovery('recovery-a',false,'restore',snapshot->'state'); raise exception 'moderation_undone_by_contributor';
 exception when raise_exception then if sqlerrm<>'revision_recovery_blocked' then raise; end if; end;
 snapshot:=public.cardforge_read_revision_recovery(history,'recovery-owner',true);
 snapshot:=public.cardforge_change_revision_recovery('recovery-owner',true,'hold',snapshot->'state',true);
 if not(snapshot->'state'->>'held')::boolean then raise exception 'owner_hold_missing'; end if;
 snapshot:=public.cardforge_change_revision_recovery('recovery-owner',true,'hold',snapshot->'state',false);
 perform public.cardforge_change_revision_recovery('recovery-owner',true,'restore',snapshot->'state');
 if not exists(select 1 from public.cardforge_owner_activity where target_id=history::text and action='library.revision.restore') then
   raise exception 'owner_recovery_audit_missing'; end if;
 snapshot:=public.cardforge_read_revision_recovery(live,'recovery-b',false);
 if snapshot->'trashReasons'='[]'::jsonb then raise exception 'newer_revision_guard_weakened'; end if;
 -- Owner Trash of another contributor's exact candidate is recoverable, but
 -- Contributor recovery can never undo that Owner decision.
 snapshot:=public.cardforge_read_revision_recovery(other,'recovery-owner',true);
 trashed:=public.cardforge_change_revision_recovery('recovery-owner',true,'trash',snapshot->'state');
 snapshot:=public.cardforge_read_revision_recovery(other,'recovery-b',false);
 if not (snapshot->'restoreReasons' ? 'owner_recovery_required') then raise exception 'owner_trash_recoverable_by_contributor'; end if;
 -- Recovery of an unpublished submitted record cannot be undone by the
 -- archived-to-Trash projection used by ordinary automatic rebalancing.
 insert into public.cardforge_contributor_asset_submissions(id,lineage_id,contributor_id,asset_type,name,status)
 values(recovered_draft,lineage,'recovery-a','icons','Recoverable submitted content','submitted');
 snapshot:=public.cardforge_read_revision_recovery(recovered_draft,'recovery-a',false);
 snapshot:=public.cardforge_change_revision_recovery('recovery-a',false,'trash',snapshot->'state');
 snapshot:=public.cardforge_change_revision_recovery('recovery-a',false,'restore',snapshot->'state');
 update public.cardforge_contributor_asset_submissions set trashed_at=now(),purge_after=now()+interval '30 days',trash_reason='withdrawn'
   where id=recovered_draft;
 if (select trashed_at from public.cardforge_contributor_asset_submissions where id=recovered_draft) is not null then
   raise exception 'automatic_projection_retrashed_recovered_content'; end if;
 -- Claim-only proof: no Storage API is invoked by this rollback fixture.
 select claim_token into claim from public.cardforge_claim_pipeline_revision_purge_owner(other,'Another contributor candidate',null);
 if claim is null then raise exception 'eligible_owner_revision_claim_missing'; end if;
 snapshot:=public.cardforge_read_revision_recovery(other,'recovery-owner',true);
 if not(snapshot->'restoreReasons' ? 'destructive_attempt_requires_reconciliation') or (snapshot->>'canHold')::boolean then
   raise exception 'claim_recovery_fence_missing'; end if;
 begin
   perform public.cardforge_change_revision_recovery('recovery-owner',true,'restore',snapshot->'state'); raise exception 'claim_restored';
 exception when raise_exception then if sqlerrm<>'revision_recovery_blocked' then raise; end if; end;
 raise notice 'revision recovery: exact ownership, history, stale epoch, moderation, holds and committed-claim assertions passed';
end $$;
rollback;
