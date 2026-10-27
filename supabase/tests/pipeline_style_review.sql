-- Native rollback-only proof. Only the existing disposable Docker-bound runner
-- supplies this cooperative marker; it is not authority to use a hosted DB.
begin;
set local lock_timeout='5s';
set local statement_timeout='45s';
do $$ begin
 if current_setting('cardforge.fixture_disposable',true) is distinct from 'style-review'
 then raise exception 'style_review_fixture_local_guard_required'; end if;
end $$;
set local role service_role;
do $$
declare
 asset text; actor text:='style-review-fixture'; parent uuid; candidate uuid; sibling uuid;
 style jsonb; proposed jsonb; pins jsonb; before_parent jsonb; registry_before jsonb; bad jsonb;
 evidence jsonb; key text; legacy boolean; field text; receipt jsonb;
begin
 if has_function_privilege('anon','public.cardforge_create_style_review_revision(text,jsonb,jsonb,text,text,text)','EXECUTE')
 or has_function_privilege('authenticated','public.cardforge_create_style_review_revision(text,jsonb,jsonb,text,text,text)','EXECUTE')
 or has_function_privilege('anon','public.cardforge_read_style_review_base(text)','EXECUTE')
 or has_function_privilege('authenticated','public.cardforge_read_style_review_receipt(text,text,text)','EXECUTE')
 then raise exception 'style_review_grants_exposed'; end if;
 foreach legacy in array array[true,false] loop
  asset:='isolated-style-'||gen_random_uuid()::text;
  style:=jsonb_build_object('id',asset,'name','Synthetic material','kind','material','targets',jsonb_build_array('shape'),
    'appearance',jsonb_build_object('material',jsonb_build_object('baseColor','#eed')), 'contributorName','Original author');
  parent:=public.cardforge_upsert_pipeline_registry_asset(asset,'Synthetic material','elementPresets','elementPreset',
    '/api/styles#'||asset,'/api/styles#'||asset,'Original authored description',actor,'',100,'application/json',null,null,
    jsonb_build_object('style',style,'unrelatedProvenance','preserve-me'));
  update public.cardforge_contributor_asset_submissions set
    revision_number=case when legacy then null else 1 end,
    specialty_tags=array['games'], semantic_role='material',source_notes='Synthetic original rights proof',published_at=now()
    where id=parent;
  update public.cardforge_asset_registry set metadata=metadata||jsonb_build_object('revisionNumber',1,'revisionId',parent)
    where asset_id=asset;
  pins:=public.cardforge_read_style_review_base(asset)->'expectedBase';
  if pins->>'baseRevisionNumber'<>'1' then raise exception 'legacy_base_not_read'; end if;
  proposed:=jsonb_set(style,'{appearance,material,baseColor}','"#fff"');
  select to_jsonb(s) into before_parent from public.cardforge_contributor_asset_submissions s where id=parent;
  select to_jsonb(r) into registry_before from public.cardforge_asset_registry r where asset_id=asset;
  -- All pin dimensions must reject without allocating a candidate.
  foreach field in array array['assetId','parentSubmissionId','lineageId','baseRevisionNumber','revisionHighWater','parentContentVersion','registryContentVersion'] loop
   bad:=jsonb_set(pins,array[field],to_jsonb('wrong'::text));
   begin
    perform public.cardforge_create_style_review_revision(asset,bad,proposed,actor,'invalid-'||replace(gen_random_uuid()::text,'-',''),repeat('a',64));
    raise exception 'stale_pin_accepted';
   exception when raise_exception then if sqlerrm<>'style_review_conflict' then raise; end if; end;
  end loop;
  foreach field in array array['null-target','invalid-texture','invalid-border','invalid-effects'] loop
   bad:=case field when 'null-target' then jsonb_set(proposed,'{targets}','[null]')
     when 'invalid-texture' then jsonb_set(proposed,'{appearance,material,texture}','{"kind":"invented"}')
     when 'invalid-border' then jsonb_set(proposed,'{appearance,border}','{"kind":"solid","width":"wide"}')
     else jsonb_set(proposed,'{appearance,effects}','{"bevel":"not-a-number"}') end;
   begin
    perform public.cardforge_create_style_review_revision(asset,pins,bad,actor,'invalid-'||replace(gen_random_uuid()::text,'-',''),repeat('a',64));
    raise exception 'invalid_nested_style_accepted';
   exception when raise_exception then if sqlerrm<>'style_review_invalid' then raise; end if; end;
  end loop;
  key:='review-'||replace(gen_random_uuid()::text,'-','');
  candidate:=public.cardforge_create_style_review_revision(asset,pins,proposed,actor,key,repeat('a',64));
  if public.cardforge_create_style_review_revision(asset,pins,proposed,actor,key,repeat('a',64)) is distinct from candidate
  then raise exception 'retry_not_idempotent'; end if;
  receipt:=public.cardforge_read_style_review_receipt(asset,key,actor);
  if receipt->>'revisionNumber'<>'2' or receipt->>'editorialReviewStatus'<>'pending' then raise exception 'invalid_receipt'; end if;
  begin
   perform public.cardforge_create_style_review_revision(asset,pins,style,actor,key,repeat('a',64));
   raise exception 'changed_retry_accepted';
  exception when raise_exception then if sqlerrm<>'style_review_conflict' then raise; end if; end;
  begin
   perform public.cardforge_read_style_review_receipt(asset,key,'different-actor');
   raise exception 'wrong_actor_accepted';
  exception when raise_exception then if sqlerrm<>'template_review_conflict' then raise; end if; end;
  begin
   update public.cardforge_contributor_asset_submissions set source_payload=style where id=candidate;
   raise exception 'mutable_candidate';
  exception when raise_exception then if sqlerrm<>'template_review_immutable' then raise; end if; end;
  begin
   perform public.cardforge_set_contributor_asset_owner_override(candidate,true,'published',true,'free','Must not approve as side effect',actor);
   raise exception 'unapproved_candidate_published';
  exception when raise_exception then if sqlerrm<>'template_review_editorial_required' then raise; end if; end;
  begin
   perform public.cardforge_upsert_pipeline_registry_asset(asset,'Overwrite','elementPresets','elementPreset',
     '/api/styles#'||asset,'/api/styles#'||asset,'Overwrite',actor,'',100,'application/json',null,null,jsonb_build_object('style',proposed));
   raise exception 'published_style_overwritten';
  exception when raise_exception then if sqlerrm<>'style_review_required' then raise; end if; end;
  if (select to_jsonb(s) from public.cardforge_contributor_asset_submissions s where id=parent) is distinct from before_parent
   or (select to_jsonb(r) from public.cardforge_asset_registry r where asset_id=asset) is distinct from registry_before
  then raise exception 'creation_mutated_live_parent'; end if;
  perform public.cardforge_rebalance_contributor_asset_pipeline(null);
  if (select metadata->'style' from public.cardforge_asset_registry where asset_id=asset) is distinct from style
   or (select contributor_submission_id from public.cardforge_asset_registry where asset_id=asset) is distinct from parent
  then raise exception 'rebalance_published_unapproved'; end if;
  evidence:=public.cardforge_record_source_review_evidence(candidate,
    '{"technicalTrace":"Synthetic style proof","creatorFacts":"Fixture author","rightsFacts":"Fixture rights","aiFacts":null,"aiDisclosurePublic":false}'::jsonb,
    public.cardforge_media_parent_content_version(candidate),0,actor);
  begin
   perform public.cardforge_set_contributor_asset_editorial_review(candidate,'approved','Exact proof',actor,0);
   raise exception 'stale_evidence_approved';
  exception when raise_exception then if sqlerrm<>'editorial_review_evidence_conflict' then raise; end if; end;
  perform public.cardforge_set_contributor_asset_editorial_review(candidate,'approved','Exact proof',actor,1);
  -- Publication rechecks style and retained ordinal, not just displayed revision.
  begin
   update public.cardforge_asset_registry set metadata=jsonb_set(metadata,'{style,name}','"Concurrent edit"') where asset_id=asset;
   perform public.cardforge_set_contributor_asset_owner_override(candidate,true,'published',true,'free','Stale source',actor);
   raise exception 'stale_source_published';
  exception when raise_exception then if sqlerrm not in ('template_review_conflict','style_review_conflict') then raise; end if; end;
  begin
   update public.cardforge_pipeline_asset_lineages set revision_high_water=revision_high_water+1 where registry_asset_id=asset;
   perform public.cardforge_set_contributor_asset_owner_override(candidate,true,'published',true,'free','Stale ordinal',actor);
   raise exception 'stale_highwater_published';
  exception when raise_exception then if sqlerrm<>'style_review_conflict' then raise; end if; end;
  begin
   perform public.cardforge_set_contributor_asset_owner_override(parent,false,null,true,'paid','Tier only',actor);
   if not exists(select 1 from public.cardforge_asset_registry where asset_id=asset and access_tier='paid'
     and metadata->'style'=style and library_source=registry_before->>'library_source')
   then raise exception 'legacy_tier_or_provenance_broken'; end if;
   perform public.cardforge_set_contributor_asset_owner_override(candidate,true,'published',true,'free','Stale tier source',actor);
   raise exception 'stale_tier_published';
  exception when raise_exception then if sqlerrm not in ('template_review_conflict','style_review_conflict') then raise; end if; end;
  insert into public.cardforge_contributor_asset_submissions(id,contributor_id,asset_type,name,status,calculated_access_tier,source_url)
   values(gen_random_uuid(),actor,'elementPresets','Unrelated pending','submitted','contributor','/api/styles#unrelated') returning id into sibling;
  perform public.cardforge_set_contributor_asset_owner_override(candidate,true,'published',true,'free','Reviewed valid synthetic candidate',actor);
  if not exists(select 1 from public.cardforge_asset_registry where asset_id=asset and contributor_submission_id=candidate
    and metadata->'style'=proposed and metadata->>'revisionNumber'='2' and metadata->>'revisionId'=candidate::text
    and metadata->>'unrelatedProvenance'='preserve-me') then raise exception 'approved_style_not_projected'; end if;
  if not exists(select 1 from public.cardforge_contributor_asset_submissions where id=parent and source_payload is null
    and revision_number is not distinct from case when legacy then null else 1 end)
  then raise exception 'legacy_history_rewritten'; end if;
  if not exists(select 1 from public.cardforge_contributor_asset_submissions where id=sibling and status='submitted')
  then raise exception 'unrelated_promoted'; end if;
 end loop;
 raise notice 'PASS style legacy NULL/integer base, exact pins/retry, immutable source, approval/evidence, guarded projection and history';
end $$;
rollback;
