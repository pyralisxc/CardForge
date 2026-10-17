-- Run against isolated Staging after the media candidate migration. All fixtures roll back.
-- Storage copy/worker deletion are separately exercised by the hosted disposable-file specimen.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $$
declare
  asset text := 'media-revision-proof-' || gen_random_uuid()::text;
  parent uuid := gen_random_uuid();
  candidate uuid := gen_random_uuid();
  next_candidate uuid := gen_random_uuid();
  sibling uuid := gen_random_uuid();
  lineage uuid;
  key text := gen_random_uuid()::text;
  snapshot jsonb;
  presentation jsonb;
  old_row jsonb;
  old_registry jsonb;
  child public.cardforge_contributor_asset_submissions%rowtype;
  path text;
  claim record;
  claimed boolean := false;
begin
  insert into public.cardforge_contributor_asset_submissions(
    id,contributor_id,contributor_email,asset_type,name,description,preview_url,source_url,
    source_storage_bucket,source_storage_path,source_file_size_bytes,source_mime_type,
    status,calculated_access_tier,editorial_review_status,revision_number,registry_asset_id,target_registry_asset_id,
    specialty_tags,use_case_tags,semantic_role,visual_family,variant_kind,variant_label,compatibility_tags,source_notes,requested_studio_destination
  ) values (
    parent,'original-creator','original@example.invalid','textures','Source fixture','Authored description','https://example.invalid/preview.svg','https://example.invalid/original.svg',
    'fixture-bucket','original.svg',53,'image/svg+xml',
    'published','free','approved',1,asset,asset,
    array['general'],'{}','texture','Original family','base',null,array['digital'],'Unchanged source notes','appearance.texture'
  );
  perform public.cardforge_sync_contributor_asset_registry(parent);
  -- Preserve the current legacy live/pending grandfathering without granting it to a child.
  update public.cardforge_contributor_asset_submissions set editorial_review_status='pending' where id=parent;
  select lineage_id into lineage from public.cardforge_contributor_asset_submissions where id=parent;
  -- An archived unpublished sibling still consumes its immutable ordinal.
  insert into public.cardforge_contributor_asset_submissions(id,lineage_id,contributor_id,asset_type,name,status,revision_number,target_registry_asset_id)
    values(sibling,lineage,'original-creator','textures','Archived draft','archived',7,asset);
  if has_function_privilege('anon','public.cardforge_create_media_presentation_revision(text,text,uuid,jsonb,text,text)','EXECUTE')
    or has_function_privilege('authenticated','public.cardforge_read_media_revision_base(text)','EXECUTE')
    or not has_function_privilege('service_role','public.cardforge_create_media_presentation_revision(text,text,uuid,jsonb,text,text)','EXECUTE')
  then raise exception 'Media candidate privileges expanded beyond the server owner'; end if;
  snapshot := public.cardforge_read_media_revision_base(asset);
  presentation := (snapshot - array['assetId','name','sourceBucket','sourcePath','sourceUrl','sourceMimeType','sourceSize']) ||
    pg_catalog.jsonb_build_object('schemaVersion',1,'sourceSha256',repeat('a',64),'proposed',pg_catalog.jsonb_build_object('tileMode','contain','seamless',false));
  path := 'media-revisions/' || candidate::text || '/' || repeat('a',64) || '.svg';
  select to_jsonb(s) into old_row from public.cardforge_contributor_asset_submissions s where id=parent;
  select to_jsonb(r) into old_registry from public.cardforge_asset_registry r where asset_id=asset;
  perform public.cardforge_create_media_presentation_revision(asset,key,candidate,presentation,'https://example.invalid/'||path,path);
  select * into child from public.cardforge_contributor_asset_submissions where id=candidate;
  if child.lineage_id<>lineage or child.revision_number<>8 or child.base_revision_number<>1
    or child.contributor_id<>'original-creator' or child.contributor_email<>'original@example.invalid'
    or child.source_notes<>'Unchanged source notes' or child.description<>'Authored description'
    or child.preview_url<>'https://example.invalid/preview.svg' or child.visual_family<>'Original family'
    or child.specialty_tags<>array['general'] or child.compatibility_tags<>array['digital']
    or child.source_storage_path<>path or child.source_storage_path='original.svg'
    or child.source_storage_bucket<>'fixture-bucket' or child.source_mime_type<>'image/svg+xml'
    or child.source_file_size_bytes<>53 or child.source_payload is not null
    or child.status<>'submitted' or child.editorial_review_status<>'pending'
    or child.editorial_reviewed_by is not null or child.editorial_reviewed_at is not null
    or child.published_at is not null or child.owner_status_override is not null
    or child.positive_votes<>0 or child.negative_votes<>0 or child.calculated_access_tier<>'contributor'
  then raise exception 'Media candidate lost identity, inherited facts, ordinal, independent bytes ownership or pending policy'; end if;
  if (select to_jsonb(s) from public.cardforge_contributor_asset_submissions s where id=parent) is distinct from old_row
    or (select to_jsonb(r) from public.cardforge_asset_registry r where asset_id=asset) is distinct from old_registry
  then raise exception 'Candidate creation changed original publication'; end if;
  -- Exact retry, including after creation of a sibling candidate, returns the original child.
  if public.cardforge_create_media_presentation_revision(asset,key,gen_random_uuid(),presentation,'ignored','ignored')<>candidate then
    raise exception 'Exact retry created a duplicate'; end if;
  begin
    perform public.cardforge_create_media_presentation_revision(asset,key,gen_random_uuid(),jsonb_set(presentation,'{proposed,tileMode}','"stretch"'),'ignored','ignored');
    raise exception 'Changed payload under same key accepted';
  exception when raise_exception then if sqlerrm<>'pipeline_media_conflict' then raise; end if; end;
  begin
    perform public.cardforge_create_media_presentation_revision(asset,gen_random_uuid()::text,gen_random_uuid(),presentation,'ignored','ignored');
    raise exception 'Different active sibling was overwritten';
  exception when raise_exception then if sqlerrm not in ('pipeline_media_conflict','pipeline_media_invalid') then raise; end if; end;
  update public.cardforge_contributor_asset_submissions set status='published' where id=candidate;
  if (select status from public.cardforge_contributor_asset_submissions where id=candidate)<>'publish_candidate' then
    raise exception 'Pending media revision bypassed the native editorial downgrade'; end if;
  perform public.cardforge_sync_contributor_asset_registry(candidate);
  if (select to_jsonb(r) from public.cardforge_asset_registry r where asset_id=asset) is distinct from old_registry then
    raise exception 'Pending publication attempt moved the live pointer'; end if;
  begin
    perform public.cardforge_set_contributor_asset_owner_override(candidate,true,'published',false,null,'Not an approval bypass','owner-proof');
    raise exception 'Owner publishing override bypassed media publication block';
  exception when raise_exception then if sqlerrm<>'pipeline_media_editorial_review_required' then raise; end if; end;
  if (select editorial_review_status from public.cardforge_contributor_asset_submissions where id=candidate)<>'pending' then
    raise exception 'Failed publication approved the candidate'; end if;
  begin
    update public.cardforge_contributor_asset_submissions set source_storage_path='original.svg' where id=candidate;
    raise exception 'Candidate shared the original purge path';
  exception when raise_exception then if sqlerrm<>'pipeline_media_revision_immutable' then raise; end if; end;
  begin
    update public.cardforge_contributor_asset_submissions set name='Changed same-key content',source_notes='Invented source',semantic_role='foundation' where id=candidate;
    raise exception 'Generic content update mutated a keyed candidate';
  exception when raise_exception then if sqlerrm<>'pipeline_media_revision_immutable' then raise; end if; end;
  -- Same revision number cannot hide a changed classification/source/presentation baseline.
  update public.cardforge_contributor_asset_submissions set source_notes='New evidence' where id=parent;
  begin
    perform public.cardforge_create_media_presentation_revision(asset,gen_random_uuid()::text,gen_random_uuid(),presentation,'ignored','ignored');
    raise exception 'Stale source/classification version accepted';
  exception when raise_exception then if sqlerrm<>'pipeline_media_conflict' then raise; end if; end;
  update public.cardforge_contributor_asset_submissions set source_notes='Unchanged source notes' where id=parent;
  -- Only the unpublished child's independent object is claimed; the real worker
  -- removes this returned path before calling the existing finalize function.
  update public.cardforge_contributor_asset_submissions
    set status='archived',automated_status='archived',calculated_access_tier='hidden',automated_access_tier='hidden',
      trashed_at=now()-interval '31 days',purge_after=now()-interval '1 day',trash_reason='expired'
    where id=candidate;
  for claim in select * from public.cardforge_claim_pipeline_revision_purges(250) loop
    if claim.submission_id=parent then raise exception 'Original publication was purgeable'; end if;
    if claim.submission_id=candidate then
      claimed:=true;
      if claim.storage_bucket<>'fixture-bucket' or claim.storage_path<>path then raise exception 'Purge claim selected wrong bytes'; end if;
      if not public.cardforge_finalize_pipeline_revision_purge(candidate) then raise exception 'Candidate purge did not finalize'; end if;
    end if;
  end loop;
  if not claimed or exists(select 1 from public.cardforge_contributor_asset_submissions where id=candidate)
    or not exists(select 1 from public.cardforge_contributor_asset_submissions where id=parent and source_storage_path='original.svg')
    or (select to_jsonb(r) from public.cardforge_asset_registry r where asset_id=asset) is distinct from old_registry
  then raise exception 'Retention did not preserve the original live asset'; end if;
  snapshot := public.cardforge_read_media_revision_base(asset);
  presentation := (snapshot - array['assetId','name','sourceBucket','sourcePath','sourceUrl','sourceMimeType','sourceSize']) ||
    pg_catalog.jsonb_build_object('schemaVersion',1,'sourceSha256',repeat('a',64),'proposed',pg_catalog.jsonb_build_object('tileMode','contain','seamless',false));
  path := 'media-revisions/' || next_candidate::text || '/' || repeat('a',64) || '.svg';
  perform public.cardforge_create_media_presentation_revision(asset,gen_random_uuid()::text,next_candidate,presentation,'https://example.invalid/'||path,path);
  if (select revision_number from public.cardforge_contributor_asset_submissions where id=next_candidate)<>9
    or (select revision_high_water from public.cardforge_pipeline_asset_lineages where id=lineage)<>9
  then raise exception 'Purge reused an allocated revision ordinal'; end if;
end $$;

do $$
declare
  asset text := 'approved-media-proof-'||gen_random_uuid()::text;
  parent uuid:=gen_random_uuid(); c1 uuid:=gen_random_uuid(); c2 uuid:=gen_random_uuid(); competitor uuid:=gen_random_uuid();
  lineage uuid; snapshot jsonb; p jsonb; path text; original_registry jsonb; approval_note text; approval_by text; approval_at timestamptz;
  k integer; current_number integer; current_snapshot jsonb;
begin
  insert into public.cardforge_contributor_asset_submissions(
    id,contributor_id,contributor_email,asset_type,name,description,preview_url,source_url,source_storage_bucket,source_storage_path,
    source_file_size_bytes,source_mime_type,status,calculated_access_tier,editorial_review_status,revision_number,registry_asset_id,target_registry_asset_id,
    specialty_tags,use_case_tags,semantic_role,compatibility_tags,source_notes,requested_studio_destination,published_at
  ) values(parent,'fixture-creator','fixture@example.invalid','textures','Approved-path fixture','Original authored description',
    'https://example.invalid/original.svg','https://example.invalid/original.svg','fixture-bucket','approved-original.svg',53,'image/svg+xml',
    'published','free','approved',1,asset,asset,array['general'],'{}','texture',array['digital'],'Fixture-only source evidence','appearance.texture',now());
  perform public.cardforge_sync_contributor_asset_registry(parent);
  update public.cardforge_asset_registry set library_source='official',
    metadata=metadata||'{"fixtureSource":{"unchanged":true},"defaultOpacity":57,"defaultScale":211,"packId":"fixture-pack"}'::jsonb,
    studio_destinations=array['appearance.texture'],studio_routing_mode='owner',studio_sort_order=91,studio_featured=true where asset_id=asset;
  select lineage_id into lineage from public.cardforge_contributor_asset_submissions where id=parent;
  select to_jsonb(r) into original_registry from public.cardforge_asset_registry r where asset_id=asset;
  snapshot:=public.cardforge_read_media_revision_base(asset);
  p:=(snapshot-array['assetId','name','sourceBucket','sourcePath','sourceUrl','sourceMimeType','sourceSize'])||
    jsonb_build_object('schemaVersion',1,'sourceSha256',repeat('b',64),'proposed',jsonb_build_object('tileMode','contain','seamless',false));
  path:='media-revisions/'||c1::text||'/'||repeat('b',64)||'.svg';
  perform public.cardforge_create_media_presentation_revision(asset,gen_random_uuid()::text,c1,p,'https://example.invalid/'||path,path);
  begin
    perform public.cardforge_set_contributor_asset_owner_override(c1,true,'published',false,null,'Publication is not an approval shortcut','fixture-owner');
    raise exception 'Combined publication approved pending media';
  exception when raise_exception then if sqlerrm<>'pipeline_media_editorial_review_required' then raise; end if; end;
  if (select editorial_review_status from public.cardforge_contributor_asset_submissions where id=c1)<>'pending'
    or (select owner_status_override from public.cardforge_contributor_asset_submissions where id=c1) is not null
  then raise exception 'Rejected combined override changed review state'; end if;
  -- The actual governed review command must run, including its real source/role gate.
  perform public.cardforge_set_contributor_asset_editorial_review(c1,'approved','CF-CQS-1 fixture review only','fixture-reviewer');
  select editorial_review_note,editorial_reviewed_by,editorial_reviewed_at into approval_note,approval_by,approval_at
    from public.cardforge_contributor_asset_submissions where id=c1;
  -- Governance churn must not invalidate the authored/source/presentation snapshot.
  update public.cardforge_contributor_asset_submissions set positive_votes=123,owner_note='Governance only',updated_at=now()+interval '1 minute' where id=parent;
  update public.cardforge_asset_registry set updated_at=now()+interval '1 minute',metadata=jsonb_set(metadata,'{revisionPublishedAt}','"timestamp churn"') where asset_id=asset;
  if public.cardforge_media_parent_content_version(parent)<>snapshot->>'baseVersion'
    or public.cardforge_media_registry_content_version(asset)<>snapshot->>'registryVersion'
  then raise exception 'Governance churn invalidated content-only versions'; end if;
  -- Stale authored, source, classification, presentation, routing and parent identity
  -- each fail in an inner transaction and leave the approved candidate recoverable.
  for k in 1..6 loop
    begin
      if k=1 then update public.cardforge_contributor_asset_submissions set name='Changed author content' where id=parent;
      elsif k=2 then update public.cardforge_contributor_asset_submissions set source_storage_path='changed-source.svg' where id=parent;
      elsif k=3 then update public.cardforge_contributor_asset_submissions set semantic_role='foundation' where id=parent;
      elsif k=4 then update public.cardforge_asset_registry set metadata=jsonb_set(metadata,'{tileMode}','"stretch"') where asset_id=asset;
      elsif k=5 then update public.cardforge_asset_registry set studio_sort_order=92 where asset_id=asset;
      else
        insert into public.cardforge_contributor_asset_submissions(id,lineage_id,contributor_id,asset_type,name,preview_url,source_url,source_storage_bucket,source_storage_path,
          source_file_size_bytes,source_mime_type,status,calculated_access_tier,editorial_review_status,revision_number,registry_asset_id,target_registry_asset_id,specialty_tags,semantic_role,source_notes,published_at)
        values(competitor,lineage,'fixture-creator','textures','Competing parent','https://example.invalid/original.svg','https://example.invalid/original.svg','fixture-bucket','approved-original.svg',53,'image/svg+xml','published','free','approved',1,asset,asset,array['general'],'texture','Fixture evidence',now());
        update public.cardforge_asset_registry set contributor_submission_id=competitor,metadata=jsonb_set(metadata,'{revisionId}',to_jsonb(competitor::text)) where asset_id=asset;
      end if;
      perform public.cardforge_set_contributor_asset_owner_override(c1,true,'published',true,'free','Publish already-approved fixture','fixture-owner');
      raise exception 'Stale media parent accepted';
    exception when raise_exception then if sqlerrm not in ('pipeline_media_conflict','pipeline_media_not_permitted') then raise; end if; end;
  end loop;
  perform public.cardforge_set_contributor_asset_owner_override(c1,true,'published',true,'free','Publish already-approved fixture','fixture-owner');
  select to_jsonb(r) into current_snapshot from public.cardforge_asset_registry r where asset_id=asset;
  if current_snapshot->>'contributor_submission_id'<>c1::text or current_snapshot->>'library_source'<>'official'
    or current_snapshot->'metadata'->>'tileMode'<>'contain' or current_snapshot->'metadata'->'seamless'<>'false'::jsonb
    or ((current_snapshot->'metadata')-array['tileMode','seamless','revisionId','revisionNumber','revisionPublishedAt'])
       is distinct from ((original_registry->'metadata')-array['tileMode','seamless','revisionId','revisionNumber','revisionPublishedAt'])
    or current_snapshot->'studio_destinations' is distinct from original_registry->'studio_destinations'
    or current_snapshot->'studio_sort_order' is distinct from original_registry->'studio_sort_order'
    or current_snapshot->'studio_routing_mode' is distinct from original_registry->'studio_routing_mode'
    or current_snapshot->'studio_featured' is distinct from original_registry->'studio_featured'
  then raise exception 'Approved media projection changed unrelated metadata/library source/routing'; end if;
  if not exists(select 1 from public.cardforge_contributor_asset_submissions where id=parent and source_url='https://example.invalid/original.svg'
      and source_storage_path='approved-original.svg' and source_notes='Fixture-only source evidence')
    or not exists(select 1 from public.cardforge_contributor_asset_submissions where id=c1 and editorial_review_note=approval_note
      and editorial_reviewed_by=approval_by and editorial_reviewed_at=approval_at)
  then raise exception 'Publication changed original source/history or prior editorial evidence'; end if;
  perform public.cardforge_sync_contributor_asset_registry(c1);
  perform public.cardforge_set_contributor_asset_owner_override(c1,false,null,true,'paid','Tier-only decision','fixture-owner');
  if not exists(select 1 from public.cardforge_asset_registry where asset_id=asset and access_tier='paid' and contributor_submission_id=c1)
  then raise exception 'Self-current media sync lost native access-tier update'; end if;
  -- Preserve the existing exact-current Owner discovery-classification seam.
  perform public.cardforge_classify_published_pipeline_asset(asset,c1,lineage,2,array['general'],'{}','texture',null,'base',null,array['digital'],
    array['general'],'{}','foundation','Reviewed fixture family','base',null,array['digital']);
  if not exists(select 1 from public.cardforge_contributor_asset_submissions where id=c1 and semantic_role='foundation' and visual_family='Reviewed fixture family'
    and media_presentation=p and source_storage_path=path and revision_number=2)
  then raise exception 'Canonical classification altered immutable content or did not update'; end if;
  -- A second approved media revision must succeed; older media must archive,
  -- not apply its obsolete parent CAS and roll back a later native rebalance.
  snapshot:=public.cardforge_read_media_revision_base(asset);
  p:=(snapshot-array['assetId','name','sourceBucket','sourcePath','sourceUrl','sourceMimeType','sourceSize'])||
    jsonb_build_object('schemaVersion',1,'sourceSha256',repeat('b',64),'proposed',jsonb_build_object('tileMode','stretch','seamless',false));
  path:='media-revisions/'||c2::text||'/'||repeat('b',64)||'.svg';
  perform public.cardforge_create_media_presentation_revision(asset,gen_random_uuid()::text,c2,p,'https://example.invalid/'||path,path);
  perform public.cardforge_set_contributor_asset_editorial_review(c2,'approved','CF-CQS-1 second fixture review only','fixture-reviewer');
  perform public.cardforge_set_contributor_asset_owner_override(c2,true,'published',true,'paid','Publish second approved fixture','fixture-owner');
  perform public.cardforge_sync_contributor_asset_registry(c1);
  perform public.cardforge_rebalance_contributor_asset_pipeline('fixture-owner');
  if not exists(select 1 from public.cardforge_asset_registry where asset_id=asset and contributor_submission_id=c2 and metadata->>'tileMode'='stretch'
      and metadata->'seamless'='false'::jsonb and library_source='official' and access_tier='paid')
    or not exists(select 1 from public.cardforge_contributor_asset_submissions where id=c1 and status='archived' and source_storage_path<>'approved-original.svg')
  then raise exception 'Second promotion or superseded-media sync corrupted the current pointer/history'; end if;
  -- Existing governance can reset review on an already-published row; this is
  -- not a new candidate promotion or a Publish-to-approve shortcut.
  perform public.cardforge_set_contributor_asset_editorial_review(c2,'pending','','fixture-reviewer');
  if (select editorial_review_status from public.cardforge_contributor_asset_submissions where id=c2)<>'pending' then
    raise exception 'Native editorial reset was blocked'; end if;
end $$;

rollback;
