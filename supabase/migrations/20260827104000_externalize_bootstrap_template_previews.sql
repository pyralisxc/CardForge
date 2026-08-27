begin;

set local lock_timeout = '5s';

-- These are generated sample placeholders, not authored user media. Replace them
-- deterministically without creating managed objects for a transparent pixel or
-- static repository-owned sample marks.
update public.cardforge_developer_asset_submissions
set source_payload = pg_catalog.replace(
  source_payload::text,
  '"data:image/gif;base64,R0lGODlhAQABAAAAACw="',
  '""'
)::jsonb
where asset_type = 'templates'
  and source_payload::text like '%data:image/gif;base64,R0lGODlhAQABAAAAACw=%';

update public.cardforge_developer_asset_submissions
set source_payload = pg_catalog.jsonb_set(
  source_payload,
  '{templatePreviewData,CompanyLogo}',
  pg_catalog.to_jsonb('/card-assets/images/default-company-logo.svg'::text),
  true
)
where asset_type = 'templates'
  and source_payload ->> 'id' = 'default-name-card-theme';

update public.cardforge_developer_asset_submissions
set source_payload = pg_catalog.jsonb_set(
  source_payload,
  '{templatePreviewData,EventLogo}',
  pg_catalog.to_jsonb('/card-assets/images/default-event-logo.svg'::text),
  true
)
where asset_type = 'templates'
  and source_payload ->> 'id' = 'default-event-badge-theme';

update public.cardforge_developer_asset_submissions
set source_file_size_bytes = pg_catalog.octet_length(
  pg_catalog.convert_to(source_payload::text, 'UTF8')
)
where asset_type = 'templates'
  and source_payload is not null;

-- Keep the temporary old-runtime projection byte-identical to its authoritative
-- submission during this one-release compatibility window.
update public.cardforge_asset_registry as registry
set metadata = registry.metadata || pg_catalog.jsonb_build_object('template', submission.source_payload)
from public.cardforge_developer_asset_submissions as submission
where registry.asset_type = 'template'
  and registry.developer_submission_id = submission.id
  and pg_catalog.jsonb_typeof(submission.source_payload) = 'object';

commit;
