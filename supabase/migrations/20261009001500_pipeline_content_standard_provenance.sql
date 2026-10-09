begin;

set local lock_timeout = '5s';

alter table public.cardforge_contributor_asset_submissions
  add column if not exists creation_origin text not null default 'unknown',
  add column if not exists content_standard_version text,
  add column if not exists intended_use_evidence text not null default '',
  add column if not exists creation_disclosure jsonb not null default '{}'::jsonb,
  add column if not exists editorial_standard_version text;

alter table public.cardforge_contributor_asset_submissions
  drop constraint if exists cardforge_contributor_asset_creation_origin_check,
  drop constraint if exists cardforge_contributor_asset_content_standard_version_check,
  drop constraint if exists cardforge_contributor_asset_intended_use_evidence_check,
  drop constraint if exists cardforge_contributor_asset_creation_disclosure_check,
  drop constraint if exists cardforge_contributor_asset_editorial_standard_version_check;

alter table public.cardforge_contributor_asset_submissions
  add constraint cardforge_contributor_asset_creation_origin_check
    check (creation_origin in ('unknown','human','ai-assisted','generated','remixed','licensed')),
  add constraint cardforge_contributor_asset_content_standard_version_check
    check (content_standard_version is null or pg_catalog.char_length(content_standard_version) between 1 and 80),
  add constraint cardforge_contributor_asset_intended_use_evidence_check
    check (pg_catalog.char_length(intended_use_evidence) <= 1200),
  add constraint cardforge_contributor_asset_creation_disclosure_check
    check (pg_catalog.jsonb_typeof(creation_disclosure) = 'object'),
  add constraint cardforge_contributor_asset_editorial_standard_version_check
    check (editorial_standard_version is null or pg_catalog.char_length(editorial_standard_version) between 1 and 80);

create index if not exists cardforge_contributor_asset_standard_review_idx
  on public.cardforge_contributor_asset_submissions (
    editorial_standard_version,
    creation_origin,
    status,
    updated_at desc
  )
  where purge_state is null;

create or replace function public.cardforge_enforce_contributor_asset_editorial_readiness()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'published'
    and (
      coalesce(new.editorial_review_status, 'pending') <> 'approved'
      or coalesce(new.editorial_standard_version, '') <> '2026-10-08-v1'
    )
  then
    if tg_op = 'INSERT' or old.status is distinct from 'published' then
      new.status := 'publish_candidate';
      new.calculated_access_tier := 'contributor';
      new.decision_reason := 'editorial_review_required';
      new.tier_decision_reason := 'editorial_review_required';
      if tg_op = 'UPDATE' then
        new.published_at := old.published_at;
      else
        new.published_at := null;
      end if;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.cardforge_set_contributor_asset_editorial_review_v2(
  p_submission_id uuid,
  p_review_status text,
  p_review_note text,
  p_reviewer_contributor_id text,
  p_standard_version text,
  p_source_notes text,
  p_creation_origin text,
  p_intended_use_evidence text,
  p_creation_disclosure jsonb
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
  normalized_standard text := pg_catalog.btrim(coalesce(p_standard_version, ''));
  normalized_source_notes text := pg_catalog.btrim(coalesce(p_source_notes, ''));
  normalized_intended_use text := pg_catalog.btrim(coalesce(p_intended_use_evidence, ''));
  disclosure jsonb := coalesce(p_creation_disclosure, '{}'::jsonb);
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
  if normalized_standard <> '2026-10-08-v1' then
    raise exception 'editorial_standard_version_required';
  end if;
  if p_creation_origin not in ('unknown','human','ai-assisted','generated','remixed','licensed') then
    raise exception 'editorial_creation_origin_invalid';
  end if;
  if pg_catalog.jsonb_typeof(disclosure) is distinct from 'object' then
    raise exception 'editorial_creation_disclosure_invalid';
  end if;
  if pg_catalog.char_length(normalized_source_notes) > 600
    or pg_catalog.char_length(normalized_intended_use) > 1200
  then
    raise exception 'editorial_evidence_invalid';
  end if;

  select *
  into submission
  from public.cardforge_contributor_asset_submissions
  where id = p_submission_id
    and purge_state is null
  for update;

  if not found then
    raise exception 'contributor_asset_not_found';
  end if;

  if submission.status = 'published' and p_review_status = 'revise' then
    raise exception 'editorial_review_live_requires_quarantine';
  end if;

  if p_review_status = 'approved' then
    if normalized_source_notes = '' then
      raise exception 'editorial_review_source_notes_required';
    end if;
    if nullif(pg_catalog.btrim(coalesce(submission.preview_url, '')), '') is null then
      raise exception 'editorial_review_preview_required';
    end if;
    if p_creation_origin = 'unknown' then
      raise exception 'editorial_creation_origin_required';
    end if;
    if normalized_intended_use = '' then
      raise exception 'editorial_intended_use_required';
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

    if p_creation_origin in ('ai-assisted','generated') then
      if nullif(pg_catalog.btrim(coalesce(disclosure ->> 'processSummary', '')), '') is null then
        raise exception 'editorial_creation_process_required';
      end if;
      if nullif(pg_catalog.btrim(coalesce(disclosure ->> 'humanEditSummary', '')), '') is null then
        raise exception 'editorial_human_edit_summary_required';
      end if;
    end if;
    if p_creation_origin in ('remixed','licensed')
      and nullif(pg_catalog.btrim(coalesce(disclosure ->> 'referenceSummary', '')), '') is null
    then
      raise exception 'editorial_reference_summary_required';
    end if;
  end if;

  update public.cardforge_contributor_asset_submissions
  set
    source_notes = normalized_source_notes,
    creation_origin = p_creation_origin,
    content_standard_version = normalized_standard,
    intended_use_evidence = normalized_intended_use,
    creation_disclosure = disclosure,
    editorial_review_status = p_review_status,
    editorial_review_note = case when p_review_status = 'pending' then '' else normalized_note end,
    editorial_reviewed_by = case when p_review_status = 'pending' then null else normalized_reviewer end,
    editorial_reviewed_at = case when p_review_status = 'pending' then null else pg_catalog.now() end,
    editorial_standard_version = case when p_review_status = 'pending' then null else normalized_standard end,
    owner_status_override = case
      when p_review_status in ('quarantine', 'retire') then 'archived'
      else owner_status_override
    end,
    owner_access_tier_override = case
      when p_review_status in ('quarantine', 'retire') then 'hidden'
      else owner_access_tier_override
    end,
    owner_note = case
      when p_review_status in ('quarantine', 'retire') then normalized_note
      else owner_note
    end
  where id = p_submission_id;

  changed_count := public.cardforge_rebalance_contributor_asset_pipeline(normalized_reviewer);
  perform public.cardforge_sync_contributor_asset_registry(p_submission_id);

  return changed_count;
end;
$$;

revoke execute on function public.cardforge_set_contributor_asset_editorial_review_v2(
  uuid,text,text,text,text,text,text,text,jsonb
) from public, anon, authenticated;
grant execute on function public.cardforge_set_contributor_asset_editorial_review_v2(
  uuid,text,text,text,text,text,text,text,jsonb
) to service_role;

-- Keep the historical function callable for non-approval lifecycle decisions,
-- but make current-standard approval explicit through the versioned v2 command.
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
begin
  if p_review_status = 'approved' then
    raise exception 'editorial_standard_version_required';
  end if;

  select *
  into submission
  from public.cardforge_contributor_asset_submissions
  where id = p_submission_id
    and purge_state is null;

  if not found then
    raise exception 'contributor_asset_not_found';
  end if;

  return public.cardforge_set_contributor_asset_editorial_review_v2(
    p_submission_id,
    p_review_status,
    p_review_note,
    p_reviewer_contributor_id,
    '2026-10-08-v1',
    submission.source_notes,
    submission.creation_origin,
    submission.intended_use_evidence,
    submission.creation_disclosure
  );
end;
$$;

-- Owner status override is no longer an editorial-approval shortcut.
create or replace function public.cardforge_set_contributor_asset_owner_override(
  p_submission_id uuid,
  p_update_status_override boolean,
  p_status_override text,
  p_update_tier_override boolean,
  p_tier_override text,
  p_owner_note text,
  p_owner_contributor_id text default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  submission public.cardforge_contributor_asset_submissions%rowtype;
  changed_count integer;
begin
  if p_update_status_override
    and p_status_override is not null
    and p_status_override not in ('voting', 'publish_candidate', 'published', 'archived', 'rejected')
  then
    raise exception 'invalid_owner_status_override';
  end if;
  if p_update_tier_override
    and p_tier_override is not null
    and p_tier_override not in ('hidden', 'free', 'paid')
  then
    raise exception 'invalid_owner_tier_override';
  end if;

  select *
  into submission
  from public.cardforge_contributor_asset_submissions
  where id = p_submission_id
    and purge_state is null
  for update;

  if not found then
    raise exception 'contributor_asset_not_found';
  end if;

  if p_update_status_override and p_status_override = 'published' then
    if submission.editorial_review_status <> 'approved'
      or coalesce(submission.editorial_standard_version, '') <> '2026-10-08-v1'
    then
      raise exception 'editorial_review_required';
    end if;
    if nullif(pg_catalog.btrim(coalesce(p_owner_note, '')), '') is null
      or nullif(pg_catalog.btrim(coalesce(p_owner_contributor_id, '')), '') is null
    then
      raise exception 'editorial_review_reason_required';
    end if;
  end if;

  update public.cardforge_contributor_asset_submissions
  set
    owner_status_override = case when p_update_status_override then p_status_override else owner_status_override end,
    owner_access_tier_override = case when p_update_tier_override then p_tier_override else owner_access_tier_override end,
    owner_note = coalesce(p_owner_note, '')
  where id = p_submission_id;

  changed_count := public.cardforge_rebalance_contributor_asset_pipeline(p_owner_contributor_id);
  perform public.cardforge_sync_contributor_asset_registry(p_submission_id);

  return changed_count;
end;
$$;

comment on column public.cardforge_contributor_asset_submissions.creation_origin
  is 'Exact-revision creation origin: unknown legacy state, human, AI-assisted, generated, remixed, or licensed. Origin is context, not a quality grade.';
comment on column public.cardforge_contributor_asset_submissions.content_standard_version
  is 'CardForge content-authoring standard version against which this exact revision evidence was prepared.';
comment on column public.cardforge_contributor_asset_submissions.intended_use_evidence
  is 'Bounded human evidence that the exact revision was inspected in its intended card/output context and size.';
comment on column public.cardforge_contributor_asset_submissions.creation_disclosure
  is 'Bounded structured creation disclosure. Never stores raw private prompts; may record tool/date/process/reference/human-edit summaries.';
comment on column public.cardforge_contributor_asset_submissions.editorial_standard_version
  is 'Content standard version used for the exact-revision editorial decision.';
comment on function public.cardforge_set_contributor_asset_editorial_review_v2(uuid,text,text,text,text,text,text,text,jsonb)
  is 'Records provenance evidence plus exact-revision editorial outcome under an explicit CardForge content-standard version.';
comment on function public.cardforge_set_contributor_asset_owner_override(uuid,boolean,text,boolean,text,text,text)
  is 'Owner lifecycle/tier override. Publishing requires a separate current-standard exact-revision editorial approval.';

commit;
