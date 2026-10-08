begin;

set local lock_timeout = '5s';

alter table public.cardforge_contributor_asset_submissions
  add column if not exists editorial_review_status text not null default 'pending',
  add column if not exists editorial_review_note text not null default '',
  add column if not exists editorial_reviewed_by text,
  add column if not exists editorial_reviewed_at timestamptz;

alter table public.cardforge_contributor_asset_submissions
  drop constraint if exists cardforge_contributor_asset_editorial_review_status_check;

alter table public.cardforge_contributor_asset_submissions
  add constraint cardforge_contributor_asset_editorial_review_status_check
  check (editorial_review_status in ('pending', 'approved', 'revise', 'quarantine', 'retire'));

create index if not exists cardforge_contributor_asset_editorial_review_idx
  on public.cardforge_contributor_asset_submissions (editorial_review_status, status, updated_at desc)
  where purge_state is null;

create or replace function public.cardforge_enforce_contributor_asset_editorial_readiness()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'published'
    and coalesce(new.editorial_review_status, 'pending') <> 'approved'
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

drop trigger if exists cardforge_contributor_asset_editorial_readiness
  on public.cardforge_contributor_asset_submissions;

create trigger cardforge_contributor_asset_editorial_readiness
before insert or update of status
on public.cardforge_contributor_asset_submissions
for each row
execute function public.cardforge_enforce_contributor_asset_editorial_readiness();

-- Publishing through the existing Owner override is an explicit editorial
-- approval only when it carries an accountable Owner identity and reason.
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
  if p_update_status_override
    and p_status_override = 'published'
    and (
      nullif(pg_catalog.btrim(coalesce(p_owner_note, '')), '') is null
      or nullif(pg_catalog.btrim(coalesce(p_owner_contributor_id, '')), '') is null
    )
  then
    raise exception 'editorial_review_reason_required';
  end if;

  update public.cardforge_contributor_asset_submissions
  set
    owner_status_override = case when p_update_status_override then p_status_override else owner_status_override end,
    owner_access_tier_override = case when p_update_tier_override then p_tier_override else owner_access_tier_override end,
    owner_note = coalesce(p_owner_note, ''),
    editorial_review_status = case
      when p_update_status_override and p_status_override = 'published' then 'approved'
      else editorial_review_status
    end,
    editorial_review_note = case
      when p_update_status_override and p_status_override = 'published' then pg_catalog.btrim(p_owner_note)
      else editorial_review_note
    end,
    editorial_reviewed_by = case
      when p_update_status_override and p_status_override = 'published' then pg_catalog.btrim(p_owner_contributor_id)
      else editorial_reviewed_by
    end,
    editorial_reviewed_at = case
      when p_update_status_override and p_status_override = 'published' then pg_catalog.now()
      else editorial_reviewed_at
    end
  where id = p_submission_id
    and purge_state is null;

  if not found then
    raise exception 'contributor_asset_not_found';
  end if;

  changed_count := public.cardforge_rebalance_contributor_asset_pipeline(p_owner_contributor_id);
  perform public.cardforge_sync_contributor_asset_registry(p_submission_id);

  return changed_count;
end;
$$;

revoke execute on function public.cardforge_set_contributor_asset_owner_override(uuid, boolean, text, boolean, text, text, text)
  from public, anon, authenticated;
grant execute on function public.cardforge_set_contributor_asset_owner_override(uuid, boolean, text, boolean, text, text, text)
  to service_role;

-- Retain the historical function name used by the direct Owner Template
-- publication RPC, but route it through the current Contributor owner.
create or replace function public.cardforge_set_developer_asset_owner_override(
  p_submission_id uuid,
  p_update_status_override boolean,
  p_status_override text,
  p_update_tier_override boolean,
  p_tier_override text,
  p_owner_note text,
  p_owner_developer_id text default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return public.cardforge_set_contributor_asset_owner_override(
    p_submission_id,
    p_update_status_override,
    p_status_override,
    p_update_tier_override,
    p_tier_override,
    p_owner_note,
    p_owner_developer_id
  );
end;
$$;

revoke execute on function public.cardforge_set_developer_asset_owner_override(uuid, boolean, text, boolean, text, text, text)
  from public, anon, authenticated;
grant execute on function public.cardforge_set_developer_asset_owner_override(uuid, boolean, text, boolean, text, text, text)
  to service_role;

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

  select *
  into submission
  from public.cardforge_contributor_asset_submissions
  where id = p_submission_id
    and purge_state is null
  for update;

  if not found then
    raise exception 'contributor_asset_not_found';
  end if;

  if p_review_status = 'approved' then
    if nullif(pg_catalog.btrim(coalesce(submission.source_notes, '')), '') is null then
      raise exception 'editorial_review_source_notes_required';
    end if;
    if nullif(pg_catalog.btrim(coalesce(submission.preview_url, '')), '') is null then
      raise exception 'editorial_review_preview_required';
    end if;
    if pg_catalog.coalesce(pg_catalog.array_length(submission.specialty_tags, 1), 0) = 0 then
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

revoke execute on function public.cardforge_set_contributor_asset_editorial_review(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.cardforge_set_contributor_asset_editorial_review(uuid, text, text, text)
  to service_role;

comment on column public.cardforge_contributor_asset_submissions.editorial_review_status
  is 'Exact-revision editorial judgment, distinct from technical validity and community vote signal.';
comment on column public.cardforge_contributor_asset_submissions.editorial_review_note
  is 'Human reason for the exact-revision editorial decision.';
comment on function public.cardforge_set_contributor_asset_editorial_review(uuid, text, text, text)
  is 'Records exact-revision editorial readiness, rebalances publication eligibility, and preserves existing live legacy revisions until explicitly quarantined or retired.';
comment on function public.cardforge_enforce_contributor_asset_editorial_readiness()
  is 'Prevents a previously-unpublished revision from entering published state before exact-revision editorial approval; existing live legacy publications remain visible until reviewed.';

commit;
