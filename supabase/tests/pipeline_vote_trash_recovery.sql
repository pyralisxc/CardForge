-- Disposable local/CI database only. No hosted identities or Storage operations.
begin;
set local role service_role;
set local lock_timeout='5s';
set local statement_timeout='45s';
savepoint feedback_recovery_fixture;
do $$
declare
 a uuid:=gen_random_uuid(); sibling uuid:=gen_random_uuid(); manual uuid:=gen_random_uuid(); private_id uuid:=gen_random_uuid();
 l uuid:=gen_random_uuid(); ml uuid:=gen_random_uuid(); pl uuid:=gen_random_uuid();
 legacy_id uuid:=gen_random_uuid(); unknown_id uuid:=gen_random_uuid(); legacy_lineage uuid:=gen_random_uuid(); metadata jsonb;
 snap jsonb; epoch timestamptz; deadline timestamptz; content_version text; total bigint;
begin
 update public.cardforge_contributor_program_settings set minimum_votes_for_grading=2,
 free_asset_minimum_positive_vote_percent=50,paid_asset_minimum_positive_vote_percent=75,
 review_minimum_age_days=0,trash_retention_days=30 where id='default';
 insert into public.cardforge_pipeline_asset_lineages(id,revision_high_water) values(l,1),(ml,1);
 insert into public.cardforge_contributor_asset_submissions(id,lineage_id,contributor_id,asset_type,name,status,revision_number,source_url)
 values(a,l,'trash-author','icons','Vote Trash proof','voting',1,'https://example.invalid/vote-trash.svg'),
 (manual,ml,'trash-author','icons','Manual Trash proof','voting',1,'https://example.invalid/manual-trash.svg');
 private_id:=public.cardforge_create_template_pipeline_draft('private-trash-'||pl::text,'Private Trash proof','trash-author','',jsonb_build_object('id','private-trash-'||pl::text,'name','Private Trash proof'),'private-'||pl::text);
 select lineage_id into pl from public.cardforge_contributor_asset_submissions where id=private_id;
 content_version:=public.cardforge_media_parent_content_version(a);
 perform public.cardforge_cast_contributor_asset_vote(a,'negative-one','negative');
 perform public.cardforge_cast_contributor_asset_vote(a,'negative-two','negative');
 select trashed_at,purge_after into epoch,deadline from public.cardforge_contributor_asset_submissions where id=a;
 if epoch is null or deadline-epoch is distinct from interval '30 days'
 or (select revision_trash_actor_role from public.cardforge_contributor_asset_submissions where id=a) is distinct from 'voting'
 then raise exception 'vote_decline_missing_single_thirty_day_epoch'; end if;
 perform public.cardforge_cast_contributor_asset_vote(a,'negative-two','negative');
 perform public.cardforge_rebalance_contributor_asset_pipeline(null);
 if exists(select 1 from public.cardforge_contributor_asset_submissions where id=a and (trashed_at<>epoch or purge_after<>deadline)) then raise exception 'retry_reset_trash_clock'; end if;
 select total_count into total from public.cardforge_list_contributor_asset_submission_ids('peer','review','','icons',null,null,'all',true,1,1,'trashed') where submission_id=a;
 if total is distinct from 1 then raise exception 'trash_query_count_not_filtered_before_pagination'; end if;
 select total_count into total from public.cardforge_list_contributor_asset_submission_ids('peer','review','','icons',null,null,'all',true,99,1,'trashed');
 if total is distinct from 1 then raise exception 'empty_page_lost_filtered_count'; end if;
 if exists(select 1 from public.cardforge_list_contributor_asset_submission_ids('peer','review','','icons',null,null,'all',true,1,50,'active') where submission_id=a) then raise exception 'active_query_included_trash'; end if;
 -- A hold permits feedback but prevents automatic restoration.
 snap:=public.cardforge_read_revision_recovery(a,'owner',true);
 perform public.cardforge_change_revision_recovery('owner',true,'hold',snap->'state',true);
 perform public.cardforge_cast_contributor_asset_vote(a,'positive-one','positive');
 perform public.cardforge_cast_contributor_asset_vote(a,'positive-two','positive');
 if (select trashed_at from public.cardforge_contributor_asset_submissions where id=a) is distinct from epoch then raise exception 'feedback_restored_held_trash'; end if;
 snap:=public.cardforge_read_revision_recovery(a,'owner',true);
 perform public.cardforge_change_revision_recovery('owner',true,'hold',snap->'state',false);
 perform public.cardforge_rebalance_contributor_asset_pipeline(null);
 if (select trashed_at from public.cardforge_contributor_asset_submissions where id=a) is not null then raise exception 'eligible_vote_trash_not_recovered'; end if;
 -- The first successful publication may allocate its canonical registry
 -- binding. Compare subsequent lifecycle-only changes against that exact base.
 content_version:=public.cardforge_media_parent_content_version(a);
 -- A second genuine entry gets a new epoch. Explicit restoration does not
 -- immediately oscillate from identical votes or unrelated capacity changes.
 perform public.cardforge_cast_contributor_asset_vote(a,'positive-one','negative');
 perform public.cardforge_cast_contributor_asset_vote(a,'positive-two','negative');
 if (select trashed_at from public.cardforge_contributor_asset_submissions where id=a)<=epoch then raise exception 'genuine_reentry_reused_old_trash_epoch'; end if;
 snap:=public.cardforge_read_revision_recovery(a,'trash-author',false);
 if snap->'restoreReasons'<>'[]'::jsonb then raise exception 'own_vote_trash_restore_unavailable: %',snap; end if;
 perform public.cardforge_change_revision_recovery('trash-author',false,'restore',snap->'state');
 update public.cardforge_contributor_program_settings set tier_caps_by_type=jsonb_set(tier_caps_by_type,'{fonts,free}','123'::jsonb) where id='default';
 perform public.cardforge_rebalance_contributor_asset_pipeline(null);
 if (select trashed_at from public.cardforge_contributor_asset_submissions where id=a) is not null then raise exception 'same_decision_or_unrelated_cap_retrashed_restore'; end if;
 if public.cardforge_media_parent_content_version(a) is distinct from content_version then raise exception 'lifecycle_changed_authored_content_version'; end if;
 -- Positive preference still moves once within the lineage, including while
 -- the first exact revision is in Trash. Other authorship never becomes ours.
 insert into public.cardforge_contributor_asset_submissions(id,lineage_id,contributor_id,asset_type,name,status,revision_number,source_url,target_registry_asset_id)
 values(sibling,l,'other-author','icons','Sibling preference proof','voting',2,'https://example.invalid/vote-sibling.svg',(select registry_asset_id from public.cardforge_pipeline_asset_lineages where id=l));
 perform public.cardforge_cast_contributor_asset_vote(a,'preference-mover','positive');
 select trashed_at into epoch from public.cardforge_contributor_asset_submissions where id=a;
 perform public.cardforge_cast_contributor_asset_vote(sibling,'preference-mover','positive');
 if exists(select 1 from public.cardforge_contributor_asset_votes where submission_id=a and contributor_id='preference-mover' and vote_value='positive')
 or not exists(select 1 from public.cardforge_contributor_asset_votes where submission_id=sibling and contributor_id='preference-mover' and vote_value='positive')
 or (select trashed_at from public.cardforge_contributor_asset_submissions where id=a) is distinct from epoch
 then raise exception 'positive_preference_or_retained_epoch_changed_incorrectly'; end if;
 begin
 perform public.cardforge_read_revision_recovery(sibling,'trash-author',false); raise exception 'sibling_authorship_granted_recovery';
 exception when raise_exception then if sqlerrm<>'revision_recovery_not_permitted' then raise; end if; end;
 -- Owner moderation is not undone by votes or Contributor restore.
 snap:=public.cardforge_read_revision_recovery(manual,'owner',true);
 snap:=public.cardforge_change_revision_recovery('owner',true,'trash',snap->'state');
 epoch:=(snap->'state'->>'trashedAt')::timestamptz;
 -- A known shared revision stays browseable/votable even when Owner moderation
 -- marks its independent review status rejected. No restore authority is granted.
 update public.cardforge_contributor_asset_submissions set status='rejected',owner_status_override='rejected' where id=manual;
 if not exists(select 1 from public.cardforge_list_contributor_asset_submission_ids('free-viewer','shared','',null,null,null,'all',true,1,50,'trashed') where submission_id=manual)
 then raise exception 'owner_rejected_shared_trash_not_browseable'; end if;

 perform public.cardforge_cast_contributor_asset_vote(manual,'positive-one','positive');
 perform public.cardforge_cast_contributor_asset_vote(manual,'positive-two','positive');
 if (select trashed_at from public.cardforge_contributor_asset_submissions where id=manual) is distinct from epoch then raise exception 'votes_reversed_owner_trash'; end if;
 snap:=public.cardforge_read_revision_recovery(manual,'trash-author',false);
 if not(snap->'restoreReasons' ? 'owner_recovery_required') then raise exception 'contributor_can_reverse_owner_trash'; end if;
 begin
 perform public.cardforge_change_revision_recovery('trash-author',false,'restore',snap->'state');
 raise exception 'contributor_restored_owner_trash';
 exception when raise_exception then if sqlerrm<>'revision_recovery_blocked' then raise; end if; end;
 -- Draft privacy survives Trash, own restore, then genuine native submission.
 snap:=public.cardforge_read_revision_recovery(private_id,'trash-author',false);
 snap:=public.cardforge_change_revision_recovery('trash-author',false,'trash',snap->'state');
 if exists(select 1 from public.cardforge_list_contributor_asset_submission_ids('peer','review','',null,null,null,'all',true,1,50,'trashed') where submission_id=private_id)
 then raise exception 'private_draft_leaked_into_shared_trash'; end if;
 if exists(select 1 from public.cardforge_list_contributor_asset_submission_ids('free-viewer','shared','',null,null,null,'all',true,1,50,'trashed') where submission_id=private_id) then raise exception 'private_draft_leaked_to_free_shared_viewer'; end if;
 if not exists(select 1 from public.cardforge_list_contributor_asset_submission_ids('trash-author','own','',null,null,null,'all',true,1,50,'trashed') where submission_id=private_id)
 then raise exception 'author_lost_private_trash'; end if;
 begin
 perform public.cardforge_cast_contributor_asset_vote(private_id,'peer','positive'); raise exception 'private_trash_vote_admitted';
 exception when raise_exception then if sqlerrm<>'contributor_asset_vote_not_permitted' then raise; end if; end;
 begin
 perform public.cardforge_set_pipeline_heart(pl,'peer',true,'contributor',true,false); raise exception 'private_trash_heart_admitted';
 exception when raise_exception then if sqlerrm<>'pipeline_reaction_not_permitted' then raise; end if; end;
 snap:=public.cardforge_change_revision_recovery('trash-author',false,'restore',snap->'state');
 if snap->'state'->>'status' is distinct from 'draft' then raise exception 'private_restore_became_shared'; end if;
 perform public.cardforge_submit_template_pipeline_draft(private_id,'trash-author','Private Trash proof','Native resubmission after recovery','https://example.invalid/private','Fixture evidence',array['games'],array['tcg'],'template.front');
 if not exists(select 1 from public.cardforge_list_contributor_asset_submission_ids('peer','review','',null,null,null,'all',true,1,50,'active') where submission_id=private_id)
 then raise exception 'legitimate_resubmission_remained_private'; end if;
 -- Legacy entry is retained only through its real publication timestamp;
 -- insertion deliberately preserves the old default-false flag and absent origin.
 insert into public.cardforge_pipeline_asset_lineages(id,revision_high_water) values(legacy_lineage,2);
 insert into public.cardforge_contributor_asset_submissions(id,lineage_id,contributor_id,asset_type,name,status,revision_number,published_at,trashed_at,purge_after,source_url)
 values(legacy_id,legacy_lineage,'legacy-author','icons','Legacy published Trash','archived',1,now()-interval '40 days',now(),now()+interval '30 days','https://example.invalid/legacy-trash.svg'),
 (unknown_id,legacy_lineage,'legacy-author','icons','Unknown sharing Trash','archived',2,null,now(),now()+interval '30 days','https://example.invalid/unknown-trash.svg');
 if (select revision_publication_retained from public.cardforge_contributor_asset_submissions where id=legacy_id) is distinct from false
 then raise exception 'legacy_fixture_not_default_false'; end if;
 select shared_metadata into metadata from public.cardforge_list_contributor_asset_submission_ids('free-viewer','shared','',null,null,null,'all',true,1,50,'trashed') where submission_id=legacy_id;
 if metadata->>'publicationRetained' is distinct from 'true'
 or metadata->>'id' is distinct from legacy_id::text or metadata ? 'publishedAt'
 then raise exception 'legacy_publication_observation_lost_or_private_field_added: %',metadata; end if;
 if exists(select 1 from public.cardforge_list_contributor_asset_submission_ids('free-viewer','shared','',null,null,null,'all',true,1,50,'trashed') where submission_id=unknown_id)
 then raise exception 'unknown_legacy_sharing_became_public'; end if;
 raise notice 'PASS vote Trash: shared feedback, 30-day epoch, retry stability, hold, automatic and own recovery, Owner moderation, private query/vote/heart isolation and content-version stability';
end $$;

-- Discard only the preceding synthetic records, including its intentionally
-- incomplete private Template. It must not become an opaque consumer of the
-- independent current-publication fixture; production admission stays strict.
rollback to savepoint feedback_recovery_fixture;
release savepoint feedback_recovery_fixture;

-- Qualifying negative feedback may retire an eligible exact current publication;
-- retained consumers, newer publications and physical-retention fences survive.
do $$
declare l uuid:=gen_random_uuid(); current_id uuid:=gen_random_uuid(); newer_id uuid:=gen_random_uuid();
 asset text:='vote-current-'||gen_random_uuid()::text; original_date timestamptz:=now()-interval '2 days';
 events_before integer; public_metadata jsonb;
begin
 if exists(select 1 from public.cardforge_asset_registry) or exists(select 1 from public.cardforge_contributor_asset_submissions) then raise exception 'current_vote_fixture_requires_isolated_empty_inventory'; end if;
 update public.cardforge_contributor_program_settings set minimum_votes_for_grading=2,
 free_asset_minimum_positive_vote_percent=50,paid_asset_minimum_positive_vote_percent=75,
 review_minimum_age_days=0,trash_retention_days=30 where id='default';
 insert into public.cardforge_pipeline_asset_lineages(id,registry_asset_id,revision_high_water) values(l,asset,1);
 insert into public.cardforge_asset_registry(asset_id,name,asset_type,url,status,access_tier,library_source)
 values(asset,'Vote current proof','icon','https://example.invalid/vote-current.svg','published','free','contributor');
 insert into public.cardforge_contributor_asset_submissions(id,lineage_id,contributor_id,asset_type,name,status,
 editorial_review_status,calculated_access_tier,registry_asset_id,target_registry_asset_id,revision_number,published_at,source_url)
 values(current_id,l,'current-author','icons','Vote current proof','published','approved','free',asset,asset,1,original_date,'https://example.invalid/vote-current.svg');
 update public.cardforge_asset_registry set contributor_submission_id=current_id where asset_id=asset;
 if cardinality(public.cardforge_catalog_trash_entry_reasons(l))<>0 then raise exception 'current_vote_fixture_not_safely_retirable: %',public.cardforge_catalog_trash_entry_reasons(l); end if;
 perform public.cardforge_cast_contributor_asset_vote(current_id,'current-negative-one','negative');
 perform public.cardforge_cast_contributor_asset_vote(current_id,'current-negative-two','negative');
 if not exists(select 1 from public.cardforge_contributor_asset_submissions where id=current_id and trashed_at is not null and revision_trash_actor_role='voting' and revision_publication_retained and published_at=original_date)
 or not exists(select 1 from public.cardforge_asset_registry where asset_id=asset and contributor_submission_id=current_id and status='archived' and access_tier='hidden')
 then raise exception 'qualifying_negative_current_publication_was_exempt_from_trash'; end if;
 if exists(select 1 from public.cardforge_claim_pipeline_revision_purge_owner(current_id,'Vote current proof',null)) then raise exception 'vote_retirement_erased_publication_retention'; end if;
 if not exists(select 1 from public.cardforge_list_contributor_asset_submission_ids('free-viewer','shared','',null,null,null,'all',true,1,50,'trashed') where submission_id=current_id)
 then raise exception 'shared_trashed_publication_not_visible_to_free_viewer'; end if;
 select shared_metadata into public_metadata from public.cardforge_list_contributor_asset_submission_ids('free-viewer','shared','',null,null,null,'all',true,1,50,'trashed') where submission_id=current_id;
 if public_metadata->>'id' is distinct from current_id::text
 or public_metadata->>'ownedByViewer' is distinct from 'false'
 or (select count(*) from jsonb_object_keys(public_metadata)) is distinct from 15::bigint
 or public_metadata ?| array['source_payload','source_url','contributor_id','contributor_email','owner_note']
 then raise exception 'shared_trash_metadata_not_exact_or_private_payload_exposed: %',public_metadata; end if;

 -- A newer live pointer wins even when votes recover the original exact row.
 insert into public.cardforge_contributor_asset_submissions(id,lineage_id,contributor_id,asset_type,name,status,
 editorial_review_status,calculated_access_tier,registry_asset_id,target_registry_asset_id,revision_number,published_at,source_url)
 values(newer_id,l,'current-author','icons','Newer vote current proof','published','approved','free',asset,asset,2,now(),'https://example.invalid/vote-newer.svg');
 update public.cardforge_asset_registry set contributor_submission_id=newer_id,status='published',access_tier='free',url='https://example.invalid/vote-newer.svg' where asset_id=asset;
 select count(*) into events_before from public.cardforge_pipeline_publication_events where lineage_id=l;
 perform public.cardforge_cast_contributor_asset_vote(current_id,'current-positive-one','positive');
 perform public.cardforge_cast_contributor_asset_vote(current_id,'current-positive-two','positive');
 if (select trashed_at from public.cardforge_contributor_asset_submissions where id=current_id) is not null
 or (select contributor_submission_id from public.cardforge_asset_registry where asset_id=asset) is distinct from newer_id
 or (select published_at from public.cardforge_contributor_asset_submissions where id=current_id) is distinct from original_date
 or (select count(*) from public.cardforge_pipeline_publication_events where lineage_id=l) is distinct from events_before
 then raise exception 'vote_recovery_replaced_newer_publication_or_invented_history'; end if;
 raise notice 'PASS vote Trash: exact current negative retirement, shared Free discovery, retained publication and newer-pointer recovery fences';
end $$;
rollback;
