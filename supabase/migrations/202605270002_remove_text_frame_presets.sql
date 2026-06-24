delete from public.cardforge_asset_registry
where asset_id in (
  'frame-gilded-relic-premium',
  'frame-mtg-rules',
  'frame-ttrpg-vellum-premium'
);

delete from public.cardforge_developer_asset_submissions
where asset_id in (
  'frame-gilded-relic-premium',
  'frame-mtg-rules',
  'frame-ttrpg-vellum-premium'
);
