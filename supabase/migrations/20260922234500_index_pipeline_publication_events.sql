begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create index if not exists cardforge_pipeline_publication_events_lineage_idx
  on public.cardforge_pipeline_publication_events (lineage_id, published_at desc);

commit;
