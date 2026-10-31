begin;
set local lock_timeout='5s';

-- Native admission counterpart to registryContentValidation.isRepositoryStyle.
-- Unknown extension fields remain intact; known renderer fields must retain
-- their canonical types/enums. This is also checked at publication, not only HTTP.
create function public.cardforge_valid_style_review_payload(p jsonb)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare a jsonb; m jsonb; v jsonb; t jsonb; g jsonb; stop jsonb; k text; field text; obj jsonb;
begin
 if jsonb_typeof(p) is distinct from 'object' or jsonb_typeof(p->'id') is distinct from 'string'
   or nullif(btrim(p->>'id'),'') is null or jsonb_typeof(p->'name') is distinct from 'string'
   or nullif(btrim(p->>'name'),'') is null
   or coalesce(p->>'kind','') not in ('material','border','divider','icon','theme','shapeRole','frameKit','textFrame')
   or jsonb_typeof(p->'targets') is distinct from 'array' then return false; end if;
 if jsonb_array_length(p->'targets')=0 then return false; end if;
 for v in select * from jsonb_array_elements(p->'targets') loop
   if jsonb_typeof(v) is distinct from 'string' or (v#>>'{}') not in ('element','text','image','icon','shape','divider','template') then return false; end if;
 end loop;
 a:=p->'appearance';
 if jsonb_typeof(a) is distinct from 'object' then return false; end if;
 foreach k in array array['assetSource','blendMode','dividerAsset'] loop
   if a?k and jsonb_typeof(a->k) is distinct from 'string' then return false; end if;
 end loop;
 foreach k in array array['textureScale','textureOpacity'] loop
   if a?k and (jsonb_typeof(a->k) is distinct from 'number' or case when jsonb_typeof(a->k)='number' then abs((a->k#>>'{}')::numeric)>1.7976931348623157e308 else false end) then return false; end if;
 end loop;
 if a?'assetKind' and coalesce(a->>'assetKind','') not in ('texture','divider','border','frame') then return false; end if;
 if a?'tileMode' and coalesce(a->>'tileMode','') not in ('repeat','stretch','contain') then return false; end if;
 if a?'shapeRole' and coalesce(a->>'shapeRole','') not in ('basic','panel','artFrame','rulesBox','titlePlate','statGem','costOrb','divider') then return false; end if;
 if a?'material' then
   m:=a->'material'; if jsonb_typeof(m) is distinct from 'object' then return false; end if;
   foreach k in array array['name','baseColor','textColor','fillColor','strokeColor'] loop
     if m?k and jsonb_typeof(m->k) is distinct from 'string' then return false; end if;
   end loop;
   if m?'gradient' then
     g:=m->'gradient';
     if jsonb_typeof(g) is distinct from 'object' or coalesce(g->>'type','') not in ('linear','radial','none')
       or (g?'angle' and (jsonb_typeof(g->'angle') is distinct from 'number' or case when jsonb_typeof(g->'angle')='number' then abs((g->'angle'#>>'{}')::numeric)>1.7976931348623157e308 else false end)) or jsonb_typeof(g->'stops') is distinct from 'array' then return false; end if;
     for stop in select * from jsonb_array_elements(g->'stops') loop
       if jsonb_typeof(stop) is distinct from 'object' or jsonb_typeof(stop->'id') is distinct from 'string'
         or nullif(btrim(stop->>'id'),'') is null or jsonb_typeof(stop->'color') is distinct from 'string'
         or (jsonb_typeof(stop->'position') is distinct from 'number' or case when jsonb_typeof(stop->'position')='number' then abs((stop->'position'#>>'{}')::numeric)>1.7976931348623157e308 else false end)
         or (stop?'opacity' and (jsonb_typeof(stop->'opacity') is distinct from 'number' or case when jsonb_typeof(stop->'opacity')='number' then abs((stop->'opacity'#>>'{}')::numeric)>1.7976931348623157e308 else false end)) then return false; end if;
     end loop;
   end if;
   if m?'texture' then
     t:=m->'texture';
     if jsonb_typeof(t) is distinct from 'object' or coalesce(t->>'kind','') not in ('none','parchment','foil','etched','grain','hatch','uploaded') then return false; end if;
     foreach k in array array['intensity','scale','textureScale','textureOpacity'] loop
       if t?k and (jsonb_typeof(t->k) is distinct from 'number' or case when jsonb_typeof(t->k)='number' then abs((t->k#>>'{}')::numeric)>1.7976931348623157e308 else false end) then return false; end if;
     end loop;
     foreach k in array array['imageSource','assetSource','blendMode'] loop
       if t?k and jsonb_typeof(t->k) is distinct from 'string' then return false; end if;
     end loop;
     if t?'assetKind' and coalesce(t->>'assetKind','') not in ('texture','divider','border','frame') then return false; end if;
     if t?'tileMode' and coalesce(t->>'tileMode','') not in ('repeat','stretch','contain') then return false; end if;
   end if;
 end if;
 foreach field in array array['border','effects','rawCss'] loop
   if a?field then
     obj:=a->field; if jsonb_typeof(obj) is distinct from 'object' then return false; end if;
     if field='border' then
       if coalesce(obj->>'kind','') not in ('none','solid','double','etched','relic','foil') then return false; end if;
       foreach k in array array['color','secondaryColor'] loop
         if obj?k and jsonb_typeof(obj->k) is distinct from 'string' then return false; end if;
       end loop;
       foreach k in array array['width','radius','innerWidth','outerWidth'] loop
         if obj?k and (jsonb_typeof(obj->k) is distinct from 'number' or case when jsonb_typeof(obj->k)='number' then abs((obj->k#>>'{}')::numeric)>1.7976931348623157e308 else false end) then return false; end if;
       end loop;
     elsif field='effects' then
       foreach k in array array['shadow','glow','bevel','innerHighlight','overlayOpacity'] loop
         if obj?k and (jsonb_typeof(obj->k) is distinct from 'number' or case when jsonb_typeof(obj->k)='number' then abs((obj->k#>>'{}')::numeric)>1.7976931348623157e308 else false end) then return false; end if;
       end loop;
     else
       foreach k in array array['backgroundImage','borderImageSource'] loop
         if obj?k and jsonb_typeof(obj->k) is distinct from 'string' then return false; end if;
       end loop;
     end if;
   end if;
 end loop;
 if p?'updates' then
   v:=p->'updates'; if jsonb_typeof(v) is distinct from 'object' then return false; end if;
   if v?'shapeKind' and coalesce(v->>'shapeKind','') not in ('rectangle','ellipse','diamond','hexagon','capsule','banner','notch-panel','bracket-frame','corner-frame','line') then return false; end if;
 end if;
 return true;
end; $$;
revoke execute on function public.cardforge_valid_style_review_payload(jsonb) from public,anon,authenticated;
grant execute on function public.cardforge_valid_style_review_payload(jsonb) to service_role;

-- Reuse the immutable revision review context, retry key, evidence and approval
-- owners already used by native Templates. kind distinguishes the style payload;
-- no extra draft store or legacy submission backfill is introduced.
create function public.cardforge_read_style_review_base(p_asset_id text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.cardforge_asset_registry%rowtype; b public.cardforge_contributor_asset_submissions%rowtype;
 l public.cardforge_pipeline_asset_lineages%rowtype; revision integer;
begin
 select * into r from public.cardforge_asset_registry where asset_id=p_asset_id;
 if not found then raise exception 'style_review_not_found'; end if;
 select * into b from public.cardforge_contributor_asset_submissions where id=r.contributor_submission_id;
 if not found or r.asset_type<>'elementPreset' or r.status<>'published' or b.asset_type<>'elementPresets'
   or b.status<>'published' or b.lineage_id is null or b.purge_state is not null or b.trashed_at is not null
   or b.contributor_lifecycle_state is not null or b.purge_claim_token is not null or b.owner_purge_requested_at is not null
   or r.metadata->>'revisionId' is distinct from b.id::text
   or coalesce(r.metadata->>'revisionNumber','') !~ '^[1-9][0-9]{0,8}$'
   or not public.cardforge_valid_style_review_payload(r.metadata->'style')
   or r.metadata->'style'->>'id' is distinct from p_asset_id
 then raise exception 'style_review_not_permitted'; end if;
 revision:=(r.metadata->>'revisionNumber')::integer;
 -- Legacy publication may have no native ordinal. Registry revision 1 remains
 -- the authoritative base; never rewrite or fabricate the parent submission.
 if (b.revision_number is null and revision<>1) or (b.revision_number is not null and b.revision_number<>revision)
   or (b.source_payload is not null and b.source_payload is distinct from r.metadata->'style')
 then raise exception 'style_review_conflict'; end if;
 select * into l from public.cardforge_pipeline_asset_lineages where id=b.lineage_id;
 if not found or l.registry_asset_id is distinct from p_asset_id or l.purge_state is not null
   or l.catalog_trashed_at is not null or l.catalog_claim_token is not null or l.catalog_claimed_at is not null
 then raise exception 'style_review_not_permitted'; end if;
 return jsonb_build_object('style',r.metadata->'style','expectedBase',jsonb_build_object(
   'assetId',p_asset_id,'parentSubmissionId',b.id,'lineageId',b.lineage_id,'baseRevisionNumber',revision,
   'revisionHighWater',greatest(l.revision_high_water,revision),
   'parentContentVersion',public.cardforge_media_parent_content_version(b.id),
   'registryContentVersion',public.cardforge_media_registry_content_version(p_asset_id)));
end; $$;

create function public.cardforge_read_style_review_receipt(p_asset_id text,p_submission_key text,p_actor_id text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare receipt jsonb;
begin
 receipt:=public.cardforge_read_template_review_receipt(p_asset_id,p_submission_key,p_actor_id);
 if receipt is not null and not exists(select 1 from public.cardforge_contributor_asset_submissions
   where id=(receipt->>'id')::uuid and asset_type='elementPresets' and template_review_context->>'kind'='elementPreset')
 then raise exception 'style_review_conflict'; end if;
 return receipt;
end; $$;

create function public.cardforge_create_style_review_revision(
 p_asset_id text,p_expected_base jsonb,p_style_payload jsonb,p_actor_id text,p_submission_key text,p_request_fingerprint text
) returns uuid language plpgsql security invoker set search_path='' as $$
declare snapshot jsonb; b public.cardforge_contributor_asset_submissions%rowtype;
 prior public.cardforge_contributor_asset_submissions%rowtype; l public.cardforge_pipeline_asset_lineages%rowtype;
 candidate_id uuid; next_number integer; key text;
begin
 if nullif(btrim(p_actor_id),'') is null or coalesce(p_submission_key,'') !~ '^[A-Za-z0-9_-]{16,160}$'
   or coalesce(p_request_fingerprint,'') !~ '^[a-f0-9]{64}$'
   or not public.cardforge_valid_style_review_payload(p_style_payload)
   or p_style_payload->>'id' is distinct from p_asset_id
   or nullif(btrim(p_style_payload->>'name'),'') is null
   or coalesce(p_style_payload->>'kind','') not in ('material','border','divider','icon','theme','shapeRole','frameKit','textFrame')
   or pg_catalog.jsonb_typeof(p_style_payload->'appearance') is distinct from 'object'
   or pg_catalog.jsonb_typeof(p_style_payload->'targets') is distinct from 'array'
 then raise exception 'style_review_invalid'; end if;
 if jsonb_array_length(p_style_payload->'targets')=0 or exists(
   select 1 from jsonb_array_elements_text(p_style_payload->'targets') t(v)
   where v not in ('element','text','image','icon','shape','divider','template'))
 then raise exception 'style_review_invalid'; end if;
 -- The service authenticates Owner and validates the complete native style.
 -- All allocation/publication writers share the asset lock and native lineage.
 if not pg_try_advisory_xact_lock(hashtextextended(p_asset_id,0)) then
   raise exception 'style_review_unavailable' using errcode='55P03'; end if;
 select * into l from public.cardforge_pipeline_asset_lineages where registry_asset_id=p_asset_id for update nowait;
 if not found then raise exception 'style_review_conflict'; end if;
 select * into prior from public.cardforge_contributor_asset_submissions where target_registry_asset_id=p_asset_id
   and submission_key=p_submission_key and template_review_context is not null for update nowait;
 if found then
   if prior.asset_type<>'elementPresets' or prior.template_review_context->>'kind' is distinct from 'elementPreset'
     or prior.template_review_context->'expectedBase' is distinct from p_expected_base
     or prior.template_review_context->>'actorId' is distinct from p_actor_id
     or prior.template_review_context->>'requestFingerprint' is distinct from p_request_fingerprint
     or prior.source_payload is distinct from p_style_payload then raise exception 'style_review_conflict'; end if;
   return prior.id;
 end if;
 perform 1 from public.cardforge_asset_registry where asset_id=p_asset_id for update nowait;
 select * into b from public.cardforge_contributor_asset_submissions where id=(
   select contributor_submission_id from public.cardforge_asset_registry where asset_id=p_asset_id) for update nowait;
 snapshot:=public.cardforge_read_style_review_base(p_asset_id);
 if p_expected_base is distinct from snapshot->'expectedBase' then raise exception 'style_review_conflict'; end if;
 foreach key in array array['librarySource','accessTier','registryStatus','contributorName'] loop
   if p_style_payload->key is distinct from snapshot->'style'->key then raise exception 'style_review_invalid'; end if;
 end loop;
 if exists(select 1 from public.cardforge_contributor_asset_submissions s where s.lineage_id=l.id
   and (s.purge_state is not null or s.purge_claim_token is not null or s.owner_purge_requested_at is not null
     or (s.published_at is null and s.trashed_at is null and s.status in('draft','submitted','voting','publish_candidate'))))
   or exists(select 1 from public.cardforge_contributor_asset_submissions s where s.lineage_id=l.id
     and s.revision_number is not null group by s.revision_number having count(*)>1)
 then raise exception 'style_review_conflict'; end if;
 select greatest(coalesce(max(s.revision_number),0),l.revision_high_water,(p_expected_base->>'baseRevisionNumber')::integer)+1
   into next_number from public.cardforge_contributor_asset_submissions s where s.lineage_id=l.id;
 update public.cardforge_pipeline_asset_lineages set revision_high_water=next_number where id=l.id;
 insert into public.cardforge_contributor_asset_submissions(
   lineage_id,contributor_id,contributor_email,asset_type,name,description,preview_url,source_url,
   source_file_size_bytes,source_mime_type,requested_studio_destination,specialty_tags,use_case_tags,
   semantic_role,visual_family,variant_kind,variant_label,compatibility_tags,source_notes,
   status,automated_status,calculated_access_tier,automated_access_tier,source_payload,
   target_registry_asset_id,base_revision_number,revision_number,submission_key,template_review_context,
   editorial_review_status,editorial_review_note,published_at
 ) values(
   b.lineage_id,b.contributor_id,b.contributor_email,'elementPresets',p_style_payload->>'name',b.description,b.preview_url,b.source_url,
   octet_length(convert_to(p_style_payload::text,'UTF8')),'application/json',b.requested_studio_destination,b.specialty_tags,b.use_case_tags,
   b.semantic_role,b.visual_family,b.variant_kind,b.variant_label,b.compatibility_tags,b.source_notes,
   'submitted','voting','contributor','contributor',p_style_payload,
   p_asset_id,(p_expected_base->>'baseRevisionNumber')::integer,next_number,p_submission_key,
   jsonb_build_object('schemaVersion',1,'kind','elementPreset','expectedBase',p_expected_base,'actorId',p_actor_id,'requestFingerprint',p_request_fingerprint),
   'pending','',null
 ) returning id into candidate_id;
 return candidate_id;
end; $$;
create or replace function public.cardforge_sync_contributor_asset_registry(
  p_submission_id uuid
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  submission public.cardforge_contributor_asset_submissions%rowtype;
  next_registry_asset_id text;
  registry_asset_type text;
  registry_library_source text;
  next_registry_metadata jsonb;
  current_revision integer := 0;
  current_revision_id text;
  current_active_submission_id uuid;
  media_registry public.cardforge_asset_registry%rowtype;
  media_base jsonb;
  template_registry public.cardforge_asset_registry%rowtype;
  template_base jsonb;
begin
  select *
  into submission
  from public.cardforge_contributor_asset_submissions
  where id = p_submission_id
  for update;

  if not found then
    raise exception 'contributor_asset_not_found';
  end if;

  next_registry_asset_id := coalesce(
    submission.target_registry_asset_id,
    submission.registry_asset_id,
    'contributor-' || submission.asset_type || '-' || submission.id::text
  );
  registry_asset_type := case submission.asset_type
    when 'templates' then 'template'
    when 'elementPresets' then 'elementPreset'
    when 'textures' then 'texture'
    when 'dividers' then 'divider'
    when 'icons' then 'icon'
    when 'imageAssets' then 'image'
    when 'fonts' then 'font'
    when 'sets' then 'set'
    else null
  end;

  -- Serialize every input type on its stable registry identity.
  -- Bootstrap takes this lock before submission rows. Never wait here while
  -- holding the reverse order; roll back and let the caller retry instead.
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(next_registry_asset_id, 0)) then
    raise exception 'pipeline_publication_unavailable' using errcode = '55P03';
  end if;
  select
    registry.contributor_submission_id,
    case when registry.metadata ->> 'revisionNumber' ~ '^[0-9]+$'
      then (registry.metadata ->> 'revisionNumber')::integer else 0 end,
    registry.metadata ->> 'revisionId'
  into current_active_submission_id, current_revision, current_revision_id
  from public.cardforge_asset_registry as registry
  where registry.asset_id = next_registry_asset_id;

  current_revision := coalesce(current_revision, 0);

  if current_active_submission_id is not null
    and current_active_submission_id <> submission.id
    and (
      submission.revision_number is null
      or submission.revision_number <= current_revision
    )
  then
    update public.cardforge_contributor_asset_submissions
    set
      status = 'archived',
      calculated_access_tier = 'hidden',
      decision_reason = 'superseded_revision',
      tier_decision_reason = 'superseded_revision'
    where id = submission.id;
    return next_registry_asset_id;
  end if;

  if current_active_submission_id is not null
    and current_active_submission_id <> submission.id
    and submission.revision_number is not null
    and submission.revision_number > current_revision
    and submission.status <> 'published'
  then
    return next_registry_asset_id;
  end if;

  -- Rebalance visits the active parent before its proposed child. When its
  -- authored/source and public registry facts are exactly unchanged, do not
  -- re-synthesize legacy texture defaults or attribution over that snapshot.
  if submission.media_presentation is null and submission.asset_type='textures'
    and submission.status='published' and current_active_submission_id=submission.id
    and exists(select 1 from public.cardforge_asset_registry registry where registry.asset_id=next_registry_asset_id
      and registry.access_tier=submission.calculated_access_tier)
    and exists(select 1 from public.cardforge_contributor_asset_submissions candidate
      where candidate.media_presentation->>'parentSubmissionId'=submission.id::text
        and candidate.purge_state is null and candidate.trashed_at is null
        and candidate.media_presentation->>'baseVersion'=public.cardforge_media_parent_content_version(submission.id)
        and candidate.media_presentation->>'registryVersion'=public.cardforge_media_registry_content_version(next_registry_asset_id))
  then return next_registry_asset_id; end if;

  if submission.media_presentation is not null and submission.status='published' then
    select * into media_registry from public.cardforge_asset_registry where asset_id=next_registry_asset_id for update nowait;
    if media_registry.contributor_submission_id=submission.id then
      if media_registry.metadata->'tileMode' is distinct from submission.media_presentation->'proposed'->'tileMode'
        or media_registry.metadata->'seamless' is distinct from submission.media_presentation->'proposed'->'seamless'
        or media_registry.metadata->>'revisionId' is distinct from submission.id::text
        or media_registry.metadata->>'revisionNumber' is distinct from submission.revision_number::text
      then raise exception 'pipeline_media_conflict'; end if;
    else
    if submission.editorial_review_status<>'approved' then raise exception 'pipeline_media_editorial_review_required'; end if;
    perform 1 from public.cardforge_contributor_asset_submissions
      where id=media_registry.contributor_submission_id for update nowait;
    media_base := public.cardforge_read_media_revision_base(next_registry_asset_id);
    if submission.media_presentation->'schemaVersion' is distinct from '1'::jsonb
      or coalesce(submission.media_presentation->>'sourceSha256','') !~ '^[a-f0-9]{64}$'
      or coalesce(submission.media_presentation->'proposed'->>'tileMode','') not in ('repeat','stretch','contain')
      or pg_catalog.jsonb_typeof(submission.media_presentation->'proposed'->'seamless') is distinct from 'boolean'
      or submission.media_presentation->>'parentSubmissionId' is distinct from media_base->>'parentSubmissionId'
      or submission.media_presentation->>'lineageId' is distinct from media_base->>'lineageId'
      or submission.lineage_id::text is distinct from media_base->>'lineageId'
      or submission.media_presentation->'baseRevisionNumber' is distinct from media_base->'baseRevisionNumber'
      or submission.base_revision_number::text is distinct from media_base->>'baseRevisionNumber'
      or submission.media_presentation->>'baseVersion' is distinct from media_base->>'baseVersion'
      or submission.media_presentation->>'registryVersion' is distinct from media_base->>'registryVersion'
      or submission.media_presentation->'baseline' is distinct from media_base->'baseline'
      or submission.media_presentation->'intendedAccessTier' is distinct from media_base->'intendedAccessTier'
      or submission.source_storage_bucket is distinct from media_base->>'sourceBucket'
      or submission.source_storage_path is not distinct from media_base->>'sourcePath'
      or submission.source_url is not distinct from media_base->>'sourceUrl'
      or submission.source_mime_type is distinct from media_base->>'sourceMimeType'
      or pg_catalog.to_jsonb(submission.source_file_size_bytes) is distinct from media_base->'sourceSize'
    then raise exception 'pipeline_media_conflict'; end if;
    end if;
  end if;

  if submission.asset_type='templates' and submission.template_review_context is null
    and submission.status='published' and current_active_submission_id=submission.id
    and exists(select 1 from public.cardforge_asset_registry r where r.asset_id=next_registry_asset_id and r.access_tier=submission.calculated_access_tier)
    and exists(select 1 from public.cardforge_contributor_asset_submissions c
      where c.template_review_context->'expectedBase'->>'parentSubmissionId'=submission.id::text
        and c.purge_state is null and c.trashed_at is null
        and c.template_review_context->'expectedBase'->>'parentContentVersion'=public.cardforge_media_parent_content_version(submission.id)
        and c.template_review_context->'expectedBase'->>'registryContentVersion'=public.cardforge_media_registry_content_version(next_registry_asset_id))
  then return next_registry_asset_id; end if;

  -- The live legacy style is already canonical. Rebalancing must not reconstruct
  -- its metadata or mutate its NULL source payload while reviewing a correction.
  if submission.asset_type='elementPresets' and submission.status='published'
    and current_active_submission_id=submission.id
    and submission.template_review_context is null
  then
    update public.cardforge_asset_registry set access_tier=submission.calculated_access_tier
      where asset_id=next_registry_asset_id and access_tier is distinct from submission.calculated_access_tier;
    return next_registry_asset_id;
  end if;

  if submission.template_review_context is not null and submission.status='published' then
    select * into template_registry from public.cardforge_asset_registry where asset_id=next_registry_asset_id for update nowait;
    if template_registry.contributor_submission_id is distinct from submission.id then
      if submission.editorial_review_status<>'approved' then raise exception 'template_review_editorial_required'; end if;
      if submission.asset_type='elementPresets' then
        perform 1 from public.cardforge_pipeline_asset_lineages where id=submission.lineage_id for update nowait;
        perform 1 from public.cardforge_contributor_asset_submissions where id=template_registry.contributor_submission_id for update nowait;
      end if;
      template_base:=case when submission.asset_type='elementPresets'
        then public.cardforge_read_style_review_base(next_registry_asset_id)
        else public.cardforge_read_template_review_base(next_registry_asset_id) end;
      if submission.asset_type='elementPresets' and (
        submission.template_review_context->>'kind' is distinct from 'elementPreset'
        or submission.lineage_id::text is distinct from template_base->'expectedBase'->>'lineageId'
        or submission.base_revision_number::text is distinct from template_base->'expectedBase'->>'baseRevisionNumber'
        or submission.revision_number is distinct from (template_base->'expectedBase'->>'revisionHighWater')::integer
        or submission.revision_number is distinct from (submission.template_review_context->'expectedBase'->>'revisionHighWater')::integer+1
        or not public.cardforge_valid_style_review_payload(submission.source_payload)
        or submission.source_payload->>'id' is distinct from next_registry_asset_id
      ) then raise exception 'style_review_conflict'; end if;
      -- Ordinal allocation advances high-water, not the authored/source lease.
      if ((submission.template_review_context->'expectedBase')-'revisionHighWater')
        is distinct from ((template_base->'expectedBase')-'revisionHighWater')
      then raise exception 'template_review_conflict'; end if;
    end if;
  end if;

  if submission.status = 'published' and nullif(submission.source_url, '') is null then
    raise exception 'contributor_asset_source_required';
  end if;

  if submission.status = 'published' and submission.asset_type = 'sets'
    and (submission.source_mime_type is null or submission.source_mime_type not in ('application/vnd.cardforge.project+zip', 'application/octet-stream'))
  then
    raise exception 'published_set_package_required';
  end if;

  if submission.status = 'published' then
    next_registry_metadata := case submission.asset_type
      when 'textures' then pg_catalog.jsonb_build_object(
        'sourceMimeType', submission.source_mime_type,
        'tileMode', 'repeat', 'seamless', true,
        'allowedTargets', pg_catalog.jsonb_build_array('text', 'shape', 'template'),
        'defaultBlendMode', 'multiply', 'defaultOpacity', 42, 'defaultScale', 160
      )
      when 'dividers' then pg_catalog.jsonb_build_object(
        'sourceMimeType', submission.source_mime_type,
        'tileMode', 'stretch', 'seamless', false,
        'allowedTargets', pg_catalog.jsonb_build_array('divider'),
        'defaultBlendMode', 'normal', 'defaultOpacity', 100, 'defaultScale', 100
      )
      when 'icons' then pg_catalog.jsonb_build_object(
        'sourceMimeType', submission.source_mime_type,
        'tileMode', 'contain', 'seamless', false,
        'allowedTargets', pg_catalog.jsonb_build_array('icon'),
        'defaultBlendMode', 'normal', 'defaultOpacity', 100, 'defaultScale', 100,
        'defaultWidth', 64, 'defaultHeight', 64
      )
      when 'imageAssets' then pg_catalog.jsonb_build_object(
        'sourceMimeType', submission.source_mime_type,
        'tileMode', 'contain', 'seamless', false,
        'allowedTargets', pg_catalog.jsonb_build_array('image', 'imageFrame', 'template'),
        'defaultBlendMode', 'normal', 'defaultOpacity', 100, 'defaultScale', 100,
        'defaultWidth', 300, 'defaultHeight', 180
      )
      when 'sets' then pg_catalog.jsonb_build_object(
        'sourceMimeType', submission.source_mime_type, 'portableProject', true,
        'description', submission.description,
        'specialtyTags', to_jsonb(submission.specialty_tags),
        'useCaseTags', to_jsonb(submission.use_case_tags)
      )
      when 'fonts' then pg_catalog.jsonb_build_object(
        'sourceMimeType', submission.source_mime_type,
        'category', 'Utility', 'fallback', 'serif', 'fontDisplay', 'swap'
      )
      else pg_catalog.jsonb_build_object('sourceMimeType', submission.source_mime_type)
    end;

    if submission.media_presentation is not null then
      -- Preserve the approved parent's unrelated provenance, defaults and routing
      -- metadata. This lane changes only fit/seamless and normal revision pointers.
      next_registry_metadata := media_registry.metadata || pg_catalog.jsonb_build_object(
        'tileMode',submission.media_presentation->'proposed'->'tileMode',
        'seamless',submission.media_presentation->'proposed'->'seamless');
    end if;

    if submission.asset_type='elementPresets' and submission.template_review_context is not null then
      next_registry_metadata := template_registry.metadata || pg_catalog.jsonb_build_object('style',submission.source_payload);
    end if;

    next_registry_metadata := next_registry_metadata || pg_catalog.jsonb_build_object(
      'revisionNumber', coalesce(submission.revision_number, 1),
      'revisionId', submission.id,
      'revisionPublishedAt', coalesce(submission.published_at, pg_catalog.now())
    );

    registry_library_source := case when submission.template_review_context is not null then template_registry.library_source
      when submission.media_presentation is not null then media_registry.library_source
      when submission.source_payload is not null then 'official' else 'contributor' end;
    if submission.asset_type = 'templates' and submission.source_payload is not null then
      if submission.base_revision_number is null
        or submission.revision_number is null
      then
        raise exception 'invalid_template_revision';
      end if;

      select
        case when registry.metadata ->> 'revisionNumber' ~ '^[0-9]+$'
          then (registry.metadata ->> 'revisionNumber')::integer else 0 end,
        registry.metadata ->> 'revisionId'
      into current_revision, current_revision_id
      from public.cardforge_asset_registry as registry
      where registry.asset_id = next_registry_asset_id;

      current_revision := coalesce(current_revision, 0);
      if not (
        current_revision = submission.base_revision_number
        or (
          current_revision = submission.revision_number
          and current_revision_id = submission.id::text
        )
      ) then
        raise exception 'template_revision_conflict';
      end if;

      next_registry_metadata := next_registry_metadata || pg_catalog.jsonb_strip_nulls(
        pg_catalog.jsonb_build_object(
          'revisionNumber', submission.revision_number,
          'revisionId', submission.id,
          'revisionPublishedAt', coalesce(submission.published_at, pg_catalog.now()),
          'templateUsage', submission.source_payload ->> 'templateUsage',
          'templateOrder', submission.source_payload -> 'templateOrder'
        )
      );
    end if;

    insert into public.cardforge_asset_registry (
      asset_id, name, asset_type, url, preview_url, status, access_tier,
      library_source, contributor_submission_id, storage_bucket, storage_path,
      file_size_bytes, metadata, specialty_tags, use_case_tags
    )
    values (
      next_registry_asset_id, submission.name, registry_asset_type,
      submission.source_url, coalesce(nullif(submission.preview_url, ''), submission.source_url),
      'published', submission.calculated_access_tier, registry_library_source,
      submission.id, submission.source_storage_bucket, submission.source_storage_path,
      submission.source_file_size_bytes, next_registry_metadata, submission.specialty_tags, submission.use_case_tags
    )
    on conflict (asset_id) do update
    set
      name = excluded.name,
      asset_type = excluded.asset_type,
      url = excluded.url,
      preview_url = excluded.preview_url,
      status = excluded.status,
      access_tier = excluded.access_tier,
      library_source = excluded.library_source,
      contributor_submission_id = excluded.contributor_submission_id,
      storage_bucket = excluded.storage_bucket,
      storage_path = excluded.storage_path,
      file_size_bytes = excluded.file_size_bytes,
      specialty_tags = excluded.specialty_tags,
      use_case_tags = excluded.use_case_tags,
      metadata = (public.cardforge_asset_registry.metadata - 'template' - 'contributorEmail' - 'contributorId' - 'revisionAuthor') || excluded.metadata;

    update public.cardforge_contributor_asset_submissions
    set registry_asset_id = next_registry_asset_id
    where id = submission.id;
  elsif submission.registry_asset_id is not null then
    update public.cardforge_asset_registry
    set
      status = submission.status,
      access_tier = case
        when submission.status in ('archived', 'rejected') then 'hidden'
        else 'contributor'
      end,
      metadata = metadata - 'template' - 'contributorEmail' - 'contributorId' - 'revisionAuthor'
    where asset_id = submission.registry_asset_id
      and contributor_submission_id = submission.id;
  end if;

  return next_registry_asset_id;
end;
$$;


create or replace function public.cardforge_record_source_review_evidence(
 p_submission_id uuid,p_facts jsonb,p_expected_candidate_version text,p_expected_evidence_version integer,p_actor_id text
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.cardforge_contributor_asset_submissions%rowtype; target_asset_id text; parent_id uuid;
 base jsonb; revision integer; key text;
begin
 if pg_catalog.jsonb_typeof(p_facts) is distinct from 'object' or nullif(pg_catalog.btrim(p_actor_id),'') is null
   or coalesce(p_expected_candidate_version,'') !~ '^[a-f0-9]{32}$' or p_expected_evidence_version is null or p_expected_evidence_version<0
   or (select count(*) from pg_catalog.jsonb_object_keys(p_facts))<>(4 + case when p_facts ? 'aiDisclosurePublic' then 1 else 0 end)
   or (p_facts ? 'aiDisclosurePublic' and pg_catalog.jsonb_typeof(p_facts->'aiDisclosurePublic') is distinct from 'boolean')
   or (p_facts->'aiDisclosurePublic' = 'true'::jsonb and nullif(pg_catalog.btrim(p_facts->>'aiFacts'),'') is null)
   or nullif(pg_catalog.btrim(p_facts->>'technicalTrace'),'') is null
   or pg_catalog.length(p_facts->>'technicalTrace')>2400
 then raise exception 'source_evidence_invalid'; end if;
 foreach key in array array['creatorFacts','rightsFacts','aiFacts'] loop
   if not(p_facts ? key) or pg_catalog.jsonb_typeof(p_facts->key) not in('null','string')
     or pg_catalog.length(p_facts->>key)>1200 or p_facts->>key is not null and nullif(pg_catalog.btrim(p_facts->>key),'') is null
   then raise exception 'source_evidence_invalid'; end if;
 end loop;
 if pg_catalog.jsonb_typeof(p_facts->'technicalTrace') is distinct from 'string' then raise exception 'source_evidence_invalid'; end if;
 select target_registry_asset_id into target_asset_id from public.cardforge_contributor_asset_submissions where id=p_submission_id;
 if not found then raise exception 'source_evidence_not_found'; end if;
 if target_asset_id is null then raise exception 'source_evidence_not_permitted'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(target_asset_id,0)) then
   raise exception 'source_evidence_unavailable' using errcode='55P03'; end if;
 select contributor_submission_id into parent_id from public.cardforge_asset_registry where cardforge_asset_registry.asset_id=target_asset_id for update nowait;
 if not found then raise exception 'source_evidence_conflict'; end if;
 perform 1 from public.cardforge_contributor_asset_submissions where id=parent_id for update nowait;
 perform 1 from public.cardforge_pipeline_asset_lineages where registry_asset_id=target_asset_id for update nowait;
 select * into s from public.cardforge_contributor_asset_submissions where id=p_submission_id for update nowait;
 if not found then raise exception 'source_evidence_not_found'; end if;
 if (s.media_presentation is null and s.template_review_context is null) or s.published_at is not null
   or s.status not in('submitted','voting','publish_candidate') or s.trashed_at is not null or s.purge_state is not null
   or s.contributor_lifecycle_state is not null
 then raise exception 'source_evidence_not_permitted'; end if;
 if p_expected_candidate_version is distinct from public.cardforge_media_parent_content_version(s.id)
 then raise exception 'source_evidence_conflict'; end if;
 if s.template_review_context is not null then
   base:=case when s.asset_type='elementPresets' then public.cardforge_read_style_review_base(target_asset_id) else public.cardforge_read_template_review_base(target_asset_id) end;
   if ((s.template_review_context->'expectedBase')-'revisionHighWater') is distinct from ((base->'expectedBase')-'revisionHighWater')
   then raise exception 'source_evidence_conflict'; end if;
 else
   base:=public.cardforge_read_media_revision_base(target_asset_id);
   if s.media_presentation->>'parentSubmissionId' is distinct from base->>'parentSubmissionId'
     or s.media_presentation->>'lineageId' is distinct from base->>'lineageId'
     or s.media_presentation->'baseRevisionNumber' is distinct from base->'baseRevisionNumber'
     or s.media_presentation->>'baseVersion' is distinct from base->>'baseVersion'
     or s.media_presentation->>'registryVersion' is distinct from base->>'registryVersion'
     or s.media_presentation->'baseline' is distinct from base->'baseline'
     or s.media_presentation->'intendedAccessTier' is distinct from base->'intendedAccessTier'
   then raise exception 'source_evidence_conflict'; end if;
 end if;
 revision:=coalesce((s.source_review_evidence->>'version')::integer,0);
 -- Identical retries neither change evidence attribution nor erase valid review.
 if s.source_review_evidence->'facts'=p_facts then return public.cardforge_read_source_review_evidence(s.id); end if;
 if revision is distinct from p_expected_evidence_version then raise exception 'source_evidence_conflict'; end if;
 update public.cardforge_contributor_asset_submissions set source_review_evidence=pg_catalog.jsonb_build_object(
   'schemaVersion',1,'version',revision+1,'facts',p_facts,'recordedBy',p_actor_id,'recordedAt',pg_catalog.now()),
   editorial_review_status='pending',editorial_review_note='',editorial_reviewed_by=null,editorial_reviewed_at=null
 where id=s.id;
 return public.cardforge_read_source_review_evidence(s.id);
end; $$;

CREATE OR REPLACE FUNCTION public.cardforge_upsert_pipeline_registry_asset(p_asset_id text, p_name text, p_submission_asset_type text, p_registry_asset_type text, p_url text, p_preview_url text, p_description text, p_contributor_id text, p_contributor_email text, p_file_size_bytes bigint, p_source_mime_type text, p_storage_bucket text, p_storage_path text, p_metadata jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  next_submission_id uuid;
  reviewed_first_party_font boolean :=
    p_registry_asset_type = 'font'
    and p_submission_asset_type = 'fonts'
    and p_asset_id like 'official-%'
    and p_source_mime_type = 'font/ttf'
    and p_storage_bucket = 'cardforge-contributor-assets'
    and p_storage_path like 'owner-defaults/fonts/%'
    and p_metadata ->> 'sourceKind' = 'reviewed-first-party-original'
    and p_metadata ->> 'sourceRepository' = 'https://github.com/google/fonts'
    and p_metadata ->> 'originalFontUnmodified' = 'true'
    and p_metadata ->> 'license' = 'OFL-1.1'
    and p_metadata ->> 'sourceGitBlobSha' ~ '^[a-f0-9]{40}$'
    and p_metadata ->> 'licenseGitBlobSha' ~ '^[a-f0-9]{40}$'
    and p_metadata ->> 'reviewedBatchDigest' ~ '^[a-f0-9]{64}$';
  bootstrap_access_tier text := case
    when p_metadata ->> 'bootstrapAccessTier' in ('free', 'paid', 'contributor')
      then p_metadata ->> 'bootstrapAccessTier'
    else 'free'
  end;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_asset_id, 0));

  if exists(
    select 1 from public.cardforge_asset_registry where asset_id=p_asset_id and (asset_type='elementPreset' or p_registry_asset_type='elementPreset')
  ) then raise exception 'style_review_required'; end if;

  select registry.contributor_submission_id
  into next_submission_id
  from public.cardforge_asset_registry as registry
  where registry.asset_id = p_asset_id
  for update;

  if next_submission_id is null then
    select submission.id
    into next_submission_id
    from public.cardforge_contributor_asset_submissions as submission
    where submission.registry_asset_id = p_asset_id
    order by submission.submitted_at asc
    limit 1
    for update;
  end if;

  if next_submission_id is null then
    insert into public.cardforge_contributor_asset_submissions (
      contributor_id,
      contributor_email,
      asset_type,
      name,
      description,
      preview_url,
      source_url,
      source_file_size_bytes,
      source_mime_type,
      source_storage_bucket,
      source_storage_path,
      status,
      automated_status,
      owner_status_override,
      calculated_access_tier,
      automated_access_tier,
      owner_access_tier_override,
      decision_reason,
      tier_decision_reason
    )
    values (
      p_contributor_id,
      p_contributor_email,
      p_submission_asset_type,
      p_name,
      p_description,
      p_preview_url,
      p_url,
      p_file_size_bytes,
      p_source_mime_type,
      p_storage_bucket,
      p_storage_path,
      'published',
      'published',
      'published',
      bootstrap_access_tier,
      bootstrap_access_tier,
      bootstrap_access_tier,
      'owner_status_override',
      'owner_forced_' || bootstrap_access_tier
    )
    returning id into next_submission_id;
  else
    update public.cardforge_contributor_asset_submissions
    set
      contributor_id = p_contributor_id,
      contributor_email = p_contributor_email,
      asset_type = p_submission_asset_type,
      name = p_name,
      description = p_description,
      preview_url = p_preview_url,
      source_url = p_url,
      source_file_size_bytes = p_file_size_bytes,
      source_mime_type = p_source_mime_type,
      source_storage_bucket = p_storage_bucket,
      source_storage_path = p_storage_path
    where id = next_submission_id;
  end if;

  insert into public.cardforge_asset_registry (
    asset_id,
    name,
    asset_type,
    url,
    preview_url,
    status,
    access_tier,
    library_source,
    contributor_submission_id,
    storage_bucket,
    storage_path,
    file_size_bytes,
    metadata
  )
  values (
    p_asset_id,
    p_name,
    p_registry_asset_type,
    p_url,
    p_preview_url,
    'published',
    bootstrap_access_tier,
    case when reviewed_first_party_font then 'official' else 'contributor' end,
    next_submission_id,
    p_storage_bucket,
    p_storage_path,
    p_file_size_bytes,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (asset_id) do update
  set
    name = excluded.name,
    asset_type = excluded.asset_type,
    url = excluded.url,
    preview_url = excluded.preview_url,
    contributor_submission_id = excluded.contributor_submission_id,
    storage_bucket = excluded.storage_bucket,
    storage_path = excluded.storage_path,
    file_size_bytes = excluded.file_size_bytes,
    metadata = excluded.metadata;

  update public.cardforge_contributor_asset_submissions
  set registry_asset_id = p_asset_id
  where id = next_submission_id;

  return next_submission_id;
end;
$function$;

revoke execute on function public.cardforge_read_style_review_base(text) from public,anon,authenticated;
grant execute on function public.cardforge_read_style_review_base(text) to service_role;
revoke execute on function public.cardforge_read_style_review_receipt(text,text,text) from public,anon,authenticated;
grant execute on function public.cardforge_read_style_review_receipt(text,text,text) to service_role;
revoke execute on function public.cardforge_create_style_review_revision(text,jsonb,jsonb,text,text,text) from public,anon,authenticated;
grant execute on function public.cardforge_create_style_review_revision(text,jsonb,jsonb,text,text,text) to service_role;
commit;
