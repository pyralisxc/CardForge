begin;

set local lock_timeout = '5s';

-- The Contributor cutover renamed stored values, checks and function bodies.
-- Defaults are independent schema expressions and must follow the same contract.
-- SET DEFAULT affects future inserts only; authored revisions remain unchanged.
alter table public.cardforge_contributor_asset_submissions
  alter column calculated_access_tier set default 'contributor',
  alter column automated_access_tier set default 'contributor';

alter table public.cardforge_pipeline_template_assets
  alter column storage_bucket set default 'cardforge-contributor-assets';

-- The official-tier retirement mapped official to free; library_source still
-- independently records official authorship. Complete that default cutover too.
alter table public.cardforge_asset_registry
  alter column access_tier set default 'free';

commit;
