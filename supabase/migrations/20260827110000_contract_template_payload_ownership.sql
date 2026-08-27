begin;

set local lock_timeout = '5s';

-- The submission-owned runtime is production READY and all legacy media has been
-- externalized. Remove the one-release projection rather than preserving a second
-- Template document owner indefinitely.
drop trigger if exists cardforge_asset_registry_preserve_template_runtime_compatibility
  on public.cardforge_asset_registry;
drop function if exists public.cardforge_preserve_template_registry_runtime_compatibility();

update public.cardforge_asset_registry
set metadata = metadata - 'template' - 'payload'
where asset_type = 'template'
  and (metadata ? 'template' or metadata ? 'payload');

alter table public.cardforge_asset_registry
  drop constraint if exists cardforge_registry_does_not_clone_template_payload;
alter table public.cardforge_asset_registry
  add constraint cardforge_registry_does_not_clone_template_payload
  check (
    asset_type <> 'template'
    or (
      not (coalesce(metadata, '{}'::jsonb) ? 'template')
      and not (coalesce(metadata, '{}'::jsonb) ? 'payload')
    )
  ) not valid;
alter table public.cardforge_asset_registry
  validate constraint cardforge_registry_does_not_clone_template_payload;

alter table public.cardforge_developer_asset_submissions
  validate constraint cardforge_template_payload_has_no_embedded_media;

create or replace function public.cardforge_default_studio_destinations(
  p_asset_type text,
  p_metadata jsonb
)
returns text[]
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
    when p_asset_type = 'image'
      and p_metadata ->> 'studioDefaultDestination' in ('image.picture', 'image.frame.front', 'image.frame.back')
      then array[p_metadata ->> 'studioDefaultDestination']::text[]
    when p_asset_type = 'template'
      and p_metadata ->> 'templateUsage' = 'back-preset'
      then array['template.back']::text[]
    when p_asset_type = 'template' then array['template.front']::text[]
    when p_asset_type = 'image' then array['image.picture']::text[]
    when p_asset_type = 'texture' then array['appearance.texture']::text[]
    when p_asset_type = 'divider' then array['element.divider']::text[]
    when p_asset_type = 'icon' then array['element.icon']::text[]
    when p_asset_type = 'font' then array['typography.font']::text[]
    when p_asset_type = 'elementPreset' then case coalesce(
      p_metadata -> 'style' ->> 'kind',
      p_metadata -> 'elementPreset' ->> 'kind',
      p_metadata -> 'payload' ->> 'kind',
      'material'
    )
      when 'border' then array['style.border']::text[]
      when 'textFrame' then array['style.textFrame']::text[]
      when 'shapeRole' then array['style.shape']::text[]
      when 'divider' then array['style.divider']::text[]
      when 'icon' then array['style.icon']::text[]
      else array['style.material']::text[]
    end
    else '{}'::text[]
  end;
$$;

comment on column public.cardforge_asset_registry.developer_submission_id is
  'Pointer to the active immutable revision; registry metadata is constrained against cloning Template payloads.';
comment on function public.cardforge_default_studio_destinations(text, jsonb) is
  'Resolves Studio routing from compact registry metadata; Template documents remain submission-owned.';

commit;
