-- CardForge reaches the Data API only through its server-side service-role client.
-- Keep RLS enabled as defense in depth, and remove browser-role object access so a
-- future policy cannot accidentally expose production tables.
revoke usage on schema public from public, anon, authenticated;
grant usage on schema public to service_role;

revoke all privileges on all tables in schema public from public, anon, authenticated;
revoke all privileges on all sequences in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

-- Require future database objects to opt in to browser access explicitly.
alter default privileges for role postgres in schema public
  revoke all on tables from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated, service_role;

-- Mirror CardForge's existing per-upload policy at the Storage boundary. This is
-- independent from the Supabase plan's total storage quota.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'cardforge-developer-assets',
  'cardforge-developer-assets',
  true,
  10485760,
  array[
    'image/svg+xml',
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/json',
    'font/woff2',
    'font/woff',
    'font/ttf',
    'font/otf',
    'application/font-woff',
    'application/x-font-ttf',
    'application/x-font-otf',
    'application/octet-stream'
  ]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
