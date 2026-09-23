begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Self-voting is not a valid review signal. Remove legacy rows created before
-- peer-only review was enforced so they cannot continue to affect totals.
delete from public.cardforge_contributor_asset_votes as vote
using public.cardforge_contributor_asset_submissions as submission
where submission.id = vote.submission_id
  and submission.contributor_id = vote.contributor_id;

-- Keep the invariant below the RPC boundary as well. Service-role imports and
-- future maintenance code must not be able to recreate a self-vote directly.
create or replace function public.cardforge_validate_contributor_vote_lineage()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  expected_lineage uuid;
  submission_contributor_id text;
begin
  select submission.lineage_id, submission.contributor_id
  into expected_lineage, submission_contributor_id
  from public.cardforge_contributor_asset_submissions as submission
  where submission.id = new.submission_id;

  if not found or expected_lineage is distinct from new.lineage_id then
    raise exception 'contributor_vote_lineage_mismatch';
  end if;
  if submission_contributor_id = new.contributor_id then
    raise exception 'contributor_asset_self_vote_not_permitted';
  end if;

  new.vote_weight := 1;
  return new;
end;
$$;

drop trigger if exists cardforge_contributor_vote_lineage_guard
  on public.cardforge_contributor_asset_votes;
create trigger cardforge_contributor_vote_lineage_guard
  before insert or update of submission_id, lineage_id, contributor_id, vote_weight
  on public.cardforge_contributor_asset_votes
  for each row execute function public.cardforge_validate_contributor_vote_lineage();

commit;
