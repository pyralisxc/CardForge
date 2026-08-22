alter table public.cardforge_owner_settings
  add column if not exists studio_default_template_id text;

alter table public.cardforge_owner_settings
  add constraint cardforge_owner_settings_studio_default_template_id_check
  check (
    studio_default_template_id is null
    or char_length(btrim(studio_default_template_id)) between 1 and 200
  );
