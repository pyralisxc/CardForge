alter table public.cardforge_personal_library_items
  add column if not exists provider_resource_key text;

alter table public.cardforge_personal_library_items
  drop constraint if exists cardforge_personal_library_provider_resource_key_check;

alter table public.cardforge_personal_library_items
  add constraint cardforge_personal_library_provider_resource_key_check
  check (
    provider_resource_key is null
    or (
      char_length(btrim(provider_resource_key)) between 1 and 255
      and provider_resource_key !~ '[[:cntrl:]]'
    )
  );

comment on column public.cardforge_personal_library_items.provider_resource_key is
  'Optional Google Drive resource key for an explicitly Picker-authorized personal-library file. Provider metadata only; not an OAuth credential.';
