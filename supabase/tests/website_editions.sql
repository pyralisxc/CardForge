-- Website Editions: transaction BODY; caller must provide a single outer
-- BEGIN; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
-- [exact migration SQL as privileged migrator if unapplied];
-- SET LOCAL ROLE service_role; [this body];
-- ROLLBACK. Never COMMIT the proof. No direct Storage API actions.
-- The same body can run after an already-applied migration, in isolated Staging.
-- Do not run with actual Owner publication or acceptance activity.

do $$
declare
  e uuid := gen_random_uuid();
  op1 uuid := gen_random_uuid();
  op2 uuid := gen_random_uuid();
  act uuid := gen_random_uuid();
  rev1 uuid;
  rev2 uuid;
  gen_before bigint;
  live_before uuid;
  generation_after bigint;
  manifest1 jsonb := '{"schemaVersion":1,"configuration":{},"content":[],"media":[]}'::jsonb;
  manifest2 jsonb := '{"schemaVersion":1,"configuration":{},"content":[],"media":[]}'::jsonb;
  path text := 'website-drafts/brand/social/fixture.webp';
  digest text := repeat('a',64);
  source_slot text := 'landing.showcase.generator-bulk';
  source_epochs jsonb;
  source_media jsonb;
  settings_epoch text;
  stale_operation uuid := gen_random_uuid();
  activations_before bigint;
  editions_before bigint;
begin
  -- The historical media authorization routine requires the identical slot,
  -- path and digest inside the immutable revision manifest as well as ledger.
  manifest1 := jsonb_set(manifest1, '{media}', jsonb_build_array(
    jsonb_build_object('slot','brand.social','storagePath',path,'sha256',digest)));
  if has_function_privilege('anon',
      'public.cardforge_website_save_revision(uuid,uuid,uuid,text,jsonb,jsonb)','EXECUTE')
    or has_function_privilege('authenticated',
      'public.cardforge_website_activate(uuid,bigint,uuid,text,jsonb)','EXECUTE')
    or has_function_privilege('anon',
      'public.cardforge_website_activated_media_version(text,text)','EXECUTE')
  then raise exception 'website edition browser role privilege leak'; end if;

  select generation,live_revision_id into gen_before,live_before
    from public.cardforge_website_state where id='cardforge' for update;
  if not found then raise exception 'missing website state singleton'; end if;

  -- Adoption exercises global singleton authority; this disposable proof is
  -- ineligible if an actual revision was already activated.
  if live_before is not null or gen_before <> 0 then
    raise exception 'website_fixture_requires_unactivated_state';
  end if;
  if exists(select 1 from public.cardforge_site_media where slot=source_slot)
  then raise exception 'website_fixture_disposable_slot_occupied'; end if;
  select count(*) into activations_before from public.cardforge_website_activations;
  select count(*) into editions_before from public.cardforge_website_editions;
  select updated_at::text into settings_epoch
    from public.cardforge_owner_settings where id='cardforge';
  if settings_epoch is null then raise exception 'website_fixture_missing_legacy_config'; end if;

  -- Only the just-inserted row is removed. Snapshot includes every existing
  -- row so a genuine provider record is never deleted or modified.
  insert into public.cardforge_site_media(slot,storage_path,alt,presentation)
    values(source_slot,null,'Rollback-only website adoption fixture','{}'::jsonb);
  select coalesce(jsonb_object_agg(slug,to_jsonb(updated_at)),'{}'::jsonb)
    into source_epochs from public.cardforge_site_content_blocks;
  select coalesce(jsonb_object_agg(slot,to_jsonb(updated_at)),'{}'::jsonb)
    into source_media from public.cardforge_site_media;
  if not source_media ? source_slot then
    raise exception 'website_fixture_source_snapshot_not_captured'; end if;
  delete from public.cardforge_site_media where slot=source_slot;
  if found is false then raise exception 'website_fixture_disposable_delete_missing'; end if;
  begin
    perform public.cardforge_website_initialize(
      '{"schemaVersion":1,"configuration":{},"content":[],"media":[]}'::jsonb,
      '[]'::jsonb,settings_epoch,source_epochs,source_media,
      stale_operation,'website-fixture');
    raise exception 'stale website adoption unexpectedly accepted';
  exception when raise_exception then
    if sqlerrm <> 'website_bootstrap_conflict' then raise; end if;
  end;
  if (select generation from public.cardforge_website_state where id='cardforge')<>gen_before
    or (select live_revision_id from public.cardforge_website_state where id='cardforge') is distinct from live_before
    or (select count(*) from public.cardforge_website_activations)<>activations_before
    or (select count(*) from public.cardforge_website_editions)<>editions_before
    or exists(select 1 from public.cardforge_website_revisions where operation_id=stale_operation)
  then raise exception 'rejected adoption mutated canonical website state'; end if;

  insert into public.cardforge_website_editions(id,name)
    values(e,'rollback-proof-'||e::text);
  rev1 := public.cardforge_website_save_revision(
    e,null,op1,'website-fixture',manifest1,
    jsonb_build_array(jsonb_build_object(
      'storagePath',path,'sha256',digest)));
  if rev1 is distinct from public.cardforge_website_save_revision(
      e,null,op1,'website-fixture',manifest1,
      jsonb_build_array(jsonb_build_object('storagePath',path,'sha256',digest)))
    or not exists (select 1 from public.cardforge_website_revision_media
       where revision_id=rev1 and storage_path=path and sha256=digest)
  then raise exception 'idempotent Save or exact retained media identity failed'; end if;

  begin
    perform public.cardforge_website_save_revision(e,null,op2,
      'website-fixture',manifest2,'[]'::jsonb);
    raise exception 'stale Save unexpectedly accepted';
  exception when raise_exception then
    if sqlerrm <> 'website_revision_conflict' then raise; end if;
  end;

  rev2 := public.cardforge_website_save_revision(e,rev1,op2,
    'website-fixture',manifest2,'[]'::jsonb);
  if rev2=rev1 or (select count(*) from public.cardforge_website_revisions
      where edition_id=e)<>2 then
    raise exception 'Save revision sequence failed'; end if;

  begin
    update public.cardforge_website_revisions set manifest=manifest2 where id=rev1;
    raise exception 'revision history update unexpectedly allowed';
  exception when raise_exception then
    if sqlerrm <> 'website_history_immutable' then raise; end if;
  end;
  begin
    delete from public.cardforge_website_revision_media where revision_id=rev1;
    raise exception 'retained media reference deletion unexpectedly allowed';
  exception when raise_exception then
    if sqlerrm <> 'website_history_immutable' then raise; end if;
  end;

  if exists(select 1 from public.cardforge_website_activated_media_version('brand.social',path))
  then raise exception 'inactive media identity was publicly authorized'; end if;
  generation_after := public.cardforge_website_activate(
    rev1,gen_before,act,'website-fixture','{}'::jsonb);
  if generation_after<>gen_before+1
    or (select live_revision_id from public.cardforge_website_state
        where id='cardforge')<>rev1
    or (select previous_revision_id from public.cardforge_website_activations
        where operation_id=act) is distinct from live_before
    or not exists(select 1 from public.cardforge_website_activated_media_version(
        'brand.social',path) where storage_path=path and sha256=digest)
  then raise exception 'activation pointer, history or exact media authorization failed'; end if;
  if exists(select 1 from public.cardforge_website_activated_media_version('brand.favicon',path))
    or exists(select 1 from public.cardforge_website_activated_media_version('brand.social',path||'-wrong'))
  then raise exception 'incorrect media identity unexpectedly authorized'; end if;
  if public.cardforge_website_activate(rev1,gen_before,act,
      'website-fixture','{}'::jsonb)<>generation_after then
    raise exception 'activation operation idempotency failed'; end if;

  begin
    perform public.cardforge_website_activate(rev2,gen_before,
       gen_random_uuid(),'website-fixture','{}'::jsonb);
    raise exception 'stale activation unexpectedly accepted';
  exception when raise_exception then
    if sqlerrm <> 'website_activation_conflict' then raise; end if;
  end;
  begin
    perform public.cardforge_website_archive_edition(e);
    raise exception 'active edition unexpectedly archived';
  exception when raise_exception then
    if sqlerrm <> 'website_edition_active' then raise; end if;
  end;
  if (select count(*) from public.cardforge_website_activations
      where operation_id=act)<>1 then
    raise exception 'activation operation wrote duplicate history'; end if;
end $$;

-- This is SEQUENTIAL stale-snapshot rejection, NOT a two-session race proof.
-- Caller MUST ROLLBACK the outer transaction even when all assertions pass.
-- A simultaneous writer and Storage bytes/policy are not exercised here.
