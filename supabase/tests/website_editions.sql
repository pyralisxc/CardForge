-- Website Editions: isolated disposable SQL proof AFTER the migration is applied
-- in an explicitly approved Staging environment. Never run on production.
-- No Storage object is created and no existing edition is modified permanently.
-- All inserts and the temporary global activation pointer change ROLLBACK.
-- Do not run concurrently with public acceptance or Owner writes.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
set local role service_role;

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
begin
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

rollback;

-- Separate two-connection proof for adoption deletion (not run by this script):
-- In session A take an exact published source snapshot outside the transaction.
-- Session B removes only a disposable row created for the proof; commit its
-- removal while there is no website activation, recording both source epochs.
-- Session A calls cardforge_website_initialize with the stale copied epoch map
-- in BEGIN/ROLLBACK. Expect website_bootstrap_conflict and no new activation.
-- Do not interpret a serial tool's two SQL requests as concurrency evidence.
-- Never delete or update real authored copy, media or the live singleton.
-- This fixture does not prove object bytes, Storage API authorization,
-- cross-session races, browser preview isolation or deployed publication.
