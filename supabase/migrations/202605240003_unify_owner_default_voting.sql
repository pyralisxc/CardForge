update public.cardforge_developer_asset_submissions
set owner_access_tier_override = null
where developer_id = 'cardforge-official'
  and owner_access_tier_override = 'official';
