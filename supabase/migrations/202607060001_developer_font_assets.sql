alter table public.cardforge_developer_asset_submissions
  drop constraint if exists cardforge_developer_asset_submissions_asset_type_check;

alter table public.cardforge_developer_asset_submissions
  add constraint cardforge_developer_asset_submissions_asset_type_check
  check (asset_type in ('templates', 'elementPresets', 'textures', 'dividers', 'icons', 'imageAssets', 'parts', 'fonts'));

alter table public.cardforge_asset_registry
  drop constraint if exists cardforge_asset_registry_asset_type_check;

alter table public.cardforge_asset_registry
  add constraint cardforge_asset_registry_asset_type_check
  check (asset_type in ('texture', 'divider', 'part', 'icon', 'image', 'template', 'elementPreset', 'font'));
