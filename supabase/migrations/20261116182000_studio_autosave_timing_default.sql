alter table public.cardforge_owner_settings
  add column studio_autosave_delay_seconds integer not null default 15
  constraint cardforge_owner_settings_studio_autosave_delay_check
  check (studio_autosave_delay_seconds in (5, 15, 30, 60));
