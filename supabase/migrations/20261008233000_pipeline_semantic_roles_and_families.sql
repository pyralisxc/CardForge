begin;

set local lock_timeout = '5s';

alter table public.cardforge_contributor_asset_submissions
  add column if not exists semantic_role text,
  add column if not exists visual_family text,
  add column if not exists variant_kind text not null default 'base',
  add column if not exists variant_label text,
  add column if not exists compatibility_tags text[] not null default '{}'::text[];

create or replace function public.cardforge_valid_pipeline_semantic_role(
  p_asset_type text,
  p_semantic_role text
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select case p_asset_type
    when 'templates' then p_semantic_role in ('template-front','template-back')
    when 'sets' then p_semantic_role = 'set'
    when 'fonts' then p_semantic_role = 'font'
    when 'textures' then p_semantic_role in ('texture','foundation','material')
    when 'dividers' then p_semantic_role in ('divider','text-frame','ornament')
    when 'icons' then p_semantic_role in ('icon','pip','symbol','ornament','stat-component')
    when 'imageAssets' then p_semantic_role in ('picture','foundation','border','frame','text-frame','ornament','stat-component')
    when 'elementPresets' then p_semantic_role in ('material','border','frame','text-frame','ornament','divider','icon','stat-component','shape','style')
    else false
  end;
$$;

update public.cardforge_contributor_asset_submissions
set semantic_role = case asset_type
  when 'templates' then case when requested_studio_destination = 'template.back' then 'template-back' else 'template-front' end
  when 'sets' then 'set'
  when 'fonts' then 'font'
  when 'textures' then 'texture'
  when 'dividers' then 'divider'
  when 'icons' then 'icon'
  when 'imageAssets' then case
    when requested_studio_destination like 'image.border.%' then 'border'
    when requested_studio_destination like 'image.frame.%' then 'frame'
    else 'picture'
  end
  when 'elementPresets' then case requested_studio_destination
    when 'style.material' then 'material'
    when 'style.border' then 'border'
    when 'style.textFrame' then 'text-frame'
    when 'style.shape' then 'shape'
    when 'style.divider' then 'divider'
    when 'style.icon' then 'icon'
    else 'style'
  end
  else semantic_role
end
where semantic_role is null or pg_catalog.btrim(semantic_role) = '';

alter table public.cardforge_contributor_asset_submissions
  alter column semantic_role set not null;

alter table public.cardforge_contributor_asset_submissions
  drop constraint if exists cardforge_contributor_asset_semantic_role_check,
  drop constraint if exists cardforge_contributor_asset_visual_family_check,
  drop constraint if exists cardforge_contributor_asset_variant_kind_check,
  drop constraint if exists cardforge_contributor_asset_variant_label_check,
  drop constraint if exists cardforge_contributor_asset_compatibility_tags_check;

alter table public.cardforge_contributor_asset_submissions
  add constraint cardforge_contributor_asset_semantic_role_check
    check (public.cardforge_valid_pipeline_semantic_role(asset_type, semantic_role)),
  add constraint cardforge_contributor_asset_visual_family_check
    check (visual_family is null or (pg_catalog.char_length(pg_catalog.btrim(visual_family)) between 1 and 80)),
  add constraint cardforge_contributor_asset_variant_kind_check
    check (variant_kind in ('base','format','treatment','size','color','finish')),
  add constraint cardforge_contributor_asset_variant_label_check
    check (variant_label is null or (pg_catalog.char_length(pg_catalog.btrim(variant_label)) between 1 and 80)),
  add constraint cardforge_contributor_asset_compatibility_tags_check
    check (
      pg_catalog.array_position(compatibility_tags, null) is null
      and compatibility_tags <@ array[
        'front','back','print','digital','full-bleed','transparent','tileable','recolorable','small-size-legible'
      ]::text[]
    );

create or replace function public.cardforge_assign_default_semantic_role()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if nullif(pg_catalog.btrim(coalesce(new.semantic_role, '')), '') is null then
    new.semantic_role := case new.asset_type
      when 'templates' then case when new.requested_studio_destination = 'template.back' then 'template-back' else 'template-front' end
      when 'sets' then 'set'
      when 'fonts' then 'font'
      when 'textures' then 'texture'
      when 'dividers' then 'divider'
      when 'icons' then 'icon'
      when 'imageAssets' then case
        when new.requested_studio_destination like 'image.border.%' then 'border'
        when new.requested_studio_destination like 'image.frame.%' then 'frame'
        else 'picture'
      end
      when 'elementPresets' then case new.requested_studio_destination
        when 'style.material' then 'material'
        when 'style.border' then 'border'
        when 'style.textFrame' then 'text-frame'
        when 'style.shape' then 'shape'
        when 'style.divider' then 'divider'
        when 'style.icon' then 'icon'
        else 'style'
      end
      else new.semantic_role
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists cardforge_contributor_asset_default_semantic_role
  on public.cardforge_contributor_asset_submissions;
create trigger cardforge_contributor_asset_default_semantic_role
before insert or update of asset_type, requested_studio_destination, semantic_role
on public.cardforge_contributor_asset_submissions
for each row
execute function public.cardforge_assign_default_semantic_role();

drop function if exists public.cardforge_classify_published_pipeline_asset(
  text,uuid,uuid,integer,text[],text[],text[],text[]
);

create or replace function public.cardforge_classify_published_pipeline_asset(
  p_asset_id text,
  p_expected_submission_id uuid,
  p_expected_lineage_id uuid,
  p_expected_revision integer,
  p_expected_specialty_tags text[],
  p_expected_use_case_tags text[],
  p_expected_semantic_role text,
  p_expected_visual_family text,
  p_expected_variant_kind text,
  p_expected_variant_label text,
  p_expected_compatibility_tags text[],
  p_specialty_tags text[],
  p_use_case_tags text[],
  p_semantic_role text,
  p_visual_family text,
  p_variant_kind text,
  p_variant_label text,
  p_compatibility_tags text[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  registry public.cardforge_asset_registry%rowtype;
  submission public.cardforge_contributor_asset_submissions%rowtype;
  current_revision integer;
  normalized_family text := nullif(pg_catalog.btrim(coalesce(p_visual_family, '')), '');
  normalized_variant_label text := nullif(pg_catalog.btrim(coalesce(p_variant_label, '')), '');
begin
  select * into registry from public.cardforge_asset_registry where asset_id = p_asset_id;
  if not found then raise exception 'pipeline_classification_not_found'; end if;
  select * into submission from public.cardforge_contributor_asset_submissions where id = registry.contributor_submission_id for update;
  if not found then raise exception 'pipeline_classification_conflict'; end if;

  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(p_asset_id, 0)) then
    raise exception 'pipeline_classification_unavailable';
  end if;
  select * into registry from public.cardforge_asset_registry where asset_id = p_asset_id for update;
  if not found then raise exception 'pipeline_classification_not_found'; end if;
  current_revision := case when registry.metadata ->> 'revisionNumber' ~ '^[0-9]+$'
    then (registry.metadata ->> 'revisionNumber')::integer else 0 end;
  if registry.status <> 'published' or submission.status <> 'published'
    or submission.purge_state is not null
    or registry.contributor_submission_id is distinct from p_expected_submission_id
    or registry.contributor_submission_id is distinct from submission.id
    or submission.lineage_id is distinct from p_expected_lineage_id
    or current_revision is distinct from p_expected_revision
  then raise exception 'pipeline_classification_conflict'; end if;

  if p_specialty_tags is null or p_use_case_tags is null or p_compatibility_tags is null
    or pg_catalog.cardinality(p_specialty_tags) = 0
    or not p_specialty_tags <@ array['general','games','marketing','events','education','business','community']::text[]
    or not p_use_case_tags <@ array['tcg','playing-cards','tarot','board-game','reference-card','business-card','event-badge','event-poster','social-post','rulebook','packaging']::text[]
    or not p_compatibility_tags <@ array['front','back','print','digital','full-bleed','transparent','tileable','recolorable','small-size-legible']::text[]
    or pg_catalog.array_position(p_specialty_tags, null) is not null
    or pg_catalog.array_position(p_use_case_tags, null) is not null
    or pg_catalog.array_position(p_compatibility_tags, null) is not null
    or not public.cardforge_valid_pipeline_semantic_role(submission.asset_type, p_semantic_role)
    or p_variant_kind not in ('base','format','treatment','size','color','finish')
    or (normalized_family is not null and pg_catalog.char_length(normalized_family) > 80)
    or (normalized_variant_label is not null and pg_catalog.char_length(normalized_variant_label) > 80)
    or (pg_catalog.cardinality(p_use_case_tags) = 0 and not (
      p_specialty_tags = array['general']::text[]
      and submission.asset_type in ('textures','dividers','icons','imageAssets','elementPresets','fonts')
    ))
  then raise exception 'pipeline_classification_invalid'; end if;

  if submission.specialty_tags = p_specialty_tags
    and submission.use_case_tags = p_use_case_tags
    and submission.semantic_role = p_semantic_role
    and submission.visual_family is not distinct from normalized_family
    and submission.variant_kind = p_variant_kind
    and submission.variant_label is not distinct from normalized_variant_label
    and submission.compatibility_tags = p_compatibility_tags
  then return; end if;

  if submission.specialty_tags is distinct from p_expected_specialty_tags
    or submission.use_case_tags is distinct from p_expected_use_case_tags
    or submission.semantic_role is distinct from p_expected_semantic_role
    or submission.visual_family is distinct from nullif(pg_catalog.btrim(coalesce(p_expected_visual_family, '')), '')
    or submission.variant_kind is distinct from p_expected_variant_kind
    or submission.variant_label is distinct from nullif(pg_catalog.btrim(coalesce(p_expected_variant_label, '')), '')
    or submission.compatibility_tags is distinct from p_expected_compatibility_tags
  then raise exception 'pipeline_classification_conflict'; end if;

  update public.cardforge_contributor_asset_submissions
  set
    specialty_tags = p_specialty_tags,
    use_case_tags = p_use_case_tags,
    semantic_role = p_semantic_role,
    visual_family = normalized_family,
    variant_kind = p_variant_kind,
    variant_label = normalized_variant_label,
    compatibility_tags = p_compatibility_tags
  where id = submission.id;

  if registry.asset_type = 'set' then
    update public.cardforge_asset_registry
    set metadata = metadata || pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'specialtyTags', p_specialty_tags,
      'useCaseTags', p_use_case_tags,
      'semanticRole', p_semantic_role,
      'visualFamily', normalized_family,
      'variantKind', p_variant_kind,
      'variantLabel', normalized_variant_label,
      'compatibilityTags', p_compatibility_tags
    ))
    where asset_id = p_asset_id;
  end if;
end;
$$;

revoke all on function public.cardforge_classify_published_pipeline_asset(
  text,uuid,uuid,integer,text[],text[],text,text,text,text,text[],text[],text[],text,text,text,text,text[]
) from public, anon, authenticated;
grant execute on function public.cardforge_classify_published_pipeline_asset(
  text,uuid,uuid,integer,text[],text[],text,text,text,text,text[],text[],text[],text,text,text,text,text[]
) to service_role;

create or replace function public.cardforge_set_contributor_asset_editorial_review(
  p_submission_id uuid,
  p_review_status text,
  p_review_note text,
  p_reviewer_contributor_id text
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  submission public.cardforge_contributor_asset_submissions%rowtype;
  normalized_note text := pg_catalog.btrim(coalesce(p_review_note, ''));
  normalized_reviewer text := pg_catalog.btrim(coalesce(p_reviewer_contributor_id, ''));
  changed_count integer;
begin
  if p_review_status not in ('pending', 'approved', 'revise', 'quarantine', 'retire') then
    raise exception 'invalid_editorial_review_status';
  end if;
  if p_review_status <> 'pending'
    and (normalized_note = '' or normalized_reviewer = '')
  then
    raise exception 'editorial_review_reason_required';
  end if;

  select * into submission
  from public.cardforge_contributor_asset_submissions
  where id = p_submission_id and purge_state is null
  for update;
  if not found then raise exception 'contributor_asset_not_found'; end if;

  if submission.status = 'published' and p_review_status = 'revise' then
    raise exception 'editorial_review_live_requires_quarantine';
  end if;

  if p_review_status = 'approved' then
    if nullif(pg_catalog.btrim(coalesce(submission.source_notes, '')), '') is null then
      raise exception 'editorial_review_source_notes_required';
    end if;
    if nullif(pg_catalog.btrim(coalesce(submission.preview_url, '')), '') is null then
      raise exception 'editorial_review_preview_required';
    end if;
    if pg_catalog.coalesce(pg_catalog.array_length(submission.specialty_tags, 1), 0) = 0
      or not public.cardforge_valid_pipeline_semantic_role(submission.asset_type, submission.semantic_role)
    then
      raise exception 'editorial_review_classification_required';
    end if;
    if submission.asset_type in ('templates', 'sets')
      and pg_catalog.coalesce(pg_catalog.array_length(submission.use_case_tags, 1), 0) = 0
    then
      raise exception 'editorial_review_classification_required';
    end if;
  end if;

  update public.cardforge_contributor_asset_submissions
  set
    editorial_review_status = p_review_status,
    editorial_review_note = case when p_review_status = 'pending' then '' else normalized_note end,
    editorial_reviewed_by = case when p_review_status = 'pending' then null else normalized_reviewer end,
    editorial_reviewed_at = case when p_review_status = 'pending' then null else pg_catalog.now() end,
    owner_status_override = case when p_review_status in ('quarantine', 'retire') then 'archived' else owner_status_override end,
    owner_access_tier_override = case when p_review_status in ('quarantine', 'retire') then 'hidden' else owner_access_tier_override end,
    owner_note = case when p_review_status in ('quarantine', 'retire') then normalized_note else owner_note end
  where id = p_submission_id;

  changed_count := public.cardforge_rebalance_contributor_asset_pipeline(normalized_reviewer);
  perform public.cardforge_sync_contributor_asset_registry(p_submission_id);
  return changed_count;
end;
$$;

revoke execute on function public.cardforge_set_contributor_asset_editorial_review(uuid,text,text,text)
  from public, anon, authenticated;
grant execute on function public.cardforge_set_contributor_asset_editorial_review(uuid,text,text,text)
  to service_role;

comment on column public.cardforge_contributor_asset_submissions.semantic_role
  is 'Code-owned semantic purpose of this exact Pipeline revision, distinct from storage asset type and visual treatment.';
comment on column public.cardforge_contributor_asset_submissions.visual_family
  is 'Optional human-readable visual family/pack grouping; not object identity.';
comment on column public.cardforge_contributor_asset_submissions.variant_kind
  is 'Relationship of this revision/object to its visual family: base, format, treatment, size, color, or finish.';
comment on column public.cardforge_contributor_asset_submissions.variant_label
  is 'Optional human-readable variant label within a visual family.';
comment on column public.cardforge_contributor_asset_submissions.compatibility_tags
  is 'Controlled compositional compatibility traits used by review and creator discovery.';

commit;
