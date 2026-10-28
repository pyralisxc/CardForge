-- LOCAL SOURCE CANDIDATE ONLY. Generate the canonical filename with the pinned
-- official CLI before integration. Never execute against a hosted database.
begin;
alter table public.cardforge_contributor_asset_submissions add column catalog_dependencies jsonb;

create function public.cardforge_set_source_identity(p_source jsonb)
returns jsonb language sql immutable security invoker set search_path='' as $$
 select jsonb_build_object('assetType',p_source->'asset_type','id',p_source->'id','lineageId',p_source->'lineage_id',
 'revision',p_source->'revision_number','assetId',p_source->'target_registry_asset_id',
 'url',p_source->'source_url','bucket',p_source->'source_storage_bucket',
 'path',p_source->'source_storage_path','size',p_source->'source_file_size_bytes','payload',p_source->'source_payload');
$$;
create function public.cardforge_set_dependency_binding_valid(p_source jsonb)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
begin
 if jsonb_typeof(p_source->'catalog_dependencies') is distinct from 'object'
   or jsonb_typeof(p_source->'catalog_dependencies'->'references'->'identities') is distinct from 'array'
   or jsonb_typeof(p_source->'catalog_dependencies'->'references'->'sources') is distinct from 'array'
   or jsonb_typeof(p_source->'catalog_dependencies'->'opaqueReasons') is distinct from 'array' then return false; end if;
 return coalesce(p_source->>'asset_type'='sets' and p_source->>'revision_number' is not null
 and p_source->>'lineage_id' is not null and p_source->>'id' is not null
 and p_source->>'source_file_size_bytes' ~ '^[1-9][0-9]*$'
 and p_source->'catalog_dependencies'->>'projectRevision' ~ '^[a-f0-9]{64}$'
 and p_source->'catalog_dependencies'->>'contractVersion'='1'
 and jsonb_typeof(p_source->'catalog_dependencies'->'complete')='boolean'
 and jsonb_typeof(p_source->'catalog_dependencies'->'references')='object'
 and jsonb_typeof(p_source->'catalog_dependencies'->'references'->'identities')='array'
 and jsonb_typeof(p_source->'catalog_dependencies'->'references'->'sources')='array'
 and not exists(select 1 from jsonb_array_elements((p_source->'catalog_dependencies'->'references'->'identities')||(p_source->'catalog_dependencies'->'references'->'sources')) v where jsonb_typeof(v)<>'string')
 and jsonb_typeof(p_source->'catalog_dependencies'->'sourceManifest')='object'
 and p_source->'catalog_dependencies'->>'packageSha256' ~ '^[a-f0-9]{64}$'
 and p_source->'catalog_dependencies'->>'packageSha256'=p_source->'source_payload'->>'packageSha256'
 and p_source->'catalog_dependencies'->>'fileSizeBytes'=p_source->>'source_file_size_bytes'
 and p_source->'catalog_dependencies'->>'projectRevision'=p_source->'catalog_dependencies'->'sourceManifest'->>'projectRevision'
 and p_source->>'source_storage_path'='owner-defaults/sets/'||(p_source->>'target_registry_asset_id')||'/'||(p_source->'catalog_dependencies'->>'packageSha256')||'.cardforge'
 and p_source->>'source_url' ~ '^https://'
 and right(p_source->>'source_url',length('/storage/v1/object/public/'||(p_source->>'source_storage_bucket')||'/'||(p_source->>'source_storage_path')))='/storage/v1/object/public/'||(p_source->>'source_storage_bucket')||'/'||(p_source->>'source_storage_path')
 and p_source->'catalog_dependencies'->>'sourceBinding'=encode(extensions.digest(
 jsonb_build_object('source',public.cardforge_set_source_identity(p_source),
 'interpretation',(p_source->'catalog_dependencies')-'sourceBinding')::text,'sha256'),'hex'),false);
end $$;

-- Both submission and registry writes already hold ROW EXCLUSIVE before this
-- guard. The existing catalog command holds SHARE NOWAIT on these same tables.
-- Never wait on lineage locks with the writer lock held; reject old snapshots.
create function public.cardforge_check_set_dependency_write(p_source jsonb,p_prior jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare target record; ids text[]; aliases text[]; prior_mentions boolean;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'set_catalog_isolation_unsupported'; end if;
 for target in select l.id,l.registry_asset_id from public.cardforge_pipeline_asset_lineages l
 where l.catalog_trashed_at is not null or l.catalog_claim_token is not null or l.catalog_claimed_at is not null for share nowait loop
  ids:=array_remove(array[target.id::text,target.registry_asset_id],null)||array(select s.id::text from public.cardforge_contributor_asset_submissions s where s.lineage_id=target.id);
  select coalesce(array_agg(distinct u) filter(where nullif(u,'') is not null),'{}') into aliases from (
   select r.url u from public.cardforge_asset_registry r where r.asset_id=target.registry_asset_id
   union all select r.preview_url from public.cardforge_asset_registry r where r.asset_id=target.registry_asset_id
   union all select s.source_url from public.cardforge_contributor_asset_submissions s where s.lineage_id=target.id
   union all select s.preview_url from public.cardforge_contributor_asset_submissions s where s.lineage_id=target.id
  ) sources;
  if not public.cardforge_set_dependency_binding_valid(p_source)
    or p_source->'catalog_dependencies'->'complete' is distinct from 'true'::jsonb then raise exception 'set_catalog_dependency_unverified'; end if;
  prior_mentions:=public.cardforge_catalog_consumer_mentions(p_prior,ids,aliases)
   or (public.cardforge_set_dependency_binding_valid(p_prior) and public.cardforge_studio_dependencies_mention(p_prior->'catalog_dependencies'->'references',ids,aliases));
  if (public.cardforge_catalog_consumer_mentions(p_source,ids,aliases)
    or public.cardforge_studio_dependencies_mention(p_source->'catalog_dependencies'->'references',ids,aliases)) and not coalesce(prior_mentions,false)
    then raise exception 'set_catalog_reference_unavailable'; end if;
 end loop;
end $$;

create function public.cardforge_guard_set_package_source()
returns trigger language plpgsql security invoker set search_path='' as $$
declare proof jsonb; prior jsonb;
begin
 if tg_op='UPDATE' then
  prior:=to_jsonb(old);
  -- Bound published package identity is immutable; a new package requires a new
  -- submission, never a proof backfill onto a legacy mutable source.
  if old.catalog_dependencies is not null and (public.cardforge_set_source_identity(to_jsonb(new)) is distinct from public.cardforge_set_source_identity(prior)
    or new.catalog_dependencies is distinct from old.catalog_dependencies) then raise exception 'set_source_binding_immutable'; end if;
  if old.catalog_dependencies is null and new.catalog_dependencies is not null then raise exception 'set_source_new_revision_required'; end if;
  if old.asset_type='sets' and new.asset_type<>'sets' then raise exception 'set_source_kind_immutable'; end if;
  if public.cardforge_set_source_identity(to_jsonb(new)) is not distinct from public.cardforge_set_source_identity(prior)
    and new.preview_url is not distinct from old.preview_url then return new; end if;
 end if;
 if new.asset_type<>'sets' then
  if new.catalog_dependencies is not null then raise exception 'set_source_kind_invalid'; end if;
  return new;
 end if;
 proof:=new.catalog_dependencies;
 if tg_op='INSERT' and proof is not null then
  if proof ? 'sourceBinding' then raise exception 'set_source_binding_must_be_native'; end if;
  new.catalog_dependencies:=proof||jsonb_build_object('sourceBinding',encode(extensions.digest(
    jsonb_build_object('source',public.cardforge_set_source_identity(to_jsonb(new)),'interpretation',proof)::text,'sha256'),'hex'));
  if not public.cardforge_set_dependency_binding_valid(to_jsonb(new)) then raise exception 'set_source_binding_invalid'; end if;
 end if;
 perform public.cardforge_check_set_dependency_write(to_jsonb(new),prior);
 return new;
end $$;
-- Alphabetically after the existing lineage assignment and member locks.
create trigger zz_cardforge_set_package_guard before insert or update on public.cardforge_contributor_asset_submissions
 for each row execute function public.cardforge_guard_set_package_source();

create function public.cardforge_guard_set_registry_source()
returns trigger language plpgsql security invoker set search_path='' as $$
declare source jsonb; prior jsonb;
begin
 if tg_op='UPDATE' and old.asset_type='set' and new.asset_type<>'set' then raise exception 'set_registry_kind_immutable'; end if;
 if new.asset_type<>'set' then return new; end if;
 if tg_op='UPDATE' and row(new.asset_type,new.url,new.preview_url,new.storage_bucket,new.storage_path,new.contributor_submission_id)
   is not distinct from row(old.asset_type,old.url,old.preview_url,old.storage_bucket,old.storage_path,old.contributor_submission_id) then return new; end if;
 select to_jsonb(s) into source from public.cardforge_contributor_asset_submissions s where s.id=new.contributor_submission_id;
 if source->>'source_url' is distinct from new.url or source->>'source_storage_bucket' is distinct from new.storage_bucket
   or source->>'source_storage_path' is distinct from new.storage_path then source:=null; end if;
 if tg_op='UPDATE' then select to_jsonb(s) into prior from public.cardforge_contributor_asset_submissions s where s.id=old.contributor_submission_id; end if;
 -- Include the actual selected preview, not only the package interpretation.
 source:=source||jsonb_build_object('preview_url',new.preview_url);
 perform public.cardforge_check_set_dependency_write(source,prior);
 return new;
end $$;
create trigger zz_cardforge_set_registry_guard before insert or update on public.cardforge_asset_registry
 for each row execute function public.cardforge_guard_set_registry_source();

revoke all on function public.cardforge_set_source_identity(jsonb),public.cardforge_set_dependency_binding_valid(jsonb),
 public.cardforge_check_set_dependency_write(jsonb,jsonb),public.cardforge_guard_set_package_source(),public.cardforge_guard_set_registry_source() from public,anon,authenticated;
grant execute on function public.cardforge_set_source_identity(jsonb),public.cardforge_set_dependency_binding_valid(jsonb),
 public.cardforge_check_set_dependency_write(jsonb,jsonb),public.cardforge_guard_set_package_source(),public.cardforge_guard_set_registry_source() to service_role;

create or replace function public.cardforge_publish_official_starter_set(
  p_asset_id text,
  p_name text,
  p_description text,
  p_package_url text,
  p_preview_url text,
  p_storage_bucket text,
  p_storage_path text,
  p_file_size_bytes bigint,
  p_package_sha256 text,
  p_contributor_id text,
  p_contributor_email text,
  p_specialty_tags text[],
  p_use_case_tags text[],
  p_source_notes text,
  p_package_interpretation jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  submission_id uuid;
  previous_revision integer;
  stable_submission_key text;
begin
  if p_asset_id !~ '^[a-z0-9][a-z0-9-]{2,119}$'
    or nullif(pg_catalog.btrim(p_name), '') is null
    or nullif(pg_catalog.btrim(p_description), '') is null
    or p_package_url !~ '^https://'
    or nullif(pg_catalog.btrim(p_storage_bucket), '') is null
    or nullif(pg_catalog.btrim(p_storage_path), '') is null
    or p_file_size_bytes <= 0
    or p_package_sha256 !~ '^[a-f0-9]{64}$'
    or nullif(pg_catalog.btrim(p_contributor_id), '') is null
    or pg_catalog.cardinality(coalesce(p_specialty_tags, '{}'::text[])) = 0
    or pg_catalog.cardinality(coalesce(p_use_case_tags, '{}'::text[])) = 0
    or not public.cardforge_content_tags_are_valid(p_specialty_tags)
    or not public.cardforge_content_tags_are_valid(p_use_case_tags)
  then
    raise exception 'official_starter_set_invalid';
  end if;

  if not exists (
    select 1 from public.cardforge_contributor_profiles
    where clerk_user_id = p_contributor_id and status = 'active'
  ) then
    raise exception 'official_starter_set_contributor_required';
  end if;

  stable_submission_key := (case when p_package_interpretation is null then 'official-starter-set:' else 'official-starter-set:source-v1:' end) || p_asset_id || ':' || p_package_sha256;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('official-starter-set:'||p_asset_id,0));
  perform l.id from public.cardforge_pipeline_asset_lineages l where l.registry_asset_id=p_asset_id for update nowait;

  select id
  into submission_id
  from public.cardforge_contributor_asset_submissions
  where submission_key = stable_submission_key
  limit 1
  for update;

  if submission_id is null then
    select coalesce(max(revision_number), 0)
    into previous_revision
    from public.cardforge_contributor_asset_submissions
    where asset_type = 'sets'
      and (target_registry_asset_id = p_asset_id or registry_asset_id = p_asset_id);

    update public.cardforge_contributor_asset_submissions
    set
      status = 'archived',
      automated_status = 'archived',
      owner_status_override = 'archived',
      decision_reason = 'superseded_revision'
    where asset_type = 'sets'
      and status = 'published'
      and (target_registry_asset_id = p_asset_id or registry_asset_id = p_asset_id);

    insert into public.cardforge_contributor_asset_submissions (
      contributor_id,
      contributor_email,
      asset_type,
      name,
      description,
      preview_url,
      source_url,
      status,
      automated_status,
      owner_status_override,
      calculated_access_tier,
      automated_access_tier,
      owner_access_tier_override,
      quality_score,
      tier_decision_reason,
      decision_reason,
      source_file_size_bytes,
      source_mime_type,
      source_storage_bucket,
      source_storage_path,
      source_payload,
      catalog_dependencies,
      target_registry_asset_id,
      base_revision_number,
      revision_number,
      submission_key,
      published_at,
      specialty_tags,
      use_case_tags,
      source_notes
    ) values (
      p_contributor_id,
      nullif(pg_catalog.btrim(p_contributor_email), ''),
      'sets',
      pg_catalog.btrim(p_name),
      pg_catalog.btrim(p_description),
      coalesce(nullif(pg_catalog.btrim(p_preview_url), ''), ''),
      p_package_url,
      'published',
      'published',
      'published',
      'free',
      'free',
      'free',
      100,
      'owner_forced_free',
      'published',
      p_file_size_bytes,
      'application/vnd.cardforge.project+zip',
      p_storage_bucket,
      p_storage_path,
      pg_catalog.jsonb_build_object('packageSha256', p_package_sha256, 'portableProject', true),
      p_package_interpretation,
      p_asset_id,
      previous_revision,
      previous_revision + 1,
      stable_submission_key,
      pg_catalog.now(),
      p_specialty_tags,
      p_use_case_tags,
      pg_catalog.btrim(p_source_notes)
    ) returning id into submission_id;
  else
    if p_package_interpretation is not null and not exists (
      select 1 from public.cardforge_contributor_asset_submissions s where s.id=submission_id
      and public.cardforge_set_dependency_binding_valid(to_jsonb(s))
      and (s.catalog_dependencies-'sourceBinding')=p_package_interpretation
      and s.source_url=p_package_url and s.source_storage_bucket=p_storage_bucket
      and s.source_storage_path=p_storage_path and s.source_file_size_bytes=p_file_size_bytes
    ) then raise exception 'set_package_retry_conflict'; end if;
    update public.cardforge_contributor_asset_submissions
    set
      source_url = p_package_url,
      source_file_size_bytes = p_file_size_bytes,
      source_storage_bucket = p_storage_bucket,
      source_storage_path = p_storage_path,
      preview_url = coalesce(nullif(pg_catalog.btrim(p_preview_url), ''), preview_url),
      updated_at = pg_catalog.now()
    where id = submission_id;
  end if;

  perform public.cardforge_sync_contributor_asset_registry(submission_id);
  return submission_id;
end;
$$;

create or replace function public.cardforge_publish_official_starter_set(p_asset_id text,p_name text,p_description text,p_package_url text,p_preview_url text,p_storage_bucket text,p_storage_path text,p_file_size_bytes bigint,p_package_sha256 text,p_contributor_id text,p_contributor_email text,p_specialty_tags text[],p_use_case_tags text[],p_source_notes text) returns uuid language sql security invoker set search_path='' as $$
 select public.cardforge_publish_official_starter_set(p_asset_id,p_name,p_description,p_package_url,p_preview_url,p_storage_bucket,p_storage_path,p_file_size_bytes,p_package_sha256,p_contributor_id,p_contributor_email,p_specialty_tags,p_use_case_tags,p_source_notes,null::jsonb);
$$;
revoke all on function public.cardforge_publish_official_starter_set(text,text,text,text,text,text,text,bigint,text,text,text,text[],text[],text,jsonb) from public,anon,authenticated;
grant execute on function public.cardforge_publish_official_starter_set(text,text,text,text,text,text,text,bigint,text,text,text,text[],text[],text,jsonb) to service_role;

create or replace function public.cardforge_catalog_trash_entry_reasons(p_lineage_id uuid)
returns text[] language plpgsql security invoker set search_path='' as $$
declare l public.cardforge_pipeline_asset_lineages%rowtype; r public.cardforge_asset_registry%rowtype;
  reasons text[] := '{}'; consumer record; payload jsonb; key text;
  ids text[]; sources text[]; opaque boolean:=false; referenced boolean:=false;
begin
  select * into l from public.cardforge_pipeline_asset_lineages where id=p_lineage_id;
  select * into r from public.cardforge_asset_registry where asset_id=l.registry_asset_id;
  if l.catalog_destructive_uncertainty is not null then reasons:=array_append(reasons,l.catalog_destructive_uncertainty); end if;
  if l.purge_state is not null or l.catalog_claim_token is not null or l.catalog_claimed_at is not null
    or exists(select 1 from public.cardforge_contributor_asset_submissions s where s.lineage_id=l.id
      and (s.purge_state is not null or s.purge_claim_token is not null or s.purge_claimed_at is not null or s.owner_purge_requested_at is not null))
    then reasons:=array_append(reasons,'destructive_attempt_requires_reconciliation'); end if;
  if r.asset_id is null or r.contributor_submission_id is null then
    reasons:=array_append(reasons,'catalog_registry_identity_unavailable');
  end if;
  if exists(select 1 from public.cardforge_contributor_asset_submissions newer
    join public.cardforge_contributor_asset_submissions published_base on published_base.id=r.contributor_submission_id
    where newer.lineage_id=l.id and newer.revision_number>published_base.revision_number) then
    reasons:=array_append(reasons,'newer_revision_requires_review');
  end if;
  if exists(select 1 from public.cardforge_contributor_asset_submissions source where source.lineage_id=l.id
    and (source.source_storage_bucket is not null or source.source_storage_path is not null)
    and not coalesce((source.source_storage_bucket='cardforge-contributor-assets'
      and source.source_storage_path=l.upload_source_path and l.upload_state='owned'
      and l.upload_operation_token is not null and l.upload_request is not null
      and exists(select 1 from public.cardforge_contributor_asset_submissions receipt
        where receipt.id=l.upload_submission_id and receipt.lineage_id=l.id
          and receipt.source_upload_token=l.upload_operation_token
          and receipt.source_storage_bucket=source.source_storage_bucket
          and receipt.source_storage_path=source.source_storage_path)),false)) then
    reasons:=array_append(reasons,'upload_cleanup_commitment_unverified');
  end if;
  -- Templates, fonts and presets also supply the runtime bootstrap. Do not
  -- hide them before installed-resolution compatibility has been established.
  if r.asset_type is null or r.asset_type not in ('image','texture','divider','icon') then
    reasons:=array_append(reasons,'installed_runtime_resolution_unverified');
  end if;
  ids:=array_remove(array[r.asset_id,l.id::text],null)||array(select id::text from public.cardforge_contributor_asset_submissions where lineage_id=l.id);
  select coalesce(array_agg(distinct u) filter(where nullif(u,'') is not null),'{}') into sources
    from (select r.url u union all select r.preview_url
      union all select s.source_url from public.cardforge_contributor_asset_submissions s where s.lineage_id=l.id
      union all select s.preview_url from public.cardforge_contributor_asset_submissions s where s.lineage_id=l.id) x;
  -- Exact stored source/preview aliases only: never derive equivalence from a
  -- display name, filename, URL rewrite, failed fetch or caller-provided scan.

  -- Respect readRegistryContentAsset precedence, but do not skip an invalid
  -- non-NULL candidate: native and JS validation may differ at their edges.
  -- Such a candidate stays opaque rather than clearing a later fallback.
  -- Only Styles have metadata fallback. NULL source is never backfilled.
  -- Sets require a source-owner interpretation bound to the exact immutable
  -- package publication. Legacy URL/hash-only rows remain opaque.
  for consumer in select a.*,s.source_payload,to_jsonb(s) set_source from public.cardforge_asset_registry a
    left join public.cardforge_contributor_asset_submissions s on s.id=a.contributor_submission_id
    where a.asset_type in ('elementPreset','template','set') loop
    payload:=consumer.source_payload;
    if consumer.asset_type='elementPreset' then
      if payload is null or payload='null'::jsonb then
        payload:=null;
        foreach key in array array['style','elementPreset','payload'] loop
          if consumer.metadata->key is not null and consumer.metadata->key<>'null'::jsonb then
            payload:=consumer.metadata->key; exit;
          end if;
        end loop;
      end if;
    end if;
    if public.cardforge_catalog_consumer_mentions(payload,ids,sources)
      or (consumer.asset_type='set' and public.cardforge_catalog_consumer_mentions(jsonb_build_object('imageSource',consumer.preview_url),ids,sources)) then referenced:=true; end if;
    if consumer.asset_type='set' then
      if public.cardforge_set_dependency_binding_valid(consumer.set_source)
        and consumer.url=consumer.set_source->>'source_url'
        and consumer.storage_bucket=consumer.set_source->>'source_storage_bucket'
        and consumer.storage_path=consumer.set_source->>'source_storage_path' then
        if public.cardforge_studio_dependencies_mention(consumer.set_source->'catalog_dependencies'->'references',ids,sources)
          or public.cardforge_catalog_consumer_mentions(jsonb_build_object('imageSource',consumer.preview_url),ids,sources) then referenced:=true; end if;
        if consumer.set_source->'catalog_dependencies'->'complete' is distinct from 'true'::jsonb then opaque:=true; end if;
      else opaque:=true; end if;
    elsif not public.cardforge_catalog_consumer_inspectable(payload,
      case when consumer.asset_type='elementPreset' then 'style' else 'template' end) then opaque:=true; end if;
  end loop;

  -- Unpublished and historical native payloads remain consumers. A linked
  -- legacy NULL Style was inspected through its authoritative registry above;
  -- never substitute that current metadata for an unlinked historical revision.
  for consumer in select s.* from public.cardforge_contributor_asset_submissions s
    where s.lineage_id is distinct from l.id
      and not exists(select 1 from public.cardforge_asset_registry a where a.contributor_submission_id=s.id
        and a.asset_type in ('elementPreset','template','set')) loop
    if public.cardforge_catalog_consumer_mentions(consumer.source_payload,ids,sources)
      or (consumer.asset_type='sets' and public.cardforge_catalog_consumer_mentions(jsonb_build_object('imageSource',consumer.preview_url),ids,sources)) then referenced:=true; end if;
    if consumer.asset_type in ('elementPresets','templates','sets') then
      if consumer.asset_type='sets' then
        if public.cardforge_set_dependency_binding_valid(to_jsonb(consumer)) then
          if public.cardforge_studio_dependencies_mention(consumer.catalog_dependencies->'references',ids,sources) then referenced:=true; end if;
          if consumer.catalog_dependencies->'complete' is distinct from 'true'::jsonb then opaque:=true; end if;
        else opaque:=true; end if;
      elsif not public.cardforge_catalog_consumer_inspectable(consumer.source_payload,
        case when consumer.asset_type='elementPresets' then 'style' else 'template' end) then opaque:=true; end if;
    elsif consumer.source_payload is not null then
      -- No negative proof for an unsupported payload kind.
      opaque:=true;
    end if;
  end loop;
  if referenced then reasons:=array_append(reasons,'pipeline_identity_consumer_requires_resolution'); end if;

  -- Inspect the proven source-contained Studio subset in the existing SHARE-
  -- locked mutation transaction; never consume an earlier service-side scan.
  for consumer in select document_payload,revision,catalog_dependencies from public.cardforge_studio_documents loop
    if public.cardforge_catalog_consumer_mentions(consumer.document_payload,ids,sources)
      or (public.cardforge_studio_dependency_binding_valid(consumer.document_payload,consumer.revision,consumer.catalog_dependencies)
        and public.cardforge_studio_dependencies_mention(consumer.catalog_dependencies->'references',ids,sources)) then
      if not ('studio_identity_consumer_requires_resolution'=any(reasons)) then
        reasons:=array_append(reasons,'studio_identity_consumer_requires_resolution');
      end if;
    elsif not public.cardforge_studio_dependency_binding_valid(consumer.document_payload,consumer.revision,consumer.catalog_dependencies)
      or consumer.catalog_dependencies->'complete' is distinct from 'true'::jsonb then opaque:=true;
    end if;
  end loop;
  if opaque then reasons:=array_append(reasons,'json_consumer_inventory_unverified'); end if;
  return reasons;
end $$;

create or replace function public.cardforge_catalog_trash_inventory_details(p_lineage_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
with target as (
 select l.id,r.asset_id,r.url,r.preview_url from public.cardforge_pipeline_asset_lineages l
 left join public.cardforge_asset_registry r on r.asset_id=l.registry_asset_id where l.id=p_lineage_id
), aliases as (
 select array_remove(array[t.asset_id,t.id::text],null)||array(select id::text from public.cardforge_contributor_asset_submissions where lineage_id=t.id) ids,
 array(select distinct u from (
 select t.url u union all select t.preview_url union all
 select s.source_url from public.cardforge_contributor_asset_submissions s where s.lineage_id=t.id union all
 select s.preview_url from public.cardforge_contributor_asset_submissions s where s.lineage_id=t.id
 ) urls where nullif(u,'') is not null) sources from target t
), consumers as (
 select 'registry' origin,a.asset_id record_id,a.asset_type kind,
 case when a.asset_type='elementPreset' then coalesce(nullif(s.source_payload,'null'::jsonb),nullif(a.metadata->'style','null'::jsonb),nullif(a.metadata->'elementPreset','null'::jsonb),nullif(a.metadata->'payload','null'::jsonb)) else s.source_payload end payload, null::integer revision, case when a.asset_type='set' and a.url=s.source_url and a.storage_bucket=s.source_storage_bucket and a.storage_path=s.source_storage_path then to_jsonb(s)||jsonb_build_object('preview_url',a.preview_url) else jsonb_build_object('preview_url',a.preview_url) end interpretation
 from public.cardforge_asset_registry a left join public.cardforge_contributor_asset_submissions s on s.id=a.contributor_submission_id
 where a.asset_type in ('elementPreset','template','set')
 union all
 select 'submission',s.id::text,s.asset_type,s.source_payload,null::integer,case when s.asset_type='sets' then to_jsonb(s) else null::jsonb end from public.cardforge_contributor_asset_submissions s
 where s.lineage_id is distinct from p_lineage_id and not exists(
 select 1 from public.cardforge_asset_registry a where a.contributor_submission_id=s.id and a.asset_type in ('elementPreset','template','set'))
 union all select 'studio',id::text,'studio',document_payload,revision,catalog_dependencies from public.cardforge_studio_documents
), evaluated as (
 select c.*,(public.cardforge_catalog_consumer_mentions(payload,a.ids,a.sources)
   or (kind in ('set','sets') and (public.cardforge_catalog_consumer_mentions(jsonb_build_object('imageSource',interpretation->>'preview_url'),a.ids,a.sources)
     or (public.cardforge_set_dependency_binding_valid(interpretation) and public.cardforge_studio_dependencies_mention(interpretation->'catalog_dependencies'->'references',a.ids,a.sources))))
   or (kind='studio' and public.cardforge_studio_dependency_binding_valid(payload,revision,interpretation)
     and public.cardforge_studio_dependencies_mention(interpretation->'references',a.ids,a.sources))) referenced,
 case when kind in ('set','sets') then case when not public.cardforge_set_dependency_binding_valid(interpretation) then 'set_package_not_natively_decoded'
 when interpretation->'catalog_dependencies'->'complete' is distinct from 'true'::jsonb then 'outside_supported_native_payload_subset' end
 when kind='studio' and not public.cardforge_studio_dependency_binding_valid(payload,revision,interpretation) then 'studio_interpretation_missing_or_stale'
 when kind='studio' and interpretation->'complete' is distinct from 'true'::jsonb then 'outside_supported_native_payload_subset'
 when kind in ('elementPreset','elementPresets','template','templates') then
 case when payload is null or payload='null'::jsonb then 'missing_native_payload_external_fallback_possible'
 when jsonb_typeof(payload)<>'object' then 'non_object_payload'
 when kind in ('elementPreset','elementPresets') and public.cardforge_valid_style_review_payload(payload) is not true then 'invalid_native_style_payload'
 when not public.cardforge_catalog_consumer_inspectable(payload,case when kind in ('elementPreset','elementPresets') then 'style' else 'template' end) then 'outside_supported_native_payload_subset' end
 when kind<>'studio' and payload is not null then 'unsupported_payload_kind' end condition
 from consumers c cross join aliases a
)
select coalesce(jsonb_agg(jsonb_build_object('origin',origin,'recordId',record_id,'payloadKind',kind,
 'conditions',to_jsonb(array_remove(array[
 case when referenced then 'target_identity_or_source_reference' end,
 -- Match the existing Studio gate: a reference is blocking in its own right.
 case when origin='studio' and referenced then null else condition end],null)))
 order by origin,record_id),'[]'::jsonb)
from evaluated where referenced or condition is not null;
$$;



-- Derived metadata is not authored parent content.
create or replace function public.cardforge_media_parent_content_version(p_submission_id uuid)
returns text language sql stable security invoker set search_path = '' as $$
  select pg_catalog.md5((pg_catalog.to_jsonb(submission) - array[
    'updated_at','positive_votes','negative_votes','quality_score','status','contributor_lifecycle_state',
    'automated_status','owner_status_override','calculated_access_tier','automated_access_tier','owner_access_tier_override',
    'tier_decision_reason','owner_note','decision_reason','editorial_review_status','editorial_review_note',
    'editorial_reviewed_by','editorial_reviewed_at','published_at','purge_state','trashed_at','purge_after',
    'trash_reason','retention_hold','purge_claimed_at','template_review_context','source_review_evidence','owner_purge_requested_at','purge_claim_token','catalog_dependencies'])::text)
  from public.cardforge_contributor_asset_submissions as submission where id=p_submission_id;
$$;

commit;
