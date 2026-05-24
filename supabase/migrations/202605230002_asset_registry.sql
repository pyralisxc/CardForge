create table if not exists public.cardforge_asset_registry (
  asset_id text primary key,
  name text not null,
  asset_type text not null check (asset_type in ('texture', 'divider', 'part')),
  url text not null,
  preview_url text,
  status text not null default 'published' check (status in ('draft', 'submitted', 'voting', 'publish_candidate', 'published', 'archived', 'rejected')),
  access_tier text not null default 'official' check (access_tier in ('hidden', 'free', 'paid', 'developer', 'official')),
  library_source text not null default 'official' check (library_source in ('official', 'developer')),
  developer_submission_id uuid references public.cardforge_developer_asset_submissions(id) on delete set null,
  storage_bucket text,
  storage_path text,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cardforge_asset_registry_type_status_idx
  on public.cardforge_asset_registry (asset_type, status, access_tier, name);

create index if not exists cardforge_asset_registry_source_idx
  on public.cardforge_asset_registry (library_source, updated_at desc);

drop trigger if exists cardforge_asset_registry_touch_updated_at on public.cardforge_asset_registry;
create trigger cardforge_asset_registry_touch_updated_at
  before update on public.cardforge_asset_registry
  for each row
  execute function public.cardforge_touch_updated_at();

alter table public.cardforge_asset_registry enable row level security;

insert into public.cardforge_asset_registry (asset_id, name, asset_type, url, access_tier, library_source, file_size_bytes, metadata)
values
  ('parchment-grain', 'Parchment Grain', 'texture', '/card-assets/textures/parchment-grain.svg', 'official', 'official', 553, '{"tileMode":"repeat","seamless":true,"allowedTargets":["text","shape","template"],"defaultBlendMode":"multiply","defaultOpacity":42,"defaultScale":160}'::jsonb),
  ('dark-leather', 'Dark Leather', 'texture', '/card-assets/textures/dark-leather.svg', 'official', 'official', 497, '{"tileMode":"repeat","seamless":true,"allowedTargets":["text","shape","template"],"defaultBlendMode":"overlay","defaultOpacity":46,"defaultScale":180}'::jsonb),
  ('hammered-metal', 'Hammered Metal Surface', 'texture', '/card-assets/textures/hammered-metal.svg', 'official', 'official', 684, '{"tileMode":"contain","seamless":false,"allowedTargets":["shape","template"],"defaultBlendMode":"overlay","defaultOpacity":40,"defaultScale":150}'::jsonb),
  ('purple-foil', 'Purple Foil Surface', 'texture', '/card-assets/textures/purple-foil.svg', 'official', 'official', 557, '{"tileMode":"contain","seamless":false,"allowedTargets":["shape","template"],"defaultBlendMode":"screen","defaultOpacity":44,"defaultScale":190}'::jsonb),
  ('arcane-hatch', 'Arcane Hatch', 'texture', '/card-assets/textures/arcane-hatch.svg', 'official', 'official', 516, '{"tileMode":"repeat","seamless":true,"allowedTargets":["text","shape","template"],"defaultBlendMode":"soft-light","defaultOpacity":54,"defaultScale":140}'::jsonb),
  ('ink-wash', 'Ink Wash Surface', 'texture', '/card-assets/textures/ink-wash.svg', 'official', 'official', 471, '{"tileMode":"contain","seamless":false,"allowedTargets":["shape","template"],"defaultBlendMode":"multiply","defaultOpacity":34,"defaultScale":170}'::jsonb),
  ('stone-grain', 'Stone Grain', 'texture', '/card-assets/textures/stone-grain.svg', 'official', 'official', 533, '{"tileMode":"repeat","seamless":true,"allowedTargets":["text","shape","template"],"defaultBlendMode":"overlay","defaultOpacity":42,"defaultScale":160}'::jsonb),
  ('worn-paper', 'Worn Paper', 'texture', '/card-assets/textures/worn-paper.svg', 'official', 'official', 563, '{"tileMode":"repeat","seamless":true,"allowedTargets":["text","shape","template"],"defaultBlendMode":"multiply","defaultOpacity":38,"defaultScale":170}'::jsonb),
  ('arcane-forge-astral-paper', 'Astral Paper', 'texture', '/card-assets/textures/arcane-forge/astral-paper.svg', 'official', 'official', 1221, '{"tileMode":"repeat","seamless":true,"allowedTargets":["text","shape","template"],"defaultBlendMode":"soft-light","defaultOpacity":48,"defaultScale":180}'::jsonb),
  ('arcane-forge-back-obsidian-neon-premium', 'Back Obsidian Neon Premium', 'texture', '/card-assets/textures/arcane-forge/back-obsidian-neon-premium.webp', 'official', 'official', 721550, '{"tileMode":"contain","seamless":false,"allowedTargets":["template"],"defaultBlendMode":"normal","defaultOpacity":100,"defaultScale":100}'::jsonb),
  ('arcane-forge-ember-leather', 'Ember Leather', 'texture', '/card-assets/textures/arcane-forge/ember-leather.svg', 'official', 'official', 1135, '{"tileMode":"repeat","seamless":true,"allowedTargets":["text","shape","template"],"defaultBlendMode":"overlay","defaultOpacity":46,"defaultScale":180}'::jsonb),
  ('arcane-forge-forged-parchment', 'Forged Parchment', 'texture', '/card-assets/textures/arcane-forge/forged-parchment.svg', 'official', 'official', 1464, '{"tileMode":"repeat","seamless":true,"allowedTargets":["text","shape","template"],"defaultBlendMode":"multiply","defaultOpacity":52,"defaultScale":220}'::jsonb),
  ('arcane-forge-frame-creature-premium', 'Frame Creature Premium', 'texture', '/card-assets/textures/arcane-forge/frame-creature-premium.webp', 'official', 'official', 646882, '{"tileMode":"contain","seamless":false,"allowedTargets":["template"],"defaultBlendMode":"normal","defaultOpacity":100,"defaultScale":100}'::jsonb),
  ('arcane-forge-frame-playing-premium', 'Frame Playing Premium', 'texture', '/card-assets/textures/arcane-forge/frame-playing-premium.webp', 'official', 'official', 766268, '{"tileMode":"contain","seamless":false,"allowedTargets":["template"],"defaultBlendMode":"normal","defaultOpacity":100,"defaultScale":100}'::jsonb),
  ('arcane-forge-frame-ttrpg-premium', 'Frame TTRPG Premium', 'texture', '/card-assets/textures/arcane-forge/frame-ttrpg-premium.webp', 'official', 'official', 714104, '{"tileMode":"contain","seamless":false,"allowedTargets":["template"],"defaultBlendMode":"normal","defaultOpacity":100,"defaultScale":100}'::jsonb),
  ('arcane-forge-guild-slate', 'Guild Slate', 'texture', '/card-assets/textures/arcane-forge/guild-slate.svg', 'official', 'official', 1155, '{"tileMode":"repeat","seamless":true,"allowedTargets":["text","shape","template"],"defaultBlendMode":"overlay","defaultOpacity":42,"defaultScale":160}'::jsonb),
  ('arcane-forge-obsidian-vellum', 'Obsidian Vellum', 'texture', '/card-assets/textures/arcane-forge/obsidian-vellum.svg', 'official', 'official', 1384, '{"tileMode":"repeat","seamless":true,"allowedTargets":["text","shape","template"],"defaultBlendMode":"overlay","defaultOpacity":58,"defaultScale":240}'::jsonb),
  ('arcane-forge-rune-metal', 'Rune Metal', 'texture', '/card-assets/textures/arcane-forge/rune-metal.svg', 'official', 'official', 1249, '{"tileMode":"repeat","seamless":true,"allowedTargets":["text","shape","template"],"defaultBlendMode":"overlay","defaultOpacity":42,"defaultScale":180}'::jsonb),
  ('gilded-filigree', 'Gilded Filigree', 'divider', '/card-assets/dividers/gilded-filigree.svg', 'official', 'official', 494, '{"tileMode":"stretch","seamless":false,"allowedTargets":["divider"],"defaultBlendMode":"normal","defaultOpacity":100,"defaultScale":100}'::jsonb),
  ('gem-center', 'Gem Center', 'divider', '/card-assets/dividers/gem-center.svg', 'official', 'official', 459, '{"tileMode":"stretch","seamless":false,"allowedTargets":["divider"],"defaultBlendMode":"normal","defaultOpacity":100,"defaultScale":100}'::jsonb),
  ('runic-thread', 'Runic Thread', 'divider', '/card-assets/dividers/runic-thread.svg', 'official', 'official', 437, '{"tileMode":"stretch","seamless":false,"allowedTargets":["divider"],"defaultBlendMode":"normal","defaultOpacity":100,"defaultScale":100}'::jsonb),
  ('double-rule', 'Double Rule', 'divider', '/card-assets/dividers/double-rule.svg', 'official', 'official', 432, '{"tileMode":"stretch","seamless":false,"allowedTargets":["divider"],"defaultBlendMode":"normal","defaultOpacity":100,"defaultScale":100}'::jsonb),
  ('vine-rule', 'Vine Rule', 'divider', '/card-assets/dividers/vine-rule.svg', 'official', 'official', 408, '{"tileMode":"stretch","seamless":false,"allowedTargets":["divider"],"defaultBlendMode":"normal","defaultOpacity":100,"defaultScale":100}'::jsonb),
  ('arcane-chevron', 'Arcane Chevron', 'divider', '/card-assets/dividers/arcane-chevron.svg', 'official', 'official', 450, '{"tileMode":"stretch","seamless":false,"allowedTargets":["divider"],"defaultBlendMode":"normal","defaultOpacity":100,"defaultScale":100}'::jsonb),
  ('arcane-forge-corner-flourish', 'Corner Flourish', 'divider', '/card-assets/dividers/arcane-forge/corner-flourish.svg', 'official', 'official', 831, '{"tileMode":"stretch","seamless":false,"allowedTargets":["divider"],"defaultBlendMode":"normal","defaultOpacity":100,"defaultScale":100}'::jsonb),
  ('arcane-forge-gilded-title-plate', 'Gilded Title Plate', 'divider', '/card-assets/dividers/arcane-forge/gilded-title-plate.svg', 'official', 'official', 1119, '{"tileMode":"stretch","seamless":false,"allowedTargets":["divider"],"defaultBlendMode":"normal","defaultOpacity":100,"defaultScale":100}'::jsonb),
  ('arcane-forge-mana-gem-rule', 'Mana Gem Rule', 'divider', '/card-assets/dividers/arcane-forge/mana-gem-rule.svg', 'official', 'official', 1124, '{"tileMode":"stretch","seamless":false,"allowedTargets":["divider"],"defaultBlendMode":"normal","defaultOpacity":100,"defaultScale":100}'::jsonb),
  ('arcane-forge-neon-sigil-divider', 'Neon Sigil Divider', 'divider', '/card-assets/dividers/arcane-forge/neon-sigil-divider.svg', 'official', 'official', 1184, '{"tileMode":"stretch","seamless":false,"allowedTargets":["divider"],"defaultBlendMode":"normal","defaultOpacity":100,"defaultScale":100}'::jsonb),
  ('arcane-forge-rune-rule-separator', 'Rune Rule Separator', 'divider', '/card-assets/dividers/arcane-forge/rune-rule-separator.svg', 'official', 'official', 978, '{"tileMode":"stretch","seamless":false,"allowedTargets":["divider"],"defaultBlendMode":"normal","defaultOpacity":100,"defaultScale":100}'::jsonb),
  ('arcane-forge-stat-rail', 'Stat Rail', 'divider', '/card-assets/dividers/arcane-forge/stat-rail.svg', 'official', 'official', 900, '{"tileMode":"stretch","seamless":false,"allowedTargets":["divider"],"defaultBlendMode":"normal","defaultOpacity":100,"defaultScale":100}'::jsonb)
on conflict (asset_id) do update
set
  name = excluded.name,
  asset_type = excluded.asset_type,
  url = excluded.url,
  access_tier = excluded.access_tier,
  library_source = excluded.library_source,
  file_size_bytes = excluded.file_size_bytes,
  metadata = excluded.metadata;

create or replace function public.cardforge_database_metrics()
returns table (
  database_size_bytes bigint,
  cardforge_table_size_bytes bigint,
  storage_size_bytes bigint,
  asset_registry_count bigint,
  developer_submission_count bigint,
  founder_beta_claim_count bigint
)
language sql
stable
set search_path = public, pg_catalog, storage
as $$
  select
    pg_database_size(current_database())::bigint as database_size_bytes,
    coalesce((
      select sum(pg_total_relation_size(format('%I.%I', schemaname, tablename)::regclass))::bigint
      from pg_tables
      where schemaname = 'public'
        and tablename like 'cardforge_%'
    ), 0)::bigint as cardforge_table_size_bytes,
    coalesce((
      select sum(
        case
          when metadata ? 'size' and (metadata->>'size') ~ '^[0-9]+$'
            then (metadata->>'size')::bigint
          else 0
        end
      )::bigint
      from storage.objects
    ), 0)::bigint as storage_size_bytes,
    (select count(*)::bigint from public.cardforge_asset_registry) as asset_registry_count,
    (select count(*)::bigint from public.cardforge_developer_asset_submissions) as developer_submission_count,
    (select count(*)::bigint from public.cardforge_founder_beta_claims) as founder_beta_claim_count;
$$;

revoke all on function public.cardforge_database_metrics() from public;
revoke all on function public.cardforge_database_metrics() from anon;
revoke all on function public.cardforge_database_metrics() from authenticated;
grant execute on function public.cardforge_database_metrics() to service_role;
