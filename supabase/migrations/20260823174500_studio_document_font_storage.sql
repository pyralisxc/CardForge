insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'cardforge-studio-document-fonts',
  'cardforge-studio-document-fonts',
  false,
  16777216,
  array[
    'font/woff2',
    'font/woff',
    'font/ttf',
    'font/otf',
    'application/font-woff',
    'application/x-font-ttf',
    'application/x-font-opentype'
  ]::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

comment on column public.cardforge_studio_documents.document_payload is
  'Canonical editable CardForge project document. Private raster artwork and personal font files are content-addressed in dedicated private Storage buckets and represented here by stable CardForge Studio asset references.';

create or replace function public.cardforge_studio_document_asset_bytes(
  p_owner_user_id text,
  p_document_id uuid
)
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(pg_catalog.sum(
    ((object.metadata ->> 'size')::bigint)
  ), 0::bigint)::bigint
  from storage.objects as object
  where object.bucket_id in (
      'cardforge-studio-document-assets',
      'cardforge-studio-document-fonts'
    )
    and pg_catalog.left(
      object.name,
      pg_catalog.char_length(p_owner_user_id || '/' || p_document_id::text || '/')
    ) = p_owner_user_id || '/' || p_document_id::text || '/';
$$;

revoke execute on function public.cardforge_studio_document_asset_bytes(text, uuid)
  from public, anon, authenticated;
grant execute on function public.cardforge_studio_document_asset_bytes(text, uuid)
  to service_role;

comment on function public.cardforge_studio_document_asset_bytes(text, uuid) is
  'Counts private content-addressed artwork and font bytes for one account-owned Studio document so MCP storage usage remains accurate.';
