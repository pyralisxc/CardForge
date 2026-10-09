begin;

set local lock_timeout = '5s';

alter table public.cardforge_contributor_asset_submissions
  add column if not exists semantic_role text,
  add column if not exists visual_family text,
  add column if not exists variant_of_asset_id text,
  add column if not exists variant_kind text,
  add column if not exists compatibility_tags text[] not null default '{}'::text[];

alter table public.cardforge_contributor_asset_submissions
  drop constraint if exists cardforge_contributor_asset_semantic_role_check,
  drop constraint if exists cardforge_contributor_asset_visual_family_check,
  drop constraint if exists cardforge_contributor_asset_variant_kind_check,
  drop constraint if exists cardforge_contributor_asset_variant_pair_check,
  drop constraint if exists cardforge_contributor_asset_variant_asset_id_check,
  drop constraint if exists cardforge_contributor_asset_compatibility_tags_check;

alter table public.cardforge_contributor_asset_submissions
  add constraint cardforge_contributor_asset_semantic_role_check
    check (
      semantic_role is null
      or semantic_role in (
        'template-front','template-back','set','artwork','surface-texture','material',
        'foundation','border','text-frame','title-plate','divider','icon','resource-pip',
        'mechanic-symbol','ornament','badge','stat-component','shape','style-recipe','font'
      )
    ),
  add constraint cardforge_contributor_asset_visual_family_check
    check (
      visual_family is null
      or (
        char_length(visual_family) between 1 and 80
        and visual_family ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
      )
    ),
  add constraint cardforge_contributor_asset_variant_kind_check
    check (variant_kind is null or variant_kind in ('format','treatment','orientation','color','size')),
  add constraint cardforge_contributor_asset_variant_pair_check
    check ((variant_of_asset_id is null) = (variant_kind is null)),
  add constraint cardforge_contributor_asset_variant_asset_id_check
    check (
      variant_of_asset_id is null
      or (
        char_length(variant_of_asset_id) between 1 and 160
        and variant_of_asset_id ~ '^[A-Za-z0-9._:-]+$'
      )
    ),
  add constraint cardforge_contributor_asset_compatibility_tags_check
    check (
      compatibility_tags <@ array[
        'front','back','portrait','landscape','recolorable','monochrome','seamless',
        'small-size','full-bleed','poker','bridge','tarot','business-card',
        'event-badge','reference-card'
      ]::text[]
    );

create index if not exists cardforge_contributor_asset_semantic_role_idx
  on public.cardforge_contributor_asset_submissions (semantic_role, status, updated_at desc)
  where purge_state is null;

create index if not exists cardforge_contributor_asset_visual_family_idx
  on public.cardforge_contributor_asset_submissions (visual_family, semantic_role, updated_at desc)
  where purge_state is null and visual_family is not null;

create or replace function public.cardforge_pipeline_semantic_role_matches_asset_type(
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
    when 'textures' then p_semantic_role in ('surface-texture','foundation','artwork')
    when 'dividers' then p_semantic_role in ('divider','title-plate','text-frame','border')
    when 'icons' then p_semantic_role in ('icon','resource-pip','mechanic-symbol','ornament','badge','stat-component')
    when 'imageAssets' then p_semantic_role in ('artwork','foundation','border','text-frame','ornament','badge')
    when 'elementPresets' then p_semantic_role in ('material','foundation','border','text-frame','shape','style-recipe')
    when 'fonts' then p_semantic_role = 'font'
    else false
  end;
$$;

create or replace function public.cardforge_validate_pipeline_semantic_taxonomy()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.semantic_role is null and new.asset_type = 'templates' then
    new.semantic_role := case
      when new.source_payload ->> 'templateUsage' = 'back-preset' then 'template-back'
      else 'template-front'
    end;
  end if;

  if new.semantic_role is not null
    and not public.cardforge_pipeline_semantic_role_matches_asset_type(new.asset_type, new.semantic_role)
  then
    raise exception 'pipeline_semantic_role_asset_type_mismatch';
  end if;

  if new.variant_of_asset_id is not null
    and new.variant_of_asset_id = coalesce(new.registry_asset_id, new.target_registry_asset_id)
  then
    raise exception 'pipeline_variant_self_reference';
  end if;

  if (
    tg_op = 'INSERT'
    or old.status is distinct from new.status
  ) and new.status in ('submitted','voting','publish_candidate','published')
    and new.semantic_role is null
  then
    raise exception 'pipeline_semantic_role_required';
  end if;

  return new;
end;
$$;

drop trigger if exists cardforge_pipeline_semantic_taxonomy_guard
  on public.cardforge_contributor_asset_submissions;
create trigger cardforge_pipeline_semantic_taxonomy_guard
before insert or update of
  status, asset_type, semantic_role, visual_family, variant_of_asset_id, variant_kind, compatibility_tags
on public.cardforge_contributor_asset_submissions
for each row
execute function public.cardforge_validate_pipeline_semantic_taxonomy();

create or replace function public.cardforge_require_semantic_role_for_editorial_approval()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.editorial_review_status = 'approved'
    and old.editorial_review_status is distinct from new.editorial_review_status
    and new.semantic_role is null
  then
    raise exception 'editorial_review_semantic_role_required';
  end if;
  return new;
end;
$$;

drop trigger if exists cardforge_pipeline_editorial_semantic_role_guard
  on public.cardforge_contributor_asset_submissions;
create trigger cardforge_pipeline_editorial_semantic_role_guard
before update of editorial_review_status
on public.cardforge_contributor_asset_submissions
for each row
execute function public.cardforge_require_semantic_role_for_editorial_approval();

comment on column public.cardforge_contributor_asset_submissions.semantic_role
  is 'Controlled semantic content role for the exact Pipeline revision; null marks legacy content awaiting curation.';
comment on column public.cardforge_contributor_asset_submissions.visual_family
  is 'Optional stable normalized family/pack identity shared by related visual assets.';
comment on column public.cardforge_contributor_asset_submissions.variant_of_asset_id
  is 'Optional stable registry asset id whose semantic concept this revision varies.';
comment on column public.cardforge_contributor_asset_submissions.variant_kind
  is 'Controlled reason this asset is a variant: format, treatment, orientation, color, or size.';
comment on column public.cardforge_contributor_asset_submissions.compatibility_tags
  is 'Controlled creator-facing compatibility traits; does not replace Studio destination or physical format authority.';

commit;