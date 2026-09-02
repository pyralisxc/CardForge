-- Contributor lifecycle decisions are durable product policy, not another owner
-- override. The effective registry remains available to existing downloaded work;
-- retiring only removes the exact currently-published revision from discovery.

alter table public.cardforge_contributor_asset_submissions
  add column if not exists contributor_lifecycle_state text
  check (contributor_lifecycle_state in ('withdrawn', 'retired'));

comment on column public.cardforge_contributor_asset_submissions.contributor_lifecycle_state is
  'Durable contributor decision for an owned exact revision: withdrawn before publication or retired after publication.';

create or replace function public.cardforge_preserve_contributor_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Automated rebalancing cannot silently republish a contributor-withdrawn
  -- revision. An explicit owner override remains the audited recovery path.
  if old.contributor_lifecycle_state is not null
    and new.contributor_lifecycle_state is not distinct from old.contributor_lifecycle_state
    and new.owner_status_override is not distinct from old.owner_status_override
  then
    new.status := old.status;
    new.automated_status := old.automated_status;
    new.calculated_access_tier := old.calculated_access_tier;
    new.automated_access_tier := old.automated_access_tier;
    new.decision_reason := old.decision_reason;
  end if;

  if new.owner_status_override is distinct from old.owner_status_override then
    new.contributor_lifecycle_state := null;
  end if;

  return new;
end;
$$;

drop trigger if exists cardforge_preserve_contributor_lifecycle
  on public.cardforge_contributor_asset_submissions;
create trigger cardforge_preserve_contributor_lifecycle
before update on public.cardforge_contributor_asset_submissions
for each row execute function public.cardforge_preserve_contributor_lifecycle();

create or replace function public.cardforge_set_contributor_asset_lifecycle(
  p_submission_id uuid,
  p_contributor_id text,
  p_action text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  submission public.cardforge_contributor_asset_submissions%rowtype;
  lifecycle_state text;
begin
  if p_action not in ('withdraw', 'retire') then
    raise exception 'invalid_contributor_lifecycle_action';
  end if;

  select * into submission
  from public.cardforge_contributor_asset_submissions
  where id = p_submission_id
    and purge_state is null
  for update;

  if not found then
    raise exception 'contributor_asset_not_found';
  end if;
  if submission.contributor_id <> p_contributor_id then
    raise exception 'contributor_asset_owner_required';
  end if;

  if p_action = 'withdraw' then
    if submission.status not in ('draft', 'submitted', 'voting', 'publish_candidate') then
      raise exception 'contributor_asset_not_withdrawable';
    end if;
    lifecycle_state := 'withdrawn';
  else
    if submission.status <> 'published' then
      raise exception 'contributor_asset_not_retirable';
    end if;
    lifecycle_state := 'retired';
  end if;

  update public.cardforge_contributor_asset_submissions
  set
    status = 'archived',
    automated_status = 'archived',
    calculated_access_tier = 'hidden',
    automated_access_tier = 'hidden',
    contributor_lifecycle_state = lifecycle_state,
    decision_reason = case
      when lifecycle_state = 'withdrawn' then 'contributor_withdrawal'
      else 'contributor_retirement'
    end,
    updated_at = pg_catalog.now()
  where id = submission.id;

  -- Only hide the registry object when it still points at this exact revision.
  -- Newer published revisions in the same lineage remain discoverable.
  update public.cardforge_asset_registry
  set status = 'archived', access_tier = 'hidden', updated_at = pg_catalog.now()
  where developer_submission_id = submission.id;

  return pg_catalog.jsonb_build_object(
    'submissionId', submission.id,
    'lineageId', submission.lineage_id,
    'lifecycleState', lifecycle_state,
    'existingInstalledCopiesRemainUsable', true
  );
end;
$$;

revoke execute on function public.cardforge_set_contributor_asset_lifecycle(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.cardforge_set_contributor_asset_lifecycle(uuid, text, text)
  to service_role;
