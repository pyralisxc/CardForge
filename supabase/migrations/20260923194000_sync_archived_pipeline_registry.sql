begin;

-- Owner decisions are immediately reflected in the public registry, including
-- archived rows that the rebalance pass has just moved into retention trash.
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

  update public.cardforge_contributor_asset_submissions
  set
    owner_status_override = case when p_update_status_override then p_status_override else owner_status_override end,
    owner_access_tier_override = case when p_update_tier_override then p_tier_override else owner_access_tier_override end,
    owner_note = coalesce(p_owner_note, '')
  where id = p_submission_id
    and purge_state is null;

  if not found then
    raise exception 'contributor_asset_not_found';
  end if;

  changed_count := public.cardforge_rebalance_contributor_asset_pipeline(p_owner_contributor_id);

  -- Rebalance intentionally omits trashed rows from its general sync loop.
  -- The directly changed row still needs one final sync so a newly archived
  -- publication cannot remain visible during its recoverable retention window.
  perform public.cardforge_sync_contributor_asset_registry(p_submission_id);

  return changed_count;
end;
$$;

revoke execute on function public.cardforge_set_contributor_asset_owner_override(uuid, boolean, text, boolean, text, text, text)
  from public, anon, authenticated;
grant execute on function public.cardforge_set_contributor_asset_owner_override(uuid, boolean, text, boolean, text, text, text)
  to service_role;

-- Repair any publication that entered retention before this synchronization
-- boundary existed. The sync function only updates the linked active pointer.
do $$
declare
  stale_publication record;
begin
  for stale_publication in
    select submission.id
    from public.cardforge_contributor_asset_submissions as submission
    join public.cardforge_asset_registry as registry
      on registry.contributor_submission_id = submission.id
    where submission.status in ('archived', 'rejected')
      and registry.status = 'published'
      and submission.purge_state is null
  loop
    perform public.cardforge_sync_contributor_asset_registry(stale_publication.id);
  end loop;
end;
$$;

comment on function public.cardforge_set_contributor_asset_owner_override(uuid, boolean, text, boolean, text, text, text)
  is 'Applies an owner Pipeline decision, rebalances capacity, and synchronizes the changed revision even when it enters retention trash.';

commit;
