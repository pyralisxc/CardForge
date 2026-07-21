-- The owner console uses the server-only Supabase service role for site media.
-- Keep public roles ungranted; RLS remains enabled on this table.
grant select, insert, update on table public.cardforge_site_media to service_role;
