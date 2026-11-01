-- Disposable local/CI database only. No hosted identities or Storage operations.
begin;
set local role service_role;
set local lock_timeout='5s';
set local statement_timeout='45s';
do $$
declare
 a uuid:=gen_random_uuid(); manual uuid:=gen_random_uuid(); private_id uuid:=gen_random_uuid();
 l uuid:=gen_random_uuid(); ml uuid:=gen_random_uuid(); pl uuid:=gen_random_uuid();
 snap jsonb; epoch timestamptz; deadline timestamptz; content_version text; total bigint;
begin
 update public.cardforge_contributor_program_settings set minimum_votes_for_grading=2,
 free_asset_minimum_positive_vote_percent=50,paid_asset_minimum_positive_vote_percent=75,
 review_minimum_age_days=0,trash_retention_days=30 where id='default';
 insert into public.cardforge_pipeline_asset_lineages(id,revision_high_water) values(l,1),(ml,1);
 insert into public.cardforge_contributor_asset_submissions(id,lineage_id,contributor_id,asset_type,name,status,revision_number)
 values(a,l,'trash-author','icons','Vote Trash proof','voting',1),
 (manual,ml,'trash-author','icons','Manual Trash proof','voting',1);
 private_id:=public.cardforge_create_template_pipeline_draft('private-trash-'||pl::text,'Private Trash proof','trash-author','',jsonb_build_object('id','private-trash-'||pl::text,'name','Private Trash proof'),'private-'||pl::text);
 select lineage_id into pl from public.cardforge_contributor_asset_submissions where id=private_id;
 content_version:=public.cardforge_media_parent_content_version(a);
 perform public.cardforge_cast_contributor_asset_vote(a,'negative-one','negative');
 perform public.cardforge_cast_contributor_asset_vote(a,'negative-two','negative');
 select trashed_at,purge_after into epoch,deadline from public.cardforge_contributor_asset_submissions where id=a;
 if epoch is null or deadline-epoch<>interval '30 days'
 or (select revision_trash_actor_role from public.cardforge_contributor_asset_submissions where id=a)<>'voting'
 then raise exception 'vote_decline_missing_single_thirty_day_epoch'; end if;
 perform public.cardforge_cast_contributor_asset_vote(a,'negative-two','negative');
 perform public.cardforge_rebalance_contributor_asset_pipeline(null);
 if exists(select 1 from public.cardforge_contributor_asset_submissions where id=a and (trashed_at<>epoch or purge_after<>deadline)) then raise exception 'retry_reset_trash_clock'; end if;
 select total_count into total from public.cardforge_list_contributor_asset_submission_ids('peer','review','','icons',null,null,'all',true,1,1,'trashed') where submission_id=a;
 if total<>1 then raise exception 'trash_query_count_not_filtered_before_pagination'; end if;
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
 -- A second genuine entry gets a new epoch. Explicit restoration does not
 -- immediately oscillate from identical votes or unrelated capacity changes.
 perform public.cardforge_cast_contributor_asset_vote(a,'positive-one','negative');
 perform public.cardforge_cast_contributor_asset_vote(a,'positive-two','negative');
 snap:=public.cardforge_read_revision_recovery(a,'trash-author',false);
 if snap->'restoreReasons'<>'[]'::jsonb then raise exception 'own_vote_trash_restore_unavailable: %',snap; end if;
 perform public.cardforge_change_revision_recovery('trash-author',false,'restore',snap->'state');
 update public.cardforge_contributor_program_settings set tier_caps_by_type=jsonb_set(tier_caps_by_type,'{fonts,free}','123'::jsonb) where id='default';
 perform public.cardforge_rebalance_contributor_asset_pipeline(null);
 if (select trashed_at from public.cardforge_contributor_asset_submissions where id=a) is not null then raise exception 'same_decision_or_unrelated_cap_retrashed_restore'; end if;
 if public.cardforge_media_parent_content_version(a) is distinct from content_version then raise exception 'lifecycle_changed_authored_content_version'; end if;
 -- Owner moderation is not undone by votes or Contributor restore.
 snap:=public.cardforge_read_revision_recovery(manual,'owner',true);
 snap:=public.cardforge_change_revision_recovery('owner',true,'trash',snap->'state');
 epoch:=(snap->'state'->>'trashedAt')::timestamptz;
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
 if not exists(select 1 from public.cardforge_list_contributor_asset_submission_ids('trash-author','own','',null,null,null,'all',true,1,50,'trashed') where submission_id=private_id)
 then raise exception 'author_lost_private_trash'; end if;
 begin
 perform public.cardforge_cast_contributor_asset_vote(private_id,'peer','positive'); raise exception 'private_trash_vote_admitted';
 exception when raise_exception then if sqlerrm<>'contributor_asset_vote_not_permitted' then raise; end if; end;
 begin
 perform public.cardforge_set_pipeline_heart(pl,'peer',true,'contributor',true,false); raise exception 'private_trash_heart_admitted';
 exception when raise_exception then if sqlerrm<>'pipeline_reaction_not_permitted' then raise; end if; end;
 snap:=public.cardforge_change_revision_recovery('trash-author',false,'restore',snap->'state');
 if snap->'state'->>'status'<>'draft' then raise exception 'private_restore_became_shared'; end if;
 perform public.cardforge_submit_template_pipeline_draft(private_id,'trash-author','Private Trash proof','Native resubmission after recovery','https://example.invalid/private','Fixture evidence',array['games'],array['tcg'],'template.front');
 if not exists(select 1 from public.cardforge_list_contributor_asset_submission_ids('peer','review','',null,null,null,'all',true,1,50,'active') where submission_id=private_id)
 then raise exception 'legitimate_resubmission_remained_private'; end if;
 raise notice 'PASS vote Trash: shared feedback, 30-day epoch, retry stability, hold, automatic and own recovery, Owner moderation, private query/vote/heart isolation and content-version stability';
end $$;
rollback;
