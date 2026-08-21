begin;

alter table public.cardforge_owner_settings
  add column if not exists presentation_palette text not null default 'forge'
    check (presentation_palette in ('forge', 'obsidian', 'slate')),
  add column if not exists presentation_accent text not null default 'brass'
    check (presentation_accent in ('brass', 'ember', 'arcane')),
  add column if not exists presentation_corners text not null default 'subtle'
    check (presentation_corners in ('square', 'subtle', 'soft')),
  add column if not exists presentation_contrast text not null default 'standard'
    check (presentation_contrast in ('standard', 'high'));

comment on column public.cardforge_owner_settings.presentation_palette is
  'Validated global CardForge presentation palette. Structural behavior remains code-owned.';
comment on column public.cardforge_owner_settings.presentation_accent is
  'Validated global CardForge accent profile.';
comment on column public.cardforge_owner_settings.presentation_corners is
  'Validated global CardForge corner profile.';
comment on column public.cardforge_owner_settings.presentation_contrast is
  'Validated global CardForge contrast profile.';

commit;
