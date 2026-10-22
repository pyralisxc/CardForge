-- Run against isolated Preview after the Owner-purge migration, using an
-- administrative connection permitted to SET LOCAL ROLE. Every fixture and
-- probe is rolled back. No Storage API is called and no existing row is used.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
set local role postgres;

do $$
declare
  browser_role text;
begin
  if not pg_catalog.has_function_privilege('service_role',
      'public.cardforge_prepare_contributor_asset_purge(uuid,text)', 'EXECUTE')
    or not pg_catalog.has_function_privilege('service_role',
      'public.cardforge_finalize_contributor_asset_purge(uuid)', 'EXECUTE')
    or pg_catalog.has_table_privilege('service_role',
      'public.cardforge_pipeline_publication_events', 'DELETE')
  then raise exception 'Owner purge must retain function-only service authority'; end if;

  if not pg_catalog.has_schema_privilege('service_role', 'extensions', 'USAGE')
    or not pg_catalog.has_function_privilege('service_role', 'extensions.digest(bytea,text)', 'EXECUTE')
  then raise exception 'Invoker Prepare cannot fingerprint URLs as service_role'; end if;

  foreach browser_role in array array['anon', 'authenticated'] loop
    if pg_catalog.has_function_privilege(browser_role,
        'public.cardforge_prepare_contributor_asset_purge(uuid,text)', 'EXECUTE')
      or pg_catalog.has_function_privilege(browser_role,
        'public.cardforge_finalize_contributor_asset_purge(uuid)', 'EXECUTE')
    then raise exception 'Browser role % can execute Owner purge', browser_role; end if;
    execute pg_catalog.format('set local role %I', browser_role);
    begin
      perform public.cardforge_prepare_contributor_asset_purge(pg_catalog.gen_random_uuid(), 'Not an asset');
      raise exception 'Browser Prepare unexpectedly executed';
    exception when insufficient_privilege then null;
    end;
    begin
      perform public.cardforge_finalize_contributor_asset_purge(pg_catalog.gen_random_uuid());
      raise exception 'Browser Finalize unexpectedly executed';
    exception when insufficient_privilege then null;
    end;
    execute 'set local role postgres';
  end loop;

  -- A JWT-claims string is not the protected outer SET ROLE identity.
  perform pg_catalog.set_config('request.jwt.claims', '{"role":"service_role"}', true);
  begin
    perform public.cardforge_finalize_contributor_asset_purge(pg_catalog.gen_random_uuid());
    raise exception 'Claims alone authorized the definer';
  exception when insufficient_privilege then
    if sqlerrm <> 'contributor_asset_purge_not_permitted' then raise; end if;
  end;
  perform pg_catalog.set_config('request.jwt.claims', '{}', true);
end;
$$;

set local role service_role;

do $$
declare
  lineage uuid := pg_catalog.gen_random_uuid();
  other_lineage uuid := pg_catalog.gen_random_uuid();
  first_id uuid := pg_catalog.gen_random_uuid();
  live_id uuid := pg_catalog.gen_random_uuid();
  other_id uuid := pg_catalog.gen_random_uuid();
  registry_key text := 'owner-purge-proof-' || lineage::text;
  other_asset_id text := 'owner-purge-control-' || other_lineage::text;
  author_id text := 'owner-purge-author-' || lineage::text;
  asset_name text := 'Owner purge transaction fixture';
  first_source text := 'https://example.invalid/Owner-Purge/Old.svg?raw=1#Front';
  first_preview text := 'https://example.invalid/Owner-Purge/old-preview.webp';
  live_source text := 'https://example.invalid/owner-purge/Old.svg?raw=1#front';
  live_preview text := 'https://example.invalid/owner-purge/current-preview.webp';
  registry_preview text := 'https://example.invalid/owner-purge/registry-preview.webp';
  retained_fingerprint text;
  expected_fingerprints text[];
  original_deleted_at timestamptz := '2001-02-03 04:05:06+00';
  tombstone_snapshot jsonb;
  control_snapshot jsonb;
  control_after jsonb;
  prepared jsonb;
begin
  -- This call proves the new invoker dependency under the real service role.
  retained_fingerprint := pg_catalog.encode(extensions.digest(
    pg_catalog.convert_to('https://example.invalid/already-retained-history.svg', 'UTF8'), 'sha256'), 'hex');
  insert into public.cardforge_pipeline_asset_lineages(id, registry_asset_id)
  values (lineage, registry_key), (other_lineage, other_asset_id);
  -- Registry and submission pointers form a cycle. Seed the registry without
  -- its nullable submission pointer, then link it after the revisions exist.
  -- Keep constraints and native publication triggers enabled throughout.
  insert into public.cardforge_asset_registry
    (asset_id,name,asset_type,url,preview_url,status,access_tier,library_source)
  values (registry_key,asset_name,'icon',first_source,first_preview,'published','free','contributor'),
    (other_asset_id,'Untouched control','icon','https://example.invalid/control.svg',
     'https://example.invalid/control-preview.webp','published','free','contributor');
  insert into public.cardforge_contributor_asset_submissions
    (id,lineage_id,contributor_id,asset_type,name,status,editorial_review_status,calculated_access_tier,
     registry_asset_id,target_registry_asset_id,revision_number,published_at,source_url,preview_url)
  values
    (first_id,lineage,author_id,'icons',asset_name,'archived','approved','hidden',registry_key,registry_key,1,
     pg_catalog.now()-interval '1 day',first_source,first_preview),
    (live_id,lineage,author_id,'icons',asset_name,'published','approved','free',registry_key,registry_key,2,
     pg_catalog.now(),live_source,live_preview),
    (other_id,other_lineage,author_id,'icons','Untouched control','published','approved','free',other_asset_id,other_asset_id,1,
     pg_catalog.now(),'https://example.invalid/control.svg','https://example.invalid/control-preview.webp');

  -- Exercise native publication receipts and native deletion cleanup triggers.
  update public.cardforge_asset_registry set contributor_submission_id = first_id
    where cardforge_asset_registry.asset_id = registry_key;
  update public.cardforge_asset_registry set contributor_submission_id = other_id
    where cardforge_asset_registry.asset_id = other_asset_id;
  update public.cardforge_asset_registry set contributor_submission_id = live_id,
    url = live_source, preview_url = registry_preview where cardforge_asset_registry.asset_id = registry_key;
  if (select count(*) from public.cardforge_pipeline_publication_events e where e.lineage_id = lineage) <> 2
  then raise exception 'Published fixture did not produce two revision receipts'; end if;

  -- The same registry ID text must never broaden deletion beyond lineage UUID.
  insert into public.cardforge_pipeline_publication_events
    (lineage_id,registry_asset_id,published_submission_id,decision_source)
  values (other_lineage,registry_key,other_id,'bootstrap');
  insert into public.cardforge_pipeline_asset_hearts(lineage_id,account_id)
  values (lineage,author_id), (other_lineage,author_id);
  insert into public.cardforge_contributor_asset_votes
    (submission_id,lineage_id,contributor_id,vote_value,vote_weight)
  values (live_id,lineage,author_id,'positive',1), (other_id,other_lineage,author_id,'positive',1);
  select pg_catalog.jsonb_build_object(
    'lineage',(select pg_catalog.to_jsonb(l) from public.cardforge_pipeline_asset_lineages l where l.id=other_lineage),
    'submission',(select pg_catalog.to_jsonb(s) from public.cardforge_contributor_asset_submissions s where s.id=other_id),
    'registry',(select pg_catalog.to_jsonb(r) from public.cardforge_asset_registry r where r.asset_id=other_asset_id),
    'events',(select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(e) order by e.id)
      from public.cardforge_pipeline_publication_events e where e.lineage_id=other_lineage),
    'hearts',(select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(h)) from public.cardforge_pipeline_asset_hearts h where h.lineage_id=other_lineage),
    'votes',(select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(v)) from public.cardforge_contributor_asset_votes v where v.lineage_id=other_lineage))
  into control_snapshot;

  begin
    perform public.cardforge_prepare_contributor_asset_purge(live_id, 'Wrong name');
    raise exception 'Wrong-name Prepare unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm <> 'contributor_asset_purge_confirmation_mismatch' then raise; end if;
  end;
  begin
    perform public.cardforge_finalize_contributor_asset_purge(live_id);
    raise exception 'Unprepared Finalize unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm <> 'contributor_asset_purge_not_prepared' then raise; end if;
  end;
  if exists(select 1 from public.cardforge_pipeline_asset_lineages l where l.id=lineage and l.purge_state is not null)
    or exists(select 1 from public.cardforge_contributor_asset_submissions s where s.lineage_id=lineage and s.purge_state is not null)
    or exists(select 1 from public.cardforge_pipeline_asset_tombstones t where t.asset_id=registry_key)
    or not exists(select 1 from public.cardforge_asset_registry r where r.asset_id=registry_key and r.status='published' and r.access_tier='free')
  then raise exception 'Rejected purge changed the active fixture'; end if;

  insert into public.cardforge_pipeline_asset_tombstones
    (asset_id,asset_name,deleted_submission_id,deleted_at,lineage_id)
  values (registry_key,asset_name,other_id,original_deleted_at,other_lineage);
  begin
    perform public.cardforge_prepare_contributor_asset_purge(live_id, asset_name);
    raise exception 'Conflicting tombstone was rebound';
  exception when raise_exception then
    if sqlerrm <> 'contributor_asset_purge_identity_conflict' then raise; end if;
  end;
  if exists(select 1 from public.cardforge_pipeline_asset_lineages l where l.id=lineage and l.purge_state is not null)
    or exists(select 1 from public.cardforge_contributor_asset_submissions s where s.lineage_id=lineage and s.purge_state is not null)
    or not exists(select 1 from public.cardforge_pipeline_asset_tombstones t where t.asset_id=registry_key
      and t.lineage_id=other_lineage and t.deleted_submission_id=other_id and t.deleted_at=original_deleted_at)
  then raise exception 'Conflicting Prepare did not roll back its partial changes'; end if;
  begin
    update public.cardforge_pipeline_asset_lineages set purge_state='pending' where id=lineage;
    update public.cardforge_contributor_asset_submissions set purge_state='pending' where lineage_id=lineage;
    begin
      perform public.cardforge_finalize_contributor_asset_purge(live_id);
      raise exception 'Definer ignored the conflicting tombstone lineage';
    exception when raise_exception then
      if sqlerrm <> 'contributor_asset_purge_identity_conflict' then raise; end if;
    end;
    if (select count(*) from public.cardforge_pipeline_publication_events e where e.lineage_id=lineage) <> 2
      or (select count(*) from public.cardforge_contributor_asset_submissions s where s.lineage_id=lineage) <> 2
    then raise exception 'Rejected definer call deleted history'; end if;
    raise exception 'Restore only the pending-state probe' using errcode='ZX002';
  exception when sqlstate 'ZX002' then null;
  end;
  delete from public.cardforge_pipeline_asset_tombstones t where t.asset_id=registry_key;

  -- Simulate an older, prepared Owner purge such as Arcane, with Storage already
  -- absent. Normal same-name Prepare must capture identity without re-dating it.
  update public.cardforge_pipeline_asset_lineages set purge_state='pending' where id=lineage;
  update public.cardforge_contributor_asset_submissions set purge_state='pending' where lineage_id=lineage;
  insert into public.cardforge_pipeline_asset_tombstones
    (asset_id,asset_name,deleted_submission_id,deleted_at,source_url_fingerprints)
  values (registry_key,asset_name,first_id,original_deleted_at,array[retained_fingerprint]);
  prepared := public.cardforge_prepare_contributor_asset_purge(live_id, asset_name);
  if prepared->>'lineageId' is distinct from lineage::text
    or prepared->>'registryAssetId' is distinct from registry_key
    or prepared->'storageObjects' is distinct from '[]'::jsonb
  then raise exception 'Legacy retry returned the wrong identity or Storage manifest'; end if;
  select pg_catalog.array_agg(distinct pg_catalog.encode(extensions.digest(
    pg_catalog.convert_to(url, 'UTF8'), 'sha256'), 'hex')) into expected_fingerprints
  from (values(first_source),(first_preview),(live_source),(live_preview),(registry_preview),
    ('https://example.invalid/already-retained-history.svg')) reference(url);
  if not exists(select 1 from public.cardforge_pipeline_asset_tombstones t where t.asset_id=registry_key
    and t.lineage_id=lineage and t.deleted_submission_id=first_id and t.deleted_at=original_deleted_at
    and t.identity_captured_at is not null and t.deletion_reason='owner_permanent_deletion'
    and t.source_url_fingerprints @> expected_fingerprints and t.source_url_fingerprints <@ expected_fingerprints
    and pg_catalog.cardinality(t.source_url_fingerprints)=pg_catalog.cardinality(expected_fingerprints))
  then raise exception 'Prepare lost exact URL identity, original intent, or a retained fingerprint'; end if;
  select pg_catalog.to_jsonb(t) into tombstone_snapshot from public.cardforge_pipeline_asset_tombstones t where t.asset_id=registry_key;
  perform public.cardforge_prepare_contributor_asset_purge(live_id, asset_name);
  -- Array order is not identity; compare its membership above and fixed metadata.
  if not exists(select 1 from public.cardforge_pipeline_asset_tombstones t where t.asset_id=registry_key
    and t.deleted_at=original_deleted_at and t.deleted_submission_id=first_id
    and t.identity_captured_at=(tombstone_snapshot->>'identity_captured_at')::timestamptz
    and t.source_url_fingerprints @> expected_fingerprints and t.source_url_fingerprints <@ expected_fingerprints)
  then raise exception 'Repeated Prepare changed the deletion timestamp or lost identity'; end if;
  select pg_catalog.to_jsonb(t) into tombstone_snapshot from public.cardforge_pipeline_asset_tombstones t where t.asset_id=registry_key;

  -- Roll back a successful native finalization inside a scoped subtransaction.
  -- This proves receipts and trigger-driven cascades remain atomic without
  -- installing a test trigger or touching any unrelated/provider-owned object.
  begin
    if not public.cardforge_finalize_contributor_asset_purge(live_id)
    then raise exception 'Prepared Finalize returned false'; end if;
    raise exception 'Rollback only this fixture finalization' using errcode='ZX001';
  exception when sqlstate 'ZX001' then null;
  end;
  if (select count(*) from public.cardforge_contributor_asset_submissions s where s.lineage_id=lineage) <> 2
    or (select count(*) from public.cardforge_pipeline_publication_events e where e.lineage_id=lineage) <> 2
    or not exists(select 1 from public.cardforge_pipeline_asset_lineages l where l.id=lineage and l.purge_state='pending')
    or not exists(select 1 from public.cardforge_asset_registry r where r.asset_id=registry_key and r.status='archived' and r.access_tier='hidden')
    or not exists(select 1 from public.cardforge_pipeline_asset_hearts h where h.lineage_id=lineage)
    or not exists(select 1 from public.cardforge_contributor_asset_votes v where v.lineage_id=lineage)
  then raise exception 'Scoped rollback lost a receipt, revision, registry, reaction, or lineage'; end if;

  if not public.cardforge_finalize_contributor_asset_purge(live_id)
  then raise exception 'Prepared lineage did not finalize'; end if;
  if exists(select 1 from public.cardforge_contributor_asset_submissions s where s.lineage_id=lineage)
    or exists(select 1 from public.cardforge_pipeline_publication_events e where e.lineage_id=lineage)
    or exists(select 1 from public.cardforge_pipeline_asset_lineages l where l.id=lineage)
    or exists(select 1 from public.cardforge_asset_registry r where r.asset_id=registry_key)
    or exists(select 1 from public.cardforge_pipeline_asset_hearts h where h.lineage_id=lineage)
    or exists(select 1 from public.cardforge_contributor_asset_votes v where v.lineage_id=lineage)
  then raise exception 'Full Owner lineage cleanup left fixture history behind'; end if;
  -- Finalization is expected to set completed_at; every other tombstone field
  -- must remain byte-for-byte equivalent in JSON representation. The original
  -- snapshot must be incomplete, and successful finalization must complete it.
  if tombstone_snapshot->>'completed_at' is not null
    or (select pg_catalog.to_jsonb(t) - 'completed_at'
        from public.cardforge_pipeline_asset_tombstones t where t.asset_id=registry_key)
      is distinct from (tombstone_snapshot - 'completed_at')
    or not exists (select 1 from public.cardforge_pipeline_asset_tombstones t
      where t.asset_id=registry_key and t.completed_at is not null
        and t.completed_at >= t.identity_captured_at)
  then raise exception 'Finalization changed retained deletion identity or failed to record completion'; end if;
  begin
    perform public.cardforge_finalize_contributor_asset_purge(live_id);
    raise exception 'Missing submission unexpectedly finalized again';
  exception when raise_exception then
    if sqlerrm <> 'contributor_asset_purge_not_prepared' then raise; end if;
  end;
  select pg_catalog.jsonb_build_object(
    'lineage',(select pg_catalog.to_jsonb(l) from public.cardforge_pipeline_asset_lineages l where l.id=other_lineage),
    'submission',(select pg_catalog.to_jsonb(s) from public.cardforge_contributor_asset_submissions s where s.id=other_id),
    'registry',(select pg_catalog.to_jsonb(r) from public.cardforge_asset_registry r where r.asset_id=other_asset_id),
    'events',(select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(e) order by e.id)
      from public.cardforge_pipeline_publication_events e where e.lineage_id=other_lineage),
    'hearts',(select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(h)) from public.cardforge_pipeline_asset_hearts h where h.lineage_id=other_lineage),
    'votes',(select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(v)) from public.cardforge_contributor_asset_votes v where v.lineage_id=other_lineage))
  into control_after;
  if control_after is distinct from control_snapshot
  then raise exception 'Owner purge changed the unrelated control lineage'; end if;
end;
$$;

do $$
declare
  ordinary_lineage uuid := pg_catalog.gen_random_uuid();
  ordinary_id uuid := pg_catalog.gen_random_uuid();
  mixed_lineage uuid := pg_catalog.gen_random_uuid();
  mixed_id uuid := pg_catalog.gen_random_uuid();
  sibling_id uuid := pg_catalog.gen_random_uuid();
  draft_lineage uuid := pg_catalog.gen_random_uuid();
  draft_id uuid := pg_catalog.gen_random_uuid();
  unbound_lineage uuid := pg_catalog.gen_random_uuid();
  unbound_id uuid := pg_catalog.gen_random_uuid();
  author_id text := 'owner-purge-pending-' || ordinary_lineage::text;
begin
  insert into public.cardforge_pipeline_asset_lineages(id)
  values (ordinary_lineage),(mixed_lineage),(draft_lineage),(unbound_lineage);
  insert into public.cardforge_contributor_asset_submissions
    (id,lineage_id,contributor_id,asset_type,name,status,purge_state,revision_number,trashed_at,purge_after,trash_reason)
  values (ordinary_id,ordinary_lineage,author_id,'icons','Ordinary retention','archived','pending',1,
      pg_catalog.now()-interval '2 days',pg_catalog.now()-interval '1 day','expired'),
    (mixed_id,mixed_lineage,author_id,'icons','Mixed pending','archived','pending',1,null,null,null),
    (sibling_id,mixed_lineage,author_id,'icons','Not prepared sibling','submitted',null,2,null,null,null),
    (draft_id,draft_lineage,author_id,'icons','Unpublished draft','draft',null,1,null,null,null),
    (unbound_id,unbound_lineage,author_id,'icons','Unbound receipt','draft',null,1,null,null,null);
  begin
    perform public.cardforge_finalize_contributor_asset_purge(ordinary_id);
    raise exception 'Ordinary row-level retention authorized a full lineage purge';
  exception when raise_exception then
    if sqlerrm <> 'contributor_asset_purge_not_prepared' then raise; end if;
  end;
  update public.cardforge_pipeline_asset_lineages set purge_state='pending' where id=mixed_lineage;
  begin
    perform public.cardforge_finalize_contributor_asset_purge(mixed_id);
    raise exception 'One pending row authorized deletion of a nonpending sibling';
  exception when raise_exception then
    if sqlerrm <> 'contributor_asset_purge_not_prepared' then raise; end if;
  end;
  if not exists(select 1 from public.cardforge_contributor_asset_submissions s where s.id=ordinary_id and s.purge_state='pending')
    or (select count(*) from public.cardforge_contributor_asset_submissions s where s.lineage_id=mixed_lineage) <> 2
    or not exists(select 1 from public.cardforge_contributor_asset_submissions s where s.id=sibling_id and s.purge_state is null)
  then raise exception 'Rejected pending-state purge changed its fixture'; end if;

  perform public.cardforge_prepare_contributor_asset_purge(draft_id, 'Unpublished draft');
  -- Keep the mutating function call separate from the visibility assertions:
  -- subqueries in the same SQL expression can retain the caller statement snapshot
  -- and observe pre-finalization rows even after the volatile function mutates them.
  if not public.cardforge_finalize_contributor_asset_purge(draft_id)
  then raise exception 'Eventless unpublished finalizer returned false'; end if;
  if exists(select 1 from public.cardforge_pipeline_asset_lineages l where l.id=draft_lineage)
    or exists(select 1 from public.cardforge_contributor_asset_submissions s where s.id=draft_id)
  then raise exception 'Eventless unpublished lineage or submission remains after finalization'; end if;

  -- An inconsistent receipt without a stable registry binding is not authority
  -- to erase history through the eventless-unpublished exception.
  insert into public.cardforge_pipeline_publication_events
    (lineage_id,registry_asset_id,published_submission_id,decision_source)
  values(unbound_lineage,'owner-purge-unbound-' || unbound_lineage::text,unbound_id,'bootstrap');
  perform public.cardforge_prepare_contributor_asset_purge(unbound_id, 'Unbound receipt');
  begin
    perform public.cardforge_finalize_contributor_asset_purge(unbound_id);
    raise exception 'Unbound publication history was treated as an eventless draft';
  exception when raise_exception then
    if sqlerrm <> 'contributor_asset_purge_identity_conflict' then raise; end if;
  end;
  if not exists(select 1 from public.cardforge_contributor_asset_submissions s where s.id=unbound_id)
    or not exists(select 1 from public.cardforge_pipeline_publication_events e where e.lineage_id=unbound_lineage)
  then raise exception 'Rejected unbound purge removed revision history'; end if;
end;
$$;

do $$
declare
  scenario text;
  lineage uuid;
  anchor_id uuid;
  survivor_id uuid;
  registry_key text;
  author_id text;
  tombstone_snapshot jsonb;
begin
  foreach scenario in array array['registry_absent','anchor_disappeared'] loop
    lineage := pg_catalog.gen_random_uuid();
    anchor_id := pg_catalog.gen_random_uuid();
    survivor_id := pg_catalog.gen_random_uuid();
    registry_key := 'owner-purge-' || scenario || '-' || lineage::text;
    author_id := 'owner-purge-retry-' || lineage::text;
    insert into public.cardforge_pipeline_asset_lineages(id,registry_asset_id) values(lineage,registry_key);
    insert into public.cardforge_asset_registry
      (asset_id,name,asset_type,url,status,access_tier,library_source)
    values(registry_key,'Published survivor','icon','https://example.invalid/retry-survivor.svg',
      'published','free','contributor');
    insert into public.cardforge_contributor_asset_submissions
      (id,lineage_id,contributor_id,asset_type,name,status,editorial_review_status,registry_asset_id,target_registry_asset_id,
       revision_number,published_at,trashed_at,purge_after,trash_reason,source_url)
    values
      (anchor_id,lineage,author_id,'icons','Retry anchor','archived','pending',registry_key,registry_key,1,
       null,pg_catalog.now()-interval '2 days',pg_catalog.now()-interval '1 day','declined','https://example.invalid/retry-anchor.svg'),
      (survivor_id,lineage,author_id,'icons','Published survivor','published','approved',registry_key,registry_key,2,
       pg_catalog.now(),null,null,null,'https://example.invalid/retry-survivor.svg');
    update public.cardforge_asset_registry set contributor_submission_id = survivor_id
      where cardforge_asset_registry.asset_id = registry_key;
    if scenario='registry_absent' then
      -- ON DELETE SET NULL updates submission registry_asset_id. Do that before
      -- Prepare marks the lineage pending: the native pending-immutability guard
      -- must reject FK-driven submission edits during a prepared purge.
      delete from public.cardforge_asset_registry r where r.asset_id=registry_key;
    end if;
    perform public.cardforge_prepare_contributor_asset_purge(anchor_id, 'Retry anchor');
    select pg_catalog.to_jsonb(t) into tombstone_snapshot from public.cardforge_pipeline_asset_tombstones t where t.asset_id=registry_key;
    if scenario='registry_absent' then
      -- The registry was removed before preparation; verify the prepared
      -- tombstone still carries the lineage identity through finalization.
      null;
    else
      -- Ordinary retention can finish an eligible anchor during Owner Storage
      -- cleanup. The already-captured lineage identity must remain sufficient.
      if not public.cardforge_finalize_pipeline_revision_purge(anchor_id)
      then raise exception 'Eligible retention anchor did not disappear'; end if;
      perform public.cardforge_prepare_contributor_asset_purge(survivor_id, 'Published survivor');
      if not exists(select 1 from public.cardforge_pipeline_asset_tombstones t where t.asset_id=registry_key
        and t.deleted_submission_id=anchor_id
        and t.deleted_at=(tombstone_snapshot->>'deleted_at')::timestamptz
        and t.source_url_fingerprints @> array[pg_catalog.encode(extensions.digest(
          pg_catalog.convert_to('https://example.invalid/retry-anchor.svg','UTF8'),'sha256'),'hex')])
      then raise exception 'Retry lost the removed anchor identity or re-dated its deletion'; end if;
    end if;
    if not exists(select 1 from public.cardforge_pipeline_publication_events e where e.lineage_id=lineage)
      or not exists(select 1 from public.cardforge_pipeline_asset_lineages l where l.id=lineage)
    then raise exception 'Fixture did not retain publication history before % retry', scenario; end if;
    if not public.cardforge_finalize_contributor_asset_purge(survivor_id)
    then raise exception '% retry finalizer returned false', scenario; end if;
    if exists(select 1 from public.cardforge_contributor_asset_submissions s where s.lineage_id=lineage)
      or exists(select 1 from public.cardforge_pipeline_publication_events e where e.lineage_id=lineage)
      or exists(select 1 from public.cardforge_pipeline_asset_lineages l where l.id=lineage)
      or exists(select 1 from public.cardforge_asset_registry r where r.asset_id=registry_key)
      or not exists(select 1 from public.cardforge_pipeline_asset_tombstones t where t.asset_id=registry_key and t.lineage_id=lineage)
    then raise exception '% retry did not finish the exact full lineage', scenario; end if;
  end loop;
end;
$$;

rollback;
