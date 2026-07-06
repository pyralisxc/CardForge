do $$
begin
  alter table public.cardforge_asset_registry
    drop constraint if exists cardforge_asset_registry_asset_type_check;
end $$;

alter table public.cardforge_asset_registry
  add constraint cardforge_asset_registry_asset_type_check
  check (asset_type in ('texture', 'divider', 'part', 'icon', 'image', 'template', 'elementPreset'));

create index if not exists cardforge_asset_registry_status_updated_idx
  on public.cardforge_asset_registry (status, updated_at desc);
