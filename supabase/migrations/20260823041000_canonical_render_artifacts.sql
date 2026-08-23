insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'cardforge-render-artifacts',
  'cardforge-render-artifacts',
  false,
  16777216,
  array['image/png']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

comment on table public.cardforge_studio_documents is
  'Private revisioned CardForge working documents. Canonical browser-rendered derivatives are cached separately in cardforge-render-artifacts and keyed by source revision plus renderer contract version.';
