-- Classification is discovery metadata. Preserve authored revisions and votes.
create or replace function public.cardforge_classify_published_pipeline_asset(
  p_asset_id text,
  p_expected_submission_id uuid,
  p_expected_lineage_id uuid,
  p_expected_revision integer,
  p_expected_specialty_tags text[],
  p_expected_use_case_tags text[],
  p_specialty_tags text[],
  p_use_case_tags text[]
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
begin
  select * into registry from public.cardforge_asset_registry where asset_id = p_asset_id;
  if not found then raise exception 'pipeline_classification_not_found'; end if;
  select * into submission from public.cardforge_contributor_asset_submissions where id = registry.contributor_submission_id for update;
  if not found then raise exception 'pipeline_classification_conflict'; end if;
  -- Native publication and taxonomy triggers lock submission before registry.
  -- Re-read after acquiring those locks; the initial link may have changed.
  -- Bootstrap upsert takes the advisory lock first. Do not wait while holding
  -- its submission row: let the caller retry instead of forming a lock cycle.
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

  if p_specialty_tags is null or p_use_case_tags is null
    or pg_catalog.cardinality(p_specialty_tags) = 0
    or not p_specialty_tags <@ array['general','games','marketing','events','education','business','community']::text[]
    or not p_use_case_tags <@ array['tcg','playing-cards','tarot','board-game','reference-card','event-poster','social-post','rulebook','packaging']::text[]
    or pg_catalog.array_position(p_specialty_tags, null) is not null
    or pg_catalog.array_position(p_use_case_tags, null) is not null
    or (pg_catalog.cardinality(p_use_case_tags) = 0 and not (
      p_specialty_tags = array['general']::text[]
      and submission.asset_type in ('textures','dividers','icons','imageAssets','elementPresets','fonts')
    ))
  then raise exception 'pipeline_classification_invalid'; end if;

  -- A retried successful request is safe; never replay against another revision.
  if submission.specialty_tags = p_specialty_tags and submission.use_case_tags = p_use_case_tags then return; end if;
  if submission.specialty_tags is distinct from p_expected_specialty_tags
    or submission.use_case_tags is distinct from p_expected_use_case_tags
  then raise exception 'pipeline_classification_conflict'; end if;

  update public.cardforge_contributor_asset_submissions
    set specialty_tags = p_specialty_tags, use_case_tags = p_use_case_tags
    where id = submission.id;
  -- Existing taxonomy trigger keeps registry columns aligned. Set discovery also
  -- projects these values from compact metadata; never copy authored payloads.
  if registry.asset_type = 'set' then
    update public.cardforge_asset_registry
      set metadata = metadata || pg_catalog.jsonb_build_object('specialtyTags', p_specialty_tags, 'useCaseTags', p_use_case_tags)
      where asset_id = p_asset_id;
  end if;
end;
$$;

revoke all on function public.cardforge_classify_published_pipeline_asset(text,uuid,uuid,integer,text[],text[],text[],text[]) from public, anon, authenticated;
grant execute on function public.cardforge_classify_published_pipeline_asset(text,uuid,uuid,integer,text[],text[],text[],text[]) to service_role;
comment on function public.cardforge_classify_published_pipeline_asset(text,uuid,uuid,integer,text[],text[],text[],text[]) is 'Owner service command for atomic discovery classification; compare-and-set linked published identity, revision and previous taxonomy without changing authored payloads, lineage or votes.';
